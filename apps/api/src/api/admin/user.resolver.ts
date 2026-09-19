import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UsersService } from '../../users/users.service';
import { PasswordService } from '../../auth/password.service';
import { InviteService } from '../../auth/invite.service';
import { GqlThrottlerGuard } from '../../auth/gql-throttler.guard';
import { Public } from '../../auth/public.decorator';
import { UserStatus } from '../../users/entities/user.entity';
import type { User } from '../../users/entities/user.entity';
import { CurrentUser } from '../../auth/current-user.decorator';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { UserModel } from '../models/user.model';
import { toUserModel } from '../models/mappers';

@InputType()
export class CreateUserInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsString()
  @MinLength(6)
  password!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => UserStatus, { nullable: true })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;
}

/** User management (`user:manage`). Users are global (not tenant-scoped);
 *  site access is granted separately via memberships (see SiteResolver). */
@Resolver(() => UserModel)
export class UserResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwords: PasswordService,
    private readonly invites: InviteService,
  ) {}

  /** Only a super-admin may grant/hold the instance-wide super-admin flag —
   *  otherwise any `user:manage` holder could self-promote to full control. */
  private assertMaySetSuperAdmin(actor: User, requested?: boolean): void {
    if (requested && !actor.isSuperAdmin) {
      throw new ForbiddenException(
        'Only a super-admin can grant super-admin access.',
      );
    }
  }

  /** A non-super-admin may not modify (update / reset password / delete) a
   *  super-admin account — that would be a takeover path. */
  private async assertMayModify(actor: User, targetId: string): Promise<User> {
    const target = await this.usersService.findById(targetId);
    if (!target) throw new NotFoundException('User not found.');
    if (target.isSuperAdmin && !actor.isSuperAdmin) {
      throw new ForbiddenException('You cannot modify a super-admin account.');
    }
    return target;
  }

  @Query(() => [UserModel])
  @RequireCapability(Capabilities.User.Manage)
  async users(): Promise<UserModel[]> {
    return (await this.usersService.list()).map(toUserModel);
  }

  @Mutation(() => UserModel)
  @RequireCapability(Capabilities.User.Manage)
  async createUser(
    @Args('input') input: CreateUserInput,
    @CurrentUser() actor: User,
  ): Promise<UserModel> {
    this.assertMaySetSuperAdmin(actor, input.isSuperAdmin);
    if (await this.usersService.findByEmail(input.email)) {
      throw new BadRequestException(`A user with email "${input.email}" already exists.`);
    }
    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.usersService.create({
      email: input.email,
      name: input.name,
      passwordHash,
      isSuperAdmin: input.isSuperAdmin ?? false,
      status: UserStatus.Active,
    });
    return toUserModel(user);
  }

  /**
   * Invite a user by email: creates the account with a random, unusable
   * password and emails them a link to set their own. The user appears in the
   * list as "Invited" until they accept via {@link acceptInvite}.
   */
  @Mutation(() => UserModel)
  @RequireCapability(Capabilities.User.Manage)
  async inviteUser(
    @Args('email') email: string,
    @Args('name') name: string,
    @CurrentUser() actor: User,
    @Args('isSuperAdmin', { type: () => Boolean, nullable: true })
    isSuperAdmin?: boolean,
  ): Promise<UserModel> {
    this.assertMaySetSuperAdmin(actor, isSuperAdmin);
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException(
        `A user with email "${email}" already exists.`,
      );
    }
    const user = await this.usersService.create({
      email,
      name,
      passwordHash: await this.invites.randomPasswordHash(),
      isSuperAdmin: isSuperAdmin ?? false,
      status: UserStatus.Invited,
    });
    await this.invites.sendInvite(user);
    return toUserModel(user);
  }

  /**
   * Public: an invited user redeems their emailed token to set a password and
   * activate their account. Token is verified for validity, expiry and the
   * `invite` purpose.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(GqlThrottlerGuard)
  @Mutation(() => Boolean)
  acceptInvite(
    @Args('token') token: string,
    @Args('password') password: string,
  ): Promise<boolean> {
    return this.invites.acceptInvite(token, password);
  }

  @Mutation(() => UserModel)
  @RequireCapability(Capabilities.User.Manage)
  async updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
    @CurrentUser() actor: User,
  ): Promise<UserModel> {
    this.assertMaySetSuperAdmin(actor, input.isSuperAdmin);
    await this.assertMayModify(actor, id);
    return toUserModel(await this.usersService.update(id, input));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.User.Manage)
  async setUserPassword(
    @Args('id', { type: () => ID }) id: string,
    @Args('password') password: string,
    @CurrentUser() actor: User,
  ): Promise<boolean> {
    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters.');
    }
    await this.assertMayModify(actor, id);
    await this.usersService.updatePassword(id, await this.passwords.hash(password));
    return true;
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.User.Manage)
  async deleteUser(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() actor: User,
  ): Promise<boolean> {
    if (id === actor.id) {
      throw new BadRequestException('You cannot delete your own account.');
    }
    await this.assertMayModify(actor, id);
    await this.usersService.delete(id);
    return true;
  }
}

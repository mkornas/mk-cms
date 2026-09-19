import { Args, Field, InputType, Mutation, Resolver } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { UsersService } from '../../users/users.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { User } from '../../users/entities/user.entity';
import { UserModel } from '../models/user.model';
import { toUserModel } from '../models/mappers';

/** Self-service profile edits: the caller's own display name and/or avatar. */
@InputType()
export class UpdateProfileInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  /** Pass an http(s) URL to set the avatar, or `null` to clear it. */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(1024)
  // Only http(s) — blocks `javascript:` / `data:` URLs. `null` clears; empty
  // string is allowed and also clears.
  @Matches(/^(https?:\/\/|)$|^https?:\/\/\S+$/, {
    message: 'avatarUrl must be an http(s) URL.',
  })
  avatarUrl?: string | null;
}

/**
 * Self-service profile resolver. Every authenticated user may edit THEIR OWN
 * name and avatar here — no capability required (the global JwtAuthGuard already
 * gates it, and {@link CurrentUser} scopes the write to the caller). This is
 * deliberately distinct from {@link UserResolver}, which is `user:manage`-gated
 * and edits *other* users.
 */
@Resolver(() => UserModel)
export class ProfileResolver {
  constructor(private readonly users: UsersService) {}

  @Mutation(() => UserModel)
  async updateProfile(
    @Args('input') input: UpdateProfileInput,
    @CurrentUser() user: User,
  ): Promise<UserModel> {
    const updated = await this.users.updateProfile(user.id, {
      name: input.name,
      avatarUrl: input.avatarUrl,
    });
    return toUserModel(updated);
  }
}

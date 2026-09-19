import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../../auth/auth.service';
import { Public } from '../../auth/public.decorator';
import { GqlThrottlerGuard } from '../../auth/gql-throttler.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { MembershipsService } from '../../rbac/memberships.service';
import type { User } from '../../users/entities/user.entity';
import { AuthTokensModel } from '../models/auth.model';
import { SiteMembershipModel, UserModel } from '../models/user.model';
import { toUserModel } from '../models/mappers';

/** Authentication + identity. Login/refresh are public; the rest require a
 * valid access token (enforced by the global JwtAuthGuard). */
@Resolver()
export class AuthResolver {
  constructor(
    private readonly auth: AuthService,
    private readonly memberships: MembershipsService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(GqlThrottlerGuard)
  @Mutation(() => AuthTokensModel)
  login(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<AuthTokensModel> {
    return this.auth.login(email, password);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(GqlThrottlerGuard)
  @Mutation(() => AuthTokensModel)
  refresh(
    @Args('refreshToken') refreshToken: string,
  ): Promise<AuthTokensModel> {
    return this.auth.refresh(refreshToken);
  }

  /** The authenticated identity (no active site required). */
  @Query(() => UserModel)
  me(@CurrentUser() user: User): UserModel {
    return toUserModel(user);
  }

  /** Every site the caller can access, with their role on each. */
  @Query(() => [SiteMembershipModel])
  async mySites(@CurrentUser() user: User): Promise<SiteMembershipModel[]> {
    const memberships = await this.memberships.listForUser(user.id);
    return memberships.map((m) => ({
      siteId: m.siteId,
      siteSlug: m.site?.slug ?? null,
      siteName: m.site?.name ?? null,
      role: m.role?.slug ?? null,
    }));
  }
}

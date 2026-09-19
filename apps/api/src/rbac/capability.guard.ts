import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { MembershipsService } from './memberships.service';
import { can } from './capabilities';
import { REQUIRE_CAPABILITY_KEY } from './require-capability.decorator';

/**
 * Global authorization guard. For handlers annotated with
 * {@link RequireCapability}, it verifies the current user has every required
 * capability *on the active site*. Runs after the auth guard (user set) and
 * tenant guard (site set).
 *
 * Super-admins bypass the check entirely.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenant: TenantContextService,
    private readonly memberships: MembershipsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRE_CAPABILITY_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const user = this.tenant.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (user.isSuperAdmin) return true;

    const siteId = this.tenant.requireSiteId();
    const granted = await this.memberships.capabilitiesFor(user.id, siteId);

    const missing = required.filter((cap) => !can(granted, cap));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing capability: ${missing.join(', ')} on this site.`,
      );
    }
    return true;
  }
}

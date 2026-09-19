import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentSite } from '../tenancy/current-site.decorator';
import { RequireCapability } from '../rbac/require-capability.decorator';
import { Capabilities } from '../rbac/capabilities';
import { MembershipsService } from '../rbac/memberships.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import type { User } from '../users/entities/user.entity';
import type { Site } from '../tenancy/entities/site.entity';

/**
 * Thin endpoints that exercise the P1 auth/tenant/RBAC stack end-to-end.
 * These become GraphQL resolvers in P3.
 */
@Controller('me')
export class MeController {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly tenant: TenantContextService,
  ) {}

  /** Every site the authenticated user can access, with their role. */
  @Get('sites')
  async sites(@CurrentUser() user: User) {
    const memberships = await this.memberships.listForUser(user.id);
    return memberships.map((m) => ({
      siteId: m.siteId,
      siteSlug: m.site?.slug,
      siteName: m.site?.name,
      role: m.role?.slug,
    }));
  }

  /**
   * Requires an active site (x-site header) AND the content:read capability on
   * it. Returns the caller's effective capabilities — proof the whole chain
   * (auth → tenant → capability) resolved.
   */
  @Get('whoami')
  @RequireCapability(Capabilities.Content.Read)
  async whoami(@CurrentUser() user: User, @CurrentSite() site?: Site) {
    const capabilities = await this.memberships.capabilitiesFor(
      user.id,
      this.tenant.requireSiteId(),
    );
    return {
      user: { id: user.id, email: user.email },
      site: site ? { id: site.id, slug: site.slug } : null,
      capabilities,
    };
  }
}

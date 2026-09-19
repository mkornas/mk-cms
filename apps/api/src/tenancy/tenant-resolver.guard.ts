import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { TenantContextService } from './tenant-context.service';
import { requestFromContext } from '../graphql/gql-request';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Global guard that resolves the active site and stores it in the request
 * context. Non-blocking by design: it resolves when it can and always returns
 * true. Routes that truly need a tenant enforce it by calling
 * {@link TenantContextService.requireSiteId} (directly or via a scoped repo).
 *
 * Resolution order:
 *   1. explicit `x-site` header (slug, then id) — a bad value is a hard 404
 *   2. request host (`x-forwarded-host` / `host`) matched against site.domains
 */
@Injectable()
export class TenantResolverGuard implements CanActivate {
  constructor(
    private readonly sites: SitesService,
    private readonly tenant: TenantContextService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = requestFromContext(ctx);

    const explicit = this.headerValue(req.headers['x-site']);
    if (explicit) {
      const site =
        (await this.sites.findBySlug(explicit)) ??
        (UUID_RE.test(explicit) ? await this.sites.findById(explicit) : null);
      if (!site) {
        throw new NotFoundException(`Unknown site "${explicit}"`);
      }
      this.tenant.setSite(site);
      return true;
    }

    const host = this.headerValue(
      req.headers['x-forwarded-host'] ?? req.headers.host,
    );
    if (host) {
      const site = await this.sites.findByDomain(host.split(':')[0]);
      if (site) this.tenant.setSite(site);
    }

    return true;
  }

  private headerValue(v: string | string[] | undefined): string | undefined {
    if (!v) return undefined;
    return (Array.isArray(v) ? v[0] : v).trim() || undefined;
  }
}

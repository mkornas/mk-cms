import { BadRequestException, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { AppClsStore } from './cls-store';
import type { Site } from './entities/site.entity';
import type { User } from '../users/entities/user.entity';

/**
 * The single, safe way to read "who am I and which site am I acting on" for the
 * current request. Singleton, backed by AsyncLocalStorage — so it works from
 * any service without making the DI graph request-scoped.
 *
 * Tenant-scoped services MUST derive `siteId` from here (via
 * {@link requireSiteId}) rather than trusting a client-supplied id, so a caller
 * can never read or write another tenant's rows.
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService<AppClsStore>) {}

  get site(): Site | undefined {
    return this.cls.get('site');
  }

  get siteId(): string | undefined {
    return this.cls.get('siteId');
  }

  /** The active site id, or a 400 if no tenant was resolved for this request. */
  requireSiteId(): string {
    const id = this.siteId;
    if (!id) {
      throw new BadRequestException(
        'No active site. Provide an "x-site" header (site slug or id) or a known host.',
      );
    }
    return id;
  }

  setSite(site: Site): void {
    this.cls.set('site', site);
    this.cls.set('siteId', site.id);
  }

  get user(): User | undefined {
    return this.cls.get('user');
  }

  get userId(): string | undefined {
    return this.cls.get('userId');
  }

  setUser(user: User): void {
    this.cls.set('user', user);
    this.cls.set('userId', user.id);
  }
}

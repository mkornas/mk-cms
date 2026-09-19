import { Inject, Injectable } from '@nestjs/common';
import { ContentStatus } from '../content/entities/content-entry.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { SEARCH_ADAPTER, SearchAdapter, SearchHit } from './search.types';

export interface SearchOptions {
  type?: string;
  locale?: string;
  limit?: number;
  offset?: number;
  /** Admin surfaces set this to include drafts/scheduled (never trashed). */
  includeUnpublished?: boolean;
}

/**
 * Tenant-scoped search facade. Chooses the visible statuses per surface —
 * published-only for delivery, everything-but-trashed for admin — and delegates
 * the actual matching to the configured {@link SearchAdapter}.
 */
@Injectable()
export class SearchService {
  constructor(
    @Inject(SEARCH_ADAPTER) private readonly adapter: SearchAdapter,
    private readonly tenant: TenantContextService,
  ) {}

  search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
    const statuses = opts.includeUnpublished
      ? [ContentStatus.Published, ContentStatus.Draft, ContentStatus.Scheduled]
      : [ContentStatus.Published];
    return this.adapter.search({
      siteId: this.tenant.requireSiteId(),
      query,
      type: opts.type,
      locale: opts.locale,
      statuses,
      limit: Math.min(opts.limit ?? 20, 100),
      offset: opts.offset ?? 0,
    });
  }
}

import { SearchService } from './search.service';
import { ContentStatus } from '../content/entities/content-entry.entity';
import type { SearchAdapter, SearchQuery } from './search.types';
import type { TenantContextService } from '../tenancy/tenant-context.service';

describe('SearchService', () => {
  let lastQuery: SearchQuery;
  const adapter: SearchAdapter = {
    search: (q) => {
      lastQuery = q;
      return Promise.resolve([]);
    },
  };
  const tenant = { requireSiteId: () => 'site-1' } as TenantContextService;
  const service = new SearchService(adapter, tenant);

  it('restricts to published for the public surface', async () => {
    await service.search('hi');
    expect(lastQuery.statuses).toEqual([ContentStatus.Published]);
    expect(lastQuery.siteId).toBe('site-1');
  });

  it('includes drafts + scheduled (never trashed) for admin', async () => {
    await service.search('hi', { includeUnpublished: true });
    expect(lastQuery.statuses).toEqual([
      ContentStatus.Published,
      ContentStatus.Draft,
      ContentStatus.Scheduled,
    ]);
    expect(lastQuery.statuses).not.toContain(ContentStatus.Trashed);
  });

  it('clamps the limit and passes through filters', async () => {
    await service.search('hi', { limit: 500, type: 'post', locale: 'en' });
    expect(lastQuery.limit).toBe(100);
    expect(lastQuery.type).toBe('post');
    expect(lastQuery.locale).toBe('en');
  });
});

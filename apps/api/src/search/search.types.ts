import type { ContentEntry, ContentStatus } from '../content/entities/content-entry.entity';

/** DI token for the pluggable search backend (Postgres FTS by default). */
export const SEARCH_ADAPTER = Symbol('SEARCH_ADAPTER');

export interface SearchQuery {
  siteId: string;
  query: string;
  /** Restrict to one content type (slug). */
  type?: string;
  locale?: string;
  /** Statuses to include (the service sets this per surface). */
  statuses: ContentStatus[];
  limit: number;
  offset: number;
}

export interface SearchHit {
  entry: ContentEntry;
  typeSlug: string;
  /** Relevance score (higher = better). */
  rank: number;
  /** Highlighted excerpt around the match. */
  snippet: string;
}

/**
 * A search backend. Postgres FTS ships as the default; a Meilisearch adapter can
 * be dropped in behind this interface (with content hooks feeding its index)
 * without touching callers.
 */
export interface SearchAdapter {
  search(q: SearchQuery): Promise<SearchHit[]>;
}

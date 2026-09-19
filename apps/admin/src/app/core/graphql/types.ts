/** Shared shapes for the GraphQL admin surface (hand-written; a codegen step
 *  can replace these later). */

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'relation'
  | 'media'
  | 'email'
  | 'url'
  | 'slug'
  | 'json';

/** One field definition on a content type (schema-as-data). `config` is the
 *  per-type options blob — e.g. select `options`, relation `contentType`,
 *  `multiple`, min/max. */
export interface FieldDef {
  id: string;
  key: string;
  name: string;
  type: FieldKind;
  required: boolean;
  config: Record<string, unknown>;
  sortOrder: number;
}

export interface ContentTypeDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  fields: FieldDef[];
}

export interface EntryDetail {
  id: string;
  type: string;
  slug: string | null;
  title: string;
  status: string;
  locale: string;
  fields: Record<string, unknown>;
  publishedAt: string | null;
}

/** A search result row: the matched entry plus relevance + highlighted snippet
 *  (matches wrapped in `<b>…</b>`, safe to render as HTML). */
export interface SearchHit {
  rank: number;
  snippet: string;
  entry: {
    id: string;
    type: string;
    title: string;
    slug: string | null;
    status: string;
    updatedAt: string;
  };
}

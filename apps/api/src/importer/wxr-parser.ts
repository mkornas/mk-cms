import { XMLParser } from 'fast-xml-parser';

export interface WxrTermRef {
  domain: string; // "category" | "post_tag" | custom
  slug: string;
  name: string;
}

export interface WxrItem {
  title: string;
  slug: string;
  status: string; // publish | draft | pending | private | ...
  type: string; // post | page | attachment | nav_menu_item | ...
  content: string;
  excerpt: string;
  wpId: string;
  wpParentId: string;
  postDate: string | null;
  terms: WxrTermRef[];
  /** For `attachment` items: the source file URL to download. */
  attachmentUrl: string | null;
}

export interface WxrData {
  siteTitle: string;
  items: WxrItem[];
}

/** Coerce a fast-xml-parser value (string | node | array) to a plain string. */
function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  const node = value as Record<string, unknown>;
  if ('#text' in node) return text(node['#text']);
  if ('__cdata' in node) return text(node['__cdata']);
  return '';
}

/** Normalize a possibly-single / possibly-missing element to an array. */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Parses a WordPress eXtended RSS (WXR) export into a normalized structure.
 * Handles the namespaced tags (`wp:`, `content:`, `excerpt:`, `dc:`), CDATA,
 * and the "single element vs array" ambiguity of XML. Pure/stateless — mapping
 * to mk-cms content lives in the importer service.
 */
export class WxrParser {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '__cdata',
    parseTagValue: false,
    trimValues: true,
  });

  parse(xml: string): WxrData {
    const doc = this.parser.parse(xml) as Record<string, any>;
    const channel = doc?.rss?.channel;
    if (!channel) {
      throw new Error('Not a valid WXR file: missing <rss><channel>.');
    }

    const items = asArray<Record<string, any>>(channel.item).map((raw) =>
      this.mapItem(raw),
    );
    return { siteTitle: text(channel.title), items };
  }

  private mapItem(raw: Record<string, any>): WxrItem {
    const terms = asArray<Record<string, any>>(raw.category)
      .map((c) => ({
        domain: String(c['@_domain'] ?? 'category'),
        slug: String(c['@_nicename'] ?? '').toLowerCase(),
        name: text(c),
      }))
      .filter((t) => t.slug && t.name);

    return {
      title: text(raw.title),
      slug: String(text(raw['wp:post_name']) || '').toLowerCase(),
      status: text(raw['wp:status']) || 'draft',
      type: text(raw['wp:post_type']) || 'post',
      content: text(raw['content:encoded']),
      excerpt: text(raw['excerpt:encoded']),
      wpId: text(raw['wp:post_id']),
      wpParentId: text(raw['wp:post_parent']),
      postDate: text(raw['wp:post_date_gmt']) || text(raw['wp:post_date']) || null,
      terms,
      attachmentUrl:
        text(raw['wp:attachment_url']) || text(raw.guid) || null,
    };
  }
}

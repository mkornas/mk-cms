import { Injectable, Logger } from '@nestjs/common';
import { ContentTypesService } from '../content/content-types.service';
import { ContentEntriesService } from '../content/content-entries.service';
import { ContentStatus } from '../content/entities/content-entry.entity';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { TaxonomyConfig } from '../taxonomy/entities/taxonomy.entity';
import { MediaService } from '../media/media.service';
import { AppConfigService } from '../config/app-config.service';
import { WxrParser, WxrItem } from './wxr-parser';

export interface ImportResult {
  siteTitle: string;
  contentTypesEnsured: string[];
  taxonomiesEnsured: string[];
  termsCreated: number;
  entriesImported: number;
  entriesSkipped: number;
  mediaImported: number;
  mediaFailed: number;
  warnings: string[];
}

export interface ImportOptions {
  /** Download attachment files into the media library (default true). */
  importMedia?: boolean;
}

/** WP post_status → our status. Anything absent here is skipped. */
const STATUS_MAP: Record<string, ContentStatus> = {
  publish: ContentStatus.Published,
  draft: ContentStatus.Draft,
  pending: ContentStatus.Draft,
  private: ContentStatus.Draft,
  future: ContentStatus.Draft,
};

/** WP post types that carry no importable content. */
const SKIP_TYPES = new Set([
  'attachment',
  'revision',
  'nav_menu_item',
  'custom_css',
  'customize_changeset',
  'oembed_cache',
  'wp_global_styles',
  'wp_navigation',
  'wp_block',
  'wp_template',
  'wp_template_part',
]);

/**
 * Imports a WordPress WXR export into the content engine — the migration path
 * for existing client sites (ARCHITECTURE §7). Ensures the target content types
 * (post/page/custom, each gaining `content` + `excerpt` fields) and taxonomies
 * (category/tag) exist, then creates one entry per importable item and attaches
 * its terms. Idempotent by slug: an item whose slug already exists is skipped,
 * so a re-run doesn't duplicate. Per-item failures are collected as warnings
 * rather than aborting the whole import.
 */
@Injectable()
export class WpImporterService {
  private readonly logger = new Logger(WpImporterService.name);
  private readonly parser = new WxrParser();

  constructor(
    private readonly types: ContentTypesService,
    private readonly entries: ContentEntriesService,
    private readonly taxonomy: TaxonomyService,
    private readonly media: MediaService,
    private readonly config: AppConfigService,
  ) {}

  async import(xml: string, opts: ImportOptions = {}): Promise<ImportResult> {
    const data = this.parser.parse(xml);
    const result: ImportResult = {
      siteTitle: data.siteTitle,
      contentTypesEnsured: [],
      taxonomiesEnsured: [],
      termsCreated: 0,
      entriesImported: 0,
      entriesSkipped: 0,
      mediaImported: 0,
      mediaFailed: 0,
      warnings: [],
    };

    const ensuredTypes = new Set<string>();
    // taxonomySlug → (termSlug → termId)
    const termCache = new Map<string, Map<string, string>>();
    // original attachment URL → new media URL, for rewriting inline images.
    const urlMap = new Map<string, string>();

    await this.ensureTaxonomy('category', 'Categories', { hierarchical: true }, result);
    await this.ensureTaxonomy('tag', 'Tags', { hierarchical: false }, result);

    // Pass 1: attachments → media library, so content can be rewritten.
    if (opts.importMedia !== false) {
      for (const item of data.items) {
        if (item.type === 'attachment') {
          await this.importAttachment(item, urlMap, result);
        }
      }
    }

    // Pass 2: content entries (with inline media URLs rewritten).
    for (const item of data.items) {
      if (item.type === 'attachment') continue;
      try {
        await this.importItem(item, ensuredTypes, termCache, urlMap, result);
      } catch (err) {
        result.entriesSkipped += 1;
        result.warnings.push(
          `"${item.title || item.slug || item.wpId}": ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(
      `WXR import: ${result.entriesImported} entries, ${result.mediaImported} media, ${result.entriesSkipped} skipped`,
    );
    return result;
  }

  private async importItem(
    item: WxrItem,
    ensuredTypes: Set<string>,
    termCache: Map<string, Map<string, string>>,
    urlMap: Map<string, string>,
    result: ImportResult,
  ): Promise<void> {
    if (SKIP_TYPES.has(item.type)) {
      result.entriesSkipped += 1;
      return;
    }
    const status = STATUS_MAP[item.status];
    if (!status || !item.title) {
      result.entriesSkipped += 1;
      return;
    }

    const typeSlug = this.sanitizeSlug(item.type) || 'post';
    await this.ensureContentType(typeSlug, ensuredTypes, result);

    if (item.slug && (await this.entries.findBySlug(typeSlug, item.slug))) {
      result.entriesSkipped += 1;
      result.warnings.push(`Skipped existing ${typeSlug} "${item.slug}"`);
      return;
    }

    const entry = await this.entries.create(typeSlug, {
      title: item.title,
      slug: item.slug || undefined,
      status,
      publishedAt:
        status === ContentStatus.Published
          ? this.parseDate(item.postDate)
          : undefined,
      fields: {
        content: this.rewriteUrls(item.content, urlMap),
        excerpt: item.excerpt,
      },
    });
    result.entriesImported += 1;

    const termIds: string[] = [];
    for (const ref of item.terms) {
      const taxSlug = ref.domain === 'post_tag' ? 'tag' : 'category';
      termIds.push(
        await this.ensureTerm(taxSlug, ref.slug, ref.name, termCache, result),
      );
    }
    if (termIds.length > 0) {
      await this.taxonomy.setEntryTerms(entry.id, termIds);
    }
  }

  // ── attachments → media ────────────────────────────
  private async importAttachment(
    item: WxrItem,
    urlMap: Map<string, string>,
    result: ImportResult,
  ): Promise<void> {
    const url = item.attachmentUrl;
    if (!url || !/^https?:\/\//i.test(url)) return;
    try {
      const { buffer, mime } = await this.download(url);
      const media = await this.media.upload({
        buffer,
        originalname: this.filenameFromUrl(url) || `${item.wpId}.bin`,
        mimetype: mime,
        size: buffer.length,
      });
      urlMap.set(url, media.url);
      result.mediaImported += 1;
    } catch (err) {
      result.mediaFailed += 1;
      result.warnings.push(`media "${url}": ${(err as Error).message}`);
    }
  }

  private async download(url: string): Promise<{ buffer: Buffer; mime: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const max = this.config.media.maxDownloadBytes;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > max) throw new Error(`too large (${declared} bytes)`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > max) throw new Error(`too large (${buffer.length} bytes)`);
    const mime =
      res.headers.get('content-type')?.split(';')[0].trim() ||
      'application/octet-stream';
    return { buffer, mime };
  }

  private filenameFromUrl(url: string): string {
    try {
      return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    } catch {
      return '';
    }
  }

  /** Replace known source URLs in HTML with their new media URLs. */
  private rewriteUrls(html: string, urlMap: Map<string, string>): string {
    let out = html;
    for (const [from, to] of urlMap) {
      if (out.includes(from)) out = out.split(from).join(to);
    }
    return out;
  }

  // ── ensure helpers ─────────────────────────────────
  private async ensureContentType(
    slug: string,
    ensured: Set<string>,
    result: ImportResult,
  ): Promise<void> {
    if (ensured.has(slug)) return;
    ensured.add(slug);

    const fields = [
      { key: 'content', name: 'Content', type: 'richtext' },
      { key: 'excerpt', name: 'Excerpt', type: 'textarea' },
    ];
    let type = await this.types.getBySlug(slug).catch(() => null);
    if (!type) {
      type = await this.types.create({
        slug,
        name: this.titleCase(slug),
        config: {
          hierarchical: slug === 'page',
          hasSlug: true,
          supportsPublishing: true,
        },
        fields,
      });
      result.contentTypesEnsured.push(slug);
      return;
    }
    // Existing type: make sure the import fields are present.
    const existing = new Set((await this.types.getFields(type.id)).map((f) => f.key));
    for (const f of fields) {
      if (!existing.has(f.key)) {
        await this.types.addField(slug, f).catch(() => undefined);
      }
    }
    result.contentTypesEnsured.push(slug);
  }

  private async ensureTaxonomy(
    slug: string,
    name: string,
    config: TaxonomyConfig,
    result: ImportResult,
  ): Promise<void> {
    const existing = await this.taxonomy.getTaxonomy(slug).catch(() => null);
    if (!existing) {
      await this.taxonomy.createTaxonomy({ slug, name, config });
    }
    result.taxonomiesEnsured.push(slug);
  }

  private async ensureTerm(
    taxSlug: string,
    termSlug: string,
    name: string,
    cache: Map<string, Map<string, string>>,
    result: ImportResult,
  ): Promise<string> {
    let map = cache.get(taxSlug);
    if (!map) {
      const terms = await this.taxonomy.listTerms(taxSlug);
      map = new Map(terms.map((t) => [t.slug, t.id]));
      cache.set(taxSlug, map);
    }
    const existing = map.get(termSlug);
    if (existing) return existing;

    const term = await this.taxonomy.createTerm(taxSlug, {
      slug: termSlug,
      name,
    });
    map.set(termSlug, term.id);
    result.termsCreated += 1;
    return term.id;
  }

  // ── small utils ────────────────────────────────────
  private parseDate(value: string | null): Date | undefined {
    if (!value) return undefined;
    const ms = Date.parse(value.replace(' ', 'T') + 'Z');
    return Number.isNaN(ms) ? undefined : new Date(ms);
  }

  private sanitizeSlug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  private titleCase(slug: string): string {
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}

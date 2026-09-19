import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeoMeta } from './entities/seo-meta.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { OptionsService } from '../options/options.service';
import { ContentEntriesService } from '../content/content-entries.service';
import { ContentTypesService } from '../content/content-types.service';

const SEO_OPTION_KEY = 'seo';

/** Per-site SEO configuration, stored in the options table under `seo`. */
export interface SeoSiteSettings {
  /** Absolute base URL of the frontend, e.g. "https://example.com". If unset,
   * the site's first domain is used. */
  baseUrl?: string;
  /** Title template with a `{title}` placeholder, e.g. "{title} — Example". */
  titleTemplate?: string;
  defaultDescription?: string;
  /** Paths to disallow in robots.txt. */
  robotsDisallow?: string[];
  /** Take the whole site out of the index. */
  noindexSite?: boolean;
}

/** Minimal entry shape SEO resolution needs (satisfied by the GraphQL model). */
export interface SeoEntryLike {
  id: string;
  type: string;
  title: string;
  slug: string | null;
  publishedAt: Date | null;
}

export interface ResolvedSeo {
  title: string;
  description: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  noindex: boolean;
  jsonLd: Record<string, unknown>;
}

export interface SeoMetaInput {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | null;
}

/**
 * SEO engine: per-entry meta overrides, per-site defaults, and the derived
 * values a headless frontend needs (resolved title/description/canonical +
 * JSON-LD), plus `sitemap.xml` / `robots.txt` generation. Everything is
 * tenant-scoped through the request context.
 */
@Injectable()
export class SeoService {
  constructor(
    @InjectRepository(SeoMeta)
    private readonly meta: Repository<SeoMeta>,
    private readonly tenant: TenantContextService,
    private readonly options: OptionsService,
    private readonly entries: ContentEntriesService,
    private readonly types: ContentTypesService,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  // ── site settings ──────────────────────────────────
  async siteSettings(): Promise<SeoSiteSettings> {
    return (await this.options.get<SeoSiteSettings>(SEO_OPTION_KEY)) ?? {};
  }

  async updateSiteSettings(patch: SeoSiteSettings): Promise<SeoSiteSettings> {
    const merged = { ...(await this.siteSettings()), ...patch };
    await this.options.set(SEO_OPTION_KEY, merged);
    return merged;
  }

  // ── per-entry meta ─────────────────────────────────
  getForEntry(entryId: string): Promise<SeoMeta | null> {
    return this.meta.findOne({ where: { siteId: this.siteId(), entryId } });
  }

  async setForEntry(entryId: string, input: SeoMetaInput): Promise<SeoMeta> {
    await this.entries.getById(entryId); // tenant-scoped existence check
    const existing = await this.getForEntry(entryId);
    const row =
      existing ??
      this.meta.create({ siteId: this.siteId(), entryId, noindex: false });
    if (input.title !== undefined) row.title = input.title;
    if (input.description !== undefined) row.description = input.description;
    if (input.canonical !== undefined) row.canonical = input.canonical;
    if (input.ogTitle !== undefined) row.ogTitle = input.ogTitle;
    if (input.ogDescription !== undefined) row.ogDescription = input.ogDescription;
    if (input.ogImage !== undefined) row.ogImage = input.ogImage;
    if (input.noindex !== undefined) row.noindex = input.noindex;
    if (input.jsonLd !== undefined) row.jsonLd = input.jsonLd;
    return this.meta.save(row);
  }

  // ── resolution ─────────────────────────────────────
  /** Resolve SEO for an entry id, loading the entry + its type slug. */
  async resolveForEntryId(entryId: string): Promise<ResolvedSeo> {
    const entry = await this.entries.getById(entryId);
    const type = await this.types.getById(entry.contentTypeId);
    return this.resolveForEntry({
      id: entry.id,
      type: type.slug,
      title: entry.title,
      slug: entry.slug,
      publishedAt: entry.publishedAt,
    });
  }

  async resolveForEntry(entry: SeoEntryLike): Promise<ResolvedSeo> {
    const [meta, settings] = await Promise.all([
      this.getForEntry(entry.id),
      this.siteSettings(),
    ]);
    const pattern = await this.urlPatternFor(entry.type);
    const url = this.absoluteUrl(await this.baseUrl(), pattern, entry.slug);

    const title =
      meta?.title ?? this.applyTitleTemplate(settings.titleTemplate, entry.title);
    const description = meta?.description ?? settings.defaultDescription ?? null;
    const canonical = meta?.canonical ?? url;
    const noindex = meta?.noindex || settings.noindexSite || false;

    return {
      title,
      description,
      canonical,
      ogTitle: meta?.ogTitle ?? title,
      ogDescription: meta?.ogDescription ?? description,
      ogImage: meta?.ogImage ?? null,
      noindex,
      jsonLd:
        meta?.jsonLd ?? this.defaultJsonLd(entry, title, description, canonical),
    };
  }

  // ── sitemap / robots ───────────────────────────────
  async buildSitemap(): Promise<string> {
    const [entries, types, base] = await Promise.all([
      this.entries.allPublished(),
      this.types.list(),
      this.baseUrl(),
    ]);
    const patternById = new Map(
      types.map((t) => [t.id, t.config.seoUrlPattern ?? '/{slug}']),
    );
    const noindexIds = new Set(
      (
        await this.meta.find({
          where: { siteId: this.siteId(), noindex: true },
        })
      ).map((m) => m.entryId),
    );

    const urls: string[] = [];
    for (const entry of entries) {
      if (!entry.slug || noindexIds.has(entry.id)) continue;
      const pattern = patternById.get(entry.contentTypeId);
      if (pattern === undefined || pattern === '') continue; // type opted out
      const loc = this.absoluteUrl(base, pattern, entry.slug);
      if (!loc) continue;
      const lastmod = entry.updatedAt.toISOString();
      urls.push(
        `  <url>\n    <loc>${this.xml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
      );
    }
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `${urls.join('\n')}\n</urlset>\n`
    );
  }

  async buildRobots(): Promise<string> {
    const [settings, base] = await Promise.all([
      this.siteSettings(),
      this.baseUrl(),
    ]);
    const lines = ['User-agent: *'];
    if (settings.noindexSite) {
      lines.push('Disallow: /');
    } else {
      for (const path of settings.robotsDisallow ?? []) {
        lines.push(`Disallow: ${path}`);
      }
      if (!(settings.robotsDisallow ?? []).length) lines.push('Allow: /');
    }
    if (base) lines.push(`Sitemap: ${base}/seo/sitemap.xml`);
    return lines.join('\n') + '\n';
  }

  // ── helpers ────────────────────────────────────────
  private async urlPatternFor(typeSlug: string): Promise<string> {
    const type = await this.types.getBySlug(typeSlug);
    return type.config.seoUrlPattern ?? '/{slug}';
  }

  private async baseUrl(): Promise<string> {
    const settings = await this.siteSettings();
    if (settings.baseUrl) return settings.baseUrl.replace(/\/+$/, '');
    const domains = this.tenant.site?.domains ?? [];
    return domains.length ? `https://${domains[0]}` : '';
  }

  private absoluteUrl(
    base: string,
    pattern: string,
    slug: string | null,
  ): string | null {
    if (!pattern) return null;
    const path = pattern.replace('{slug}', slug ?? '');
    return base ? `${base}${path}` : path;
  }

  private applyTitleTemplate(template: string | undefined, title: string): string {
    return template ? template.replace('{title}', title) : title;
  }

  private defaultJsonLd(
    entry: SeoEntryLike,
    title: string,
    description: string | null,
    url: string | null,
  ): Record<string, unknown> {
    const ld: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
    };
    if (description) ld.description = description;
    if (url) ld.url = url;
    if (entry.publishedAt) ld.datePublished = entry.publishedAt.toISOString();
    return ld;
  }

  private xml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

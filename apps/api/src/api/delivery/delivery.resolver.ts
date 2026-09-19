import {
  Args,
  ID,
  Int,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Public } from '../../auth/public.decorator';
import { ContentEntriesService } from '../../content/content-entries.service';
import { ContentTypesService } from '../../content/content-types.service';
import {
  ContentStatus,
  type ContentEntry,
} from '../../content/entities/content-entry.entity';
import { TaxonomyService } from '../../taxonomy/taxonomy.service';
import { RedirectsService } from '../../redirects/redirects.service';
import { MenusService } from '../../menus/menus.service';
import { SearchService } from '../../search/search.service';
import { MediaService } from '../../media/media.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { ContentTypeModel, EntryModel } from '../models/content.model';
import { TaxonomyModel, TermModel } from '../models/taxonomy.model';
import { RedirectMatchModel } from '../models/redirect.model';
import { MenuNodeModel } from '../models/menu.model';
import { SearchHitModel } from '../models/search.model';
import { toSearchHitModel } from '../admin/search.resolver';
import { MediaModel } from '../models/media.model';
import { toMediaModel } from '../admin/media.resolver';
import {
  toContentTypeModel,
  toEntryModel,
  toTaxonomyModel,
  toTermModel,
} from '../models/mappers';
import { PreviewService } from '../preview.service';

/**
 * Namespace object for the public Content Delivery surface. Grouping the public
 * reads under a single `delivery` root field keeps them clearly separated from
 * the authenticated admin root fields within the one shared schema.
 */
@ObjectType('DeliveryQuery')
export class DeliveryQueryModel {}

/** What a valid preview token unlocks for the current request. */
interface PreviewScope {
  all: boolean;
  entryId?: string;
}

/**
 * The public, read-only Content Delivery API, reachable as
 * `query { delivery { … } }`. The `delivery` entrypoint is `@Public` (no JWT),
 * but still resolves a site via the `x-site` header / host, and every read is
 * published-only — unless the request carries a preview token valid for this
 * site, which unlocks drafts. Field resolvers on this type run without the
 * global auth guard, so the whole subtree is public by construction.
 */
@Resolver(() => DeliveryQueryModel)
export class DeliveryResolver {
  constructor(
    private readonly entriesSvc: ContentEntriesService,
    private readonly types: ContentTypesService,
    private readonly taxonomy: TaxonomyService,
    private readonly redirects: RedirectsService,
    private readonly menus: MenusService,
    private readonly searchService: SearchService,
    private readonly mediaService: MediaService,
    private readonly preview: PreviewService,
    private readonly tenant: TenantContextService,
  ) {}

  @Public()
  @Query(() => DeliveryQueryModel, {
    description: 'Public, read-only, published-only content delivery surface.',
  })
  delivery(): DeliveryQueryModel {
    return new DeliveryQueryModel();
  }

  private previewScope(token?: string): PreviewScope | null {
    if (!token) return null;
    const payload = this.preview.verify(token, this.tenant.requireSiteId());
    if (!payload) return null;
    return { all: !payload.entry, entryId: payload.entry };
  }

  private canDeliver(entry: ContentEntry, scope: PreviewScope | null): boolean {
    if (entry.status === ContentStatus.Published) return true;
    if (!scope) return false;
    if (scope.all) return entry.status !== ContentStatus.Trashed;
    return scope.entryId === entry.id;
  }

  // ── content ────────────────────────────────────────
  @ResolveField(() => [EntryModel])
  async entries(
    @Parent() _parent: DeliveryQueryModel,
    @Args('type') type: string,
    @Args('locale', { nullable: true }) locale?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
    @Args('preview', { nullable: true }) preview?: string,
  ): Promise<EntryModel[]> {
    const scope = this.previewScope(preview);
    const rows = scope?.all
      ? (await this.entriesSvc.list(type, { locale, limit, offset })).filter(
          (e) => e.status !== ContentStatus.Trashed,
        )
      : await this.entriesSvc.list(type, {
          status: ContentStatus.Published,
          locale,
          limit,
          offset,
        });
    return rows.map((e) => toEntryModel(e, type));
  }

  @ResolveField(() => EntryModel, { nullable: true })
  async entry(
    @Parent() _parent: DeliveryQueryModel,
    @Args('type') type: string,
    @Args('slug') slug: string,
    @Args('locale', { nullable: true }) locale?: string,
    @Args('preview', { nullable: true }) preview?: string,
  ): Promise<EntryModel | null> {
    const entry = await this.entriesSvc.findBySlug(type, slug, locale);
    if (!entry) return null;
    return this.canDeliver(entry, this.previewScope(preview))
      ? toEntryModel(entry, type)
      : null;
  }

  // ── schema introspection (so frontends can discover a type's shape) ──
  @ResolveField(() => [ContentTypeModel])
  async contentTypes(): Promise<ContentTypeModel[]> {
    return (await this.types.list()).map((t) => toContentTypeModel(t));
  }

  @ResolveField(() => ContentTypeModel, { nullable: true })
  async contentType(
    @Parent() _parent: DeliveryQueryModel,
    @Args('slug') slug: string,
  ): Promise<ContentTypeModel | null> {
    const type = await this.types.getBySlug(slug);
    return toContentTypeModel(type, await this.types.getFields(type.id));
  }

  // ── taxonomies ─────────────────────────────────────
  @ResolveField(() => [TaxonomyModel])
  async taxonomies(): Promise<TaxonomyModel[]> {
    return (await this.taxonomy.listTaxonomies()).map(toTaxonomyModel);
  }

  @ResolveField(() => [TermModel])
  async terms(
    @Parent() _parent: DeliveryQueryModel,
    @Args('taxonomy') taxonomy: string,
  ): Promise<TermModel[]> {
    return (await this.taxonomy.listTerms(taxonomy)).map(toTermModel);
  }

  // ── search ─────────────────────────────────────────
  /** Full-text search across published content. */
  @ResolveField(() => [SearchHitModel])
  async search(
    @Parent() _parent: DeliveryQueryModel,
    @Args('query') query: string,
    @Args('type', { nullable: true }) type?: string,
    @Args('locale', { nullable: true }) locale?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<SearchHitModel[]> {
    const hits = await this.searchService.search(query, {
      type,
      locale,
      limit,
      offset,
    });
    return hits.map(toSearchHitModel);
  }

  // ── menus ──────────────────────────────────────────
  /** A navigation menu resolved into a nested tree, entry links resolved to
   * their published URLs. */
  @ResolveField(() => [MenuNodeModel])
  async menu(
    @Parent() _parent: DeliveryQueryModel,
    @Args('slug') slug: string,
  ): Promise<MenuNodeModel[]> {
    return this.menus.buildTree(slug, { publishedOnly: true });
  }

  // ── media ──────────────────────────────────────────
  /** A media item (URL + responsive variants) referenced by content. */
  @ResolveField(() => MediaModel, { nullable: true })
  async media(
    @Parent() _parent: DeliveryQueryModel,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<MediaModel | null> {
    const item = await this.mediaService.getById(id).catch(() => null);
    return item ? toMediaModel(item) : null;
  }

  // ── redirects ──────────────────────────────────────
  /** Resolve an incoming path to a redirect target, or null if none applies. */
  @ResolveField(() => RedirectMatchModel, { nullable: true })
  async redirect(
    @Parent() _parent: DeliveryQueryModel,
    @Args('path') path: string,
  ): Promise<RedirectMatchModel | null> {
    const match = await this.redirects.resolve(path);
    return match ? { to: match.toPath, statusCode: match.statusCode } : null;
  }
}

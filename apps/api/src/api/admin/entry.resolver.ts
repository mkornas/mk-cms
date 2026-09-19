import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { NotFoundException } from '@nestjs/common';
import { ContentEntriesService } from '../../content/content-entries.service';
import { ContentTypesService } from '../../content/content-types.service';
import { ContentStatus } from '../../content/entities/content-entry.entity';
import type { ContentEntry } from '../../content/entities/content-entry.entity';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { EntryModel, RevisionModel } from '../models/content.model';
import { PublicAuthorModel } from '../models/user.model';
import { TermModel } from '../models/taxonomy.model';
import { SeoMetaModel } from '../models/seo.model';
import { toEntryModel, toRevisionModel } from '../models/mappers';
import { toSeoMetaModel } from './seo.resolver';
import { SeoService } from '../../seo/seo.service';
import { Loaders } from '../loaders/loaders.decorator';
import type { GqlLoaders } from '../loaders/loader.factory';
import { PreviewService } from '../preview.service';
import { CreateEntryInput, UpdateEntryInput } from './admin.inputs';

/**
 * Full-access content CRUD for the admin surface. Every entry returned is
 * projected with its content-type slug; `author` and `terms` are resolved
 * through per-request DataLoaders to avoid N+1 queries.
 */
@Resolver(() => EntryModel)
export class EntryResolver {
  constructor(
    private readonly entriesSvc: ContentEntriesService,
    private readonly types: ContentTypesService,
    private readonly preview: PreviewService,
    private readonly tenant: TenantContextService,
    private readonly seoService: SeoService,
  ) {}

  /** Map an entry to the API model, resolving its type slug (one lookup). */
  private async toModel(entry: ContentEntry): Promise<EntryModel> {
    const type = await this.types.getById(entry.contentTypeId);
    return toEntryModel(entry, type.slug);
  }

  // ── queries ────────────────────────────────────────
  @Query(() => [EntryModel])
  @RequireCapability(Capabilities.Content.Read)
  async entries(
    @Args('type') type: string,
    @Args('status', { type: () => ContentStatus, nullable: true })
    status?: ContentStatus,
    @Args('locale', { nullable: true }) locale?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<EntryModel[]> {
    const rows = await this.entriesSvc.list(type, { status, locale, limit, offset });
    return rows.map((e) => toEntryModel(e, type));
  }

  @Query(() => EntryModel, { nullable: true })
  @RequireCapability(Capabilities.Content.Read)
  async entry(
    @Args('id', { type: () => ID, nullable: true }) id?: string,
    @Args('type', { nullable: true }) type?: string,
    @Args('slug', { nullable: true }) slug?: string,
    @Args('locale', { nullable: true }) locale?: string,
  ): Promise<EntryModel | null> {
    if (id) return this.toModel(await this.entriesSvc.getById(id));
    if (type && slug) {
      const entry = await this.entriesSvc.findBySlug(type, slug, locale);
      return entry ? toEntryModel(entry, type) : null;
    }
    throw new NotFoundException('Provide either `id`, or `type` and `slug`.');
  }

  @Query(() => [RevisionModel])
  @RequireCapability(Capabilities.Content.Read)
  async entryRevisions(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<RevisionModel[]> {
    const revisions = await this.entriesSvc.listRevisions(id);
    return revisions.map(toRevisionModel);
  }

  // ── mutations ──────────────────────────────────────
  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Create)
  async createEntry(
    @Args('type') type: string,
    @Args('input') input: CreateEntryInput,
  ): Promise<EntryModel> {
    const entry = await this.entriesSvc.create(type, input);
    return toEntryModel(entry, type);
  }

  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Create)
  async duplicateEntry(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<EntryModel> {
    return this.toModel(await this.entriesSvc.clone(id));
  }

  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Update)
  async updateEntry(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEntryInput,
  ): Promise<EntryModel> {
    return this.toModel(await this.entriesSvc.update(id, input));
  }

  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Publish)
  async publishEntry(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<EntryModel> {
    return this.toModel(await this.entriesSvc.publish(id));
  }

  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Publish)
  async unpublishEntry(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<EntryModel> {
    return this.toModel(await this.entriesSvc.unpublish(id));
  }

  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Delete)
  async trashEntry(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<EntryModel> {
    return this.toModel(await this.entriesSvc.trash(id));
  }

  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Delete)
  async restoreEntry(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<EntryModel> {
    return this.toModel(await this.entriesSvc.restore(id));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Content.Delete)
  async deleteEntry(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.entriesSvc.remove(id);
    return true;
  }

  /** Mint a signed, 1-hour token that unlocks this entry's drafts on the
   * Delivery API. */
  @Mutation(() => String)
  @RequireCapability(Capabilities.Content.Read)
  async previewToken(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<string> {
    const entry = await this.entriesSvc.getById(id); // tenant-scoped existence
    return this.preview.sign(this.tenant.requireSiteId(), entry.id);
  }

  // ── field resolvers ────────────────────────────────
  @ResolveField(() => PublicAuthorModel, { nullable: true })
  async author(
    @Parent() entry: EntryModel,
    @Loaders() loaders: GqlLoaders,
  ): Promise<PublicAuthorModel | null> {
    if (!entry.authorId) return null;
    const user = await loaders.user.load(entry.authorId);
    return user
      ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
      : null;
  }

  @ResolveField(() => [TermModel])
  terms(
    @Parent() entry: EntryModel,
    @Loaders() loaders: GqlLoaders,
  ): Promise<TermModel[]> {
    return loaders.entryTerms.load(entry.id);
  }

  /** Resolved SEO (per-entry overrides merged with site defaults + derived
   * values). Available on both the admin and delivery surfaces. */
  @ResolveField(() => SeoMetaModel)
  async seo(@Parent() entry: EntryModel): Promise<SeoMetaModel> {
    return toSeoMetaModel(
      await this.seoService.resolveForEntry({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        slug: entry.slug,
        publishedAt: entry.publishedAt,
      }),
    );
  }
}

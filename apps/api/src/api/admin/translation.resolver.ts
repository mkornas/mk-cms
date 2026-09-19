import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentEntry } from '../../content/entities/content-entry.entity';
import { ContentEntriesService } from '../../content/content-entries.service';
import { ContentTypesService } from '../../content/content-types.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { EntryModel } from '../models/content.model';
import { toEntryModel } from '../models/mappers';

/**
 * Translation grouping for content entries. Sibling translations of the same
 * logical entry share a `translationGroupId`; this resolver lists a group and
 * spins up new-locale drafts within it. Kept separate from `EntryResolver` so
 * the translation surface can evolve without touching core entry CRUD.
 */
@Resolver()
export class TranslationResolver {
  constructor(
    @InjectRepository(ContentEntry)
    private readonly entries: Repository<ContentEntry>,
    private readonly entriesSvc: ContentEntriesService,
    private readonly types: ContentTypesService,
    private readonly tenant: TenantContextService,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  /** Map an entry to the API model, resolving its content-type slug. */
  private async toModel(entry: ContentEntry): Promise<EntryModel> {
    const type = await this.types.getById(entry.contentTypeId);
    return toEntryModel(entry, type.slug);
  }

  /** Map several entries, caching type-slug lookups (siblings usually share a type). */
  private async toModels(rows: ContentEntry[]): Promise<EntryModel[]> {
    const slugs = new Map<string, string>();
    const out: EntryModel[] = [];
    for (const row of rows) {
      let slug = slugs.get(row.contentTypeId);
      if (!slug) {
        slug = (await this.types.getById(row.contentTypeId)).slug;
        slugs.set(row.contentTypeId, slug);
      }
      out.push(toEntryModel(row, slug));
    }
    return out;
  }

  // ── queries ────────────────────────────────────────
  /** Every entry in the same translation group as `id` (including itself). */
  @Query(() => [EntryModel])
  @RequireCapability(Capabilities.Content.Read)
  async entryTranslations(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<EntryModel[]> {
    const source = await this.entriesSvc.getById(id); // tenant-scoped
    const groupId = source.translationGroupId;
    if (!groupId) return [await this.toModel(source)];

    const rows = await this.entries.find({
      where: { siteId: this.siteId(), translationGroupId: groupId },
      order: { locale: 'ASC' },
    });
    return this.toModels(rows);
  }

  // ── mutations ──────────────────────────────────────
  /** Create a Draft translation of `id` in `locale` within its group. */
  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Create)
  async addTranslation(
    @Args('id', { type: () => ID }) id: string,
    @Args('locale') locale: string,
  ): Promise<EntryModel> {
    const source = await this.entriesSvc.getById(id); // tenant-scoped

    // Ensure the source anchors a translation group.
    if (!source.translationGroupId) {
      source.translationGroupId = source.id;
      await this.entries.save(source);
    }
    const groupId = source.translationGroupId;

    // Don't create a duplicate locale within the group — return the existing one.
    const existing = await this.entries.findOne({
      where: {
        siteId: this.siteId(),
        translationGroupId: groupId,
        locale,
      },
    });
    if (existing) {
      if (existing.id === source.id) {
        throw new ConflictException(
          `This entry is already in locale "${locale}".`,
        );
      }
      return this.toModel(existing);
    }

    const typeSlug = (await this.types.getById(source.contentTypeId)).slug;

    // `create` mints a fresh group (translationGroupId = new id); re-point it at
    // the source's group so the new draft joins the existing translation set.
    const created = await this.entriesSvc.create(typeSlug, {
      title: source.title,
      locale,
      fields: source.fields,
    });
    created.translationGroupId = groupId;
    const saved = await this.entries.save(created);

    return this.toModel(saved);
  }
}

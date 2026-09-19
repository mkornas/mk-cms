import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContentEntry, ContentStatus } from './entities/content-entry.entity';
import {
  ContentRevision,
  RevisionData,
} from './entities/content-revision.entity';
import { FieldDefinition } from './entities/field-definition.entity';
import { ContentTypesService } from './content-types.service';
import { ContentFieldValidator } from './field-types/content-field-validator';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { HookBus } from '../hooks/hook-bus.service';
import { CoreActions, CoreFilters } from '../hooks/hooks.constants';
import type { ContentType } from './entities/content-type.entity';

export interface CreateEntryInput {
  title: string;
  slug?: string;
  status?: ContentStatus;
  locale?: string;
  parentId?: string | null;
  fields?: Record<string, unknown>;
  /** Override the publish timestamp (used by the importer to preserve dates). */
  publishedAt?: Date;
}

export interface UpdateEntryInput {
  title?: string;
  slug?: string | null;
  parentId?: string | null;
  fields?: Record<string, unknown>;
}

export interface ListEntriesOptions {
  status?: ContentStatus;
  locale?: string;
  parentId?: string | null;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ContentEntriesService {
  constructor(
    @InjectRepository(ContentEntry)
    private readonly entries: Repository<ContentEntry>,
    @InjectRepository(ContentRevision)
    private readonly revisions: Repository<ContentRevision>,
    private readonly contentTypes: ContentTypesService,
    private readonly validator: ContentFieldValidator,
    private readonly tenant: TenantContextService,
    private readonly hooks: HookBus,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  async create(
    typeSlug: string,
    input: CreateEntryInput,
  ): Promise<ContentEntry> {
    const siteId = this.siteId();
    const type = await this.contentTypes.getBySlug(typeSlug);
    const defs = await this.contentTypes.getFields(type.id);

    const validated = this.validator.validate(defs, input.fields ?? {});
    const fields = await this.hooks.applyFilters(
      CoreFilters.ContentFields,
      validated,
      { typeSlug: type.slug, mode: 'create' as const },
    );
    await this.assertRelationsExist(defs, fields);

    const locale = input.locale ?? 'en';
    const slug = await this.resolveSlug(type, input.slug, input.title, locale);
    const status = input.status ?? ContentStatus.Draft;

    const entry = this.entries.create({
      siteId,
      contentTypeId: type.id,
      title: input.title,
      slug,
      status,
      locale,
      parentId: input.parentId ?? null,
      authorId: this.tenant.userId ?? null,
      fields,
      publishedAt:
        input.publishedAt ??
        (status === ContentStatus.Published ? new Date() : null),
    });
    entry.translationGroupId = null;
    const saved = await this.entries.save(entry);

    // A translation group defaults to the entry itself.
    saved.translationGroupId = saved.id;
    await this.entries.save(saved);

    await this.writeRevision(saved);
    await this.hooks.doAction(CoreActions.ContentAfterSave, { entry: saved });
    if (saved.status === ContentStatus.Published) {
      await this.hooks.doAction(CoreActions.ContentAfterPublish, {
        entry: saved,
      });
    }
    return saved;
  }

  /**
   * Clone an entry into a fresh Draft copy. Copies title (suffixed), fields and
   * locale; the slug is left unset so a new unique one is generated, and a fresh
   * translationGroupId is assigned by `create` (a clone is a new logical entry).
   */
  async clone(id: string): Promise<ContentEntry> {
    const source = await this.getById(id);
    const typeSlug = await this.typeSlugFor(source.contentTypeId);
    // Copy only fields defined on the current schema: stored entries can carry
    // extra keys added by hooks (e.g. `processedBy`) that aren't real fields and
    // would otherwise fail create-time validation.
    const type = await this.contentTypes.getBySlug(typeSlug);
    const defs = await this.contentTypes.getFields(type.id);
    const allowed = new Set(defs.map((d) => d.key));
    const src = (source.fields ?? {}) as Record<string, unknown>;
    const fields: Record<string, unknown> = {};
    for (const k of Object.keys(src)) {
      if (allowed.has(k)) fields[k] = src[k];
    }
    return this.create(typeSlug, {
      title: `${source.title} (copy)`,
      fields,
      locale: source.locale,
      status: ContentStatus.Draft,
    });
  }

  async update(id: string, input: UpdateEntryInput): Promise<ContentEntry> {
    const entry = await this.getById(id);
    const type = await this.contentTypes.getBySlug(
      await this.typeSlugFor(entry.contentTypeId),
    );
    const defs = await this.contentTypes.getFields(type.id);

    if (input.fields) {
      const validated = this.validator.validate(defs, input.fields, {
        partial: true,
      });
      await this.assertRelationsExist(defs, validated);
      entry.fields = await this.hooks.applyFilters(
        CoreFilters.ContentFields,
        { ...entry.fields, ...validated },
        { typeSlug: type.slug, mode: 'update' as const },
      );
    }
    if (input.title !== undefined) entry.title = input.title;
    if (input.parentId !== undefined) entry.parentId = input.parentId;
    if (input.slug !== undefined) {
      entry.slug =
        input.slug === null
          ? null
          : await this.resolveSlug(type, input.slug, entry.title, entry.locale, entry.id);
    }

    const saved = await this.entries.save(entry);
    await this.writeRevision(saved);
    await this.hooks.doAction(CoreActions.ContentAfterSave, { entry: saved });
    return saved;
  }

  async publish(id: string): Promise<ContentEntry> {
    const entry = await this.getById(id);
    const wasPublished = entry.status === ContentStatus.Published;
    entry.status = ContentStatus.Published;
    entry.publishedAt ??= new Date();
    const saved = await this.entries.save(entry);
    await this.writeRevision(saved);
    await this.hooks.doAction(CoreActions.ContentAfterSave, { entry: saved });
    if (!wasPublished) {
      await this.hooks.doAction(CoreActions.ContentAfterPublish, {
        entry: saved,
      });
    }
    return saved;
  }

  async unpublish(id: string): Promise<ContentEntry> {
    return this.setStatus(id, ContentStatus.Draft);
  }

  async trash(id: string): Promise<ContentEntry> {
    const saved = await this.setStatus(id, ContentStatus.Trashed);
    await this.hooks.doAction(CoreActions.ContentAfterTrash, { entry: saved });
    return saved;
  }

  /** Restore a trashed entry back to Draft. */
  async restore(id: string): Promise<ContentEntry> {
    return this.setStatus(id, ContentStatus.Draft);
  }

  /** Permanently delete an entry (tenant-scoped). */
  async remove(id: string): Promise<void> {
    const entry = await this.getById(id); // tenant-scoped existence check
    await this.entries.remove(entry);
  }

  private async setStatus(
    id: string,
    status: ContentStatus,
  ): Promise<ContentEntry> {
    const entry = await this.getById(id);
    entry.status = status;
    const saved = await this.entries.save(entry);
    await this.writeRevision(saved);
    return saved;
  }

  // ── reads ──────────────────────────────────────────
  async getById(id: string): Promise<ContentEntry> {
    const entry = await this.entries.findOne({
      where: { id, siteId: this.siteId() },
    });
    if (!entry) throw new NotFoundException('Content entry not found.');
    return entry;
  }

  /** Batch load entries by id within the active site (any status). */
  findByIds(ids: string[]): Promise<ContentEntry[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.entries.find({
      where: { siteId: this.siteId(), id: In(ids) },
    });
  }

  /** Every published entry in the active site (across all types), for sitemap
   * generation. Newest-updated first. */
  allPublished(): Promise<ContentEntry[]> {
    return this.entries.find({
      where: { siteId: this.siteId(), status: ContentStatus.Published },
      order: { updatedAt: 'DESC' },
    });
  }

  /** Single entry by its slug within a type (+ optional locale). Null if none. */
  async findBySlug(
    typeSlug: string,
    slug: string,
    locale?: string,
  ): Promise<ContentEntry | null> {
    const type = await this.contentTypes.getBySlug(typeSlug);
    return this.entries.findOne({
      where: {
        siteId: this.siteId(),
        contentTypeId: type.id,
        slug,
        ...(locale ? { locale } : {}),
      },
    });
  }

  async list(
    typeSlug: string,
    opts: ListEntriesOptions = {},
  ): Promise<ContentEntry[]> {
    const type = await this.contentTypes.getBySlug(typeSlug);
    const qb = this.entries
      .createQueryBuilder('e')
      .where('e.siteId = :siteId', { siteId: this.siteId() })
      .andWhere('e.contentTypeId = :typeId', { typeId: type.id });

    if (opts.status) qb.andWhere('e.status = :status', { status: opts.status });
    if (opts.locale) qb.andWhere('e.locale = :locale', { locale: opts.locale });
    if (opts.parentId !== undefined) {
      opts.parentId === null
        ? qb.andWhere('e.parentId IS NULL')
        : qb.andWhere('e.parentId = :pid', { pid: opts.parentId });
    }
    return qb
      .orderBy('e.updatedAt', 'DESC')
      .take(Math.min(opts.limit ?? 50, 200))
      .skip(opts.offset ?? 0)
      .getMany();
  }

  listRevisions(entryId: string): Promise<ContentRevision[]> {
    return this.revisions.find({
      where: { entryId, siteId: this.siteId() },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  // ── internals ──────────────────────────────────────
  private async writeRevision(entry: ContentEntry): Promise<void> {
    const data: RevisionData = {
      title: entry.title,
      slug: entry.slug,
      status: entry.status,
      locale: entry.locale,
      parentId: entry.parentId,
      fields: entry.fields,
    };
    await this.revisions.save(
      this.revisions.create({
        siteId: entry.siteId,
        entryId: entry.id,
        authorId: this.tenant.userId ?? null,
        data,
      }),
    );
  }

  /** Verify every id referenced by a relation field exists within this site. */
  private async assertRelationsExist(
    defs: FieldDefinition[],
    fields: Record<string, unknown>,
  ): Promise<void> {
    const ids = new Set<string>();
    for (const def of defs) {
      if (def.type !== 'relation') continue;
      const value = fields[def.key];
      if (value == null) continue;
      (Array.isArray(value) ? value : [value]).forEach((v) =>
        ids.add(String(v)),
      );
    }
    if (ids.size === 0) return;
    const found = await this.entries.count({
      where: { siteId: this.siteId(), id: In([...ids]) },
    });
    if (found !== ids.size) {
      throw new BadRequestException(
        'One or more related entries do not exist in this site.',
      );
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }

  /**
   * Produce a unique slug within (site, type, locale). Skips slug handling for
   * types that don't use slugs. `excludeId` lets an update keep its own slug.
   */
  private async resolveSlug(
    type: ContentType,
    provided: string | undefined,
    title: string,
    locale: string,
    excludeId?: string,
  ): Promise<string | null> {
    if (type.config.hasSlug === false) return null;
    const base = this.slugify(provided || title) || 'item';
    let candidate = base;
    let n = 1;
    while (await this.slugTaken(type.id, locale, candidate, excludeId)) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }

  private async slugTaken(
    contentTypeId: string,
    locale: string,
    slug: string,
    excludeId?: string,
  ): Promise<boolean> {
    const qb = this.entries
      .createQueryBuilder('e')
      .where('e.siteId = :siteId', { siteId: this.siteId() })
      .andWhere('e.contentTypeId = :typeId', { typeId: contentTypeId })
      .andWhere('e.locale = :locale', { locale })
      .andWhere('e.slug = :slug', { slug });
    if (excludeId) qb.andWhere('e.id != :excludeId', { excludeId });
    return (await qb.getCount()) > 0;
  }

  private async typeSlugFor(contentTypeId: string): Promise<string> {
    // getById already enforced tenant scope; resolve the slug for validation.
    const list = await this.contentTypes.list();
    const type = list.find((t) => t.id === contentTypeId);
    if (!type) throw new NotFoundException('Content type not found.');
    return type.slug;
  }
}

import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

export enum ContentStatus {
  Draft = 'draft',
  Published = 'published',
  Scheduled = 'scheduled',
  Trashed = 'trashed',
}

/**
 * A single piece of content — one row per instance of any content type. Core
 * columns (title, slug, status, hierarchy, locale) are relational and indexed;
 * all type-specific values live in `fields` JSONB. This is the hybrid model:
 * fast, queryable core + schema-less custom fields.
 */
@Entity('content_entries')
@Index(['siteId', 'contentTypeId', 'status'])
// Unique slug per type + locale within a site (NULL slugs are exempt).
@Index(['siteId', 'contentTypeId', 'locale', 'slug'], {
  unique: true,
  where: '"slug" IS NOT NULL',
})
export class ContentEntry extends TenantEntity {
  @Index()
  @Column('uuid')
  contentTypeId!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  slug!: string | null;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'enum', enum: ContentStatus, default: ContentStatus.Draft })
  status!: ContentStatus;

  @Column({ type: 'uuid', nullable: true })
  authorId!: string | null;

  /** Parent entry for hierarchical types (pages). */
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 12, default: 'en' })
  locale!: string;

  /** Groups translations of the same logical entry across locales. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  translationGroupId!: string | null;

  /** Custom field values, keyed by field definition key. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  fields!: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
}

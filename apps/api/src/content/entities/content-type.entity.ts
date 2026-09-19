import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

/**
 * A content type is a data-defined schema (WordPress "post type" analogue). Its
 * instances all live in the shared `content_entries` table with their custom
 * values in JSONB — so a new type can be created at runtime with no migration.
 * The field schema lives in {@link FieldDefinition} rows.
 */
export interface ContentTypeConfig {
  /** Entries can be nested (pages). Enables parentId usage. */
  hierarchical?: boolean;
  /** Entries carry a slug (URL segment). */
  hasSlug?: boolean;
  /** Entries have publish/draft workflow. */
  supportsPublishing?: boolean;
  /** Exactly one entry (e.g. site-wide "settings"/"homepage config"). */
  isSingleton?: boolean;
  /** Admin UI hints. */
  icon?: string;
  labelSingular?: string;
  labelPlural?: string;
  /**
   * Frontend URL pattern for this type's entries, used to build sitemap URLs
   * (the CMS is headless and doesn't own routing). `{slug}` is substituted;
   * defaults to `/{slug}`. An empty string excludes the type from the sitemap.
   */
  seoUrlPattern?: string;
}

@Entity('content_types')
@Index(['siteId', 'slug'], { unique: true })
export class ContentType extends TenantEntity {
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config!: ContentTypeConfig;

  /** Core types (page, post) are seeded and protected from deletion. */
  @Column({ type: 'boolean', default: false })
  isCore!: boolean;
}

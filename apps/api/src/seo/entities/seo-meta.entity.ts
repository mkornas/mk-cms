import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

/**
 * Per-entry SEO overrides. Optional — an entry without a row falls back to
 * site-level defaults and values derived from its title. One row per entry
 * within a site. `jsonLd` stores a structured-data object served verbatim to
 * the frontend for `<script type="application/ld+json">`.
 */
@Entity('seo_meta')
@Index(['siteId', 'entryId'], { unique: true })
export class SeoMeta extends TenantEntity {
  @Column({ type: 'uuid' })
  entryId!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  canonical!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  ogTitle!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ogDescription!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  ogImage!: string | null;

  /** Exclude from indexing (robots noindex) + omit from the sitemap. */
  @Column({ type: 'boolean', default: false })
  noindex!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  jsonLd!: Record<string, unknown> | null;
}

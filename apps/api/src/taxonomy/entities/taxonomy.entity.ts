import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

export interface TaxonomyConfig {
  /** Terms can be nested (categories) vs flat (tags). */
  hierarchical?: boolean;
  /** Content type slugs this taxonomy applies to (empty = all). */
  contentTypes?: string[];
  labelSingular?: string;
  labelPlural?: string;
}

/** A classification scheme (categories, tags, or any custom one). */
@Entity('taxonomies')
@Index(['siteId', 'slug'], { unique: true })
export class Taxonomy extends TenantEntity {
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config!: TaxonomyConfig;

  @Column({ type: 'boolean', default: false })
  isCore!: boolean;
}

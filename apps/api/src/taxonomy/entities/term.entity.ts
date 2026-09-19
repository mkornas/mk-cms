import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';
import { Taxonomy } from './taxonomy.entity';

/** A single term within a taxonomy (e.g. the "News" category). */
@Entity('terms')
@Index(['siteId', 'taxonomyId', 'slug'], { unique: true })
export class Term extends TenantEntity {
  @Index()
  @Column('uuid')
  taxonomyId!: string;

  @ManyToOne(() => Taxonomy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taxonomyId' })
  taxonomy?: Taxonomy;

  @Column({ type: 'varchar', length: 128 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  description!: string | null;

  /** Parent term for hierarchical taxonomies. */
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;
}

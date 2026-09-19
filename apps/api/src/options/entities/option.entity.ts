import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Key/value settings store (the `wp_options` analogue). `siteId = null` is a
 * global/instance option; otherwise it belongs to one site. Values are JSONB so
 * anything from a string to a nested config object can live here.
 */
@Entity('options')
@Index(['siteId', 'key'], { unique: true })
export class Option extends BaseEntity {
  /** null → global instance option. */
  @Column({ type: 'uuid', nullable: true })
  siteId!: string | null;

  @Column({ type: 'varchar', length: 191 })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: unknown;

  /** Options flagged autoload are eagerly loaded/cached at request start. */
  @Column({ type: 'boolean', default: true })
  autoload!: boolean;
}

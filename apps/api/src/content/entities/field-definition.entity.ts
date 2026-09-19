import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';
import { ContentType } from './content-type.entity';

/**
 * One field on a content type. `type` names a registered field type; `config`
 * holds that field type's per-field options (min/max, options list, relation
 * target, …). Entry values for this field are stored under `key` in the
 * entry's `fields` JSONB.
 */
@Entity('field_definitions')
@Index(['contentTypeId', 'key'], { unique: true })
export class FieldDefinition extends TenantEntity {
  @Index()
  @Column('uuid')
  contentTypeId!: string;

  @ManyToOne(() => ContentType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contentTypeId' })
  contentType?: ContentType;

  /** Stored key in the entry's `fields` JSONB, e.g. "subtitle". */
  @Column({ type: 'varchar', length: 64 })
  key!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  /** Registered field type id, e.g. "text", "number", "relation". */
  @Column({ type: 'varchar', length: 64 })
  type!: string;

  @Column({ type: 'boolean', default: false })
  required!: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config!: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;
}

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/** Join between a content entry and a term (many-to-many). */
@Entity('entry_terms')
@Index(['entryId', 'termId'], { unique: true })
export class EntryTerm extends BaseEntity {
  @Index()
  @Column('uuid')
  siteId!: string;

  @Index()
  @Column('uuid')
  entryId!: string;

  @Index()
  @Column('uuid')
  termId!: string;
}

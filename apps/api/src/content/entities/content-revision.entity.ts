import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import type { ContentStatus } from './content-entry.entity';

/** Immutable snapshot of an entry's meaningful state, written on every save. */
export interface RevisionData {
  title: string;
  slug: string | null;
  status: ContentStatus;
  locale: string;
  parentId: string | null;
  fields: Record<string, unknown>;
}

@Entity('content_revisions')
@Index(['entryId', 'createdAt'])
export class ContentRevision extends BaseEntity {
  @Index()
  @Column('uuid')
  siteId!: string;

  @Column('uuid')
  entryId!: string;

  /** Who produced this revision. */
  @Column({ type: 'uuid', nullable: true })
  authorId!: string | null;

  @Column({ type: 'jsonb' })
  data!: RevisionData;
}

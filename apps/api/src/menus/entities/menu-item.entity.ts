import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

export enum MenuItemType {
  /** A hand-entered URL. */
  Custom = 'custom',
  /** A link to a content entry, whose URL is resolved from its type pattern. */
  Entry = 'entry',
}

/**
 * One node in a menu tree. `parentId` nests items; `sortOrder` orders siblings.
 * A `custom` item carries an explicit `url`; an `entry` item carries `entryId`
 * and the delivery layer resolves its URL from the entry's slug + content-type
 * pattern, so moving/renaming content keeps menus correct.
 */
@Entity('menu_items')
@Index(['siteId', 'menuId'])
export class MenuItem extends TenantEntity {
  @Index()
  @Column({ type: 'uuid' })
  menuId!: string;

  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 200 })
  label!: string;

  @Column({ type: 'enum', enum: MenuItemType, default: MenuItemType.Custom })
  type!: MenuItemType;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  url!: string | null;

  @Column({ type: 'uuid', nullable: true })
  entryId!: string | null;

  /** e.g. "_blank" to open in a new tab. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  target!: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;
}

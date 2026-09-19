import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

/**
 * A named navigation menu (e.g. "primary", "footer"). Its items form a tree in
 * {@link MenuItem}. Slugs are unique per site so a frontend can request a menu
 * by a stable handle.
 */
@Entity('menus')
@Index(['siteId', 'slug'], { unique: true })
export class Menu extends TenantEntity {
  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;
}

import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from './role.entity';
import { Site } from '../../tenancy/entities/site.entity';

/**
 * Binds a {@link User} to a {@link Site} with a {@link Role}. This is the join
 * that authorization walks: given (userId, active siteId) → role → capabilities.
 * A user has at most one membership per site.
 */
@Entity('site_memberships')
@Index(['userId', 'siteId'], { unique: true })
export class SiteMembership extends BaseEntity {
  @Column('uuid')
  userId!: string;

  @Index()
  @Column('uuid')
  siteId!: string;

  @Column('uuid')
  roleId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @ManyToOne(() => Site, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'siteId' })
  site?: Site;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleId' })
  role?: Role;
}

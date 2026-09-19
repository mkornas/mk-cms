import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum UserStatus {
  Active = 'active',
  Invited = 'invited',
  Suspended = 'suspended',
}

/**
 * A global identity. A user is NOT owned by a site — they authenticate once and
 * gain access to specific sites through {@link SiteMembership}. This is what
 * lets one person administer many of your sites from a single account.
 */
@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  /** argon2id hash. Never selected by default — auth loads it explicitly. */
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status!: UserStatus;

  /** True for the platform super-admin; bypasses per-site capability checks. */
  @Column({ type: 'boolean', default: false })
  isSuperAdmin!: boolean;
}

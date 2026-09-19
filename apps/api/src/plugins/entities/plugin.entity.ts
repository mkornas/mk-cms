import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Persistent record of an installed plugin. Global (not tenant-scoped) in P4 —
 * a plugin is installed instance-wide and toggled on/off here; per-site
 * activation is a later refinement. `installedVersion` tracks what the DB was
 * migrated to, so a code bump to a newer manifest version triggers `onUpgrade`.
 */
@Entity('plugins')
export class PluginRecord extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  /** Manifest version currently installed in the DB. */
  @Column({ type: 'varchar', length: 32 })
  installedVersion!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  settings!: Record<string, unknown>;
}

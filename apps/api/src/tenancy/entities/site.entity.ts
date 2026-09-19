import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SiteStatus {
  Active = 'active',
  Suspended = 'suspended',
  Archived = 'archived',
}

/**
 * A website hosted by this CMS instance. Global (not tenant-scoped) — it *is*
 * the tenant. `domains` lets the tenant middleware resolve the active site from
 * the request Host; `settings` holds arbitrary per-site configuration as JSONB.
 */
@Entity('sites')
export class Site extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  /** Hostnames that map to this site, e.g. ["client-a.example", "www.client-a.example"]. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  domains!: string[];

  @Column({ type: 'enum', enum: SiteStatus, default: SiteStatus.Active })
  status!: SiteStatus;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  settings!: Record<string, unknown>;
}

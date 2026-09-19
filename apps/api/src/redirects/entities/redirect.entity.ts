import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

/**
 * A URL redirect for a site's public frontend. The Delivery API resolves an
 * incoming path to a target so a frontend can 301/302 without hardcoding moved
 * URLs. `fromPath` is unique per site; `hits` counts resolutions for cleanup
 * insight.
 */
@Entity('redirects')
@Index(['siteId', 'fromPath'], { unique: true })
export class Redirect extends TenantEntity {
  /** Source path, normalized to a leading slash, e.g. "/old-page". */
  @Column({ type: 'varchar', length: 2048 })
  fromPath!: string;

  /** Destination path or absolute URL. */
  @Column({ type: 'varchar', length: 2048 })
  toPath!: string;

  /** 301 (permanent) or 302 (temporary). */
  @Column({ type: 'int', default: 301 })
  statusCode!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'int', default: 0 })
  hits!: number;
}

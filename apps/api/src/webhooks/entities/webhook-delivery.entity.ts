import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Record of a single webhook delivery attempt (one row per attempt), for
 * observability and debugging. Not a TenantEntity by inheritance but carries
 * `siteId` so the admin sees only its site's history.
 */
@Entity('webhook_deliveries')
@Index(['siteId', 'webhookId', 'createdAt'])
export class WebhookDelivery extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  siteId!: string;

  @Column({ type: 'uuid' })
  webhookId!: string;

  @Column({ type: 'varchar', length: 64 })
  event!: string;

  @Column({ type: 'boolean' })
  success!: boolean;

  @Column({ type: 'int', nullable: true })
  statusCode!: number | null;

  /** Which attempt this was (1-based). */
  @Column({ type: 'int', default: 1 })
  attempt!: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  error!: string | null;
}

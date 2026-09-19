import { Column, Entity } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

/**
 * An outbound webhook. When one of its subscribed `events` fires (off the hook
 * bus), a delivery job POSTs the payload to `url`, signed with `secret` (HMAC).
 * Per-site (`siteId` indexed by {@link TenantEntity}). Deliveries are recorded
 * in {@link WebhookDelivery}.
 */
@Entity('webhooks')
export class Webhook extends TenantEntity {
  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  /** Event names this webhook subscribes to, e.g. ["content.published"]. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  events!: string[];

  /** Shared secret used to HMAC-sign each delivery. */
  @Column({ type: 'varchar', length: 128 })
  secret!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description!: string | null;
}

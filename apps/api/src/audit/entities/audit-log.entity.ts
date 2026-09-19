import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

/**
 * An immutable audit record. Written by the {@link AuditService} in response to
 * hook-bus events, so any action worth tracking becomes a row without the
 * originating code knowing the audit log exists. Tenant-scoped: each site sees
 * only its own trail. `actorEmail` is denormalized so the log stays readable
 * even after a user is renamed or removed.
 */
@Entity('audit_log')
@Index(['siteId', 'createdAt'])
export class AuditLogEntry extends TenantEntity {
  /** Machine action key, e.g. "content.published". */
  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  actorEmail!: string | null;

  /** What was acted on, e.g. "entry". */
  @Column({ type: 'varchar', length: 64, nullable: true })
  targetType!: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetId!: string | null;

  /** Human-readable one-liner for admin display. */
  @Column({ type: 'varchar', length: 512 })
  summary!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  meta!: Record<string, unknown>;
}

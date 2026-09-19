import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntry } from './entities/audit-log.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';

export interface RecordAuditInput {
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}

export interface ListAuditOptions {
  action?: string;
  /** Substring match on the actor's email (case-insensitive). */
  actor?: string;
  /** Lower bound (inclusive) on createdAt. */
  from?: Date;
  /** Upper bound (inclusive) on createdAt. */
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Writes and reads the audit trail. `record` derives the site and actor from
 * the active request context, so callers (hook listeners) only describe *what*
 * happened. Recording never throws into the caller — an audit failure must not
 * roll back the action being audited — and events without a resolved site are
 * skipped (the log is tenant-scoped).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntry)
    private readonly entries: Repository<AuditLogEntry>,
    private readonly tenant: TenantContextService,
  ) {}

  async record(input: RecordAuditInput): Promise<void> {
    const siteId = this.tenant.siteId;
    if (!siteId) return; // nothing to scope the record to
    try {
      const user = this.tenant.user;
      await this.entries.save(
        this.entries.create({
          siteId,
          action: input.action,
          actorId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          summary: input.summary,
          meta: input.meta ?? {},
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to write audit entry: ${(err as Error).message}`);
    }
  }

  list(opts: ListAuditOptions = {}): Promise<AuditLogEntry[]> {
    const qb = this.entries
      .createQueryBuilder('a')
      .where('a.siteId = :siteId', { siteId: this.tenant.requireSiteId() });
    if (opts.action) qb.andWhere('a.action = :action', { action: opts.action });
    if (opts.actor) qb.andWhere('a.actorEmail ILIKE :actor', { actor: `%${opts.actor}%` });
    if (opts.from) qb.andWhere('a.createdAt >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('a.createdAt <= :to', { to: opts.to });
    return qb
      .orderBy('a.createdAt', 'DESC')
      .take(Math.min(opts.limit ?? 50, 200))
      .skip(opts.offset ?? 0)
      .getMany();
  }
}

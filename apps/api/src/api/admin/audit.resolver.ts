import { Args, GraphQLISODateTime, Int, Query, Resolver } from '@nestjs/graphql';
import { AuditService } from '../../audit/audit.service';
import { AuditLogEntry } from '../../audit/entities/audit-log.entity';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { AuditEntryModel } from '../models/audit.model';

function toModel(entry: AuditLogEntry): AuditEntryModel {
  return {
    id: entry.id,
    action: entry.action,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    targetType: entry.targetType,
    targetId: entry.targetId,
    summary: entry.summary,
    meta: entry.meta,
    createdAt: entry.createdAt,
  };
}

/** Read-only access to the tenant's audit trail (`audit:read`). */
@Resolver(() => AuditEntryModel)
export class AuditResolver {
  constructor(private readonly audit: AuditService) {}

  @Query(() => [AuditEntryModel])
  @RequireCapability(Capabilities.Audit.Read)
  async auditLog(
    @Args('action', { nullable: true }) action?: string,
    @Args('actor', { nullable: true }) actor?: string,
    @Args('from', { type: () => GraphQLISODateTime, nullable: true }) from?: Date,
    @Args('to', { type: () => GraphQLISODateTime, nullable: true }) to?: Date,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<AuditEntryModel[]> {
    const rows = await this.audit.list({ action, actor, from, to, limit, offset });
    return rows.map(toModel);
  }
}

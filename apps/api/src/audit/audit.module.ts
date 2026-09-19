import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntry } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditSubscriber } from './audit.subscriber';

/**
 * First-party audit module. Consumes the hook bus (via {@link AuditSubscriber})
 * to record a tenant-scoped trail of content activity, and exposes it through
 * {@link AuditService}. HookBus and TenantContext come from global modules.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntry])],
  providers: [AuditService, AuditSubscriber],
  exports: [AuditService],
})
export class AuditModule {}

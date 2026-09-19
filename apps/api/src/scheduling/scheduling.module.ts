import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ContentEntry } from '../content/entities/content-entry.entity';
import { ContentModule } from '../content/content.module';
import { SchedulingService } from './scheduling.service';
import { SchedulingProcessor } from './scheduling.processor';
import { SchedulingResolver } from './scheduling.resolver';
import { QUEUE_CONTENT_PUBLISH } from './scheduling.constants';

/**
 * Scheduled publishing. Registers the `content-publish` queue + its worker and
 * exposes the schedule/unschedule mutations. Reuses ContentEntriesService (from
 * ContentModule) for tenant-scoped reads + the existing publish path; the
 * ContentEntry repository is registered locally for the status/time writes.
 */
@Module({
  imports: [
    ContentModule,
    TypeOrmModule.forFeature([ContentEntry]),
    BullModule.registerQueue({ name: QUEUE_CONTENT_PUBLISH }),
  ],
  providers: [SchedulingService, SchedulingProcessor, SchedulingResolver],
})
export class SchedulingModule {}

import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import type { AppClsStore } from '../tenancy/cls-store';
import { ContentEntriesService } from '../content/content-entries.service';
import { ContentStatus } from '../content/entities/content-entry.entity';
import { QUEUE_CONTENT_PUBLISH, PublishJobData } from './scheduling.constants';

/**
 * BullMQ worker that publishes an entry when its scheduled time arrives. Runs
 * off-request, so it re-establishes a CLS tenant context from the job payload
 * before touching the tenant-scoped {@link ContentEntriesService}. Publishes
 * only if the entry still exists and is still Scheduled — it may have been
 * unscheduled, trashed, or already published in the interim.
 */
@Processor(QUEUE_CONTENT_PUBLISH)
export class SchedulingProcessor extends WorkerHost {
  private readonly logger = new Logger(SchedulingProcessor.name);

  constructor(
    private readonly entriesSvc: ContentEntriesService,
    private readonly cls: ClsService<AppClsStore>,
  ) {
    super();
  }

  async process(job: Job<PublishJobData>): Promise<void> {
    const { entryId, siteId } = job.data;
    await this.cls.run(async () => {
      this.cls.set('siteId', siteId);

      let status: ContentStatus;
      try {
        status = (await this.entriesSvc.getById(entryId)).status;
      } catch {
        this.logger.warn(
          `Scheduled entry ${entryId} no longer exists; skipping.`,
        );
        return;
      }

      if (status !== ContentStatus.Scheduled) {
        this.logger.debug(
          `Entry ${entryId} is "${status}", not Scheduled; skipping publish.`,
        );
        return;
      }

      await this.entriesSvc.publish(entryId);
      this.logger.debug(`Published scheduled entry ${entryId}`);
    });
  }
}

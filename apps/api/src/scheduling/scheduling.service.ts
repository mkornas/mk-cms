import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import {
  ContentEntry,
  ContentStatus,
} from '../content/entities/content-entry.entity';
import { ContentEntriesService } from '../content/content-entries.service';
import { QUEUE_CONTENT_PUBLISH, PublishJobData } from './scheduling.constants';

/**
 * Scheduled publishing for content entries. `schedule` flips an entry to
 * {@link ContentStatus.Scheduled}, records the target time on `publishedAt`
 * (reused as the intended publish moment), and enqueues a delayed BullMQ job
 * keyed by the entry id — so re-scheduling replaces the pending job. When the
 * job fires the {@link SchedulingProcessor} performs the actual publish.
 */
@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @InjectQueue(QUEUE_CONTENT_PUBLISH)
    private readonly queue: Queue<PublishJobData>,
    @InjectRepository(ContentEntry)
    private readonly entries: Repository<ContentEntry>,
    private readonly entriesSvc: ContentEntriesService,
  ) {}

  /** Mark the entry Scheduled and enqueue a delayed publish job. Tenant-scoped
   * via `getById`. Re-scheduling the same entry replaces its pending job. */
  async schedule(id: string, publishAt: Date): Promise<ContentEntry> {
    const entry = await this.entriesSvc.getById(id); // tenant-scoped existence
    entry.status = ContentStatus.Scheduled;
    entry.publishedAt = publishAt; // target publish time (kept on publish)
    const saved = await this.entries.save(entry);

    // Drop any pending job for this entry before enqueuing the replacement —
    // BullMQ dedupes by jobId and would otherwise ignore the new one.
    await this.queue.remove(id).catch(() => undefined);
    const delay = Math.max(0, publishAt.getTime() - Date.now());
    await this.queue.add(
      'publish',
      { entryId: saved.id, siteId: saved.siteId },
      { jobId: id, delay },
    );
    this.logger.debug(`Scheduled entry ${id} to publish in ${delay}ms`);
    return saved;
  }

  /** Cancel a pending schedule and return the entry to Draft. */
  async unschedule(id: string): Promise<ContentEntry> {
    const entry = await this.entriesSvc.getById(id); // tenant-scoped existence
    await this.queue.remove(id).catch(() => undefined);
    entry.status = ContentStatus.Draft;
    entry.publishedAt = null;
    return this.entries.save(entry);
  }
}

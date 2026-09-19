import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService, MailMessage } from './mail.service';
import { QUEUE_MAIL } from '../jobs/jobs.module';

/** Sends queued mail off-request through the {@link MailService}. Throwing lets
 * BullMQ retry transient send failures with the queue's backoff policy. */
@Processor(QUEUE_MAIL)
export class MailProcessor extends WorkerHost {
  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<MailMessage>): Promise<void> {
    await this.mail.send(job.data);
  }
}

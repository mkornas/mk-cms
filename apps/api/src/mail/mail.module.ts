import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { QUEUE_MAIL } from '../jobs/jobs.module';

/**
 * Mail infrastructure: the {@link MailService} adapter and the worker that
 * drains the mail queue. Global so any feature can inject MailService (and the
 * mail queue, to enqueue) — e.g. form notifications.
 */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_MAIL })],
  providers: [MailService, MailProcessor],
  exports: [MailService, BullModule],
})
export class MailModule {}

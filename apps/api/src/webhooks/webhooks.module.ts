import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Webhook } from './entities/webhook.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhooksService } from './webhooks.service';
import { WebhookProcessor } from './webhook.processor';
import { WebhookSubscriber } from './webhook.subscriber';
import { QUEUE_WEBHOOKS } from '../jobs/jobs.module';

/**
 * First-party webhooks module. Registers the delivery queue + its worker,
 * subscribes to content hooks, and exposes CRUD on the admin surface. The Redis
 * connection is provided globally by {@link JobsModule}.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Webhook, WebhookDelivery]),
    BullModule.registerQueue({ name: QUEUE_WEBHOOKS }),
  ],
  providers: [WebhooksService, WebhookProcessor, WebhookSubscriber],
  exports: [WebhooksService],
})
export class WebhooksModule {}

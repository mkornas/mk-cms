import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '../config/app-config.service';

/** Queue names used across the app. */
export const QUEUE_WEBHOOKS = 'webhooks';
export const QUEUE_MAIL = 'mail';

/**
 * Background-jobs infrastructure (ARCHITECTURE §0/§7). Configures the BullMQ
 * connection from the same Redis the app already uses, so any feature can
 * register a queue + `@Processor` for async or scheduled work. Global so the
 * connection is shared; individual queues are registered per feature module via
 * `BullModule.registerQueue`.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password || undefined,
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class JobsModule {}

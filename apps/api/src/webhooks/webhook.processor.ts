import { createHmac } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { QUEUE_WEBHOOKS } from '../jobs/jobs.module';
import { WebhookJobData } from './webhook-events';

const TIMEOUT_MS = 10_000;

/**
 * BullMQ worker that performs the actual webhook HTTP POST. Runs off-request
 * (no tenant context — everything it needs is in the job payload). Signs the
 * body with HMAC-SHA256 under the webhook's secret, records every attempt in
 * `webhook_deliveries`, and throws on failure so BullMQ retries with the
 * queue's exponential backoff.
 */
@Processor(QUEUE_WEBHOOKS)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly deliveries: Repository<WebhookDelivery>,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { webhookId, siteId, url, secret, event, payload } = job.data;
    const attempt = job.attemptsMade + 1;
    const body = JSON.stringify({
      event,
      payload,
      deliveryId: job.id,
      timestamp: new Date().toISOString(),
    });
    const signature =
      'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mk-event': event,
          'x-mk-signature': signature,
          'x-mk-delivery': String(job.id),
        },
        body,
        signal: controller.signal,
      });
      await this.record(siteId, webhookId, event, attempt, res.ok, res.status, null);
      if (!res.ok) {
        throw new Error(`Webhook responded ${res.status}`);
      }
    } catch (err) {
      const message = (err as Error).message;
      // A non-2xx already recorded above; only record here for transport errors.
      if (!(err as Error).message.startsWith('Webhook responded')) {
        await this.record(siteId, webhookId, event, attempt, false, null, message);
      }
      this.logger.warn(
        `Webhook ${webhookId} attempt ${attempt} failed: ${message}`,
      );
      throw err; // let BullMQ retry
    } finally {
      clearTimeout(timer);
    }
  }

  private async record(
    siteId: string,
    webhookId: string,
    event: string,
    attempt: number,
    success: boolean,
    statusCode: number | null,
    error: string | null,
  ): Promise<void> {
    await this.deliveries.save(
      this.deliveries.create({
        siteId,
        webhookId,
        event,
        attempt,
        success,
        statusCode,
        error: error?.slice(0, 512) ?? null,
      }),
    );
  }
}

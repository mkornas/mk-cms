import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { QUEUE_WEBHOOKS } from '../jobs/jobs.module';
import { WEBHOOK_EVENTS, WebhookJobData } from './webhook-events';

export interface CreateWebhookInput {
  url: string;
  events: string[];
  secret?: string;
  enabled?: boolean;
  description?: string;
}

export interface UpdateWebhookInput {
  url?: string;
  events?: string[];
  enabled?: boolean;
  description?: string;
}

/**
 * Manages outbound webhooks and turns hook-bus events into delivery jobs. The
 * HTTP POST itself happens off-request in the {@link WebhookProcessor}; this
 * service just persists config and enqueues work (capturing url+secret into the
 * job so the worker needs no tenant context).
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly webhooks: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveries: Repository<WebhookDelivery>,
    @InjectQueue(QUEUE_WEBHOOKS) private readonly queue: Queue,
    private readonly tenant: TenantContextService,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  private assertEvents(events: string[]): void {
    const bad = events.filter(
      (e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e),
    );
    if (bad.length) {
      throw new BadRequestException(
        `Unknown event(s): ${bad.join(', ')}. Known: ${WEBHOOK_EVENTS.join(', ')}.`,
      );
    }
  }

  // ── CRUD ───────────────────────────────────────────
  list(): Promise<Webhook[]> {
    return this.webhooks.find({
      where: { siteId: this.siteId() },
      order: { createdAt: 'DESC' },
    });
  }

  async getById(id: string): Promise<Webhook> {
    const hook = await this.webhooks.findOne({
      where: { id, siteId: this.siteId() },
    });
    if (!hook) throw new NotFoundException('Webhook not found.');
    return hook;
  }

  async create(input: CreateWebhookInput): Promise<Webhook> {
    this.assertEvents(input.events);
    return this.webhooks.save(
      this.webhooks.create({
        siteId: this.siteId(),
        url: input.url,
        events: input.events,
        secret: input.secret || randomBytes(24).toString('hex'),
        enabled: input.enabled ?? true,
        description: input.description ?? null,
      }),
    );
  }

  async update(id: string, patch: UpdateWebhookInput): Promise<Webhook> {
    const hook = await this.getById(id);
    if (patch.events) this.assertEvents(patch.events);
    Object.assign(hook, {
      url: patch.url ?? hook.url,
      events: patch.events ?? hook.events,
      enabled: patch.enabled ?? hook.enabled,
      description:
        patch.description !== undefined ? patch.description : hook.description,
    });
    return this.webhooks.save(hook);
  }

  async delete(id: string): Promise<void> {
    const hook = await this.getById(id);
    await this.webhooks.remove(hook);
  }

  /**
   * Generate a fresh HMAC signing secret for the webhook. The previous secret
   * stops working immediately once saved; the receiver must be updated with the
   * returned value.
   */
  async rotateSecret(id: string): Promise<Webhook> {
    const hook = await this.getById(id);
    hook.secret = randomBytes(24).toString('hex');
    return this.webhooks.save(hook);
  }

  // ── dispatch ───────────────────────────────────────
  /** Enqueue a delivery job for every enabled webhook subscribed to `event`. */
  async dispatch(event: string, payload: unknown): Promise<number> {
    const siteId = this.tenant.siteId;
    if (!siteId) return 0;
    const hooks = await this.webhooks
      .createQueryBuilder('w')
      .where('w.siteId = :siteId', { siteId })
      .andWhere('w.enabled = true')
      .andWhere('w.events @> :event::jsonb', { event: JSON.stringify([event]) })
      .getMany();

    for (const hook of hooks) {
      await this.enqueue(hook, event, payload);
    }
    if (hooks.length) {
      this.logger.debug(`Dispatched "${event}" to ${hooks.length} webhook(s)`);
    }
    return hooks.length;
  }

  /** Send a `ping` to one webhook, ignoring its event subscriptions. */
  async test(id: string): Promise<Webhook> {
    const hook = await this.getById(id);
    await this.enqueue(hook, 'ping', { test: true });
    return hook;
  }

  /**
   * Re-send a past delivery. Deliveries don't persist the original request
   * payload, so this enqueues a FRESH delivery for the same webhook + event
   * carrying a small marker payload (`{ retry: true, originalDeliveryId }`)
   * rather than replaying the exact bytes. Returns the original delivery row.
   */
  async retryDelivery(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId, siteId: this.siteId() },
    });
    if (!delivery) throw new NotFoundException('Delivery not found.');
    const hook = await this.getById(delivery.webhookId);
    await this.enqueue(hook, delivery.event, {
      retry: true,
      originalDeliveryId: deliveryId,
    });
    return delivery;
  }

  private enqueue(hook: Webhook, event: string, payload: unknown) {
    const data: WebhookJobData = {
      webhookId: hook.id,
      siteId: hook.siteId,
      url: hook.url,
      secret: hook.secret,
      event,
      payload,
    };
    return this.queue.add('deliver', data);
  }

  // ── deliveries (observability) ─────────────────────
  listDeliveries(webhookId: string, limit = 50): Promise<WebhookDelivery[]> {
    return this.deliveries.find({
      where: { siteId: this.siteId(), webhookId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }
}

import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';
import { WebhooksService } from '../../webhooks/webhooks.service';
import { Webhook } from '../../webhooks/entities/webhook.entity';
import { WebhookDelivery } from '../../webhooks/entities/webhook-delivery.entity';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { WebhookDeliveryModel, WebhookModel } from '../models/webhook.model';

@InputType()
export class CreateWebhookInput {
  @Field()
  @IsUrl({ require_tld: false })
  url!: string;

  @Field(() => [String])
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events!: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  secret?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class UpdateWebhookInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

function toModel(w: Webhook): WebhookModel {
  return {
    id: w.id,
    url: w.url,
    events: w.events,
    enabled: w.enabled,
    description: w.description,
    secret: w.secret,
  };
}

function toDeliveryModel(d: WebhookDelivery): WebhookDeliveryModel {
  return {
    id: d.id,
    event: d.event,
    success: d.success,
    statusCode: d.statusCode,
    attempt: d.attempt,
    error: d.error,
    createdAt: d.createdAt,
  };
}

/** Webhook management (`webhook:manage`). */
@Resolver(() => WebhookModel)
export class WebhookResolver {
  constructor(private readonly service: WebhooksService) {}

  @Query(() => [WebhookModel])
  @RequireCapability(Capabilities.Webhook.Manage)
  async webhooks(): Promise<WebhookModel[]> {
    return (await this.service.list()).map(toModel);
  }

  @Query(() => [WebhookDeliveryModel])
  @RequireCapability(Capabilities.Webhook.Manage)
  async webhookDeliveries(
    @Args('webhookId', { type: () => ID }) webhookId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<WebhookDeliveryModel[]> {
    return (await this.service.listDeliveries(webhookId, limit ?? 50)).map(
      toDeliveryModel,
    );
  }

  @Mutation(() => WebhookModel)
  @RequireCapability(Capabilities.Webhook.Manage)
  async createWebhook(
    @Args('input') input: CreateWebhookInput,
  ): Promise<WebhookModel> {
    return toModel(await this.service.create(input));
  }

  @Mutation(() => WebhookModel)
  @RequireCapability(Capabilities.Webhook.Manage)
  async updateWebhook(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWebhookInput,
  ): Promise<WebhookModel> {
    return toModel(await this.service.update(id, input));
  }

  /** Replace a webhook's HMAC signing secret with a freshly generated one. */
  @Mutation(() => WebhookModel)
  @RequireCapability(Capabilities.Webhook.Manage)
  async rotateWebhookSecret(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WebhookModel> {
    return toModel(await this.service.rotateSecret(id));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Webhook.Manage)
  async deleteWebhook(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.service.delete(id);
    return true;
  }

  /** Enqueue a `ping` delivery to verify a webhook end-to-end. */
  @Mutation(() => WebhookModel)
  @RequireCapability(Capabilities.Webhook.Manage)
  async testWebhook(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WebhookModel> {
    return toModel(await this.service.test(id));
  }

  /**
   * Re-enqueue a fresh delivery for the webhook + event of a past delivery.
   * The original request payload isn't stored, so the retry carries a marker
   * payload referencing the original delivery id.
   */
  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Webhook.Manage)
  async retryDelivery(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.service.retryDelivery(id);
    return true;
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { HookBus } from '../hooks/hook-bus.service';
import { CoreActions } from '../hooks/hooks.constants';
import { WebhooksService } from './webhooks.service';
import { ACTION_TO_EVENT } from './webhook-events';

interface EntryPayload {
  entry: { id: string; title: string; slug: string | null; status: string };
}

/**
 * Bridges content hook-bus actions to webhook dispatch. Like the audit
 * subscriber, this is purely hook-driven: the content engine fires actions, and
 * subscribed webhooks receive a trimmed entry payload — the mechanism behind
 * "rebuild my static site when content is published".
 */
@Injectable()
export class WebhookSubscriber implements OnModuleInit {
  constructor(
    private readonly hooks: HookBus,
    private readonly webhooks: WebhooksService,
  ) {}

  onModuleInit(): void {
    for (const action of [
      CoreActions.ContentAfterPublish,
      CoreActions.ContentAfterSave,
      CoreActions.ContentAfterTrash,
    ]) {
      const event = ACTION_TO_EVENT[action];
      this.hooks.addAction<EntryPayload>(action, async ({ entry }) => {
        await this.webhooks.dispatch(event, {
          id: entry.id,
          title: entry.title,
          slug: entry.slug,
          status: entry.status,
        });
      });
    }
  }
}

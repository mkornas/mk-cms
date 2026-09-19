import { CoreActions } from '../hooks/hooks.constants';

/**
 * Public webhook event names and the hook-bus actions they map from. These are
 * the events a webhook can subscribe to; the {@link WebhookSubscriber} bridges
 * each core action to the matching event.
 */
export const WEBHOOK_EVENTS = [
  'content.published',
  'content.saved',
  'content.trashed',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Core hook action → webhook event name. */
export const ACTION_TO_EVENT: Record<string, WebhookEvent> = {
  [CoreActions.ContentAfterPublish]: 'content.published',
  [CoreActions.ContentAfterSave]: 'content.saved',
  [CoreActions.ContentAfterTrash]: 'content.trashed',
};

export interface WebhookJobData {
  webhookId: string;
  siteId: string;
  url: string;
  secret: string;
  event: string;
  payload: unknown;
}

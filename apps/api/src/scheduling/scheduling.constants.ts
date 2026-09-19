/** BullMQ queue that fires delayed jobs to publish scheduled content entries. */
export const QUEUE_CONTENT_PUBLISH = 'content-publish';

/**
 * Payload for a scheduled-publish job. Carries the tenant id because the worker
 * runs off-request (no CLS/tenant context), so it must re-establish the scope
 * the tenant-scoped {@link ContentEntriesService} reads from.
 */
export interface PublishJobData {
  entryId: string;
  siteId: string;
}

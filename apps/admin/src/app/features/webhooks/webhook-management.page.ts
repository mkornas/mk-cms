import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { ConfirmService } from '../../core/ui/confirm.service';
import { MkButton, MkCard, MkFormField, MkInput, MkSwitch, MkBadge, MkAlert, MkSkeletonPreset, MkPageHeader, MkEmptyState } from '@mk-kit/ui';
import {
  WEBHOOKS,
  WEBHOOK_DELIVERIES,
  CREATE_WEBHOOK,
  UPDATE_WEBHOOK,
  DELETE_WEBHOOK,
  TEST_WEBHOOK,
} from '../../core/graphql/operations';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  secret: string;
}
interface Delivery {
  id: string;
  event: string;
  success: boolean;
  statusCode: number | null;
  attempt: number;
  error: string | null;
  createdAt: string;
}

const EVENTS = ['content.published', 'content.saved', 'content.trashed'];

const ROTATE_WEBHOOK_SECRET = gql`
  mutation RotateWebhookSecret($id: ID!) {
    rotateWebhookSecret(id: $id) {
      id
      secret
    }
  }
`;

const RETRY_DELIVERY = gql`
  mutation RetryDelivery($id: ID!) {
    retryDelivery(id: $id)
  }
`;

/** Webhook management (`webhook:manage`): endpoints subscribed to content events,
 *  a test ping, and per-webhook delivery history. */
@Component({
  selector: 'app-webhook-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkCard, MkFormField, MkInput, MkSwitch, MkBadge, MkAlert, MkSkeletonPreset, MkPageHeader, MkEmptyState],
  templateUrl: './webhook-management.page.html',
  styles: `
    .layout { display: grid; gap: var(--mk-space-4); grid-template-columns: 1fr; }
    @media (min-width: 62rem) { .layout { grid-template-columns: 22rem 1fr; align-items: start; } }
    .list { display: flex; flex-direction: column; gap: var(--mk-space-1); margin-bottom: var(--mk-space-4); }
    .item { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-2); padding: var(--mk-space-2) var(--mk-space-3); border-radius: var(--mk-radius-md); cursor: pointer; }
    .item:hover { background: var(--mk-hover-overlay); }
    .item[data-active='true'] { background: var(--mk-selected-bg); color: var(--mk-selected-text); }
    .item .url { font-family: var(--mk-font-mono); font-size: var(--mk-font-size-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .muted { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    .form, .events { display: grid; gap: var(--mk-space-3); }
    .events { grid-auto-flow: row; }
    .evt { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-2); }
    .actions { display: flex; gap: var(--mk-space-2); flex-wrap: wrap; }
    .deliveries { display: flex; flex-direction: column; gap: var(--mk-space-1); margin-top: var(--mk-space-2); }
    .drow { display: flex; align-items: center; gap: var(--mk-space-3); padding: var(--mk-space-1) var(--mk-space-2); font-size: var(--mk-font-size-sm); border-bottom: var(--mk-border-width) solid var(--mk-border-subtle); }
    h2, h3 { margin: 0 0 var(--mk-space-3); } h3 { margin-top: var(--mk-space-5); font-size: var(--mk-font-size-md); }
  `,
})
export class WebhookManagementPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  protected readonly allEvents = EVENTS;

  private readonly ref = this.apollo.watchQuery<{ webhooks: Webhook[] }>({
    query: WEBHOOKS,
    fetchPolicy: 'cache-and-network',
  });
  protected readonly webhooks = toSignal(
    this.ref.valueChanges.pipe(map((r) => (r.data?.webhooks ?? []) as Webhook[])),
    { initialValue: [] as Webhook[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.ref.valueChanges.pipe(map((r) => r.loading && !r.data?.webhooks)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.webhooks().length === 0,
  );

  protected readonly busy = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly url = signal('');
  protected readonly description = signal('');
  protected readonly enabled = signal(true);
  protected readonly events = signal<Set<string>>(new Set());
  protected readonly deliveries = signal<Delivery[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);

  protected readonly active = computed(
    () => this.webhooks().find((w) => w.id === this.editingId()) ?? null,
  );

  protected s(t: EventTarget | null, set: (v: string) => void): void {
    set((t as HTMLInputElement)?.value ?? '');
  }
  protected hasEvent(e: string): boolean {
    return this.events().has(e);
  }
  protected toggleEvent(e: string, on: boolean): void {
    this.events.update((s) => {
      const n = new Set(s);
      on ? n.add(e) : n.delete(e);
      return n;
    });
  }

  protected newWebhook(): void {
    this.creating.set(true);
    this.editingId.set(null);
    this.url.set('');
    this.description.set('');
    this.enabled.set(true);
    this.events.set(new Set(EVENTS));
    this.deliveries.set([]);
  }
  protected async select(w: Webhook): Promise<void> {
    this.creating.set(false);
    this.editingId.set(w.id);
    this.url.set(w.url);
    this.description.set(w.description ?? '');
    this.enabled.set(w.enabled);
    this.events.set(new Set(w.events));
    this.info.set(null);
    await this.loadDeliveries(w.id);
  }
  private async loadDeliveries(id: string): Promise<void> {
    const res = await firstValueFrom(
      this.apollo.query<{ webhookDeliveries: Delivery[] }>({
        query: WEBHOOK_DELIVERIES,
        variables: { webhookId: id, limit: 20 },
        fetchPolicy: 'network-only',
      }),
    );
    this.deliveries.set((res.data?.webhookDeliveries ?? []) as Delivery[]);
  }

  private async run(work: Promise<unknown>, after?: () => Promise<void> | void): Promise<void> {
    this.error.set(null);
    try {
      await work;
      if (after) await after();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed.');
    }
  }

  protected save(): void {
    if (this.busy()) return;
    this.busy.set(true);
    const events = [...this.events()];
    const id = this.editingId();
    if (id) {
      void this.run(
        firstValueFrom(
          this.apollo.mutate({
            mutation: UPDATE_WEBHOOK,
            variables: { id, input: { url: this.url(), events, enabled: this.enabled(), description: this.description() || null } },
          }),
        ),
        async () => { await this.ref.refetch(); },
      ).finally(() => this.busy.set(false));
    } else {
      void this.run(
        firstValueFrom(
          this.apollo.mutate({
            mutation: CREATE_WEBHOOK,
            variables: { input: { url: this.url(), events, enabled: this.enabled(), description: this.description() || null } },
          }),
        ),
        async () => { this.creating.set(false); await this.ref.refetch(); },
      ).finally(() => this.busy.set(false));
    }
  }
  protected async remove(w: Webhook, event: Event): Promise<void> {
    event.stopPropagation();
    if (!(await this.confirm.remove(`the webhook to ${w.url}`))) return;
    void this.run(
      firstValueFrom(this.apollo.mutate({ mutation: DELETE_WEBHOOK, variables: { id: w.id } })),
      async () => {
        if (this.editingId() === w.id) { this.editingId.set(null); this.creating.set(false); }
        await this.ref.refetch();
      },
    );
  }
  protected test(): void {
    const id = this.editingId();
    if (!id) return;
    this.info.set(null);
    void this.run(
      firstValueFrom(this.apollo.mutate({ mutation: TEST_WEBHOOK, variables: { id } })),
      async () => {
        this.info.set('Test ping queued — check deliveries in a moment.');
        setTimeout(() => void this.loadDeliveries(id), 1500);
      },
    );
  }
  protected retryDelivery(deliveryId: string): void {
    const id = this.editingId();
    if (!id) return;
    void this.run(
      firstValueFrom(this.apollo.mutate({ mutation: RETRY_DELIVERY, variables: { id: deliveryId } })),
      () => {
        setTimeout(() => void this.loadDeliveries(id), 1500);
      },
    );
  }
  protected async rotate(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    const ok = await this.confirm.confirm({
      title: 'Rotate signing secret?',
      message: 'The current secret stops working immediately; update your receiver with the new one.',
      confirmText: 'Rotate',
      tone: 'danger',
      icon: 'refresh',
    });
    if (!ok) return;
    this.info.set(null);
    void this.run(
      firstValueFrom(this.apollo.mutate({ mutation: ROTATE_WEBHOOK_SECRET, variables: { id } })),
      async () => {
        this.info.set('Signing secret rotated — copy the new value below into your receiver.');
        await this.ref.refetch();
      },
    );
  }
}

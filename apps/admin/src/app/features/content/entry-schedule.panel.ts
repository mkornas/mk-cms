import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { MkButton, MkFormField, MkInput, MkBadge, MkAlert } from '@mk-kit/ui';

const ENTRY_SCHEDULE = gql`
  query EntrySchedule($id: ID!) {
    entry(id: $id) {
      id
      status
      publishedAt
    }
  }
`;

const SCHEDULE_ENTRY = gql`
  mutation ScheduleEntry($id: ID!, $publishAt: DateTime!) {
    scheduleEntry(id: $id, publishAt: $publishAt) {
      id
      status
      publishedAt
    }
  }
`;

const UNSCHEDULE_ENTRY = gql`
  mutation UnscheduleEntry($id: ID!) {
    unscheduleEntry(id: $id) {
      id
      status
      publishedAt
    }
  }
`;

interface EntrySchedule {
  id: string;
  status: string;
  publishedAt: string | null;
}

/**
 * Sidebar panel for scheduled publishing. Reflects the entry's current status
 * and (when Scheduled) its target publish time, and lets an editor pick a
 * date/time to schedule — or unschedule back to Draft. Backed by the
 * `scheduleEntry`/`unscheduleEntry` mutations; success toasts fire globally.
 */
@Component({
  selector: 'app-entry-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkFormField, MkInput, MkBadge, MkAlert],
  template: `
    <div class="panel">
      @if (error(); as msg) {
        <mk-alert tone="danger" style="margin-bottom: var(--mk-space-3)">{{ msg }}</mk-alert>
      }

      <div class="side-row">
        <span class="muted">Status</span>
        <mk-badge [tone]="statusTone()" variant="soft">{{ status() || '…' }}</mk-badge>
      </div>

      @if (isScheduled() && scheduledLabel(); as when) {
        <p class="muted scheduled-for">Publishes {{ when }}</p>
      }

      <mk-form-field label="Publish at" hint="Local time. Publishing happens automatically at this moment.">
        <input mkInput type="datetime-local" [value]="when()"
          (input)="when.set($any($event.target).value)" />
      </mk-form-field>

      <div class="actions">
        <button mkButton tone="primary" [loading]="busy()" [disabled]="!when()" (click)="schedule()">
          {{ isScheduled() ? 'Reschedule' : 'Schedule' }}
        </button>
        @if (isScheduled()) {
          <button mkButton variant="outline" [loading]="busy()" (click)="unschedule()">Unschedule</button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .card-title { margin: 0 0 var(--mk-space-3); font-size: var(--mk-font-size-md); }
    .side-row { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); margin-bottom: var(--mk-space-3); }
    .muted { color: var(--mk-text-muted); }
    .scheduled-for { margin: 0 0 var(--mk-space-3); font-size: var(--mk-font-size-sm); }
    .actions { display: flex; gap: var(--mk-space-2); margin-top: var(--mk-space-3); }
  `,
})
export class EntrySchedulePanel {
  private readonly apollo = inject(Apollo);

  readonly entryId = input.required<string>();

  protected readonly status = signal('');
  protected readonly scheduledAt = signal<string | null>(null);
  protected readonly when = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly isScheduled = computed(() => this.status() === 'scheduled');

  protected readonly statusTone = computed(() => {
    switch (this.status()) {
      case 'published':
        return 'success' as const;
      case 'scheduled':
        return 'warning' as const;
      default:
        return 'neutral' as const;
    }
  });

  /** Human-readable version of the stored scheduled/publish time. */
  protected readonly scheduledLabel = computed(() => {
    const iso = this.scheduledAt();
    return iso ? new Date(iso).toLocaleString() : '';
  });

  private lastLoaded: string | null = null;

  constructor() {
    effect(() => {
      const id = this.entryId();
      if (id && id !== this.lastLoaded) {
        this.lastLoaded = id;
        void this.load(id);
      }
    });
  }

  /** Format an ISO instant as the `datetime-local` input's local value. */
  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private apply(entry: EntrySchedule): void {
    this.status.set(entry.status);
    this.scheduledAt.set(entry.publishedAt);
    // Prefill the picker with the scheduled time when there is one.
    if (entry.status === 'scheduled' && entry.publishedAt) {
      this.when.set(this.toLocalInput(entry.publishedAt));
    }
  }

  private async load(entryId: string): Promise<void> {
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.query<{ entry: EntrySchedule | null }>({
          query: ENTRY_SCHEDULE,
          variables: { id: entryId },
          fetchPolicy: 'network-only',
        }),
      );
      if (res.data?.entry) this.apply(res.data.entry);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load status.');
    }
  }

  protected async schedule(): Promise<void> {
    const value = this.when();
    if (this.busy() || !value) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate<{ scheduleEntry: EntrySchedule }>({
          mutation: SCHEDULE_ENTRY,
          // datetime-local is local wall-clock; toISOString normalizes to UTC.
          variables: { id: this.entryId(), publishAt: new Date(value).toISOString() },
        }),
      );
      if (res.data?.scheduleEntry) this.apply(res.data.scheduleEntry);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to schedule.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async unschedule(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate<{ unscheduleEntry: EntrySchedule }>({
          mutation: UNSCHEDULE_ENTRY,
          variables: { id: this.entryId() },
        }),
      );
      if (res.data?.unscheduleEntry) this.apply(res.data.unscheduleEntry);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to unschedule.');
    } finally {
      this.busy.set(false);
    }
  }
}

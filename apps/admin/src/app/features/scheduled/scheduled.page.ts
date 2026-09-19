import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, of, map, switchMap, firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import {
  MkButton,
  MkEmptyState,
  MkPageHeader,
  MkSkeletonPreset,
  MkTable,
  MkTableColumn,
} from '@mk-kit/ui';
import { CONTENT_TYPES, ENTRIES, PUBLISH_ENTRY } from '../../core/graphql/operations';
import { ConfirmService } from '../../core/ui/confirm.service';

/** A content type as returned by CONTENT_TYPES (only the fields we use). */
interface ContentTypeRow {
  slug: string;
  name: string;
}

/** One scheduled entry as returned by ENTRIES (the fields we select). */
interface RawEntry {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  publishedAt: string | null;
}

/** A scheduled entry enriched with its owning content type (ENTRIES omits `type`). */
interface ScheduledRow extends RawEntry {
  /** Content-type slug (from the fan-out loop, not the row). */
  type: string;
  /** Human-readable content-type name. */
  typeName: string;
}

/**
 * Reverse-of-scheduling: return a Scheduled entry to Draft. Mirrors the
 * `unscheduleEntry` doc used by the entry editor's schedule panel; success
 * toasts fire globally.
 */
const UNSCHEDULE_ENTRY = gql`
  mutation UnscheduleEntry($id: ID!) {
    unscheduleEntry(id: $id) {
      id
      status
      publishedAt
    }
  }
`;

/** How many scheduled rows we fetch per content type (a page is plenty). */
const PER_TYPE_LIMIT = 100;

/**
 * Scheduled-publishing queue: every upcoming Scheduled entry across all content
 * types, soonest first, with a live countdown and quick "Publish now" /
 * "Unschedule" actions. Fans `entries(type, status: Scheduled)` over
 * `contentTypes()` (like the dashboard) and flattens the result.
 */
@Component({
  selector: 'app-scheduled',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkButton,
    MkEmptyState,
    MkPageHeader,
    MkSkeletonPreset,
    MkTable,
  ],
  template: `
    <mk-page-header
      heading="Scheduled"
      description="Upcoming entries queued to publish automatically, soonest first."
    />

    @if (selected().length) {
      <div class="bulk">
        <span class="bulk__count">{{ selected().length }} selected</span>
        <button
          mkButton
          size="sm"
          variant="outline"
          tone="success"
          [loading]="busy()"
          (click)="publishSelected()"
        >
          Publish now
        </button>
        <button mkButton size="sm" variant="outline" [loading]="busy()" (click)="unscheduleSelected()">
          Unschedule
        </button>
      </div>
    }

    @if (scheduled() === null) {
      <mk-skeleton-preset preset="table" [rows]="6" [columns]="3" loadingLabel="Loading schedule…" />
    } @else if (scheduled()!.length === 0) {
      <mk-empty-state
        icon="calendar"
        title="No scheduled entries"
        description="Entries you schedule to publish later will appear here, ordered by their publish time."
      />
    } @else {
      <mk-table
        [columns]="columns"
        [data]="scheduled()!"
        trackKey="id"
        [selectable]="true"
        [(selected)]="selected"
        [hover]="true"
        [zebra]="true"
        [clickableRows]="true"
        (rowClick)="openEntry($event)"
        emptyMessage="No scheduled entries."
        [stackAt]="640"
      />
    }
  `,
  styles: `
    :host { display: block; }
    mk-page-header { display: block; margin-bottom: var(--mk-space-5); }
    .bulk { display: flex; align-items: center; gap: var(--mk-space-2); padding: var(--mk-space-2) var(--mk-space-3); background: var(--mk-surface-2); border-radius: var(--mk-radius-md); margin-bottom: var(--mk-space-3); }
    .bulk__count { font-weight: var(--mk-font-weight-medium); }
  `,
})
export class ScheduledPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  /** Bumped after a mutation to re-run the fan-out and refresh the queue. */
  private readonly reloadTick = signal(0);

  /** Guards the bulk handlers against double-submit. */
  protected readonly busy = signal(false);

  /** Rows ticked for a bulk publish/unschedule. */
  protected readonly selected = signal<ScheduledRow[]>([]);

  protected readonly columns: MkTableColumn<ScheduledRow>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      stack: 'title',
      format: (v) => (v ? String(v) : '(untitled)'),
    },
    { key: 'typeName', header: 'Type' },
    {
      key: 'publishedAt',
      header: 'Publishes',
      sortable: true,
      format: (v) => this.fmt(v as string | null),
    },
  ];

  /**
   * `null` while loading; a flat list of every Scheduled entry across all
   * content types once the per-type pages resolve. Each row carries its owning
   * content type (ENTRIES does not select `type`), attached from the fan-out.
   */
  private readonly rows = toSignal(
    toObservable(this.reloadTick).pipe(
      switchMap(() =>
        this.apollo
          .query<{ contentTypes: ContentTypeRow[] }>({
            query: CONTENT_TYPES,
            fetchPolicy: 'cache-first',
          })
          .pipe(
            map((r) => (r.data?.contentTypes ?? []) as ContentTypeRow[]),
            switchMap((types) =>
              types.length
                ? forkJoin(
                    types.map((t) =>
                      this.apollo
                        .query<{ entries: RawEntry[] }>({
                          query: ENTRIES,
                          variables: { type: t.slug, status: 'Scheduled', limit: PER_TYPE_LIMIT },
                          fetchPolicy: 'network-only',
                        })
                        .pipe(
                          map((res) =>
                            ((res.data?.entries ?? []) as RawEntry[]).map(
                              (e) =>
                                ({
                                  ...e,
                                  type: String(t.slug ?? ''),
                                  typeName: String(t.name ?? t.slug ?? ''),
                                }) satisfies ScheduledRow,
                            ),
                          ),
                        ),
                    ),
                  ).pipe(map((chunks) => chunks.flat()))
                : of([] as ScheduledRow[]),
            ),
          ),
      ),
    ),
    { initialValue: null },
  );

  /** `null` while loading; scheduled rows sorted by publish time (soonest first). */
  protected readonly scheduled = computed<ScheduledRow[] | null>(() => {
    const rows = this.rows();
    if (rows === null) return null;
    return [...rows].sort((a, b) => this.time(a.publishedAt) - this.time(b.publishedAt));
  });

  /** ISO instant → epoch ms; missing/invalid dates sort last. */
  private time(iso: string | null): number {
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  }

  /** ISO instant → `Date` for the countdown input (null when absent/invalid). */
  protected toDate(iso: string | null): Date | null {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Human-readable absolute publish time. */
  protected fmt(iso: string | null): string {
    const d = this.toDate(iso);
    return d ? d.toLocaleString() : '—';
  }

  /** Open the entry editor for a clicked row. */
  protected openEntry(row: ScheduledRow): void {
    void this.router.navigate(['/content', row.type, row.id]);
  }

  /** Publish every selected entry immediately (reuses `publishEntry`), then refresh. */
  protected async publishSelected(): Promise<void> {
    const rows = this.selected();
    if (!rows.length || this.busy()) return;
    this.busy.set(true);
    try {
      await Promise.all(
        rows.map((r) =>
          firstValueFrom(this.apollo.mutate({ mutation: PUBLISH_ENTRY, variables: { id: r.id } })),
        ),
      );
      this.selected.set([]);
      this.reloadTick.update((t) => t + 1);
    } catch {
      this.reloadTick.update((t) => t + 1);
    } finally {
      this.busy.set(false);
    }
  }

  /** Return every selected entry to Draft (`unscheduleEntry`) after confirming, then refresh. */
  protected async unscheduleSelected(): Promise<void> {
    const rows = this.selected();
    if (!rows.length || this.busy()) return;
    const subject = rows.length === 1 ? 'this entry' : `these ${rows.length} entries`;
    const ok = await this.confirm.confirm({
      title: `Unschedule ${subject}?`,
      message: `${rows.length === 1 ? 'It' : 'They'} will move back to Draft and won't publish automatically.`,
      confirmText: 'Unschedule',
      cancelText: 'Keep scheduled',
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await Promise.all(
        rows.map((r) =>
          firstValueFrom(this.apollo.mutate({ mutation: UNSCHEDULE_ENTRY, variables: { id: r.id } })),
        ),
      );
      this.selected.set([]);
      this.reloadTick.update((t) => t + 1);
    } catch {
      this.reloadTick.update((t) => t + 1);
    } finally {
      this.busy.set(false);
    }
  }
}

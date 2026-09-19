import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, of, map, switchMap } from 'rxjs';
import { Apollo } from 'apollo-angular';
import {
  MkStatCard,
  MkCard,
  MkPageHeader,
  MkButton,
  MkIcon,
  MkMenu,
  MkMenuItem,
  MkMenuTrigger,
  MkTimeline,
  MkTimelineItem,
  MkSkeletonPreset,
  MkBarChart,
  MkDonutChart,
  type MkChartSeries,
  type MkChartSlice,
  type MkTone,
} from '@mk-kit/ui';
import { CONTENT_TYPES, ENTRIES, AUDIT_LOG } from '../../core/graphql/operations';
import { SessionStore } from '../../core/session/session.store';

/** A content type as returned by CONTENT_TYPES (only the fields we use). */
interface ContentTypeRow {
  slug: string;
  name: string;
}

/** The four content statuses, as serialised by the GraphQL `ContentStatus` enum. */
type StatusKey = 'Published' | 'Draft' | 'Scheduled' | 'Trashed';
const STATUS_KEYS: readonly StatusKey[] = ['Published', 'Draft', 'Scheduled', 'Trashed'];
/** Palette token per status (validated `--mk-chart-N` categorical hues). */
const STATUS_COLORS: Record<StatusKey, string> = {
  Published: 'var(--mk-chart-1)',
  Draft: 'var(--mk-chart-2)',
  Scheduled: 'var(--mk-chart-3)',
  Trashed: 'var(--mk-chart-4)',
};

/** Per-type load: entry count plus a per-status tally, derived from one page of rows. */
interface TypeLoad {
  slug: string;
  name: string;
  count: number;
  /** True when the page came back full — the real count may be higher. */
  full: boolean;
  buckets: Record<StatusKey, number>;
}

/** One entry-count stat card. */
interface Stat {
  slug: string;
  name: string;
  count: number;
  /** True when the page came back full — the real count may be higher. */
  full: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  summary: string;
  createdAt: string;
}

/** How many rows we fetch per type to derive a count (no count query exists). */
const COUNT_LIMIT = 100;

/**
 * Landing screen after sign-in: a stat card per content type (entry counts,
 * click-through to the list) plus a "Recent activity" feed from the audit log.
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkStatCard,
    MkCard,
    MkPageHeader,
    MkButton,
    MkIcon,
    MkMenu,
    MkMenuItem,
    MkMenuTrigger,
    MkTimeline,
    MkTimelineItem,
    MkSkeletonPreset,
    MkBarChart,
    MkDonutChart,
  ],
  template: `
    <mk-page-header heading="Dashboard" [description]="'Welcome back' + greeting() + '.'">
      @if (typeList().length) {
        <div mkPageHeaderActions>
          <button mkButton tone="primary" [mkMenuTriggerFor]="createMenu">
            <mk-icon name="plus" size="sm" /> Create
          </button>
          <mk-menu #createMenu>
            @for (t of typeList(); track t.slug) {
              <mk-menu-item (action)="newEntry(t.slug)">
                <mk-icon mkMenuItemIcon name="file-text" size="sm" />
                New {{ t.name }}
              </mk-menu-item>
            }
          </mk-menu>
        </div>
      }
    </mk-page-header>

    <section class="section">
      <h2 class="section-title">Content</h2>
      @if (stats() === null) {
        <div class="grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <mk-skeleton-preset preset="card" />
          }
        </div>
      } @else if (stats()!.length === 0) {
        <mk-card><p class="muted">No content types yet.</p></mk-card>
      } @else {
        <div class="grid">
          @for (s of stats()!; track s.slug) {
            <button type="button" class="stat-link" (click)="openType(s.slug)">
              <mk-stat-card [label]="s.name" [value]="statValue(s)" />
            </button>
          }
        </div>
      }
    </section>

    <section class="section">
      <h2 class="section-title">Insights</h2>
      <div class="chart-grid">
        <mk-card>
          <h3 class="chart-title">Entries per content type</h3>
          @if (stats() === null) {
            <mk-skeleton-preset preset="card" />
          } @else if (barCategories().length === 0) {
            <p class="muted">No content yet.</p>
          } @else {
            <mk-bar-chart
              [categories]="barCategories()"
              [series]="barSeries()"
              [height]="240"
              [showGrid]="true"
              label="Number of entries in each content type"
            />
          }
        </mk-card>

        <mk-card>
          <h3 class="chart-title">Status breakdown</h3>
          @if (stats() === null) {
            <mk-skeleton-preset preset="card" />
          } @else if (donutSlices().length === 0) {
            <p class="muted">No content yet.</p>
          } @else {
            <mk-donut-chart
              [slices]="donutSlices()"
              [centerLabel]="totalLabel()"
              centerSublabel="entries"
              [showLegend]="true"
              [size]="240"
              label="Entries by publication status across all content"
            />
          }
        </mk-card>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Recent activity</h2>
      <mk-card>
        @if (activity().length === 0) {
          <p class="muted">No recent activity.</p>
        } @else {
          <mk-timeline>
            @for (e of activity(); track e.id) {
              <mk-timeline-item
                [tone]="tone(e.action)"
                [time]="fmt(e.createdAt)"
                [heading]="e.action"
              >
                {{ e.summary }}
                @if (e.actorEmail) { <span class="muted"> — {{ e.actorEmail }}</span> }
              </mk-timeline-item>
            }
          </mk-timeline>
        }
      </mk-card>
    </section>
  `,
  styles: `
    mk-page-header { display: block; margin-bottom: var(--mk-space-6); }
    .section { margin-bottom: var(--mk-space-6); }
    .section-title { margin: 0 0 var(--mk-space-3); font-size: var(--mk-font-size-lg); }
    .grid {
      display: grid;
      gap: var(--mk-space-4);
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    }
    .stat-link {
      display: block;
      text-align: inherit;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: var(--mk-radius-lg);
    }
    .stat-link > mk-stat-card { display: block; height: 100%; }
    .stat-link:focus-visible {
      outline: var(--mk-focus-ring-width, 2px) solid var(--mk-border-focus, var(--mk-primary));
      outline-offset: 2px;
    }
    .muted { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    .chart-grid {
      display: grid;
      gap: var(--mk-space-4);
      grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
    }
    .chart-title {
      margin: 0 0 var(--mk-space-3);
      font-size: var(--mk-font-size-md, var(--mk-font-size-sm));
      color: var(--mk-text-muted);
      font-weight: var(--mk-font-weight-medium, 500);
    }
  `,
})
export class DashboardPage {
  private readonly apollo = inject(Apollo);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  protected readonly greeting = computed(() => {
    const name = this.session.user()?.name;
    return name ? `, ${name}` : '';
  });

  /**
   * `null` while loading; one {@link TypeLoad} per content type once the
   * per-type entry pages resolve. Feeds the stat cards, the bar chart, and the
   * status donut — a single fan-out (one page per type) drives all three.
   */
  private readonly typeLoads = toSignal(
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
                    .query<{ entries: { id: string; status: string }[] }>({
                      query: ENTRIES,
                      variables: { type: t.slug, limit: COUNT_LIMIT },
                      fetchPolicy: 'network-only',
                    })
                    .pipe(
                      map((res) => {
                        const rows = (res.data?.entries ?? []) as {
                          id: string;
                          status: string;
                        }[];
                        const buckets: Record<StatusKey, number> = {
                          Published: 0,
                          Draft: 0,
                          Scheduled: 0,
                          Trashed: 0,
                        };
                        for (const row of rows) {
                          const key = String(row.status ?? '') as StatusKey;
                          if (key in buckets) buckets[key] += 1;
                        }
                        return {
                          slug: String(t.slug ?? ''),
                          name: String(t.name ?? t.slug ?? ''),
                          count: rows.length,
                          full: rows.length >= COUNT_LIMIT,
                          buckets,
                        } satisfies TypeLoad;
                      }),
                    ),
                ),
              )
            : of([] as TypeLoad[]),
        ),
      ),
    { initialValue: null },
  );

  /** `null` while loading; an array of stat cards once counts resolve. */
  protected readonly stats = computed<Stat[] | null>(() => {
    const loads = this.typeLoads();
    return loads === null
      ? null
      : loads.map((l) => ({ slug: l.slug, name: l.name, count: l.count, full: l.full }));
  });

  /** Category axis for the bar chart: one label per content type. */
  protected readonly barCategories = computed<string[]>(() =>
    (this.typeLoads() ?? []).map((l) => l.name),
  );

  /** Single "Entries" series aligned to {@link barCategories}. */
  protected readonly barSeries = computed<MkChartSeries[]>(() => [
    { name: 'Entries', data: (this.typeLoads() ?? []).map((l) => l.count) },
  ]);

  /** Donut slices: total entries per status across every content type. */
  protected readonly donutSlices = computed<MkChartSlice[]>(() => {
    const loads = this.typeLoads() ?? [];
    const totals: Record<StatusKey, number> = {
      Published: 0,
      Draft: 0,
      Scheduled: 0,
      Trashed: 0,
    };
    for (const l of loads) {
      for (const key of STATUS_KEYS) totals[key] += l.buckets[key];
    }
    return STATUS_KEYS.filter((key) => totals[key] > 0).map((key) => ({
      name: key,
      value: totals[key],
      color: STATUS_COLORS[key],
    }));
  });

  /** Total entries across all types (donut centre label). */
  protected readonly totalEntries = computed<number>(() =>
    (this.typeLoads() ?? []).reduce((n, l) => n + l.count, 0),
  );

  /** Stringified {@link totalEntries} for the donut `centerLabel` input. */
  protected readonly totalLabel = computed<string>(() => String(this.totalEntries()));

  protected readonly activity = toSignal(
    this.apollo
      .watchQuery<{ auditLog: AuditEntry[] }>({
        query: AUDIT_LOG,
        variables: { limit: 10 },
        fetchPolicy: 'cache-and-network',
      })
      .valueChanges.pipe(map((r) => (r.data?.auditLog ?? []) as AuditEntry[])),
    { initialValue: [] as AuditEntry[] },
  );

  /** Content types for the header's "Create" menu. */
  protected readonly typeList = computed(() =>
    (this.typeLoads() ?? []).map((l) => ({ slug: l.slug, name: l.name })),
  );

  protected statValue(s: Stat): string {
    return s.full ? `${s.count}+` : String(s.count);
  }

  protected openType(slug: string): void {
    void this.router.navigate(['/content', slug]);
  }

  protected newEntry(slug: string): void {
    void this.router.navigate(['/content', slug, 'new']);
  }

  protected fmt(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  /** Map an audit action to a timeline marker tone. */
  protected tone(action: string): MkTone {
    const a = String(action ?? '');
    if (a.includes('publish')) return 'success';
    if (a.includes('delete') || a.includes('trash')) return 'danger';
    if (a.includes('create')) return 'info';
    return 'neutral';
  }
}

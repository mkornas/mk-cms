import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { MkButton, MkInput, MkDatePicker, MkSkeletonPreset, MkPageHeader, MkTable, MkTableColumn } from '@mk-kit/ui';

/** Extended audit-log query adding actor + date-range filters. Defined inline
 *  here (rather than in the shared operations.ts) so this page can filter by
 *  actor email and a createdAt from/to window. */
const AUDIT_LOG_FILTERED = gql`
  query AuditLogFiltered(
    $action: String
    $actor: String
    $from: DateTime
    $to: DateTime
    $limit: Int
    $offset: Int
  ) {
    auditLog(action: $action, actor: $actor, from: $from, to: $to, limit: $limit, offset: $offset) {
      id action actorEmail targetType targetId summary createdAt
    }
  }
`;

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  createdAt: string;
}

const PAGE = 30;

/** Audit log viewer (`audit:read`): a chronological feed of admin actions, with
 *  an action filter and offset paging. */
@Component({
  selector: 'app-audit-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkInput, MkDatePicker, MkSkeletonPreset, MkPageHeader, MkTable],
  template: `
    <mk-page-header heading="Activity log" description="Who did what, and when — filterable by action, person and date." />

    <div class="toolbar">
      <input mkInput placeholder="Filter by action (e.g. content.published)"
        [value]="action()" (input)="setAction($event.target)" />
      <input mkInput placeholder="Filter by actor email"
        [value]="actor()" (input)="setActor($event.target)" />
      <mk-date-picker placeholder="From" [value]="from()" [clearable]="true"
        (valueChange)="setFrom($event)" />
      <mk-date-picker placeholder="To" [value]="to()" [clearable]="true"
        (valueChange)="setTo($event)" />
      <span class="spacer"></span>
      <button mkButton size="sm" variant="outline" [disabled]="entries().length === 0"
        (click)="exportCsv()" title="Exports the currently loaded (filtered) page">
        Export CSV
      </button>
    </div>

    @if (showSkeleton()) {
      <mk-skeleton-preset preset="table" [rows]="8" [columns]="4" loadingLabel="Loading audit log…" />
    } @else {
      <mk-table
        [columns]="columns"
        [data]="entries()"
        trackKey="id"
        [hover]="true"
        [zebra]="true"
        emptyMessage="No audit entries."
        [stackAt]="640"
      />
    }

    <div class="pager">
      <button mkButton size="sm" variant="outline" [disabled]="offset() === 0" (click)="prev()">← Previous</button>
      <button mkButton size="sm" variant="outline" [disabled]="entries().length < pageSize" (click)="next()">Next →</button>
    </div>
  `,
  styles: `
    :host { --page-max: 72rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: var(--mk-space-2); margin-bottom: var(--mk-space-3); }
    .toolbar input { max-width: 24rem; }
    .spacer { flex: 1; }
    .pager { display: flex; gap: var(--mk-space-2); margin-top: var(--mk-space-3); }
  `,
})
export class AuditLogPage {
  private readonly apollo = inject(Apollo);
  protected readonly action = signal('');
  protected readonly actor = signal('');
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);
  protected readonly offset = signal(0);
  protected readonly pageSize = PAGE;

  protected readonly columns: MkTableColumn<AuditEntry>[] = [
    { key: 'action', header: 'Action', width: '14rem', stack: 'title' },
    { key: 'actorEmail', header: 'Actor', format: (v) => (v ? String(v) : '—') },
    { key: 'summary', header: 'Summary' },
    { key: 'createdAt', header: 'When', align: 'end', format: (v) => new Date(String(v)).toLocaleString() },
  ];

  private readonly params = computed(() => ({
    action: this.action().trim(),
    actor: this.actor().trim(),
    from: this.from(),
    to: this.to(),
    offset: this.offset(),
  }));

  private readonly result = toSignal(
    toObservable(this.params).pipe(
      switchMap((p) =>
        this.apollo
          .watchQuery<{ auditLog: AuditEntry[] }>({
            query: AUDIT_LOG_FILTERED,
            variables: {
              action: p.action || undefined,
              actor: p.actor || undefined,
              from: p.from ? p.from.toISOString() : undefined,
              to: p.to ? p.to.toISOString() : undefined,
              limit: PAGE,
              offset: p.offset,
            },
            fetchPolicy: 'cache-and-network',
          })
          .valueChanges.pipe(
            map((r) => ({
              entries: (r.data?.auditLog ?? []) as AuditEntry[],
              loading: r.loading && !r.data?.auditLog,
            })),
          ),
      ),
    ),
    { initialValue: { entries: [] as AuditEntry[], loading: true } },
  );

  protected readonly entries = computed(() => this.result().entries);
  /** First-load skeleton: still loading with nothing to show yet. */
  protected readonly showSkeleton = computed(
    () => this.result().loading && this.entries().length === 0,
  );

  /** Quote a CSV field when it contains a comma, quote or newline, doubling
   *  any internal quotes per RFC 4180. */
  private csvCell(value: unknown): string {
    let s = String(value ?? '');
    // CSV-injection guard: a leading =/+/-/@ (or tab/CR) makes the cell a live
    // formula in Excel/Sheets. Prefix such cells with a single quote.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  /** Download the currently loaded (filtered) audit entries as a CSV file. */
  protected exportCsv(): void {
    const rows = this.entries();
    if (rows.length === 0) return;
    const columns: (keyof AuditEntry)[] = [
      'createdAt',
      'action',
      'actorEmail',
      'targetType',
      'targetId',
      'summary',
    ];
    const lines = [
      columns.join(','),
      ...rows.map((e) =>
        columns
          .map((c) => this.csvCell(c === 'createdAt' ? new Date(e.createdAt).toISOString() : e[c]))
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  protected setAction(t: EventTarget | null): void {
    this.action.set((t as HTMLInputElement)?.value ?? '');
    this.offset.set(0);
  }
  protected setActor(t: EventTarget | null): void {
    this.actor.set((t as HTMLInputElement)?.value ?? '');
    this.offset.set(0);
  }
  protected setFrom(d: Date | null): void {
    this.from.set(d);
    this.offset.set(0);
  }
  protected setTo(d: Date | null): void {
    this.to.set(d);
    this.offset.set(0);
  }
  protected prev(): void {
    this.offset.update((o) => Math.max(0, o - PAGE));
  }
  protected next(): void {
    if (this.entries().length === PAGE) this.offset.update((o) => o + PAGE);
  }
}

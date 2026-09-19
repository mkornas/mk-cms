import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { ConfirmService } from '../../core/ui/confirm.service';
import { MkTable, MkTableCell, MkTableColumn, MkTag, MkTone, MkButton, MkInput, MkSkeletonPreset, MkPageHeader, MkTabs, MkTab } from '@mk-kit/ui';
import {
  ENTRIES,
  PUBLISH_ENTRY,
  UNPUBLISH_ENTRY,
  TRASH_ENTRY,
} from '../../core/graphql/operations';

interface EntryRow {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  locale: string;
  updatedAt: string;
}

/** Restore a trashed entry back to Draft. */
const RESTORE_ENTRY = gql`
  mutation RestoreEntry($id: ID!) {
    restoreEntry(id: $id) {
      id
      status
    }
  }
`;

/** Permanently delete an entry. */
const DELETE_ENTRY = gql`
  mutation DeleteEntry($id: ID!) {
    deleteEntry(id: $id)
  }
`;

/** Clone an entry into a fresh Draft copy. */
const DUPLICATE_ENTRY = gql`
  mutation DuplicateEntry($id: ID!) {
    duplicateEntry(id: $id) {
      id
    }
  }
`;

const PAGE_SIZE = 25;
/** Status tabs — `null` = all statuses. Values are the GraphQL enum keys. */
const TABS: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Published', value: 'Published' },
  { label: 'Draft', value: 'Draft' },
  { label: 'Scheduled', value: 'Scheduled' },
  { label: 'Trashed', value: 'Trashed' },
];

/**
 * List view for one content type: status tabs + offset pagination (server-side),
 * a client-side title filter over the current page, row selection with bulk
 * publish/unpublish/trash, and click-to-edit.
 */
@Component({
  selector: 'app-content-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkTable, MkTableCell, MkTag, MkButton, MkInput, MkSkeletonPreset, MkPageHeader, MkTabs, MkTab],
  templateUrl: './content-list.page.html',
  styles: `
    mk-page-header { display: block; margin-bottom: var(--mk-space-4); }
    .tabs { margin-bottom: var(--mk-space-3); }
    .toolbar { display: flex; align-items: center; gap: var(--mk-space-3); margin-bottom: var(--mk-space-3); }
    .toolbar input { min-width: 16rem; }
    .toolbar .spacer { flex: 1; }
    .bulk { display: flex; align-items: center; gap: var(--mk-space-2); padding: var(--mk-space-2) var(--mk-space-3); background: var(--mk-surface-2); border-radius: var(--mk-radius-md); margin-bottom: var(--mk-space-3); }
    .bulk .count { font-weight: var(--mk-font-weight-medium); }
    .pager { display: flex; align-items: center; gap: var(--mk-space-3); margin-top: var(--mk-space-3); }
    .pager .range { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
  `,
})
export class ContentListPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  /** Content-type slug from the route (`/content/:type`). */
  readonly type = input.required<string>();

  /** Capitalised content-type slug for the page heading. */
  protected readonly typeLabel = computed(() => {
    const t = this.type();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  });

  protected readonly status = signal<string | null>(null);
  protected readonly offset = signal(0);
  protected readonly filter = signal('');
  protected readonly selected = signal<EntryRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly tabs = TABS;
  protected readonly pageSize = PAGE_SIZE;
  /** Bumped to force a refetch of the current page after a mutation. */
  private readonly reloadTick = signal(0);

  protected readonly columns: MkTableColumn<EntryRow>[] = [
    { key: 'title', header: 'Title', sortable: true, stack: 'title' },
    { key: 'slug', header: 'Slug', stack: 'hide' },
    { key: 'status', header: 'Status', align: 'center' },
    { key: 'locale', header: 'Locale', align: 'center', stack: 'hide' },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      format: (v) => (v ? new Date(String(v)).toLocaleString() : '—'),
    },
  ];

  /** Tone for the status tag rendered by the `status` cell template. */
  protected statusTone(status: unknown): MkTone {
    switch (String(status)) {
      case 'Published': return 'success';
      case 'Scheduled': return 'info';
      case 'Trashed': return 'danger';
      default: return 'neutral';
    }
  }

  private readonly params = computed(() => ({
    type: this.type(),
    status: this.status(),
    offset: this.offset(),
    tick: this.reloadTick(),
  }));

  /** True while a page/status query is in flight. */
  protected readonly loading = signal(true);

  protected readonly entries = toSignal(
    toObservable(this.params).pipe(
      switchMap((p) => {
        this.loading.set(true);
        return this.apollo
          .watchQuery<{ entries: EntryRow[] }>({
            query: ENTRIES,
            variables: {
              type: p.type,
              status: p.status ?? undefined,
              limit: PAGE_SIZE,
              offset: p.offset,
            },
            fetchPolicy: 'network-only',
          })
          .valueChanges.pipe(
            map((r) => {
              this.loading.set(false);
              return (r.data?.entries ?? []) as EntryRow[];
            }),
          );
      }),
    ),
    { initialValue: [] as EntryRow[] },
  );

  /** Show the table skeleton only on a cold load (no rows to show yet). */
  protected readonly showSkeleton = computed(() => this.loading() && this.entries().length === 0);

  /** Client-side title filter over the current page. */
  protected readonly visible = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const rows = this.entries();
    return q ? rows.filter((e) => e.title.toLowerCase().includes(q)) : rows;
  });

  protected readonly hasPrev = computed(() => this.offset() > 0);
  protected readonly hasNext = computed(() => this.entries().length === PAGE_SIZE);
  protected readonly rangeLabel = computed(() => {
    const start = this.entries().length ? this.offset() + 1 : 0;
    return `${start}–${this.offset() + this.entries().length}`;
  });

  protected setInput(target: EventTarget | null): void {
    this.filter.set((target as HTMLInputElement)?.value ?? '');
  }

  protected setStatus(value: string | null): void {
    this.status.set(value);
    this.offset.set(0);
    this.selected.set([]);
  }

  /** Index of the active status tab (for the mk-tabs strip). */
  protected readonly tabIndex = computed(() =>
    Math.max(0, TABS.findIndex((t) => t.value === this.status())),
  );

  protected setTabIndex(index: number): void {
    this.setStatus(TABS[index]?.value ?? null);
  }

  protected prev(): void {
    if (this.hasPrev()) this.offset.update((o) => Math.max(0, o - PAGE_SIZE));
    this.selected.set([]);
  }
  protected next(): void {
    if (this.hasNext()) this.offset.update((o) => o + PAGE_SIZE);
    this.selected.set([]);
  }

  protected newEntry(): void {
    void this.router.navigate(['/content', this.type(), 'new']);
  }
  protected openEntry(row: EntryRow): void {
    void this.router.navigate(['/content', this.type(), row.id]);
  }

  private async bulk(mutation: unknown, verb: string): Promise<void> {
    const rows = this.selected();
    if (!rows.length || this.busy()) return;
    this.busy.set(true);
    try {
      await Promise.all(
        rows.map((r) =>
          firstValueFrom(this.apollo.mutate({ mutation: mutation as never, variables: { id: r.id } })),
        ),
      );
      this.selected.set([]);
      this.reloadTick.update((t) => t + 1);
    } catch {
      /* surfaced per-row failures are rare; a refetch shows the true state */
      this.reloadTick.update((t) => t + 1);
    } finally {
      this.busy.set(false);
    }
    void verb;
  }

  protected bulkPublish(): void {
    void this.bulk(PUBLISH_ENTRY, 'publish');
  }
  protected bulkUnpublish(): void {
    void this.bulk(UNPUBLISH_ENTRY, 'unpublish');
  }
  protected async bulkTrash(): Promise<void> {
    const n = this.selected().length;
    if (!n) return;
    const subject = n === 1 ? 'this entry' : `these ${n} entries`;
    if (!(await this.confirm.confirm({
      title: `Move ${subject} to trash?`,
      message: 'Trashed entries are hidden from the site but can be restored.',
      confirmText: 'Move to trash',
      tone: 'danger',
      icon: 'trash',
    }))) return;
    void this.bulk(TRASH_ENTRY, 'trash');
  }

  protected bulkRestore(): void {
    void this.bulk(RESTORE_ENTRY, 'restore');
  }

  protected bulkDuplicate(): void {
    void this.bulk(DUPLICATE_ENTRY, 'duplicate');
  }

  protected async bulkDelete(): Promise<void> {
    if (!this.selected().length) return;
    if (!(await this.confirm.remove(
      'the selected entries',
      'Permanently delete these entries? This cannot be undone.',
    ))) return;
    void this.bulk(DELETE_ENTRY, 'delete');
  }
}

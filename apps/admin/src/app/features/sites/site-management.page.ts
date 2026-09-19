import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import {
  MkButton,
  MkTable,
  MkTableColumn,
  MkPageHeader,
  MkEmptyState,
  MkSkeletonPreset,
  MkDialogService,
} from '@mk-kit/ui';
import { ConfirmService } from '../../core/ui/confirm.service';
import { SITES, DELETE_SITE } from '../../core/graphql/operations';
import { SiteEditDialog, SiteDialogData, SiteLite } from './site-edit.dialog';

interface Site extends SiteLite {}

/** Row shape rendered by the table (adds a derived domain-count label). */
interface SiteRow extends Site {
  domainCount: number;
}

/**
 * Site (tenant) management: a data table of every site with click-to-edit, plus
 * create via a focused dialog and multi-select delete. The edit dialog owns the
 * richer editor (details, domains, members). Gated by `site:manage` on the API.
 */
@Component({
  selector: 'app-site-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkTable, MkPageHeader, MkEmptyState, MkSkeletonPreset],
  templateUrl: './site-management.page.html',
  styles: `
    .head-actions { display: flex; gap: var(--mk-space-2); }
    .bulk { display: flex; align-items: center; gap: var(--mk-space-2); padding: var(--mk-space-2) var(--mk-space-3); background: var(--mk-surface-2); border-radius: var(--mk-radius-md); margin-bottom: var(--mk-space-3); }
    .bulk__count { font-weight: var(--mk-font-weight-medium); }
  `,
})
export class SiteManagementPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly dialog = inject(MkDialogService);

  private readonly sitesRef = this.apollo.watchQuery<{ sites: Site[] }>({
    query: SITES,
    fetchPolicy: 'cache-and-network',
  });
  protected readonly sites = toSignal(
    this.sitesRef.valueChanges.pipe(map((r) => (r.data?.sites ?? []) as Site[])),
    { initialValue: [] as Site[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.sitesRef.valueChanges.pipe(map((r) => r.loading && !r.data?.sites)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.sites().length === 0,
  );

  protected readonly selected = signal<SiteRow[]>([]);
  /** Guards the bulk-delete handler against double-submit. */
  protected readonly busy = signal(false);

  protected readonly columns: MkTableColumn<SiteRow>[] = [
    { key: 'name', header: 'Name', sortable: true, stack: 'title' },
    { key: 'slug', header: 'Slug', sortable: true },
    { key: 'status', header: 'Status', align: 'center' },
    { key: 'domainCount', header: 'Domains', align: 'center', format: (v) => String(v) },
  ];

  protected readonly rows = computed<SiteRow[]>(() =>
    this.sites().map((s) => ({ ...s, domainCount: s.domains.length })),
  );

  private async openDialog(data: SiteDialogData): Promise<void> {
    const ref = this.dialog.open<SiteEditDialog, boolean, SiteDialogData>(SiteEditDialog, {
      data,
      size: data.mode === 'edit' ? 'md' : 'sm',
    });
    const changed = await ref.afterClosed;
    if (changed) await this.sitesRef.refetch();
  }

  protected openNew(): void {
    void this.openDialog({ mode: 'create' });
  }
  protected openEdit(row: SiteRow): void {
    void this.openDialog({ mode: 'edit', site: row });
  }

  protected async bulkDelete(): Promise<void> {
    const rows = this.selected();
    if (!rows.length || this.busy()) return;
    const subject = rows.length === 1 ? `the “${rows[0].name}” site` : `these ${rows.length} sites`;
    if (!(await this.confirm.remove(subject, "This removes the sites and all of their content. This can't be undone."))) return;
    this.busy.set(true);
    try {
      await Promise.all(
        rows.map((r) => firstValueFrom(this.apollo.mutate({ mutation: DELETE_SITE, variables: { id: r.id } }))),
      );
      this.selected.set([]);
      await this.sitesRef.refetch();
    } catch {
      await this.sitesRef.refetch();
    } finally {
      this.busy.set(false);
    }
  }
}

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
  MkInput,
  MkTable,
  MkTableCell,
  MkTableColumn,
  MkTag,
  MkTone,
  MkPageHeader,
  MkEmptyState,
  MkSkeletonPreset,
  MkDialogService,
} from '@mk-kit/ui';
import { ConfirmService } from '../../core/ui/confirm.service';
import { USERS, DELETE_USER } from '../../core/graphql/operations';
import { UserEditDialog, UserDialogData, UserLite } from './user-edit.dialog';

interface User extends UserLite {}

/** Row shape rendered by the table (adds a derived, human-readable access label). */
interface UserRow extends User {
  access: string;
}

/**
 * User management: a data table of every user with click-to-edit, plus create /
 * invite via a focused dialog and multi-select delete. Users are global; site
 * access is granted separately (Sites). Gated by `user:manage` on the API.
 */
@Component({
  selector: 'app-user-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkInput, MkTable, MkTableCell, MkTag, MkPageHeader, MkEmptyState, MkSkeletonPreset],
  templateUrl: './user-management.page.html',
  styles: `
    .head-actions { display: flex; gap: var(--mk-space-2); }
    .toolbar { display: flex; align-items: center; gap: var(--mk-space-3); margin-bottom: var(--mk-space-3); }
    .toolbar__filter { min-width: 18rem; }
    .toolbar__spacer { flex: 1; }
    .bulk { display: flex; align-items: center; gap: var(--mk-space-2); padding: var(--mk-space-2) var(--mk-space-3); background: var(--mk-surface-2); border-radius: var(--mk-radius-md); margin-bottom: var(--mk-space-3); }
    .bulk__count { font-weight: var(--mk-font-weight-medium); }
  `,
})
export class UserManagementPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly dialog = inject(MkDialogService);

  private readonly usersRef = this.apollo.watchQuery<{ users: User[] }>({
    query: USERS,
    fetchPolicy: 'cache-and-network',
  });
  protected readonly users = toSignal(
    this.usersRef.valueChanges.pipe(map((r) => (r.data?.users ?? []) as User[])),
    { initialValue: [] as User[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.usersRef.valueChanges.pipe(map((r) => r.loading && !r.data?.users)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.users().length === 0,
  );

  protected readonly filter = signal('');
  protected readonly selected = signal<UserRow[]>([]);
  /** Guards the bulk-delete handler against double-submit. */
  protected readonly busy = signal(false);

  protected readonly columns: MkTableColumn<UserRow>[] = [
    { key: 'name', header: 'Name', sortable: true, stack: 'title' },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'status', header: 'Status', align: 'center' },
    { key: 'access', header: 'Access', align: 'center' },
  ];

  /** Tone for the status tag rendered by the `status` cell template. */
  protected statusTone(status: unknown): MkTone {
    switch (String(status)) {
      case 'Active': return 'success';
      case 'Invited': return 'info';
      case 'Suspended': return 'danger';
      default: return 'neutral';
    }
  }

  private readonly rows = computed<UserRow[]>(() =>
    this.users().map((u) => ({ ...u, access: u.isSuperAdmin ? 'Super admin' : 'Member' })),
  );

  /** Client-side filter over name + email. */
  protected readonly visible = computed<UserRow[]>(() => {
    const q = this.filter().trim().toLowerCase();
    const rows = this.rows();
    return q
      ? rows.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : rows;
  });

  protected setFilter(target: EventTarget | null): void {
    this.filter.set((target as HTMLInputElement)?.value ?? '');
  }

  private async openDialog(data: UserDialogData): Promise<void> {
    const ref = this.dialog.open<UserEditDialog, boolean, UserDialogData>(UserEditDialog, { data });
    const changed = await ref.afterClosed;
    if (changed) await this.usersRef.refetch();
  }

  protected openNew(): void {
    void this.openDialog({ mode: 'create' });
  }
  protected openInvite(): void {
    void this.openDialog({ mode: 'invite' });
  }
  protected openEdit(row: UserRow): void {
    void this.openDialog({ mode: 'edit', user: row });
  }

  protected async bulkDelete(): Promise<void> {
    const rows = this.selected();
    if (!rows.length || this.busy()) return;
    const subject = rows.length === 1 ? `user “${rows[0].email}”` : `these ${rows.length} users`;
    if (!(await this.confirm.remove(subject))) return;
    this.busy.set(true);
    try {
      await Promise.all(
        rows.map((r) => firstValueFrom(this.apollo.mutate({ mutation: DELETE_USER, variables: { id: r.id } }))),
      );
      this.selected.set([]);
      await this.usersRef.refetch();
    } catch {
      await this.usersRef.refetch();
    } finally {
      this.busy.set(false);
    }
  }
}

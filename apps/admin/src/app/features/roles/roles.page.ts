import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import {
  MkButton,
  MkTable,
  MkTableColumn,
  MkPageHeader,
  MkSkeletonPreset,
  MkDialogService,
} from '@mk-kit/ui';
import { RoleEditDialog, RoleDialogData, RoleLite } from './role-edit.dialog';
import { RoleViewDialog, RoleViewData } from './role-view.dialog';

/** Shape returned by the `roles` / `siteRoles` queries (deep-partial from Apollo). */
interface RoleInfo {
  id: string;
  slug: string;
  name: string;
  capabilities: string[];
}

/** Row rendered by the roles table (system + custom combined). */
interface RoleRow {
  id: string;
  slug: string;
  name: string;
  kind: 'System' | 'Custom';
  capabilities: string[];
  capCount: number;
  hasAll: boolean;
}

const ROLES = gql`
  query Roles {
    roles {
      id
      slug
      name
      capabilities
    }
  }
`;

const SITE_ROLES = gql`
  query SiteRoles {
    siteRoles {
      id
      slug
      name
      capabilities
    }
  }
`;

/**
 * Roles & capabilities. One compact table of every role (read-only system
 * templates + this site's custom roles). Clicking a system role opens a
 * read-only capability viewer; clicking a custom role opens the edit dialog.
 * Managing custom roles is gated by `role:manage` on the API.
 */
@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkTable, MkPageHeader, MkSkeletonPreset],
  templateUrl: './roles.page.html',
  styles: `
    :host { --page-max: 64rem; }
  `,
})
export class RolesPage {
  private readonly apollo = inject(Apollo);
  private readonly dialog = inject(MkDialogService);

  protected readonly loading = signal(true);

  private readonly systemRoles = toSignal(
    this.apollo
      .watchQuery<{ roles: RoleInfo[] }>({ query: ROLES, fetchPolicy: 'cache-and-network' })
      .valueChanges.pipe(
        map((r) => {
          this.loading.set(r.loading);
          return (r.data?.roles ?? []) as RoleInfo[];
        }),
      ),
    { initialValue: [] as RoleInfo[] },
  );

  private readonly siteRolesRef = this.apollo.watchQuery<{ siteRoles: RoleInfo[] }>({
    query: SITE_ROLES,
    fetchPolicy: 'cache-and-network',
  });
  private readonly siteRoles = toSignal(
    this.siteRolesRef.valueChanges.pipe(map((r) => (r.data?.siteRoles ?? []) as RoleInfo[])),
    { initialValue: [] as RoleInfo[] },
  );

  /** System roles first, then this site's custom roles — one flat table. */
  protected readonly rows = computed<RoleRow[]>(() => [
    ...this.systemRoles().map((r) => this.toRow(r, 'System')),
    ...this.siteRoles().map((r) => this.toRow(r, 'Custom')),
  ]);

  protected readonly columns: MkTableColumn<RoleRow>[] = [
    { key: 'name', header: 'Role', sortable: true, stack: 'title' },
    { key: 'kind', header: 'Type', align: 'center' },
    { key: 'slug', header: 'Slug', sortable: true },
    {
      key: 'capCount',
      header: 'Capabilities',
      align: 'center',
      format: (v, row) =>
        row.hasAll ? 'All capabilities' : `${v} ${Number(v) === 1 ? 'capability' : 'capabilities'}`,
    },
  ];

  protected readonly showSkeleton = computed(
    () => this.loading() && this.systemRoles().length === 0,
  );

  private toRow(role: RoleInfo, kind: 'System' | 'Custom'): RoleRow {
    const caps = (role.capabilities ?? []).map((c) => String(c ?? ''));
    return {
      id: String(role.id ?? ''),
      slug: String(role.slug ?? ''),
      name: String(role.name ?? ''),
      kind,
      capabilities: caps,
      capCount: caps.length,
      hasAll: caps.includes('*'),
    };
  }

  /** System roles → read-only viewer; custom roles → edit dialog. */
  protected openRow(row: RoleRow): void {
    if (row.kind === 'System') {
      this.dialog.open<RoleViewDialog, void, RoleViewData>(RoleViewDialog, {
        data: { name: row.name, slug: row.slug, capabilities: row.capabilities },
        ariaLabel: `${row.name} capabilities`,
        size: 'md',
      });
      return;
    }
    const role: RoleLite = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      capabilities: row.capabilities,
    };
    void this.openDialog({ mode: 'edit', role });
  }

  protected openNew(): void {
    void this.openDialog({ mode: 'create' });
  }

  private async openDialog(data: RoleDialogData): Promise<void> {
    const ref = this.dialog.open<RoleEditDialog, boolean, RoleDialogData>(RoleEditDialog, { data, size: 'lg' });
    const changed = await ref.afterClosed;
    if (changed) await this.siteRolesRef.refetch();
  }
}

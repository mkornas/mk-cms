import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import {
  MkButton,
  MkFormField,
  MkInput,
  MkCheckbox,
  MkOverlayRef,
  MK_OVERLAY_DATA,
} from '@mk-kit/ui';
import { ConfirmService } from '../../core/ui/confirm.service';

export interface RoleLite {
  id: string;
  slug: string;
  name: string;
  capabilities: string[];
}

export type RoleDialogMode = 'create' | 'edit';

export interface RoleDialogData {
  mode: RoleDialogMode;
  /** Required for `edit`. */
  role?: RoleLite;
}

/** A pickable capability grouped under its resource prefix. */
interface CatalogItem {
  cap: string;
  action: string;
}
interface CatalogGroup {
  resource: string;
  items: CatalogItem[];
}

const CAPABILITY_CATALOG = gql`
  query CapabilityCatalog {
    capabilityCatalog
  }
`;

const CREATE_ROLE = gql`
  mutation CreateRole($input: CreateRoleInput!) {
    createRole(input: $input) {
      id
      slug
      name
      capabilities
    }
  }
`;

const UPDATE_ROLE = gql`
  mutation UpdateRole($id: ID!, $input: UpdateRoleInput!) {
    updateRole(id: $id, input: $input) {
      id
      slug
      name
      capabilities
    }
  }
`;

const DELETE_ROLE = gql`
  mutation DeleteRole($id: ID!) {
    deleteRole(id: $id)
  }
`;

/**
 * Create / edit a custom role in a focused overlay: name, slug (immutable once
 * created) and a capability picker grouped by resource. Owns its mutations
 * (success + error surface as global toasts) and closes with `true` when it
 * changed data so the caller can refetch. Edit mode adds a danger-zone delete.
 */
@Component({
  selector: 'app-role-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkFormField, MkInput, MkCheckbox],
  template: `
    <div class="dlg">
      <header class="dlg__head">
        <h2>{{ mode === 'edit' ? 'Edit role' : 'New role' }}</h2>
        <button mkButton variant="ghost" size="sm" iconOnly aria-label="Close" (click)="cancel()">✕</button>
      </header>

      <div class="dlg__body">
        <div class="dlg__grid">
          <mk-form-field label="Name" hint="e.g. Content moderator">
            <input mkInput [value]="name()" (input)="set($event.target, name.set)" />
          </mk-form-field>
          <mk-form-field label="Slug" [hint]="mode === 'edit' ? 'Immutable once created' : 'lowercase, e.g. moderator'">
            <input mkInput [value]="slug()" [disabled]="mode === 'edit'" (input)="set($event.target, slug.set)" />
          </mk-form-field>
        </div>

        <div>
          <span class="dlg__caps-label">Capabilities</span>
          <div class="dlg__picker">
            @for (group of catalogGroups(); track group.resource) {
              <div class="pick-group">
                <span class="pick-group__label">{{ group.resource }}</span>
                <div class="pick-group__list">
                  @for (item of group.items; track item.cap) {
                    <mk-checkbox [checked]="isSelected(item.cap)" (checkedChange)="toggleCap(item.cap, $event)">
                      {{ item.action === '*' ? 'all' : item.action }}
                    </mk-checkbox>
                  }
                </div>
              </div>
            } @empty {
              <p class="mk-muted">No capabilities available.</p>
            }
          </div>
        </div>
      </div>

      <footer class="dlg__foot">
        @if (mode === 'edit' && data.role) {
          <button mkButton variant="ghost" tone="danger" [disabled]="busy()" (click)="remove()">Delete role</button>
        }
        <span class="dlg__spacer"></span>
        <button mkButton variant="ghost" [disabled]="busy()" (click)="cancel()">Cancel</button>
        <button mkButton tone="primary" [loading]="busy()" [disabled]="busy() || !canSave()" (click)="save()">
          {{ mode === 'edit' ? 'Save changes' : 'Create role' }}
        </button>
      </footer>
    </div>
  `,
  styles: `
    .dlg { display: flex; flex-direction: column; min-height: 0; }
    .dlg__head { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); margin-bottom: var(--mk-space-4); }
    .dlg__head h2 { margin: 0; font-size: var(--mk-font-size-lg); }
    .dlg__body { display: flex; flex-direction: column; gap: var(--mk-space-4); overflow: auto; }
    .dlg__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--mk-space-3); max-width: 34rem; }
    @media (max-width: 34rem) { .dlg__grid { grid-template-columns: 1fr; } }
    .dlg__caps-label { display: block; margin-bottom: var(--mk-space-2); font-weight: var(--mk-font-weight-medium); }
    /* Groups flow into as many columns as fit — uses the dialog's width instead
       of stacking into one tall list. */
    .dlg__picker { display: grid; gap: var(--mk-space-3); grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); align-items: start; }
    .pick-group { border: var(--mk-border-width) solid var(--mk-border-subtle); border-radius: var(--mk-radius-md); padding: var(--mk-space-3); }
    .pick-group__label { display: block; font-size: var(--mk-font-size-sm); font-weight: var(--mk-font-weight-medium); margin-bottom: var(--mk-space-2); text-transform: capitalize; }
    .pick-group__list { display: flex; flex-direction: column; gap: var(--mk-space-2); }
    .dlg__foot { display: flex; align-items: center; gap: var(--mk-space-2); margin-top: var(--mk-space-5); }
    .dlg__spacer { flex: 1; }
  `,
})
export class RoleEditDialog {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly ref = inject<MkOverlayRef<boolean>>(MkOverlayRef);
  protected readonly data = inject<RoleDialogData>(MK_OVERLAY_DATA);

  protected readonly mode = this.data.mode;

  private readonly catalog = toSignal(
    this.apollo
      .watchQuery<{ capabilityCatalog: string[] }>({
        query: CAPABILITY_CATALOG,
        fetchPolicy: 'cache-and-network',
      })
      .valueChanges.pipe(map((r) => (r.data?.capabilityCatalog ?? []) as string[])),
    { initialValue: [] as string[] },
  );

  protected readonly name = signal(this.data.role?.name ?? '');
  protected readonly slug = signal(this.data.role?.slug ?? '');
  protected readonly selected = signal<ReadonlySet<string>>(
    new Set((this.data.role?.capabilities ?? []).map((c) => String(c ?? ''))),
  );
  protected readonly busy = signal(false);

  /** Capability catalog grouped by resource prefix, for the picker. */
  protected readonly catalogGroups = computed<CatalogGroup[]>(() => {
    const groups = new Map<string, CatalogItem[]>();
    for (const raw of this.catalog()) {
      const cap = String(raw ?? '');
      if (!cap) continue;
      const [resource, action = '*'] = cap.split(':');
      const list = groups.get(resource) ?? [];
      list.push({ cap, action });
      groups.set(resource, list);
    }
    return [...groups.entries()]
      .map(([resource, items]) => ({
        resource,
        items: items.sort((a, b) => a.action.localeCompare(b.action)),
      }))
      .sort((a, b) => a.resource.localeCompare(b.resource));
  });

  protected set(t: EventTarget | null, setter: (v: string) => void): void {
    setter((t as HTMLInputElement)?.value ?? '');
  }

  protected isSelected(cap: string): boolean {
    return this.selected().has(cap);
  }

  protected toggleCap(cap: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(cap);
    else next.delete(cap);
    this.selected.set(next);
  }

  protected canSave(): boolean {
    if (!this.name().trim()) return false;
    if (this.mode === 'create' && !this.slug().trim()) return false;
    return true;
  }

  protected async save(): Promise<void> {
    if (!this.canSave() || this.busy()) return;
    this.busy.set(true);
    const capabilities = [...this.selected()];
    try {
      if (this.mode === 'edit' && this.data.role) {
        await firstValueFrom(
          this.apollo.mutate({
            mutation: UPDATE_ROLE,
            variables: { id: this.data.role.id, input: { name: this.name().trim(), capabilities } },
          }),
        );
      } else {
        await firstValueFrom(
          this.apollo.mutate({
            mutation: CREATE_ROLE,
            variables: { input: { name: this.name().trim(), slug: this.slug().trim(), capabilities } },
          }),
        );
      }
      this.ref.close(true);
    } catch {
      // Error surfaced as a global toast; keep the dialog open.
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const role = this.data.role;
    if (!role || this.busy()) return;
    if (!(await this.confirm.remove(`the role “${role.name}”`))) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.apollo.mutate({ mutation: DELETE_ROLE, variables: { id: role.id } }));
      this.ref.close(true);
    } catch {
      // Error surfaced as a global toast; keep the dialog open.
    } finally {
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.ref.close(false);
  }
}

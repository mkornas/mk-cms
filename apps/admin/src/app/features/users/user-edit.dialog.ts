import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import {
  MkButton,
  MkFormField,
  MkInput,
  MkSelect,
  MkSwitch,
  MkDivider,
  MkOverlayRef,
  MK_OVERLAY_DATA,
} from '@mk-kit/ui';
import { ConfirmService } from '../../core/ui/confirm.service';
import {
  CREATE_USER,
  UPDATE_USER,
  SET_USER_PASSWORD,
  DELETE_USER,
} from '../../core/graphql/operations';

export interface UserLite {
  id: string;
  email: string;
  name: string;
  status: string;
  isSuperAdmin: boolean;
}

export type UserDialogMode = 'create' | 'invite' | 'edit';

export interface UserDialogData {
  mode: UserDialogMode;
  /** Required for `edit`. */
  user?: UserLite;
}

/** Invite a user by email; they set their own password via an emailed link. */
const INVITE_USER = gql`
  mutation InviteUser($email: String!, $name: String!, $isSuperAdmin: Boolean) {
    inviteUser(email: $email, name: $name, isSuperAdmin: $isSuperAdmin) {
      id
    }
  }
`;

const STATUSES = ['Active', 'Invited', 'Suspended'];

/**
 * Create / invite / edit a user in a focused overlay. The dialog owns its
 * mutations (success + error surface as global toasts via the notify link) and
 * closes with `true` when it changed data so the caller can refetch. Edit mode
 * additionally exposes a password reset and a danger-zone delete.
 */
@Component({
  selector: 'app-user-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkFormField, MkInput, MkSelect, MkSwitch, MkDivider],
  template: `
    <div class="dlg">
      <header class="dlg__head">
        <h2>{{ title() }}</h2>
        <button mkButton variant="ghost" size="sm" iconOnly aria-label="Close" (click)="cancel()">✕</button>
      </header>

      <div class="dlg__body">
        <mk-form-field label="Name">
          <input mkInput [value]="name()" (input)="set($event.target, name.set)" />
        </mk-form-field>

        @if (mode !== 'edit') {
          <mk-form-field label="Email">
            <input mkInput type="email" [value]="email()" (input)="set($event.target, email.set)" />
          </mk-form-field>
        }

        @if (mode === 'create') {
          <mk-form-field label="Password" hint="At least 6 characters.">
            <input mkInput type="password" [value]="password()" (input)="set($event.target, password.set)" />
          </mk-form-field>
        }

        @if (mode === 'edit') {
          <mk-form-field label="Status">
            <mk-select [options]="statusOptions" [value]="status()" (valueChange)="status.set(asStr($event))" />
          </mk-form-field>
        }

        <div class="dlg__switch">
          <div>
            <span class="dlg__switch-label">Super admin</span>
            <span class="dlg__switch-hint">Full access to every site and setting.</span>
          </div>
          <mk-switch [checked]="isSuper()" (checkedChange)="isSuper.set($event)" />
        </div>

        @if (mode === 'edit') {
          <mk-divider />
          <mk-form-field label="Reset password" hint="At least 6 characters. Leave blank to keep the current one.">
            <input mkInput type="password" [value]="resetPw()" (input)="set($event.target, resetPw.set)" />
          </mk-form-field>
          <div class="mk-form-actions">
            <button mkButton variant="outline" [loading]="busy()" [disabled]="busy() || resetPw().length < 6" (click)="resetPassword()">
              Set new password
            </button>
          </div>
        }
      </div>

      <footer class="dlg__foot">
        @if (mode === 'edit' && data.user) {
          <button mkButton variant="ghost" tone="danger" [disabled]="busy()" (click)="remove()">Delete user</button>
        }
        <span class="dlg__spacer"></span>
        <button mkButton variant="ghost" [disabled]="busy()" (click)="cancel()">Cancel</button>
        <button mkButton tone="primary" [loading]="busy()" [disabled]="busy() || !canSubmit()" (click)="submit()">
          {{ submitLabel() }}
        </button>
      </footer>
    </div>
  `,
  styles: `
    .dlg { display: flex; flex-direction: column; min-height: 0; }
    .dlg__head { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); margin-bottom: var(--mk-space-4); }
    .dlg__head h2 { margin: 0; font-size: var(--mk-font-size-lg); }
    .dlg__body { display: flex; flex-direction: column; gap: var(--mk-space-4); overflow: auto; }
    .dlg__switch { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-4); }
    .dlg__switch-label { display: block; font-weight: var(--mk-font-weight-medium); }
    .dlg__switch-hint { display: block; color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    .dlg__foot { display: flex; align-items: center; gap: var(--mk-space-2); margin-top: var(--mk-space-5); }
    .dlg__spacer { flex: 1; }
  `,
})
export class UserEditDialog {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly ref = inject<MkOverlayRef<boolean>>(MkOverlayRef);
  protected readonly data = inject<UserDialogData>(MK_OVERLAY_DATA);

  protected readonly mode = this.data.mode;
  protected readonly statusOptions = STATUSES.map((s) => ({ label: s, value: s }));

  protected readonly name = signal(this.data.user?.name ?? '');
  protected readonly email = signal(this.data.user?.email ?? '');
  protected readonly password = signal('');
  protected readonly status = signal(this.data.user?.status ?? 'Active');
  protected readonly isSuper = signal(this.data.user?.isSuperAdmin ?? false);
  protected readonly resetPw = signal('');
  protected readonly busy = signal(false);
  /** Whether any mutation succeeded, so the caller knows to refetch on close. */
  private changed = false;

  protected readonly title = computed(() =>
    this.mode === 'edit' ? 'Edit user' : this.mode === 'invite' ? 'Invite user' : 'New user',
  );
  protected readonly submitLabel = computed(() =>
    this.mode === 'edit' ? 'Save changes' : this.mode === 'invite' ? 'Send invite' : 'Create user',
  );

  protected readonly canSubmit = computed(() => {
    if (!this.name().trim()) return false;
    if (this.mode === 'edit') return true;
    if (!this.email().trim()) return false;
    if (this.mode === 'create' && this.password().length < 6) return false;
    return true;
  });

  protected set(t: EventTarget | null, setter: (v: string) => void): void {
    setter((t as HTMLInputElement)?.value ?? '');
  }
  protected asStr(v: unknown): string {
    return v == null ? '' : String(v);
  }

  private async mutate(work: Promise<unknown>): Promise<boolean> {
    this.busy.set(true);
    try {
      await work;
      this.changed = true;
      return true;
    } catch {
      // Error surfaced as a global toast by the notify link; keep the dialog open.
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    const name = this.name().trim();

    if (this.mode === 'create') {
      const ok = await this.mutate(
        firstValueFrom(
          this.apollo.mutate({
            mutation: CREATE_USER,
            variables: { input: { name, email: this.email().trim(), password: this.password(), isSuperAdmin: this.isSuper() } },
          }),
        ),
      );
      if (ok) this.ref.close(true);
      return;
    }

    if (this.mode === 'invite') {
      const ok = await this.mutate(
        firstValueFrom(
          this.apollo.mutate({
            mutation: INVITE_USER,
            variables: { email: this.email().trim(), name, isSuperAdmin: this.isSuper() },
          }),
        ),
      );
      if (ok) this.ref.close(true);
      return;
    }

    // edit
    const u = this.data.user;
    if (!u) return;
    const ok = await this.mutate(
      firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_USER,
          variables: { id: u.id, input: { name, status: this.status(), isSuperAdmin: this.isSuper() } },
        }),
      ),
    );
    if (ok) this.ref.close(true);
  }

  protected async resetPassword(): Promise<void> {
    const u = this.data.user;
    if (!u || this.busy() || this.resetPw().length < 6) return;
    const ok = await this.mutate(
      firstValueFrom(
        this.apollo.mutate({ mutation: SET_USER_PASSWORD, variables: { id: u.id, password: this.resetPw() } }),
      ),
    );
    if (ok) this.resetPw.set('');
  }

  protected async remove(): Promise<void> {
    const u = this.data.user;
    if (!u || this.busy()) return;
    if (!(await this.confirm.remove(`user “${u.email}”`))) return;
    const ok = await this.mutate(
      firstValueFrom(this.apollo.mutate({ mutation: DELETE_USER, variables: { id: u.id } })),
    );
    if (ok) this.ref.close(true);
  }

  protected cancel(): void {
    this.ref.close(this.changed);
  }
}

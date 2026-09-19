import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { MkButton, MkCard, MkFormField, MkInput, MkAlert } from '@mk-kit/ui';

/** Public mutation: redeem an emailed invite token to set a password. */
const ACCEPT_INVITE = gql`
  mutation AcceptInvite($token: String!, $password: String!) {
    acceptInvite(token: $token, password: $password)
  }
`;

const MIN_PASSWORD_LENGTH = 8;

/**
 * Public "set your password" screen reached from an emailed invite link
 * (`/set-password?token=…`). Verifies nothing client-side beyond basic form
 * validity — the token is validated by the API's public `acceptInvite`
 * mutation. On success, routes to /login.
 */
@Component({
  selector: 'app-set-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkCard, MkFormField, MkInput, MkAlert],
  templateUrl: './set-password.page.html',
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: var(--mk-space-4);
      /* Same ink backdrop as the login page. */
      background: #12110d;
    }
    mk-card { width: 100%; max-width: 22rem; box-shadow: var(--mk-shadow-lg); }
    .title { margin: 0 0 var(--mk-space-2); font-size: var(--mk-font-size-xl); font-family: var(--app-font-display); }
    .subtitle { margin: 0 0 var(--mk-space-4); color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    .fields { display: grid; gap: var(--mk-space-3); }
    .actions { margin-top: var(--mk-space-5); }
    button[mkButton] { width: 100%; }
  `,
})
export class SetPasswordPage {
  private readonly apollo = inject(Apollo);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly minLength = MIN_PASSWORD_LENGTH;

  private readonly token = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('token'))),
    { initialValue: null },
  );
  protected readonly hasToken = computed(() => !!this.token());

  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly canSubmit = computed(
    () =>
      this.hasToken() &&
      this.password().length >= MIN_PASSWORD_LENGTH &&
      this.password() === this.confirm(),
  );

  protected update(target: EventTarget | null, set: (v: string) => void): void {
    set((target as HTMLInputElement)?.value ?? '');
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;
    this.error.set(null);

    const token = this.token();
    if (!token) {
      this.error.set('This link is missing its invite token.');
      return;
    }
    if (this.password().length < MIN_PASSWORD_LENGTH) {
      this.error.set(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (this.password() !== this.confirm()) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.submitting.set(true);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: ACCEPT_INVITE,
          variables: { token, password: this.password() },
        }),
      );
      await this.router.navigate(['/login'], {
        queryParams: { invited: '1' },
      });
    } catch (err) {
      this.error.set(
        err instanceof Error
          ? err.message
          : 'Could not set your password. The link may be invalid or expired.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}

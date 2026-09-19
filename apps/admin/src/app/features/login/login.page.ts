import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MkButton, MkCard, MkFormField, MkInput, MkAlert } from '@mk-kit/ui';
import { AuthService } from '../../core/auth/auth.service';

/** Credentials screen. On success, AuthService stores the JWT + bootstraps the
 *  identity/tenant list, then we route into the shell. */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkCard, MkFormField, MkInput, MkAlert],
  templateUrl: './login.page.html',
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: var(--mk-space-4);
      /* The studio's ink backdrop, regardless of theme. */
      background: #12110d;
    }
    .login-wrap { width: 100%; max-width: 22rem; }
    .login-brand {
      margin-bottom: var(--mk-space-4);
      font-family: var(--app-font-display);
      font-size: var(--mk-font-size-3xl);
      font-weight: 700;
      letter-spacing: var(--mk-letter-spacing-tight);
      color: #f2f0e7;
      text-align: center;
    }
    .login-brand__dash { color: var(--app-signal); }
    mk-card { display: block; box-shadow: var(--mk-shadow-lg); }
    .login-title { margin: 0 0 var(--mk-space-4); font-size: var(--mk-font-size-xl); }
    .login-fields { display: grid; gap: var(--mk-space-3); }
    .login-actions { margin-top: var(--mk-space-5); }
    button[mkButton] { width: 100%; }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Shown after a user activates their account via an invite link. */
  protected readonly justInvited = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('invited') === '1')),
    { initialValue: false },
  );

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected update(target: EventTarget | null, set: (v: string) => void): void {
    set((target as HTMLInputElement)?.value ?? '');
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;
    this.error.set(null);
    this.submitting.set(true);
    try {
      await this.auth.login(this.email().trim(), this.password());
      void this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Sign-in failed. Check your credentials.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}

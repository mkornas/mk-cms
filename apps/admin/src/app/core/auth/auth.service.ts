import { inject, Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { MkOverlayService } from '@mk-kit/ui';
import { firstValueFrom } from 'rxjs';
import { SessionStore, SessionSite, SessionUser } from '../session/session.store';
import { LOGIN, ME, MY_SITES } from '../graphql/operations';

interface LoginResult {
  login: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  };
}

/**
 * Authentication flow: `login` stores the JWT pair, then `bootstrap` fills in
 * the identity (`me`) and the tenant list (`mySites`). Both write to the
 * {@link SessionStore}, which the Apollo interceptor reads for auth headers.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apollo = inject(Apollo);
  private readonly session = inject(SessionStore);
  private readonly overlays = inject(MkOverlayService);

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.apollo.mutate<LoginResult>({
        mutation: LOGIN,
        variables: { email, password },
      }),
    );
    const tokens = res.data?.login;
    if (!tokens) throw new Error('Login failed');
    this.session.setTokens(tokens);
    await this.bootstrap();
  }

  /**
   * Load identity + sites once a token is present (also on app start). Runs from
   * an app initializer, so it must NEVER throw — an expired/invalid token would
   * otherwise abort bootstrap and blank the app. On failure we clear the stale
   * session and let the route guard redirect to /login.
   */
  async bootstrap(): Promise<void> {
    if (!this.session.isAuthenticated()) return;
    try {
      const [meRes, sitesRes] = await Promise.all([
        firstValueFrom(this.apollo.query<{ me: SessionUser }>({ query: ME })),
        firstValueFrom(
          this.apollo.query<{ mySites: SessionSite[] }>({ query: MY_SITES }),
        ),
      ]);
      if (meRes.data?.me) this.session.setUser(meRes.data.me);
      if (sitesRes.data?.mySites) this.session.setSites(sitesRes.data.mySites);
    } catch {
      // Token invalid/expired or API unreachable — drop the session so the
      // guard sends the user to sign in again.
      this.session.clear();
    }
  }

  async logout(): Promise<void> {
    // Whatever is floating above the page must not outlive the session.
    this.overlays.closeAll();
    this.session.clear();
    await this.apollo.client.clearStore();
  }
}

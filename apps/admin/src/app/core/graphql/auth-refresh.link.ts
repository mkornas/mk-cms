import { Router } from '@angular/router';
import { MkOverlayService } from '@mk-kit/ui';
import { ApolloLink } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { from, switchMap } from 'rxjs';
import { SessionStore } from '../session/session.store';
import { environment } from '../../../environments/environment';

type Session = InstanceType<typeof SessionStore>;

const REFRESH_QUERY = `
  mutation Refresh($refreshToken: String!) {
    refresh(refreshToken: $refreshToken) {
      accessToken
      refreshToken
      tokenType
      expiresIn
    }
  }
`;

/** True when a GraphQL response carries an auth (expired/invalid token) error. */
function isUnauthenticated(error: unknown): boolean {
  const errors = (error as { errors?: { extensions?: { code?: string } }[] })?.errors;
  return Array.isArray(errors) && errors.some((e) => e?.extensions?.code === 'UNAUTHENTICATED');
}

/**
 * Access tokens are short-lived. This link catches an `UNAUTHENTICATED` GraphQL
 * error, exchanges the stored refresh token for a fresh pair (a raw fetch — not
 * through Apollo, to avoid a circular dependency and a stale auth header), then
 * retries the failed operation. Concurrent 401s share a single in-flight
 * refresh. If the refresh itself fails, the session is cleared and the guard
 * sends the user to /login.
 */
export function createAuthRefreshLink(
  session: Session,
  router: Router,
  overlays: MkOverlayService,
): ApolloLink {
  let inFlight: Promise<void> | null = null;

  /** Session is gone: drop any floating overlays and send the user to /login. */
  const expire = (): void => {
    overlays.closeAll();
    session.clear();
    void router.navigateByUrl('/login');
  };

  const refresh = (): Promise<void> => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const refreshToken = session.refreshToken();
      if (!refreshToken) throw new Error('No refresh token');
      try {
        const res = await fetch(environment.graphqlUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: REFRESH_QUERY, variables: { refreshToken } }),
        });
        const json = await res.json();
        const tokens = json?.data?.refresh;
        if (!tokens?.accessToken) throw new Error('Refresh rejected');
        session.setTokens(tokens);
      } catch (e) {
        expire();
        throw e;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };

  return onError(({ error, operation, forward }) => {
    // Don't try to refresh the refresh/login calls themselves (avoids a loop).
    const op = operation.operationName;
    if (!isUnauthenticated(error) || op === 'Refresh' || op === 'Login') return;
    if (!session.refreshToken()) {
      expire();
      return;
    }
    // Refresh, then replay the original operation with the new token
    // (the auth interceptor re-reads the session on the retried request).
    return from(refresh()).pipe(switchMap(() => forward(operation)));
  });
}

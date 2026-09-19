import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloLink } from '@apollo/client';
import { MkOverlayService, MkToastService } from '@mk-kit/ui';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../session/session.store';
import { createAuthRefreshLink } from './auth-refresh.link';
import { createNotifyLink } from './notify.link';

/**
 * Wires Apollo Client against the single mk-cms GraphQL endpoint. Auth/tenant
 * headers are added by {@link authInterceptor} on the underlying HttpClient;
 * the refresh link transparently renews an expired access token and replays the
 * failed operation, so sessions don't drop mid-work.
 */
export function provideGraphql() {
  return provideApollo(() => {
    const httpLink = inject(HttpLink);
    const session = inject(SessionStore);
    const router = inject(Router);
    const toast = inject(MkToastService);
    const overlays = inject(MkOverlayService);
    return {
      // Order matters: the refresh link sits above the notify link so a
      // transient 401 is retried before notify ever sees it, and notify then
      // reports the *retried* outcome.
      link: ApolloLink.from([
        createAuthRefreshLink(session, router, overlays),
        createNotifyLink(toast),
        httpLink.create({ uri: environment.graphqlUrl }),
      ]),
      cache: new InMemoryCache(),
    };
  });
}

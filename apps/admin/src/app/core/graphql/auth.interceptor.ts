import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from '../session/session.store';

/**
 * Attaches the JWT and the active-tenant header to GraphQL requests. Because
 * apollo-angular's `HttpLink` sends operations through Angular's `HttpClient`,
 * a standard functional interceptor is the version-robust place to inject
 * headers — no dependency on `@apollo/client` link internals.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const token = session.accessToken();
  const site = session.activeSiteSlug();

  if (!token && !site) return next(req);

  const setHeaders: Record<string, string> = {};
  if (token) setHeaders['Authorization'] = `Bearer ${token}`;
  if (site) setHeaders['x-site'] = site;

  return next(req.clone({ setHeaders }));
};

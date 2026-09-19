import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { SessionStore } from '../session/session.store';

/** Gate for authenticated routes — bounces to /login when there's no token. */
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const session = inject(SessionStore);
  const router = inject(Router);
  return session.isAuthenticated() ? true : router.parseUrl('/login');
};

/** Inverse guard — keeps signed-in users off /login. */
export const guestGuard: CanActivateFn = (): boolean | UrlTree => {
  const session = inject(SessionStore);
  const router = inject(Router);
  return session.isAuthenticated() ? router.parseUrl('/') : true;
};

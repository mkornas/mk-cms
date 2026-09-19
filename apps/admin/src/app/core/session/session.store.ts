import { computed, effect } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';

/** The authenticated identity (mirrors the GraphQL `User` type). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}

/** One selectable tenant (mirrors `SiteMembership`). */
export interface SessionSite {
  siteId: string;
  siteSlug: string | null;
  siteName: string | null;
  role: string | null;
}

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  sites: SessionSite[];
  /** Slug of the active tenant — sent as the `x-site` header on every request. */
  activeSiteSlug: string | null;
}

const STORAGE_KEY = 'mk-cms.session';

function loadInitial(): SessionState {
  const empty: SessionState = {
    accessToken: null,
    refreshToken: null,
    user: null,
    sites: [],
    activeSiteSlug: null,
  };
  if (typeof localStorage === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

/**
 * Global session store (ngrx SignalStore). Holds the JWT pair, the identity,
 * and the active tenant, and persists them to localStorage so a refresh keeps
 * you signed in. Apollo's auth interceptor reads `accessToken()` +
 * `activeSiteSlug()` off this store.
 */
export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState(loadInitial()),
  withComputed((store) => ({
    isAuthenticated: computed(() => !!store.accessToken()),
    activeSite: computed(
      () => store.sites().find((s) => s.siteSlug === store.activeSiteSlug()) ?? null,
    ),
  })),
  withMethods((store) => ({
    setTokens(tokens: { accessToken: string; refreshToken: string }): void {
      patchState(store, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    },
    setUser(user: SessionUser): void {
      patchState(store, { user });
    },
    setSites(sites: SessionSite[]): void {
      patchState(store, {
        sites,
        // Default to the first site if none is chosen yet.
        activeSiteSlug: store.activeSiteSlug() ?? sites[0]?.siteSlug ?? null,
      });
    },
    setActiveSite(siteSlug: string): void {
      patchState(store, { activeSiteSlug: siteSlug });
    },
    clear(): void {
      patchState(store, {
        accessToken: null,
        refreshToken: null,
        user: null,
        sites: [],
        activeSiteSlug: null,
      });
    },
  })),
  // Persist the whole slice to localStorage on every change. `onInit` runs
  // inside an injection context, so `effect` is allowed here.
  withHooks({
    onInit(store) {
      if (typeof localStorage === 'undefined') return;
      effect(() => {
        const snapshot = {
          accessToken: store.accessToken(),
          refreshToken: store.refreshToken(),
          user: store.user(),
          sites: store.sites(),
          activeSiteSlug: store.activeSiteSlug(),
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } catch {
          /* storage full / unavailable — non-fatal */
        }
      });
    },
  }),
);

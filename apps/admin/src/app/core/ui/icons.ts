import { MkIconRegistry } from '@mk-kit/ui';

/** Shared 24×24 stroke-icon wrapper (matches the kit's default icon style). */
const svg = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/**
 * App-specific icons beyond the kit's built-in set (`home`, `user`, `settings`,
 * `search`, `clock`, `menu`, `download`, `eye`, `arrow-right`, …). Registered
 * once from the Shell so every admin surface (sidebar, menus, empty states)
 * can reference them by name.
 */
const APP_ICONS: Record<string, string> = {
  /** Media library / images. */
  image: svg(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  ),
  /** Taxonomies (categories & tags). */
  tag: svg(
    '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="0.5" fill="currentColor"/>',
  ),
  /** Sites / domains. */
  globe: svg(
    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  ),
  /** Roles & permissions. */
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  /** Plugins. */
  plug: svg(
    '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/>',
  ),
  /** Webhooks / integrations. */
  zap: svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  /** Forms / submissions. */
  inbox: svg(
    '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  ),
  /** Content types (the content model). */
  layers: svg(
    '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  ),
  /** A content entry / document. */
  'file-text': svg(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  ),
  /** Sign out. */
  'log-out': svg(
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  ),
  /** Light theme. */
  sun: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  ),
  /** Dark theme. */
  moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>'),
  /** Collapse / expand the sidebar. */
  sidebar: svg(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>',
  ),
};

/** Idempotent — safe to call from any entry point. */
export function registerAppIcons(registry: MkIconRegistry): void {
  registry.registerIcons(APP_ICONS);
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  Router,
  RouterOutlet,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
} from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, filter } from 'rxjs';
import { Apollo } from 'apollo-angular';
import {
  MkAppShell,
  MkAvatar,
  MkButton,
  MkIcon,
  MkIconRegistry,
  MkNavList,
  MkNavGroup,
  MkNavItem,
  MkMenu,
  MkMenuItem,
  MkMenuTrigger,
  MkCommandPalette,
  MkCommand,
  MkThemeService,
  MkToastContainer,
  MkTooltip,
  MkInput,
  MkLoadingBar,
  MkLoadingBarService,
} from '@mk-kit/ui';

import { SessionStore } from '../core/session/session.store';
import { AuthService } from '../core/auth/auth.service';
import { registerAppIcons } from '../core/ui/icons';
import { CONTENT_TYPES } from '../core/graphql/operations';

interface ContentTypeLite {
  slug: string;
  name: string;
  isCore: boolean;
}

/**
 * Authenticated shell: app-shell chrome (header + sidebar) around the routed
 * content. The sidebar leads with the author-facing surfaces (content types,
 * media, menus…) and tucks admin/operations into collapsible groups; every item
 * carries an icon so the sidebar can collapse to an icon rail.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    MkAppShell,
    MkAvatar,
    MkButton,
    MkIcon,
    MkNavList,
    MkNavGroup,
    MkNavItem,
    MkMenu,
    MkMenuItem,
    MkMenuTrigger,
    MkCommandPalette,
    MkToastContainer,
    MkTooltip,
    MkInput,
    MkLoadingBar,
  ],
  templateUrl: './shell.html',
  styles: `
    .shell-header {
      display: flex;
      align-items: center;
      gap: var(--mk-space-3);
      width: 100%;
      padding-inline: var(--mk-space-3) var(--mk-space-4);
    }
    .shell-brand {
      font-size: var(--mk-font-size-lg);
      font-weight: 700;
      letter-spacing: var(--mk-letter-spacing-tight);
    }
    .shell-brand__dash { color: var(--app-signal); }
    .shell-site { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    .shell-site--static { display: inline-flex; align-items: center; gap: var(--mk-space-2); }
    .shell-spacer { flex: 1; }
    .shell-search { width: 18rem; max-width: 28vw; }
    .shell-user { color: var(--mk-text); }
    .shell-user__name { font-size: var(--mk-font-size-sm); }
    @media (max-width: 48rem) { .shell-user__name { display: none; } }
  `,
})
export class Shell {
  private readonly apollo = inject(Apollo);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);
  protected readonly theme = inject(MkThemeService);
  private readonly auth = inject(AuthService);
  private readonly loadingBar = inject(MkLoadingBarService);

  constructor() {
    // App-specific icons (sidebar, menus) on top of the kit's built-in set.
    registerAppIcons(inject(MkIconRegistry));

    // Drive the top loading bar from router navigations — lazy route chunks and
    // their initial data give a visible gap, so show progress across it.
    this.router.events
      .pipe(
        filter(
          (e) =>
            e instanceof NavigationStart ||
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        if (e instanceof NavigationStart) this.loadingBar.start();
        else this.loadingBar.complete();
      });
  }

  /** Content types for the active site → sidebar nav. */
  protected readonly contentTypes = toSignal(
    this.apollo
      .watchQuery<{ contentTypes: ContentTypeLite[] }>({ query: CONTENT_TYPES })
      .valueChanges.pipe(map((r) => (r.data?.contentTypes ?? []) as ContentTypeLite[])),
    { initialValue: [] as ContentTypeLite[] },
  );

  protected readonly userName = computed(() => this.session.user()?.name ?? '');
  /** Only owners/admins (or super-admins) get the admin nav; the API also gates. */
  protected readonly canManageSites = computed(
    () =>
      !!this.session.user()?.isSuperAdmin ||
      ['owner', 'admin'].includes(this.session.activeSite()?.role ?? ''),
  );
  protected readonly siteName = computed(
    () => this.session.activeSite()?.siteName ?? this.session.activeSiteSlug() ?? '—',
  );

  /** ⌘K command palette: navigation, per-type view/new, site switch, theme, sign out. */
  protected readonly commands = computed<MkCommand[]>(() => {
    const cmds: MkCommand[] = [
      { id: 'nav-search', label: 'Search content…', group: 'Navigate', keywords: 'find', run: () => this.go('/search') },
      { id: 'nav-dashboard', label: 'Dashboard', group: 'Navigate', run: () => this.go('/dashboard') },
      { id: 'nav-media', label: 'Media', group: 'Navigate', run: () => this.go('/library') },
      { id: 'nav-scheduled', label: 'Scheduled', group: 'Navigate', run: () => this.go('/scheduled') },
      { id: 'nav-taxonomies', label: 'Categories & tags', group: 'Navigate', keywords: 'taxonomies terms', run: () => this.go('/taxonomies') },
      { id: 'nav-menus', label: 'Menus', group: 'Navigate', run: () => this.go('/menus') },
    ];
    if (this.canManageSites()) {
      cmds.push({ id: 'nav-sites', label: 'Sites', group: 'Navigate', run: () => this.go('/sites') });
      cmds.push({ id: 'nav-plugins', label: 'Plugins', group: 'Navigate', run: () => this.go('/plugins') });
      cmds.push({ id: 'nav-users', label: 'Users', group: 'Navigate', run: () => this.go('/users') });
      cmds.push({ id: 'nav-roles', label: 'Roles & capabilities', group: 'Navigate', run: () => this.go('/roles') });
      cmds.push({ id: 'nav-ctypes', label: 'Content types', group: 'Navigate', run: () => this.go('/content-types') });
      for (const [label, path, keywords] of [
        ['Redirects', '/redirects', ''],
        ['Webhooks', '/webhooks', ''],
        ['Forms', '/forms', ''],
        ['Activity log', '/audit', 'audit'],
        ['SEO', '/seo', 'seo settings'],
        ['Settings', '/settings', 'general options'],
        ['Import from WordPress', '/import', 'wp import'],
      ] as const) {
        cmds.push({ id: `nav-${path}`, label, group: 'Operations', keywords, run: () => this.go(path) });
      }
    }

    for (const ct of this.contentTypes()) {
      cmds.push({
        id: `ct-${ct.slug}`,
        label: ct.name,
        group: 'Content',
        hint: 'View entries',
        keywords: ct.slug,
        run: () => this.go(`/content/${ct.slug}`),
      });
      cmds.push({
        id: `new-${ct.slug}`,
        label: `New ${ct.name}`,
        group: 'Content',
        keywords: ct.slug,
        run: () => this.go(`/content/${ct.slug}/new`),
      });
    }

    const sites = this.session.sites();
    if (sites.length > 1) {
      for (const s of sites) {
        if (s.siteSlug && s.siteSlug !== this.session.activeSiteSlug()) {
          cmds.push({
            id: `site-${s.siteSlug}`,
            label: `Switch to ${s.siteName ?? s.siteSlug}`,
            group: 'Sites',
            run: () => void this.switchSite(s.siteSlug),
          });
        }
      }
    }

    cmds.push({ id: 'profile', label: 'Your profile', group: 'Account', run: () => this.go('/profile') });
    cmds.push({ id: 'theme', label: 'Toggle light / dark', group: 'Appearance', run: () => this.theme.toggle() });
    cmds.push({ id: 'logout', label: 'Sign out', group: 'Account', run: () => void this.logout() });
    return cmds;
  });

  protected go(path: string): void {
    void this.router.navigateByUrl(path);
  }

  /** Header search: Enter jumps to the full search page with the term seeded. */
  protected submitSearch(target: EventTarget | null): void {
    const q = (target as HTMLInputElement)?.value?.trim() ?? '';
    void this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }

  /**
   * Switch the active tenant: update the session (so the Apollo interceptor
   * sends the new `x-site`), reset the cache so every query refetches for the
   * new site, and land on the dashboard (drops any per-site view like an open
   * entry editor).
   */
  protected async switchSite(slug: string | null): Promise<void> {
    if (!slug || slug === this.session.activeSiteSlug()) return;
    this.session.setActiveSite(slug);
    try {
      await this.apollo.client.resetStore();
    } catch {
      /* a refetch may error mid-switch — non-fatal, the new route reloads */
    }
    void this.router.navigateByUrl('/dashboard');
  }

  protected isActive(path: string): boolean {
    return this.router.isActive(path, {
      paths: 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}

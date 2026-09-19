import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { unsavedChangesGuard } from './features/content/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login.page').then((m) => m.LoginPage),
  },
  {
    // Public: invited users set their password here via the emailed `?token=`.
    path: 'set-password',
    loadComponent: () =>
      import('./features/auth/set-password.page').then((m) => m.SetPasswordPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./features/search/global-search.page').then((m) => m.GlobalSearchPage),
      },
      {
        path: 'scheduled',
        loadComponent: () =>
          import('./features/scheduled/scheduled.page').then((m) => m.ScheduledPage),
      },
      {
        // `library`, not `media`: the dev server proxies `/media*` to the API
        // (file serving + upload), so the SPA route must not collide with it.
        path: 'library',
        loadComponent: () =>
          import('./features/media/media-library.page').then((m) => m.MediaLibraryPage),
      },
      {
        path: 'content/:type',
        loadComponent: () =>
          import('./features/content/content-list.page').then(
            (m) => m.ContentListPage,
          ),
      },
      {
        // `new` must precede `:id` so it isn't captured as an entry id.
        path: 'content/:type/new',
        loadComponent: () =>
          import('./features/content/entry-editor.page').then((m) => m.EntryEditorPage),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'content/:type/:id',
        loadComponent: () =>
          import('./features/content/entry-editor.page').then((m) => m.EntryEditorPage),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'taxonomies',
        loadComponent: () =>
          import('./features/taxonomy/taxonomy-manager.page').then(
            (m) => m.TaxonomyManagerPage,
          ),
      },
      {
        path: 'menus',
        loadComponent: () =>
          import('./features/menu/menu-builder.page').then((m) => m.MenuBuilderPage),
      },
      {
        path: 'sites',
        loadComponent: () =>
          import('./features/sites/site-management.page').then(
            (m) => m.SiteManagementPage,
          ),
      },
      {
        path: 'plugins',
        loadComponent: () =>
          import('./features/plugins/plugin-management.page').then(
            (m) => m.PluginManagementPage,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/user-management.page').then(
            (m) => m.UserManagementPage,
          ),
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./features/roles/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'content-types',
        loadComponent: () =>
          import('./features/content-types/content-type-builder.page').then(
            (m) => m.ContentTypeBuilderPage,
          ),
      },
      {
        path: 'redirects',
        loadComponent: () =>
          import('./features/redirects/redirect-management.page').then((m) => m.RedirectManagementPage),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/audit/audit-log.page').then((m) => m.AuditLogPage),
      },
      {
        path: 'webhooks',
        loadComponent: () =>
          import('./features/webhooks/webhook-management.page').then((m) => m.WebhookManagementPage),
      },
      {
        path: 'seo',
        loadComponent: () =>
          import('./features/seo/seo-settings.page').then((m) => m.SeoSettingsPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/general-settings.page').then((m) => m.GeneralSettingsPage),
      },
      {
        path: 'forms',
        loadComponent: () =>
          import('./features/forms/form-management.page').then((m) => m.FormManagementPage),
      },
      {
        path: 'import',
        loadComponent: () =>
          import('./features/import/import.page').then((m) => m.ImportPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

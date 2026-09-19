# mk-cms roadmap

A living plan for the CMS and its Angular admin. Priorities: **P1** necessary /
near-term, **P2** valuable, **P3** future ideas. Not a commitment — a map.

Backend phases P0–P5 + media are complete (see `ARCHITECTURE.md`). The admin
(`apps/admin`, Angular 22 + `@mk-kit/ui`) was built out on 2026-07-09; this
roadmap is mostly about closing admin gaps and extending the platform.

---

## ✅ Shipped (admin)

Auth (login, session, guards, resilient bootstrap) · dashboard · **content**:
schema-driven list + editor covering all 13 field types (incl. `media`,
`relation`, block-editor richtext), media picker, revision history + diff,
taxonomy term assignment, per-entry SEO panel · **media library** + picker ·
**taxonomy** manager · **menu** builder (nested, reorder, entry links) · **site**
management + per-site switcher · **plugin/settings** management · **user**
management · ⌘K command palette. All verified end-to-end against the live API.

Backend already ships: content engine, plugin engine + hook bus, audit,
redirects, SEO + sitemap, menus, webhooks + BullMQ jobs, forms + mail, WordPress
importer, Postgres full-text search, media (local + S3/MinIO), RBAC, and (new)
site + user management resolvers.

---

## P1 — necessary / near-term

### Content authoring
- ✅ **Content-type builder UI** — `/content-types`: create/edit/delete types +
  add/edit/remove/reorder fields (per-type config as JSON). Added the backend
  `updateField` mutation. *(shipped 2026-07-09)*
- ✅ **List view: status tabs + paging + bulk + filter** — status tabs
  (server-side), offset Prev/Next, row-selection bulk publish/unpublish/trash,
  client-side title filter, sortable columns. *(shipped 2026-07-09)* Follow-ups:
  full-text search (`searchContent`) instead of client-only filter; a total
  count for numbered pages; server-side sort.
- ✅ **Trash & restore** — the Trashed tab now shows **Restore** (`restoreEntry`
  → Draft) and **Delete permanently** (`deleteEntry`, confirm-gated) instead of
  the normal publish/trash actions. *(2026-07-09)*
- ✅ **Duplicate entry** — a bulk "Duplicate" action clones selected entries into
  fresh Drafts (`duplicateEntry`; the clone reuses the create pipeline and copies
  only schema-defined fields, so hook-added keys don't break validation).
  *(2026-07-10)*
- ✅ **Scheduled queue** — a `/scheduled` page lists upcoming scheduled entries
  (soonest first, live countdown) with Publish-now / Unschedule. *(2026-07-10)*
- ✅ **Duplicate menu** — a per-menu "Duplicate" deep-clones the menu + its nested
  item tree (transactional, `parentId` remap, unique `-copy` slug). *(2026-07-10)*
- ✅ **Taxonomy term entry counts** — each term shows how many entries reference
  it (one batched grouped-count query, tenant-scoped). *(2026-07-10)*
- ✅ **Preview** — a "Preview" button in the editor mints a `previewToken` and
  opens `${previewBaseUrl}?token=…` in a new tab. *(2026-07-09)*
- ✅ **Locale / translations** — a Translations sidebar panel lists sibling
  entries in the same `translationGroup` (link per locale) and an "add
  translation" picker creates a draft in a new locale (new `entryTranslations`
  query + `addTranslation` mutation). *(2026-07-09)*
- ✅ **Parent / hierarchy** — a Parent sidebar panel picks a parent entry of the
  same type (reuses `updateEntry`'s `parentId`). *(2026-07-09)*
- ✅ **Unsaved-changes guard** — a `CanDeactivate` guard warns (via a confirm
  dialog) before leaving the editor with unsaved edits; a JSON snapshot vs.
  baseline tracks dirtiness, reset on seed/save/publish. *(2026-07-09)*

### Operational surfaces
- ✅ **Redirects**, **Audit log**, **Webhooks** (+test + deliveries), **SEO
  site defaults**, **Forms + submissions**, **WordPress importer** — all shipped
  under the sidebar "Operations" group. *(2026-07-09)* ✅ Audit log now also
  filters by **actor email** and a **from/to date range** (full-stack), and
  **exports** the filtered view to CSV. *(2026-07-10)* ✅ Webhook **secret rotation** — a confirm-gated "Rotate secret"
  button + `rotateWebhookSecret` mutation. *(2026-07-09)* ✅ **Form building** —
  create forms and add/edit/reorder/remove their fields (key + label + type from
  the shared field-type registry + required) via `createForm`/`updateForm`.
  *(2026-07-09)* ✅ Webhook **delivery retry** — a per-row "Retry" re-enqueues a
  fresh attempt (`retryDelivery`). ✅ **Redirects CSV import/export** (Blob
  download + resilient per-row import). *(2026-07-10)* Follow-up: per-field
  `config` editing (e.g. select options).
- ✅ **Global search** — a `/search` page over `searchContent` (Postgres FTS,
  spans drafts + scheduled): debounced, URL-driven (`?q=&type=`) so results are
  linkable, highlighted snippets, per-type filter chips, and a shell header
  search box + ⌘K "Search content" command that deep-link into it. *(2026-07-09)*
- ✅ **General settings** (the `options` store) — a `/settings` page listing the
  site's key/value options with per-key JSON-aware editing + an add-key form,
  over a new `options`/`setOption` resolver. *(2026-07-09)*

### Platform / quality
- ✅ **Security hardening** *(2026-07-10, audit-driven)* — fixed two CRITICAL
  multi-tenant escalation holes (cross-tenant site/member management now
  authorizes the *target* site; `isSuperAdmin` / super-admin-account changes are
  super-admin-only); custom-role capabilities bounded by the grantor; single-use
  invite tokens; search snippets HTML-escaped; media upload MIME-allowlist +
  `nosniff`; rate limiting (throttler) on auth/invite/form-submit + `helmet`
  headers; prod-boot fails on default JWT secrets; CSV-export formula-injection
  guard. Bumped `@mk-kit/ui` → 0.3.0.
- ✅ **Usability pass** *(2026-07-10)* — loading skeletons (no empty-flash),
  double-submit guards on create/save, and keyboard-accessible list rows across
  the feature pages.

- ✅ **Toasts on success/failure** — a global Apollo notify link toasts every
  mutation's outcome (a success message derived from the operation name, a danger
  toast for any GraphQL/network error), with an `mk-toast-container` in the shell.
  Sits below the refresh link so a retried 401 never surfaces. *(2026-07-09)*
- ✅ **Confirm destructive actions** — a shared `ConfirmService` (over
  `MkDialogService.confirm`) gates every delete/trash with a danger dialog and a
  contextual subject ("Delete the redirect from /old-blog?"). *(2026-07-09)*
- ✅ **Refresh-token flow** — an Apollo error link catches `UNAUTHENTICATED`,
  exchanges the refresh token for a fresh pair (dedup'd), and replays the failed
  operation; the session survives access-token expiry (and app-reopen).
  *(2026-07-09)*
- ✅ **Loading / skeleton states** — a global top loading bar (`mk-loading-bar`
  driven by router navigations) plus `mk-skeleton-preset` placeholders on the
  content list (table), entry editor (card), and media library (grid) during
  their cold loads. Bumped `@mk-kit/ui` 0.1.3 → 0.1.6 for the skeleton +
  loading-bar components. *(2026-07-09)*
- **GraphQL codegen.** Operations + result types are hand-written and cast from
  Apollo's deep-partial. Add `graphql-codegen` for typed documents.
- **Admin tests + CI.** The admin has 0 tests. Add unit/e2e (auth, editor,
  a field-control matrix) and a CI pipeline (lint, build, test). API has 62.
- **Prod config + deploy.** Environment-driven API origin, a build/host pipeline,
  and the `@mk-kit/ui` `read:packages` token wired into CI.

---

## P2 — valuable

- **User onboarding**: ✅ **invite-by-email** — `inviteUser` creates an `Invited`
  user + emails a signed set-password link; a public `/set-password` page calls
  the `@Public` `acceptInvite` (JWT `purpose:invite`, argon2). ✅ **self-service
  profile** — a `/profile` page (edit own name + avatar upload via `updateProfile`,
  session updates live). *(2026-07-10)* Follow-up: profile bio / preferences.
- ✅ **Roles & capabilities UI** — read-only `/roles` viewer (capabilities grouped
  by resource; Owner's `*` shown as "all"), plus ✅ **per-site custom roles**
  (create/edit/delete `siteId`-scoped roles with a capability picker; system roles
  stay immutable). *(2026-07-10)*
- **Media**: ✅ **focal-point editor** (click-to-set, persisted) + ✅ **bulk
  alt-text** + ✅ **bulk delete** (multi-select tiles → apply alt / delete).
  *(2026-07-10)* Follow-ups: in-browser crop/resize, folders/tags, a CDN URL
  option.
- ✅ **Site domains** management — add/remove a site's `domains` (persist via
  `updateSite`) in the Sites page. *(2026-07-10)* Follow-up: a domain →
  active-site resolution test.
- **Per-site plugin activation** (currently global — deferred in P4) and
  **plugin-owned DB tables/migrations**.
- **Admin UI descriptors**: let plugins/content-types describe panels & columns
  as data so the generic admin renders plugin screens without a redeploy
  (the original "generic admin" vision in `ARCHITECTURE.md`).
- ✅ **Scheduled publishing** — a Schedule sidebar panel with a publish-at
  picker; `scheduleEntry`/`unscheduleEntry` set status Scheduled and enqueue a
  delayed BullMQ job (`content-publish` queue) that publishes when due.
  *(2026-07-09)* Follow-up: share entry status across the editor's sidebar panels
  (each panel currently fetches status independently, so a change in one shows in
  the others only after reload).
- **Search**: Meilisearch adapter (the `SEARCH_ADAPTER` seam already exists) for
  typo-tolerance/facets beyond Postgres FTS.
- **Site delivery / hosting** — plan in `docs/HOSTING.md` (static-first tenant
  sites on CF Pages, publish-webhook rebuilds; CMS stays API-only). ✅ Public
  media serves `CORP: cross-origin` + CORS enabled on public surfaces
  *(2026-07-10)*. Next: **`mk-site-starter`** template repo (P1), cacheable GET
  delivery + CDN purge, webhook payloads with changed URLs, `mk-host` managed
  tier only if paid demand shows up (P3).
- **Delivery API keys**: issue/scope API keys for the public delivery surface
  (+ tighten CORS to `site.domains` at the same time).
- **Block editor**: custom blocks, media/embed blocks wired to the media library
  and `uploadHandler`.
- ✅ **Dashboard**: real overview — per-content-type entry-count stat cards
  (clickable), an "Insights" section with a **bar chart** (entries per type) +
  **donut** (status breakdown) via mk-charts, and a recent-activity timeline from
  the audit log. *(2026-07-09 – 2026-07-10)*
- **Static-rebuild trigger contract**: document + expose the webhook payload for
  Next/Angular ISR consumers on publish.

---

## P3 — future ideas

- **Editorial workflow**: draft → in-review → approved → published with role
  gates; assignment + notifications.
- **Live/collaborative editing**: presence, locking, or CRDT co-editing.
- **Localization workflow**: side-by-side translation across a `translationGroup`,
  translation status, machine-translation assist.
- **Comments / annotations** on entries and revisions.
- **A/B testing** and personalization of content variants.
- **Full site export / import** and cross-instance migration tooling.
- **Analytics**: traffic/engagement dashboards; content performance.
- **Notifications center** / activity feed in the admin.
- **Security**: 2FA, SSO/OAuth login, session management, rate limiting,
  security headers, audit of admin actions (partially covered by audit log).
- **Observability**: structured logging, metrics, tracing across API + jobs.
- **Command palette++**: search entries/media inline, recent items, actions with
  arguments, and app-wide keyboard shortcuts.
- **Theming / white-label** the admin; high-contrast theme; per-tenant branding.
- **Mobile app / responsive polish** for on-the-go editing.
- **P7 — Commerce plugin** (the original endgame): products, variants, inventory,
  cart, checkout, orders, payments — built on the plugin engine + content model.

---

## Known issues / cleanup

- **`mk-select` / `mk-multi-select` option clicks are flaky under CDP browser
  automation** (fine for real users) — verify those flows via the API in tests.
- **Local dev DB is tangled**: a stale `mk-cms-postgres-1` container shadows the
  API's real Postgres on :5432; seed/verify via the GraphQL API, not raw psql.
  Consider `pnpm infra:reset` to start clean.
- **richtext** uses the block-editor's HTML mode (`valueFormat="html"`); confirm
  round-trip fidelity for complex documents.
- The admin consumes **`@mk-kit/ui`** from a private GitHub Packages registry —
  keep the version bumped as mk-kit ships components (see `ADMIN-UI-READINESS.md`).

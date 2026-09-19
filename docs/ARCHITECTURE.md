# mk-cms — Architecture & Backend Plan

> A modern, extensible, headless CMS. A WordPress alternative tailored for
> websites, with e-commerce kept in mind. Backend-first plan.

## 0. Decisions locked

| Area | Decision | Rationale |
|------|----------|-----------|
| Content model | **Hybrid** | Core types are real relational tables; custom/plugin types & fields live in JSONB. Add types/fields at runtime with no migration, keep core fast & relational. |
| Tenancy | **Multi-tenant, single instance** | One deploy hosts any number of sites (a studio's own site, its clients' sites, a product's marketing pages). Row-level isolation via `site_id`, one shared admin that switches sites. |
| Delivery | **Headless, API-only** | GraphQL (+ optional REST) delivery. Each website is its own frontend. CMS never renders public HTML. |
| Backend framework | **NestJS + Apollo Server** | Modular DI, first-class code-first GraphQL, guards/interceptors for auth — its module system maps 1:1 onto a plugin architecture. |
| ORM | **TypeORM** | Runtime QueryBuilder fits data-defined field queries + JSONB paths; code-controlled migrations for plugin tables. Swappable behind the data layer. |
| DB | **PostgreSQL** | JSONB for the flex layer, GIN indexes, FTS, relational integrity for core. |
| Cache / Queue | **Redis** (BullMQ + cache-manager) | Delivery cache, cron/jobs, rate limiting. |
| Admin UI | **Angular 22 + `@mk-kit/ui` + ngrx + Apollo Client** | Reuses mk-kit. ngrx & Apollo Client live in the admin, **not** the backend. |

## 1. System shape

```
┌───────────────────────────────────────────────┐
│  ADMIN APP  (Angular 22 · @mk-kit/ui · ngrx)   │
│  Apollo Client ──► Admin GraphQL API           │
└───────────────────────────────────────────────┘
                       │ authenticated (JWT + capabilities)
                       ▼
┌───────────────────────────────────────────────┐
│  mk-cms API  (NestJS · Apollo Server)          │
│  ┌──────────────┬────────────────────────────┐ │
│  │ Core modules │ Plugin engine (hooks/regs) │ │
│  ├──────────────┴────────────────────────────┤ │
│  │ Content engine · Auth/RBAC · Media · SEO  │ │
│  │ Tenant context · Adapters (storage/mail…) │ │
│  └───────────────────────────────────────────┘ │
│         │ TypeORM              │ BullMQ          │
└─────────┼──────────────────────┼────────────────┘
          ▼                      ▼
     PostgreSQL              Redis (cache/jobs)
          ▲
          │ Content Delivery GraphQL (read-only, cacheable, API-key/site-scoped)
   ┌──────┴───────────────────────────────────────┐
   │ Public frontends: client-a.example (Angular),    │
   │ client-b.example (Next), static sites, …          │
   └───────────────────────────────────────────────┘
```

**Two GraphQL surfaces, one server:**
- **Admin/Management API** — authenticated, full CRUD, drafts, config, plugin management. For the Angular admin.
- **Content Delivery API** — public, read-only, published-only, aggressively cacheable, scoped by site + API key. For the websites. Supports preview via signed draft tokens.

> **P3 implementation note (2026-07):** the two surfaces ship as **one Apollo
> endpoint / one code-first schema** at `/graphql`, not two endpoints. NestJS
> code-first shares its schema-builder singletons across multiple
> `GraphQLModule.forRoot` instances, so a second endpoint can't get an
> independently `include`-scoped schema (both end up identical). Separation is
> enforced per resolver instead: admin root fields require a JWT + capability
> (global guards); the public delivery surface is a single `@Public` root field,
> `delivery`, whose read-only subtree is published-only (drafts only with a
> preview token). `Entry.author` is the public-safe `PublicAuthor` projection on
> both paths, so identity fields never leak to delivery consumers. A true
> endpoint/transport split (or Apollo Federation) can come later without
> changing resolver code.

## 2. Monorepo layout

pnpm/npm workspaces (or Nx). mk-kit stays its own repo, consumed as `@mk-kit/ui`.

```
mk-cms/
  apps/
    api/                 # NestJS backend (the focus of this plan)
    admin/               # Angular admin (later phase; consumes @mk-kit/ui)
  packages/
    core/                # shared domain contracts & types
    plugin-sdk/          # decorators/types/helpers to author plugins
    plugins/
      seo/
      forms/
      wp-importer/        # WordPress WXR import → migrate existing client sites
      commerce/           # future e-commerce
  docker/                 # compose + Dockerfile (one image: API + admin)
  docs/
```

## 3. Data model (core, tenant-scoped unless noted)

Everything except global identity carries `site_id` and is filtered by the tenant context.

- **sites** — `id, slug, name, domains[], status, settings(JSONB)` — *global*
- **users** — `id, email, password_hash, name, avatar, status` — *global identity*
- **site_memberships** — `user_id, site_id, role_id` (a user can belong to many sites)
- **roles** — `id, site_id?, name, capabilities[]` (site_id null = global role)
- **content_types** — `id, site_id, slug, name, config(JSONB: hierarchical, public, has_archive, supports[], icon), is_core`
- **field_definitions** — `id, content_type_id, key, type, order, config(JSONB: validation, default, localized, relation target, repeater schema…)`
- **content_entries** — `id, site_id, content_type_id, slug, title, status(draft|published|scheduled|trashed), author_id, parent_id?, locale, translation_group_id?, published_at, fields(JSONB), created_at, updated_at`
- **content_revisions** — `id, entry_id, data(JSONB snapshot), author_id, created_at`
- **taxonomies** — `id, site_id, slug, name, config(JSONB: hierarchical)`
- **terms** — `id, taxonomy_id, slug, name, parent_id?`
- **entry_terms** — `entry_id, term_id` (m2m)
- **media** — `id, site_id, storage_key, url, mime, size, width, height, alt, focal_point, variants(JSONB), meta(JSONB)`
- **menus / menu_items** — navigation trees
- **options** — `site_id, key, value(JSONB)` (per-site settings, wp_options analogue)
- **plugins** — `id, site_id?, name, version, enabled, settings(JSONB)`
- **redirects, forms, form_submissions, webhooks, api_keys, jobs, audit_log**

**Why hybrid works:** custom content types are *data*, but their instances all live in the fixed `content_entries` table with values in `fields` JSONB — so **no DDL is needed to add a "Recipe" type at runtime**. Only plugins that want their *own* real tables run migrations. Hot/filterable custom fields can be promoted to **generated columns** + GIN indexes for performance.

**i18n:** `locale` + `translation_group_id` link translations of the same entry.
**Versioning:** every save writes a `content_revisions` snapshot; restore = new revision.

## 4. Extensibility — the heart

### 4.1 A plugin is a NestJS module + manifest
```ts
export const manifest: PluginManifest = {
  name: 'seo',
  version: '1.0.0',
  requires: { core: '^1.0.0' },
  capabilities: ['seo:manage'],
};
```
Lifecycle: `install → activate → (upgrade) → deactivate → uninstall`, each a hook the plugin can implement. Migrations run on install/upgrade and are tracked per plugin.

### 4.2 What a plugin can register (via injected registries)
- **Content types & taxonomies** (programmatically, same as data-defined ones)
- **Field types** — `{ validate, serialize, deserialize, graphqlType, adminWidget }`. This is how new field kinds appear in both the API and the admin.
- **GraphQL types/resolvers** — merged into the schema at build time.
- **Own DB tables** — TypeORM entities + migrations (the "plugins can add db schemas" requirement).
- **Hooks/filters** — subscribe to the hook bus.
- **Scheduled jobs** — BullMQ cron.
- **REST endpoints / webhooks**.
- **Settings schema** — a declarative field schema the admin renders generically.
- **Admin UI descriptors** — server describes panels/columns/menu items as data; the generic Angular admin renders them (no admin redeploy to add a plugin's screens).

### 4.3 Hook bus (WordPress actions/filters, typed)
- **Actions** — fire-and-observe: `content.beforeSave`, `content.afterPublish`, `auth.onLogin`, `media.afterUpload`.
- **Filters** — transform a value through a chain: `graphql.extendSchema`, `content.serialize`, `delivery.cacheKey`.
Ordered by priority; async-aware. This is the primary decoupling mechanism.

### 4.4 Adapters (swappable drivers)
Storage (local FS / S3-MinIO), Mail (SMTP / provider), Cache (Redis), Queue (BullMQ), Search (Postgres FTS / Meilisearch). Selected in `mkcms.config.ts`.

## 5. GraphQL API design

- **Core schema** — code-first NestJS resolvers: auth, users, sites, roles, media, settings, plugins, menus.
- **Content schema** — *(P3 as-built)* a generic `Entry` type with core relational columns typed and the flexible per-type values exposed as a `JSON` scalar (`fields`), queried by content-type slug: `entries(type)`, `entry(type, slug | id)` + `create/update/publish/…` mutations. A single multi-tenant schema can't statically type per-site runtime types, so clients introspect a type's shape via its `ContentType` + `FieldDefinition` metadata. Authors and terms are DataLoader-batched. (A per-type typed schema could return as a build-time/per-tenant option later.)
- **Delivery vs Admin** — same resolvers, different guards + query scope (published-only + site/API-key scope for delivery; full access + capability checks for admin). Delivery responses carry cache hints; `content.afterPublish` invalidates cache + fires webhooks (for static/ISR rebuilds).

## 6. Auth & RBAC

- **Auth**: JWT access + refresh (httpOnly). API keys for delivery. Social/OAuth as a plugin.
- **RBAC**: capability strings (`content:recipe:publish`, `media:upload`, `settings:manage`, `plugin:manage`). Roles bundle capabilities, scoped per site. `@RequireCapability()` guard + tenant guard on every mutation.
- **Tenant resolution**: middleware resolves the current site from domain / `x-site` header / API key, sets `TenantContext`; a global TypeORM scope injects `site_id` into every query so cross-tenant leakage is structurally hard.

## 7. Out-of-the-box tools (WordPress parity, mostly core, some first-party plugins)

Content: hierarchical pages, blog posts, custom types, revisions, scheduling, drafts + preview, trash, duplicate, bulk actions · Taxonomies (categories, tags, custom) · **Media library** with image processing (sharp: responsive variants, WebP/AVIF, focal point) · Menu builder · **SEO** (meta/OG, `sitemap.xml`, robots, canonical, JSON-LD, redirects) · **Forms** builder + submissions + notifications (pairs with your AZ Widgets contact/newsletter) · Users/roles/permissions · Per-site + global settings · i18n · Search (Postgres FTS, Meilisearch adapter) · Delivery caching + invalidation · Webhooks/events · Cron/jobs · Audit log · **Import/export** (WordPress WXR importer to migrate existing client sites) · API-key management · Email adapter · optional Comments.

## 8. E-commerce readiness (design-for, don't build yet)

The content model + hook bus + plugin migrations are enough for a future `commerce` plugin to add: products (content type with variants), inventory, cart, orders, payments (**Stripe**), tax, shipping. Reserve namespaced hooks (`order.*`, `cart.*`), currency/price in settings, and a checkout webhook surface. No commerce code lands until phase 7.

## 9. Config

- Instance config in `mkcms.config.ts` + env (DB, Redis, storage/mail/search adapters, enabled plugins, JWT secrets).
- Runtime config in `options` (per site) and `plugins.settings`.
- NestJS `ConfigModule` validates env with a schema at boot.

## 10. Deployment

Docker Compose: `api` (one image serving the API and, with `ADMIN_DIR`, the admin), `postgres`, `redis`, optional `minio`. The image is built by GitHub Actions and published to GHCR; any host that runs Compose behind a reverse proxy or a tunnel will do. Migrations run on container start.

## 11. Phased roadmap

- **P0 — Skeleton**: workspace, NestJS app, Postgres+TypeORM, Redis, config module, Docker compose, health check.
- **P1 — Multi-tenant foundation**: sites, users, JWT auth, RBAC/capabilities, TenantContext + query scoping, options.
- **P2 — Content engine**: content_types, field_definitions, field-type registry, content_entries + JSONB, revisions, taxonomies/terms, media (+ sharp).
- **P3 — GraphQL** ✅: code-first core (auth/me, content types, entries, taxonomies) + JSON-scalar flex fields; admin (guarded CRUD) vs public `delivery` namespace (published-only, preview tokens); DataLoader-batched authors/terms. Per-type static schema generation deferred in favour of a generic `Entry` type — a single shared schema can't carry per-tenant runtime types (see §5 / P3 note).
- **P4 — Plugin engine** ✅: typed **hook bus** (actions + filters, priority, plugin-gated) in its own global module; plugin contracts (`PluginManifest`/`Plugin`/`PluginContext`) + `PLUGIN` DI token (collected via a factory — Nest has no `multi` providers); `PluginManager` (`OnApplicationBootstrap`: register → install/upgrade `plugins` table row → activate enabled; admin ops list/activate/deactivate/updateSettings); declarative **settings schema** validated through the shared field-type validator; content engine fires `content.afterSave/afterPublish/afterTrash` + a `content.fields` filter; an **example plugin** (color field type on activate/deactivate, publish-log action, stamp filter, settings) proves every extension point; admin GraphQL under `plugin:manage`. Deferred: per-site activation (global only for now), programmatic content-type registration, admin UI descriptors, plugin-owned DB tables.
- **P5 — First-party modules** 🚧: shipped so far —
  - **audit log** (tenant-scoped, entirely hook-driven — an `AuditSubscriber` records `content.saved/published/trashed` off the bus; admin `auditLog` query under `audit:read`);
  - **redirects** (per-site CRUD with path normalization + `redirect:manage`; a public `delivery.redirect(path)` lookup that hit-counts);
  - **SEO + sitemap** (`seo_meta` per-entry overrides + per-site defaults in `options`; a resolved `Entry.seo` field — templated title, description, canonical, OG, JSON-LD — on both admin & delivery; `setEntrySeo`/`seoSettings` admin ops; public `GET /seo/sitemap.xml` (noindex-excluded, `content_type.config.seoUrlPattern` for URLs) and `GET /seo/robots.txt`);
  - **menus** (`menus` + `menu_items` nav trees; admin CRUD + item add/update/delete + bulk `reorderMenu` under `menu:manage`; a public `delivery.menu(slug)` that returns the nested tree with `entry`-type items resolved to their published URLs via the type pattern; deleting an item re-parents its children);
  - **webhooks + jobs** (BullMQ `JobsModule` wires the queue infra onto the existing Redis; `webhooks` + `webhook_deliveries` tables; a `WebhookSubscriber` bridges `content.published/saved/trashed` hook actions to per-webhook delivery jobs; a `WebhookProcessor` performs the HMAC-SHA256-signed POST off-request, records every attempt, and throws so BullMQ retries with exponential backoff; admin CRUD + `testWebhook` + delivery history under `webhook:manage`);
  - **forms + notifications** (`forms` + `form_submissions`; data-defined form fields validated by the shared field-type registry; public REST `GET /forms/:slug` (schema for rendering, notify addresses hidden) + `POST /forms/:slug/submit` (validate → store with IP/UA meta → fire `form.submitted`); a `FormsSubscriber` enqueues notification mail per submission; a global `MailModule` (queued, log transport by default, SMTP-swappable) drains the mail queue; admin CRUD + submissions under `form:manage`);
  - **WordPress importer** (`WxrParser` parses a WXR/XML export; `WpImporterService` ensures the target content types [post/page/custom, each gaining `content`+`excerpt` fields] and taxonomies [category/tag], creates one entry per importable item preserving slug + publish date + terms, skips nav/revisions, and is idempotent by slug; **attachments are downloaded into the media library and inline `<img src>` URLs are rewritten** to the new media URLs; admin `importWordpress(xml, importMedia)` mutation under `settings:manage`);
  - **search** (Postgres FTS over a STORED generated `search_vector` on `content_entries` — title weight A + JSONB string values weight B, GIN-indexed, auto-maintained so no reindex step; a `SEARCH_ADAPTER` seam [Postgres default, Meilisearch-swappable]; `websearch_to_tsquery` matching + `ts_rank` + `ts_headline` snippets; admin `searchContent` [incl. drafts, `content:read`] and public `delivery.search` [published-only]).

  **P5 complete.**
- **Media pipeline** ✅ (the slice split out of P2): `media` table; a `STORAGE_ADAPTER` seam (local-FS default, path-traversal-safe; S3/MinIO-swappable); `sharp` image processing generating responsive WebP variants inline on upload + intrinsic dimensions; `POST /media` (multipart, `media:upload`) + public `GET /media/file/:site/:id/:name` serving with long-cache headers; admin GraphQL browse/update (alt/title/focal point)/delete; public `delivery.media(id)`.
- **P6 — Admin app**: Angular + mk-kit + ngrx + Apollo; schema-driven generic CRUD.
- **P7 — Commerce plugin**: later.

## 12. Open questions for later

- Preview strategy per frontend (signed URL vs preview mode).
- Static rebuild trigger contract (webhook payload shape) for Angular/Next consumers.
- Whether media processing runs inline or as BullMQ jobs (lean: jobs).
- Meilisearch from day one vs Postgres FTS first (lean: FTS first, adapter ready).

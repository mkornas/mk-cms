# mk-cms — API reference

Two audiences share one GraphQL endpoint at **`POST /graphql`**, plus a few
public REST endpoints for things crawlers/browsers fetch directly. In
development, open `/graphql` in a browser for the **Apollo Sandbox** explorer
(schema docs, autocomplete, query runner).

## Request model

- **Tenant** — every request resolves a site from the `x-site` header (slug or
  id) or the request Host. Tenant-scoped operations return `400` without one.
- **Auth** — admin GraphQL fields require `Authorization: Bearer <accessToken>`
  from the `login` mutation. The public `delivery` subtree and the public REST
  endpoints need no token.
- **Authorization** — capability-based (see the table below). Each admin
  field/mutation declares a required capability; roles bundle capabilities.

## GraphQL — admin (authenticated)

Root **queries**: `me`, `mySites`, `fieldTypes`, `contentTypes`, `contentType`,
`entries`, `entry`, `entryRevisions`, `taxonomies`, `terms`, `entryTerms`,
`plugins`, `auditLog`, `redirects`, `seoSettings`, `menus`, `webhooks`,
`webhookDeliveries`, `forms`, `form`, `formSubmissions`, `searchContent`,
`media`, `mediaItem`.

Root **mutations** by area:

| Area | Mutations |
|------|-----------|
| Auth | `login`, `refresh` (both `@Public`) |
| Content types | `createContentType`, `updateContentType`, `deleteContentType`, `addField`, `removeField` |
| Entries | `createEntry`, `updateEntry`, `publishEntry`, `unpublishEntry`, `trashEntry`, `previewToken` |
| Taxonomies | `createTaxonomy`, `deleteTaxonomy`, `createTerm`, `deleteTerm`, `setEntryTerms` |
| Plugins | `activatePlugin`, `deactivatePlugin`, `updatePluginSettings` |
| SEO | `setEntrySeo`, `updateSeoSettings` |
| Redirects | `createRedirect`, `updateRedirect`, `deleteRedirect` |
| Menus | `createMenu`, `deleteMenu`, `addMenuItem`, `updateMenuItem`, `deleteMenuItem`, `reorderMenu` |
| Webhooks | `createWebhook`, `updateWebhook`, `deleteWebhook`, `testWebhook` |
| Forms | `createForm`, `updateForm`, `deleteForm`, `deleteFormSubmission` |
| Import | `importWordpress(xml)` |

The flexible half of the content model (`Entry.fields`, `*.config`, plugin
`settings`, SEO `jsonLd`) crosses the API as a `JSON` scalar; clients introspect
a type's shape via its `ContentType` + `FieldDefinition` metadata. GraphQL enums
serialize as their **PascalCase** names (`Published`, not `publish`).

## GraphQL — delivery (public, read-only)

Everything public is namespaced under one `@Public` root field so it's cleanly
separated from the authenticated fields:

```graphql
query {
  delivery {
    entries(type: "post", limit: 10) { title slug seo { title canonical } }
    entry(type: "post", slug: "hello", preview: "<token?>") { fields }
    contentTypes { slug fields { key type } }
    taxonomies { slug }
    terms(taxonomy: "category") { name slug }
    menu(slug: "primary") { label url children { label url } }
    redirect(path: "/old") { to statusCode }
    search(query: "basil -garlic") { rank snippet entry { title slug } }
  }
}
```

Delivery returns **published** content only. A `preview` token (minted by the
admin `previewToken` mutation, bound to the site) unlocks a draft for previewing.
`Entry.author` is the public-safe `PublicAuthor` (no email) on every path.

## REST endpoints (public)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health`, `/health/live` | Liveness/readiness |
| `GET` | `/seo/sitemap.xml` | Sitemap (published, non-noindex) for the resolved site |
| `GET` | `/seo/robots.txt` | robots.txt (+ sitemap link) |
| `GET` | `/forms/:slug` | Public form schema for rendering |
| `POST` | `/forms/:slug/submit` | Submit a form (validated; captures IP/UA) |
| `POST` | `/media` | Upload a file (multipart, auth + `media:upload`) → processes image variants |
| `GET` | `/media/file/:site/:id/:name` | Serve a stored file / variant (public, long-cached) |

> P1/P2 also expose REST controllers for content/taxonomy CRUD; new work targets
> the GraphQL surfaces.

## Webhooks

A webhook subscribes to events (`content.published`, `content.saved`,
`content.trashed`). On dispatch, a BullMQ worker POSTs
`{ event, payload, deliveryId, timestamp }` with headers:

- `X-MK-Event` — the event name
- `X-MK-Signature` — `sha256=` + HMAC-SHA256 of the raw body under the webhook's
  secret (verify this to authenticate the call)
- `X-MK-Delivery` — the job id

Failures retry with exponential backoff; every attempt is recorded and readable
via `webhookDeliveries`.

## Capabilities

`resource:action` strings; `resource:*` and `*` are wildcards. Roles: `owner`
(`*`), `admin`, `editor`, `author`, `viewer`.

`content:{read,create,update,delete,publish}` · `media:{read,upload,delete}` ·
`taxonomy:manage` · `menu:manage` · `form:manage` · `redirect:manage` ·
`webhook:manage` · `audit:read` · `user:{read,invite,manage}` · `role:manage` ·
`settings:manage` · `site:manage` · `plugin:manage`

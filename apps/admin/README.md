# @mk-cms/admin

The mk-cms admin panel — **Angular 22 (standalone, zoneless, signals) +
[`@mk-kit/ui`](https://github.com/mk-kit/mk-kit) + Apollo Client v4 + ngrx
SignalStore**.

It talks to the CMS's single GraphQL endpoint (`/graphql`): admin root fields
are JWT + capability guarded; the active tenant is selected via the `x-site`
header. In production the API serves the built admin from the same origin
(`ADMIN_DIR`), so the relative `/graphql` URL works everywhere.

## Develop

```bash
# from the repo root
pnpm install
pnpm api:dev        # the API on :4000 (also: pnpm infra:up for pg + redis)
pnpm admin:dev      # this app on http://localhost:4300
```

The dev server proxies `/graphql` and `/media` to the API on `:4000`
(`proxy.conf.json`), so no CORS setup is needed locally.

## Layout

```
src/app/
  core/
    session/    ngrx SignalStore — JWT pair, identity, active tenant (localStorage-persisted)
    auth/       AuthService (login/bootstrap/logout) + route guards
    graphql/    Apollo provider, auth/x-site HttpInterceptor, gql operations
  layout/       Shell — app-shell chrome + data-driven sidebar (one item per content type)
  features/
    login/      credentials screen
    dashboard/  landing
    content/    list view (mk-table) + schema-driven entry editor
                (field-control maps each field type -> an mk-kit control)
```

### Schema-driven editor

`content/entry-editor.page` loads a content type's field definitions and renders
one `field-control` per field. The mapping (`field-control.ts`):

| Field type | Control |
|------------|---------|
| text / email / url / slug | `input[mkInput]` |
| textarea / richtext | `textarea[mkInput]` (richtext uses the block editor) |
| number | `input[type=number]` |
| boolean | `mk-switch` |
| date | `mk-date-picker` |
| select | `mk-select` / `mk-multi-select` (when `config.multiple`) |
| relation | `mk-select` / `mk-multi-select` over entries of `config.contentType` |
| json | `mk-code-editor` (language=json, live-validated) |

Create/update go through `createEntry`/`updateEntry`; publish/unpublish are
separate mutations (status isn't part of the update input).

## Upgrading @mk-kit/ui

Bump the range in `package.json` and `pnpm install`; the library's
[CHANGELOG](https://github.com/mk-kit/mk-kit/blob/main/CHANGELOG.md) lists
the rare breaking changes. During library development you can point at a
local build: `"@mk-kit/ui": "file:../../../mk-kit/dist/mk-kit"`.

## Next

Media library + picker (mk-file-upload → `POST /media`), the block-editor ↔ HTML
bridge for richtext, taxonomy & menu builders, a per-site switcher, and
server-side pagination/filtering on the list view. See
`../../docs/ADMIN-UI-READINESS.md`.

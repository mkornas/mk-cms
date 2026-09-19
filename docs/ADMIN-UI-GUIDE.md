# Admin UI guide

How the mk-cms admin (`apps/admin`, Angular 22 + `@mk-kit/ui`) is put together,
the design conventions every page follows, and a short operator's guide to what
each screen does. Read the **Conventions** section before adding or reworking a
page — consistency is the whole point.

The reference implementation for all of these conventions is the **Users** page:
`src/app/features/users/user-management.page.{ts,html}` +
`src/app/features/users/user-edit.dialog.ts`. When in doubt, copy it.

---

## Design principles

1. **The kit does the work.** `@mk-kit/ui` ships ~130 components. Reach for one
   before hand-rolling markup: `mk-page-header`, `mk-table`, `mk-empty-state`,
   `mk-card`, `mk-description-list`, `mk-stat-card`, dialogs, form controls. A
   raw `<table>`, `<dl>`, `role="button"` div-list, or `<p>No items</p>` is a
   smell — there's a component for it.
2. **Width is disciplined.** Content is never edge-to-edge on wide monitors.
   List/table/dashboard pages get a wide reading column; forms and detail views
   get a tighter, more legible measure. (See *Layout & width*.)
3. **Tables list, dialogs edit.** Management screens are a data table of rows;
   creating and editing happen in a focused overlay, not an always-open form
   crammed beside the list. Fast to scan, fast to act, never busy.
4. **Buttons are their natural size.** Submit buttons don't stretch across the
   page. Actions live in a `.mk-form-actions` row.
5. **Feedback is automatic.** Every GraphQL mutation raises a success/error
   toast globally (see *Feedback*). Pages don't hand-roll status banners for
   mutation results.

---

## Layout & width

The kit's app-shell pads the main region but does **not** cap its width, so the
cap lives in `src/styles.scss`:

```scss
mk-app-shell router-outlet + * {   /* the routed page inside the shell */
  display: block;
  max-width: var(--page-max, 90rem);   /* wide default: good for tables */
  margin-inline: auto;                 /* centered */
}
```

(Scoped to `mk-app-shell` so it caps the *page*, not the whole app — the
top-level outlet that renders the shell itself and the login page stays
uncapped, or the sidebar would float centered on wide screens.)

A page opts into a tighter measure by setting `--page-max` on its `:host`:

| Page kind                         | `--page-max`      | Examples                        |
| --------------------------------- | ----------------- | ------------------------------- |
| Lists / tables / dashboard        | `90rem` (default) | Users, Sites, content lists     |
| Detail / mixed forms              | `64rem` – `72rem` | Roles, redirects                |
| Single settings form              | `48rem`           | General settings, SEO, Import   |

```ts
// in a form page component
styles: `:host { --page-max: 48rem; }`,
```

### Shared helper classes (`styles.scss`)

- `.mk-form-actions` — flex row for submit/cancel buttons so they keep their
  natural width and align consistently. **Always** wrap form buttons in this;
  a bare `<button mkButton>` that is a direct child of a `display:grid` /
  `flex-direction:column` container stretches to full width.
- `.mk-form-actions--end` — right-aligns the action row.
- `.mk-form-stack` — a constrained single-column stack of form fields.
- `.page-sections` / `.page-section-title` — vertical rhythm + section headings.
- `.mk-muted` — secondary/help text.

Everything else is component-scoped CSS using `--mk-*` tokens (never hard-coded
colors, spacing, or fonts).

---

## Page anatomy

### Header — always `mk-page-header`

```html
<mk-page-header heading="Users" description="One line of context.">
  <div mkPageHeaderActions class="head-actions">
    <button mkButton variant="outline" (click)="openInvite()">Invite user</button>
    <button mkButton tone="primary" (click)="openNew()">New user</button>
  </div>
</mk-page-header>
```

Projection slots: `[mkPageHeaderBreadcrumb]`, `[mkPageHeaderMeta]`,
`[mkPageHeaderActions]`, `[mkPageHeaderTabs]`.

### Lists — `mk-table`

```html
<mk-table
  [columns]="columns" [data]="rows()" trackKey="id"
  [hover]="true" [zebra]="true"
  [clickableRows]="true" (rowClick)="openEdit($event)"
  [selectable]="true" [(selected)]="selected"
  emptyMessage="No users match your filter." />
```

```ts
columns: MkTableColumn<Row>[] = [
  { key: 'name',  header: 'Name',   sortable: true },
  { key: 'email', header: 'Email',  sortable: true },
  { key: 'status', header: 'Status', align: 'center' },
  { key: 'access', header: 'Access', align: 'center',
    format: (v, row) => (row.isSuperAdmin ? 'Super admin' : 'Member') },
];
```

**MkTable constraints — read these:**

- **Text cells only.** Cells render the property value (optionally via `format`).
  There are **no custom cell templates**, so you can't put a `<button>` or a
  `<mk-badge>` inside a cell. Derive display strings with `format`.
- **Per-row actions** are handled by `[clickableRows]` + `(rowClick)` (open the
  edit dialog) and `[selectable]` + a **bulk-action toolbar** (see Users'
  bulk-delete). Don't try to add an "actions" column of buttons.
- Extras when you need them: `[stickyHeader]`, `density`, `[expandable]` with an
  `<ng-template mkTableRowDetail let-row>`, `[resizableColumns]`,
  `[(sort)]`/`(sortChange)`, and inline `editable` columns emitting `cellEdit`.

### Empty states — `mk-empty-state`

```html
<mk-empty-state icon="user" title="No users yet"
  description="Create the first user or invite someone by email.">
  <div mkEmptyStateActions>
    <button mkButton tone="primary" (click)="openNew()">New user</button>
  </div>
</mk-empty-state>
```

### Description lists — `mk-description-list` / `mk-desc-item`

Use instead of a raw `<dl>` for key/value metadata (media details, import
results, form submissions).

---

## The edit-dialog pattern

Management pages follow **table + dialog**. The page owns the query, the table,
and the "open dialog" glue; a sibling `*.dialog.ts` owns the form and mutations.

**Page side:**

```ts
private readonly overlay = inject(MkOverlayService);

private async openDialog(data: FooDialogData): Promise<void> {
  const ref = this.overlay.open<FooEditDialog, boolean, FooDialogData>(FooEditDialog, { data });
  const changed = await ref.afterClosed;        // ⚠ afterClosed is a Promise PROPERTY, not a method
  if (changed) await this.queryRef.refetch();
}
```

**Dialog side** (`foo-edit.dialog.ts`):

```ts
private readonly ref = inject<MkOverlayRef<boolean>>(MkOverlayRef);
protected readonly data = inject<FooDialogData>(MK_OVERLAY_DATA);
// ...perform Apollo mutations; on success: this.ref.close(true);
// on cancel: this.ref.close(false) (or the accumulated `changed` flag).
```

The dialog does its own mutations (so success/error toasts fire) and closes with
`true` when it changed data. Wrap mutations in `try/catch` so an error leaves the
dialog open — the toast already told the user what happened.

A `mode: 'create' | 'invite' | 'edit'` discriminator on the dialog data keeps a
single dialog serving new/edit flows (see `UserEditDialog`).

---

## Navigation & language

The sidebar is ordered for the people who use it daily: **Content** (one item
per content type, then Media, Scheduled, Categories & tags, Menus) comes first;
**Administration** and **Operations** are collapsible groups below, visible only
to admins. Every nav item carries an icon (`<mk-icon mkNavIcon …>`), which also
enables the app-shell's collapsed icon rail (the header's sidebar button).
App-specific icons beyond the kit's built-in set are registered in
`core/ui/icons.ts` — add new ones there.

Speak the user's language, not the schema's: "Categories & tags" (not
Taxonomies), "Activity log" (not Audit log), "Import from WordPress", and
buttons name the thing they create ("New Article", not "New entry"). Icon-only
buttons always get a `mkTooltip` and an `aria-label`.

---

## Entry editor: field roles

The schema-driven entry editor keeps the parts a human author cares about
front-and-centre and tucks configuration away:

- **Title** — a large, borderless input at the top of the content column.
- **Featured image** — the first single-value `media` field is rendered as a
  prominent 16:9 hero (`<app-media-field [hero]="true">`), not a small thumb.
- **Content** — long-form fields (`richtext`, `textarea`) get the main column.
- **Details** — every other field drops into a "Details" card below the content.
- **Configuration** — slug, taxonomies, SEO, schedule, parent and translations
  live in the right rail; the entry-meta panels collapse into an `mk-accordion`
  so the sidebar isn't a tall stack of always-open cards.

Field classification is derived in `entry-editor.page.ts` (`heroField`,
`bodyFields`, `detailFields`) purely from field `type`, so it works for any
content type without per-type config.

## Feedback

`core/graphql/notify.link.ts` is an Apollo link that toasts **every** mutation:
a success toast derived from the operation name (`Create…`→"Created",
`Update/Set/Save…`→"Saved", `Delete/Remove…`→"Deleted", …) and a danger toast
for any GraphQL/network error. The global `<mk-toast-container />` lives in the
shell. Consequences for page code:

- **Don't** add `mk-alert` banners to report mutation success/failure — it's
  handled. (Inline `mk-alert` is still fine for *pre-submit* validation.)
- Destructive actions go through `ConfirmService` (`core/ui/confirm.service.ts`)
  → a consistent danger confirm dialog. Use `confirm.remove('the X "…"')`.

---

## Conventions checklist (new/reworked page)

- [ ] `mk-page-header` for the title; page actions in `[mkPageHeaderActions]`.
- [ ] Correct `--page-max` for the page kind (table 90rem / detail 64–72 / form 48).
- [ ] Lists use `mk-table`; no `role="button"` div-lists or raw `<table>`.
- [ ] Empty lists use `mk-empty-state`.
- [ ] Editing happens in a `*.dialog.ts` overlay, not an always-open side form.
- [ ] Submit buttons wrapped in `.mk-form-actions` (never full-width).
- [ ] No `mk-alert` banners for mutation results (toasts handle it).
- [ ] Raw `<dl>` → `mk-description-list`; raw `<input type=checkbox|file>` →
      `mk-checkbox` / `mk-file-upload`.
- [ ] Standalone + `ChangeDetectionStrategy.OnPush` + signals; every `mk-*` used
      in the template is listed in the component's `imports:` array.
- [ ] `pnpm admin:build` is clean.

---

## Operator's guide (what each screen does)

**Dashboard** — entry counts per content type (click a card to open its list),
an entries-per-type bar chart, a status-breakdown donut, and a recent-activity
feed from the audit log.

**Content** (sidebar, one entry per content type) — a table of entries with
status tabs (All/Published/Draft/Scheduled/Trashed), a title filter, sortable
columns, Prev/Next paging, and row-select **bulk** publish/unpublish/duplicate/
trash (or restore/delete-forever in Trash). Click a row to open the **entry
editor** (all field types, revisions + diff, terms, per-entry SEO, scheduling).

**Media** — upload (drag-drop), a tile grid, per-item alt/title/focal-point edit,
and bulk delete. Also available as a picker dialog from media fields.

**Taxonomies** — a table of taxonomies; select one to manage its **terms**
(nested), add terms with a parent. Core taxonomies are protected.

**Menus** — build nested navigation menus; reorder items; link items to entries
via the entry picker.

**Sites** *(admins)* — a table of sites; edit a site's name/status, its
**domains** (hostnames that resolve to it), and its **members** (users + their
role). Create new tenants here.

**Plugins** *(admins)* — activate/deactivate plugins and edit their settings
(settings render from each plugin's declared schema, reusing the content field
controls).

**Users** *(admins)* — a table of all users; create, invite-by-email, edit
name/status/super-admin, reset passwords, delete. Users are global; grant site
access under **Sites**.

**Roles** *(admins)* — read-only **system** roles (shared templates) plus this
site's **custom** roles, edited via a capability picker grouped by resource.

**Content types** *(admins)* — define content types and their fields (the schema
that drives the content list + editor); per-type config as JSON.

**Operations** *(admins)* — **Redirects** (from→to + hit counts), **Webhooks**
(endpoints, events, signed deliveries + delivery log), **Forms** (build forms +
view submissions), **Audit log** (who did what), **SEO settings** (site defaults,
title template, sitemap/robots), **General settings** (options store), and
**WordPress import** (WXR upload → content + media).

**⌘K** anywhere opens the command palette (navigate, new-of-type, switch site,
toggle theme, sign out).
```

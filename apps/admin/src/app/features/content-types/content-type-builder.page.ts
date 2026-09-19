import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { ConfirmService } from '../../core/ui/confirm.service';
import {
  MkButton,
  MkCard,
  MkFormField,
  MkInput,
  MkSelect,
  MkSwitch,
  MkBadge,
  MkAlert,
  MkCodeEditor,
  MkSkeletonPreset,
  MkPageHeader,
  MkEmptyState,
  MkTable,
  MkTableColumn,
} from '@mk-kit/ui';
import { slugify } from '../../core/util/slugify';
import {
  FIELD_TYPES,
  CONTENT_TYPES_ADMIN,
  CREATE_CONTENT_TYPE,
  UPDATE_CONTENT_TYPE,
  DELETE_CONTENT_TYPE,
  ADD_FIELD,
  UPDATE_FIELD,
  REMOVE_FIELD,
  CONTENT_TYPE,
} from '../../core/graphql/operations';

interface FieldDef {
  id: string;
  key: string;
  name: string;
  type: string;
  required: boolean;
  config: Record<string, unknown>;
  sortOrder: number;
}
interface ContentType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isCore: boolean;
  config: Record<string, unknown>;
  fields: FieldDef[];
}

/** Row shape rendered by the type table (adds a derived, human-readable kind). */
interface TypeRow extends ContentType {
  kind: string;
}

/**
 * Content-type builder: create/edit/delete content types and manage their field
 * definitions (add/edit/remove/reorder). Each field's per-type config (select
 * options, relation/media target, min/max, …) is edited as JSON. Gated by
 * `settings:manage` on the API.
 */
@Component({
  selector: 'app-content-type-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkButton,
    MkCard,
    MkFormField,
    MkInput,
    MkSelect,
    MkSwitch,
    MkBadge,
    MkAlert,
    MkCodeEditor,
    MkSkeletonPreset,
    MkPageHeader,
    MkEmptyState,
    MkTable,
  ],
  templateUrl: './content-type-builder.page.html',
  styles: `
    .layout { display: grid; gap: var(--mk-space-4); grid-template-columns: 1fr; }
    @media (min-width: 64rem) { .layout { grid-template-columns: 18rem 1fr; align-items: start; } }
    .type-table { margin-bottom: var(--mk-space-4); }
    .new-form, .detail-fields { display: grid; gap: var(--mk-space-3); }
    .detail-fields { margin-bottom: var(--mk-space-5); }
    .field-list { display: flex; flex-direction: column; gap: var(--mk-space-1); margin-bottom: var(--mk-space-4); }
    .field-row {
      display: flex; align-items: center; gap: var(--mk-space-2);
      padding: var(--mk-space-2) var(--mk-space-3); border-radius: var(--mk-radius-sm);
      border: var(--mk-border-width) solid var(--mk-border-subtle);
    }
    .field-row .key { font-family: var(--mk-font-mono); font-size: var(--mk-font-size-sm); }
    .field-row .name { color: var(--mk-text-muted); }
    .field-row .spacer { flex: 1; }
    .field-form { display: grid; gap: var(--mk-space-3); border: var(--mk-border-width) solid var(--mk-border); border-radius: var(--mk-radius-md); padding: var(--mk-space-4); }
    .field-form .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--mk-space-3); }
    .field-form .req { display: flex; align-items: center; gap: var(--mk-space-2); }
    .field-form .actions { display: flex; gap: var(--mk-space-2); }
    h2 { margin: 0 0 var(--mk-space-3); font-size: var(--mk-font-size-lg); }
    h3 { margin: var(--mk-space-2) 0; font-size: var(--mk-font-size-md); }
  `,
})
export class ContentTypeBuilderPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);

  private readonly typesRef = this.apollo.watchQuery<{ contentTypes: ContentType[] }>({
    query: CONTENT_TYPES_ADMIN,
    fetchPolicy: 'cache-and-network',
  });
  protected readonly types = toSignal(
    this.typesRef.valueChanges.pipe(map((r) => (r.data?.contentTypes ?? []) as ContentType[])),
    { initialValue: [] as ContentType[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.typesRef.valueChanges.pipe(map((r) => r.loading && !r.data?.contentTypes)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.types().length === 0,
  );

  protected readonly fieldTypeOptions = toSignal(
    this.apollo
      .watchQuery<{ fieldTypes: { id: string; label: string }[] }>({ query: FIELD_TYPES })
      .valueChanges.pipe(
        map((r) =>
          (r.data?.fieldTypes ?? []).map((t) => ({
            label: String(t.label ?? ''),
            value: String(t.id ?? ''),
          })),
        ),
      ),
    { initialValue: [] as { label: string; value: string }[] },
  );

  protected readonly activeSlug = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Guards create-type and field save against double-submit. */
  protected readonly busy = signal(false);

  // create-type form
  protected readonly newName = signal('');
  protected readonly newDesc = signal('');
  // edit-type form
  protected readonly editName = signal('');
  protected readonly editDesc = signal('');
  // field form
  protected readonly editingKey = signal<string | null>(null);
  protected readonly fKey = signal('');
  protected readonly fName = signal('');
  protected readonly fType = signal('text');
  protected readonly fRequired = signal(false);
  protected readonly fConfig = signal('{}');

  /** The selected type WITH its fields — the list query doesn't populate fields,
   *  so we load the full type via contentType(slug) on select + after edits. */
  protected readonly active = signal<ContentType | null>(null);
  protected readonly sortedFields = computed(() =>
    [...(this.active()?.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  protected readonly typeColumns: MkTableColumn<TypeRow>[] = [
    { key: 'name', header: 'Name', sortable: true, stack: 'title' },
    { key: 'slug', header: 'Slug', sortable: true },
    { key: 'kind', header: 'Kind', align: 'center' },
  ];
  protected readonly typeRows = computed<TypeRow[]>(() =>
    this.types().map((t) => ({ ...t, kind: t.isCore ? 'Core' : 'Custom' })),
  );

  private async loadType(base: ContentType): Promise<void> {
    const res = await firstValueFrom(
      this.apollo.query<{ contentType: ContentType }>({
        query: CONTENT_TYPE,
        variables: { slug: base.slug },
        fetchPolicy: 'network-only',
      }),
    );
    const full = res.data?.contentType;
    this.active.set({ ...base, fields: (full?.fields ?? []) as FieldDef[] });
  }

  private async reloadActive(): Promise<void> {
    const cur = this.active();
    if (cur) await this.loadType(cur);
  }

  protected set(target: EventTarget | null, setter: (v: string) => void): void {
    setter((target as HTMLInputElement)?.value ?? '');
  }
  protected asStr(v: unknown): string {
    return v == null ? '' : String(v);
  }

  private async run(work: Promise<unknown>, after?: () => Promise<void> | void): Promise<void> {
    this.error.set(null);
    try {
      await work;
      if (after) await after();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  protected selectType(t: ContentType): void {
    this.activeSlug.set(t.slug);
    this.editName.set(t.name);
    this.editDesc.set(t.description ?? '');
    this.resetFieldForm();
    this.error.set(null);
    void this.loadType(t);
  }

  protected createType(): void {
    const name = this.newName().trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    void this.run(
      firstValueFrom(
        this.apollo.mutate({
          mutation: CREATE_CONTENT_TYPE,
          variables: {
            input: { name, slug: slugify(name), description: this.newDesc().trim() || null },
          },
        }),
      ),
      async () => {
        this.newName.set('');
        this.newDesc.set('');
        await this.typesRef.refetch();
      },
    ).finally(() => this.busy.set(false));
  }

  protected saveType(): void {
    const t = this.active();
    if (!t) return;
    void this.run(
      firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_CONTENT_TYPE,
          variables: { slug: t.slug, input: { name: this.editName(), description: this.editDesc() } },
        }),
      ),
      async () => {
        await this.typesRef.refetch();
      },
    );
  }

  protected async deleteType(t: ContentType): Promise<void> {
    if (!(await this.confirm.remove(`the “${t.name}” content type`, 'This can\'t be undone. Existing entries of this type may be affected.'))) return;
    void this.run(
      firstValueFrom(this.apollo.mutate({ mutation: DELETE_CONTENT_TYPE, variables: { slug: t.slug } })),
      async () => {
        if (this.activeSlug() === t.slug) {
          this.activeSlug.set(null);
          this.active.set(null);
        }
        await this.typesRef.refetch();
      },
    );
  }

  // --- fields --------------------------------------------------------------
  protected resetFieldForm(): void {
    this.editingKey.set(null);
    this.fKey.set('');
    this.fName.set('');
    this.fType.set('text');
    this.fRequired.set(false);
    this.fConfig.set('{}');
  }

  protected editField(f: FieldDef): void {
    this.editingKey.set(f.key);
    this.fKey.set(f.key);
    this.fName.set(f.name);
    this.fType.set(f.type);
    this.fRequired.set(f.required);
    this.fConfig.set(JSON.stringify(f.config ?? {}, null, 2));
  }

  private parseConfig(): Record<string, unknown> | null {
    const text = this.fConfig().trim();
    if (text === '' || text === '{}') return {};
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  protected saveField(): void {
    const t = this.active();
    const name = this.fName().trim();
    if (!t || !name || this.busy()) return;
    const config = this.parseConfig();
    if (config === null) {
      this.error.set('Field config must be a valid JSON object.');
      return;
    }
    const editing = this.editingKey();
    if (editing) {
      this.busy.set(true);
      void this.run(
        firstValueFrom(
          this.apollo.mutate({
            mutation: UPDATE_FIELD,
            variables: {
              slug: t.slug,
              key: editing,
              input: { name, type: this.fType(), required: this.fRequired(), config },
            },
          }),
        ),
        async () => {
          this.resetFieldForm();
          await this.reloadActive();
        },
      ).finally(() => this.busy.set(false));
    } else {
      const key = this.fKey().trim();
      if (!key) {
        this.error.set('A field key is required.');
        return;
      }
      const nextOrder = Math.max(-1, ...this.sortedFields().map((f) => f.sortOrder)) + 1;
      this.busy.set(true);
      void this.run(
        firstValueFrom(
          this.apollo.mutate({
            mutation: ADD_FIELD,
            variables: {
              slug: t.slug,
              input: { key, name, type: this.fType(), required: this.fRequired(), config, sortOrder: nextOrder },
            },
          }),
        ),
        async () => {
          this.resetFieldForm();
          await this.reloadActive();
        },
      ).finally(() => this.busy.set(false));
    }
  }

  protected async removeField(f: FieldDef): Promise<void> {
    const t = this.active();
    if (!t) return;
    if (!(await this.confirm.remove(`the “${f.name}” field`, 'Removing a field can orphan its stored data on existing entries.'))) return;
    void this.run(
      firstValueFrom(this.apollo.mutate({ mutation: REMOVE_FIELD, variables: { slug: t.slug, key: f.key } })),
      async () => {
        if (this.editingKey() === f.key) this.resetFieldForm();
        await this.reloadActive();
      },
    );
  }

  /** Swap a field's sortOrder with its neighbour and persist both. */
  protected moveField(index: number, dir: -1 | 1): void {
    const t = this.active();
    const fields = this.sortedFields();
    const target = index + dir;
    if (!t || target < 0 || target >= fields.length) return;
    const a = fields[index];
    const b = fields[target];
    void this.run(
      Promise.all([
        firstValueFrom(
          this.apollo.mutate({
            mutation: UPDATE_FIELD,
            variables: { slug: t.slug, key: a.key, input: { sortOrder: b.sortOrder } },
          }),
        ),
        firstValueFrom(
          this.apollo.mutate({
            mutation: UPDATE_FIELD,
            variables: { slug: t.slug, key: b.key, input: { sortOrder: a.sortOrder } },
          }),
        ),
      ]),
      async () => {
        await this.reloadActive();
      },
    );
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { ConfirmService } from '../../core/ui/confirm.service';
import {
  MkButton,
  MkCard,
  MkBadge,
  MkSwitch,
  MkAlert,
  MkFormField,
  MkInput,
  MkSelect,
  MkSkeletonPreset,
  MkPageHeader,
  MkEmptyState,
  MkDescriptionList,
  MkDescItem,
} from '@mk-kit/ui';
import {
  FORMS,
  FIELD_TYPES,
  FORM_SUBMISSIONS,
  CREATE_FORM,
  UPDATE_FORM,
  DELETE_FORM,
  DELETE_FORM_SUBMISSION,
} from '../../core/graphql/operations';

interface FormField {
  key: string;
  type: string;
  label: string;
  required: boolean;
}
interface Form {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  fields: FormField[];
}
interface FieldType {
  id: string;
  label: string;
}
interface Submission {
  id: string;
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
  createdAt: string;
}

/** Forms + submissions (`form:manage`): create forms, build their fields
 *  (add/edit/remove/reorder — the same field-type registry as content), toggle
 *  on/off, and browse/delete submissions. */
@Component({
  selector: 'app-form-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkCard, MkBadge, MkSwitch, MkAlert, MkFormField, MkInput, MkSelect, MkSkeletonPreset, MkPageHeader, MkEmptyState, MkDescriptionList, MkDescItem],
  templateUrl: './form-management.page.html',
  styles: `
    .layout { display: grid; gap: var(--mk-space-4); grid-template-columns: 1fr; }
    @media (min-width: 62rem) { .layout { grid-template-columns: 20rem 1fr; align-items: start; } }
    .list { display: flex; flex-direction: column; gap: var(--mk-space-1); }
    .item { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-2); padding: var(--mk-space-2) var(--mk-space-3); border-radius: var(--mk-radius-md); cursor: pointer; }
    .item:hover { background: var(--mk-hover-overlay); }
    .item[data-active='true'] { background: var(--mk-selected-bg); color: var(--mk-selected-text); }
    .item small { color: var(--mk-text-muted); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); margin-bottom: var(--mk-space-4); }
    .fields { display: flex; flex-wrap: wrap; gap: var(--mk-space-2); margin-bottom: var(--mk-space-4); }
    .subs { display: flex; flex-direction: column; gap: var(--mk-space-2); }
    .sub { border: var(--mk-border-width) solid var(--mk-border-subtle); border-radius: var(--mk-radius-md); padding: var(--mk-space-3); }
    .sub .subhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--mk-space-2); }
    .sub mk-description-list { font-size: var(--mk-font-size-sm); }
    .muted { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    h2, h3 { margin: 0 0 var(--mk-space-3); } h3 { margin-top: var(--mk-space-2); font-size: var(--mk-font-size-md); }

    .fld { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: var(--mk-space-2); align-items: end;
      padding: var(--mk-space-3); border: var(--mk-border-width) solid var(--mk-border-subtle); border-radius: var(--mk-radius-md); margin-bottom: var(--mk-space-2); }
    .fld .req { display: flex; align-items: center; gap: var(--mk-space-2); white-space: nowrap; padding-bottom: var(--mk-space-2); }
    .fld .ops { display: flex; gap: var(--mk-space-1); }
    .addfld { display: grid; grid-template-columns: 1fr 1fr 1fr auto auto; gap: var(--mk-space-2); align-items: end; margin-top: var(--mk-space-3); }
    .dirty-bar { display: flex; align-items: center; gap: var(--mk-space-3); margin-top: var(--mk-space-3); }
    .create-form { display: grid; gap: var(--mk-space-2); margin-top: var(--mk-space-3); }
  `,
})
export class FormManagementPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly ref = this.apollo.watchQuery<{ forms: Form[] }>({
    query: FORMS,
    fetchPolicy: 'cache-and-network',
  });
  protected readonly forms = toSignal(
    this.ref.valueChanges.pipe(map((r) => (r.data?.forms ?? []) as Form[])),
    { initialValue: [] as Form[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.ref.valueChanges.pipe(map((r) => r.loading && !r.data?.forms)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.forms().length === 0,
  );
  protected readonly creatingForm = signal(false);

  protected readonly activeSlug = signal<string | null>(null);
  protected readonly submissions = signal<Submission[]>([]);
  protected readonly error = signal<string | null>(null);

  protected readonly active = computed(
    () => this.forms().find((f) => f.slug === this.activeSlug()) ?? null,
  );

  /** Registered field types (shared with content) → the type dropdown. */
  private readonly fieldTypes = toSignal(
    this.apollo
      .watchQuery<{ fieldTypes: FieldType[] }>({ query: FIELD_TYPES })
      .valueChanges.pipe(map((r) => (r.data?.fieldTypes ?? []) as FieldType[])),
    { initialValue: [] as FieldType[] },
  );
  protected readonly typeOptions = computed(() =>
    this.fieldTypes().map((t) => ({ label: String(t.label ?? ''), value: String(t.id ?? '') })),
  );

  // --- field builder (editable copy of the active form's fields) -----------
  protected readonly editFields = signal<FormField[]>([]);
  protected readonly savingFields = signal(false);
  /** True when the local field list diverges from the saved form. */
  protected readonly fieldsDirty = computed(
    () => JSON.stringify(this.editFields()) !== JSON.stringify(this.active()?.fields ?? []),
  );

  // New-field form.
  protected readonly nfKey = signal('');
  protected readonly nfLabel = signal('');
  protected readonly nfType = signal('text');
  protected readonly nfRequired = signal(false);

  // New-form form.
  protected readonly creating = signal(false);
  protected readonly cfSlug = signal('');
  protected readonly cfName = signal('');

  constructor() {
    // Reseed the editable field list whenever the selected form changes.
    effect(() => {
      const f = this.active();
      this.editFields.set(f ? f.fields.map((x) => ({ ...x })) : []);
    });
  }

  protected setSig(target: EventTarget | null, set: (v: string) => void): void {
    set((target as HTMLInputElement)?.value ?? '');
  }

  protected async select(f: Form): Promise<void> {
    this.activeSlug.set(f.slug);
    this.creating.set(false);
    this.error.set(null);
    await this.loadSubs(f.slug);
  }

  // --- field CRUD (local until Save) ---------------------------------------
  protected addField(): void {
    const key = this.nfKey().trim();
    const label = this.nfLabel().trim();
    if (!key || !label) return;
    if (this.editFields().some((f) => f.key === key)) {
      this.error.set(`A field with key “${key}” already exists.`);
      return;
    }
    this.error.set(null);
    this.editFields.update((fs) => [
      ...fs,
      { key, label, type: this.nfType() || 'text', required: this.nfRequired() },
    ]);
    this.nfKey.set('');
    this.nfLabel.set('');
    this.nfRequired.set(false);
  }
  protected patchField(i: number, patch: Partial<FormField>): void {
    this.editFields.update((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  protected removeField(i: number): void {
    this.editFields.update((fs) => fs.filter((_, idx) => idx !== i));
  }
  protected moveField(i: number, dir: -1 | 1): void {
    const j = i + dir;
    this.editFields.update((fs) => {
      if (j < 0 || j >= fs.length) return fs;
      const next = [...fs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  protected resetFields(): void {
    const f = this.active();
    this.editFields.set(f ? f.fields.map((x) => ({ ...x })) : []);
    this.error.set(null);
  }
  protected saveFields(): void {
    const slug = this.activeSlug();
    if (!slug || this.savingFields()) return;
    this.savingFields.set(true);
    void this.run(
      firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_FORM,
          variables: { slug, input: { fields: this.editFields() } },
        }),
      ),
      async () => {
        await this.ref.refetch();
        this.savingFields.set(false);
      },
    ).finally(() => this.savingFields.set(false));
  }

  // --- create form ---------------------------------------------------------
  protected startCreate(): void {
    this.creating.set(true);
    this.activeSlug.set(null);
    this.cfSlug.set('');
    this.cfName.set('');
    this.error.set(null);
  }
  protected createForm(): void {
    const slug = this.cfSlug().trim();
    const name = this.cfName().trim();
    if (!slug || !name || this.creatingForm()) return;
    this.creatingForm.set(true);
    void this.run(
      firstValueFrom(
        this.apollo.mutate({
          mutation: CREATE_FORM,
          variables: { input: { slug, name, fields: [] } },
        }),
      ),
      async () => {
        await this.ref.refetch();
        this.creating.set(false);
        this.activeSlug.set(slug);
      },
    ).finally(() => this.creatingForm.set(false));
  }
  private async loadSubs(slug: string): Promise<void> {
    const res = await firstValueFrom(
      this.apollo.query<{ formSubmissions: Submission[] }>({
        query: FORM_SUBMISSIONS,
        variables: { slug, limit: 50, offset: 0 },
        fetchPolicy: 'network-only',
      }),
    );
    this.submissions.set((res.data?.formSubmissions ?? []) as Submission[]);
  }

  private async run(work: Promise<unknown>, after?: () => Promise<void> | void): Promise<void> {
    this.error.set(null);
    try {
      await work;
      if (after) await after();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed.');
    }
  }

  protected toggleEnabled(f: Form, enabled: boolean): void {
    void this.run(
      firstValueFrom(
        this.apollo.mutate({ mutation: UPDATE_FORM, variables: { slug: f.slug, input: { enabled } } }),
      ),
      async () => { await this.ref.refetch(); },
    );
  }
  protected async deleteForm(f: Form, event: Event): Promise<void> {
    event.stopPropagation();
    if (!(await this.confirm.remove(`the “${f.name}” form`, 'Deleting the form also removes its submissions. This can\'t be undone.'))) return;
    void this.run(
      firstValueFrom(this.apollo.mutate({ mutation: DELETE_FORM, variables: { slug: f.slug } })),
      async () => {
        if (this.activeSlug() === f.slug) this.activeSlug.set(null);
        await this.ref.refetch();
      },
    );
  }
  protected async deleteSub(s: Submission): Promise<void> {
    if (!(await this.confirm.remove('this submission'))) return;
    const slug = this.activeSlug();
    void this.run(
      firstValueFrom(this.apollo.mutate({ mutation: DELETE_FORM_SUBMISSION, variables: { id: s.id } })),
      async () => { if (slug) await this.loadSubs(slug); },
    );
  }

  protected entries(obj: Record<string, unknown>): { k: string; v: string }[] {
    return Object.entries(obj ?? {}).map(([k, v]) => ({
      k,
      v: v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
    }));
  }
  protected fmt(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}

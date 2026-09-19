import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { MkFormField, MkSelect, MkAlert } from '@mk-kit/ui';

/** The current entry's parent link. */
const ENTRY_PARENT = gql`
  query EntryParent($id: ID!) {
    entry(id: $id) {
      id
      parentId
    }
  }
`;

/** Candidate parents = other entries of the same content type. */
const PARENT_CANDIDATES = gql`
  query ParentCandidates($type: String!) {
    entries(type: $type, limit: 100) {
      id
      title
      slug
    }
  }
`;

/** Set (or clear) an entry's parent via the generic entry update. */
const UPDATE_ENTRY_PARENT = gql`
  mutation UpdateEntryParent($id: ID!, $input: UpdateEntryInput!) {
    updateEntry(id: $id, input: $input) {
      id
      parentId
    }
  }
`;

interface Candidate {
  id: string;
  title: string | null;
  slug: string | null;
}
interface Option {
  label: string;
  value: unknown;
}

/**
 * Parent / hierarchy picker for a content entry. Lists other entries of the
 * same content type as candidate parents and writes the chosen one via
 * `updateEntry(input: { parentId })`. Only meaningful for hierarchical types,
 * but harmless to render for any type. Saves on change; success toasts fire
 * automatically from the Apollo layer.
 */
@Component({
  selector: 'app-entry-parent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkFormField, MkSelect, MkAlert],
  template: `
    @if (error(); as msg) {
      <mk-alert tone="danger" style="margin-bottom: var(--mk-space-3)">{{ msg }}</mk-alert>
    }

    <p class="hint">
      Nest this entry under another entry of the same type. Used by hierarchical
      types to build parent/child structure.
    </p>

    <mk-form-field label="Parent entry">
      <mk-select
        placeholder="— None —"
        [options]="options()"
        [value]="parentId()"
        [disabled]="busy()"
        (valueChange)="onChange($event)"
      />
    </mk-form-field>
  `,
  styles: `
    .hint { margin: 0 0 var(--mk-space-3); color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
  `,
})
export class EntryParentPanel {
  private readonly apollo = inject(Apollo);

  readonly entryId = input.required<string>();
  readonly type = input.required<string>();

  /** Candidate parents, excluding the current entry itself. */
  private readonly candidates = signal<Candidate[]>([]);
  /** Currently-saved parent id (null = top level). */
  protected readonly parentId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly options = computed<Option[]>(() => [
    { label: '— None —', value: null },
    ...this.candidates()
      .map((c) => ({
        label: String(c.title ?? c.slug ?? c.id),
        value: c.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ]);

  private lastLoaded: string | null = null;

  constructor() {
    effect(() => {
      const id = this.entryId();
      const type = this.type();
      const key = `${id}::${type}`;
      if (id && type && key !== this.lastLoaded) {
        this.lastLoaded = key;
        void this.load(id, type);
      }
    });
  }

  private async load(entryId: string, type: string): Promise<void> {
    this.error.set(null);
    try {
      const [parentRes, listRes] = await Promise.all([
        firstValueFrom(
          this.apollo.query<{ entry: { id: string; parentId: string | null } | null }>({
            query: ENTRY_PARENT,
            variables: { id: entryId },
            fetchPolicy: 'network-only',
          }),
        ),
        firstValueFrom(
          this.apollo.query<{ entries: Candidate[] }>({
            query: PARENT_CANDIDATES,
            variables: { type },
            fetchPolicy: 'network-only',
          }),
        ),
      ]);

      const rows = (listRes.data?.entries ?? []) as Candidate[];
      this.candidates.set(rows.filter((r) => r.id !== entryId));

      const current = parentRes.data?.entry?.parentId;
      this.parentId.set(current != null ? String(current) : null);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load parent.');
    }
  }

  /** mk-select emits `unknown`; option values here are an entry id or null. */
  protected async onChange(value: unknown): Promise<void> {
    if (this.busy()) return;
    const next = value == null || value === '' ? null : String(value);
    if (next === this.parentId()) return;

    const previous = this.parentId();
    this.parentId.set(next);
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate<{ updateEntry: { id: string; parentId: string | null } }>({
          mutation: UPDATE_ENTRY_PARENT,
          variables: { id: this.entryId(), input: { parentId: next } },
        }),
      );
      const saved = res.data?.updateEntry?.parentId;
      this.parentId.set(saved != null ? String(saved) : null);
    } catch (e) {
      this.parentId.set(previous);
      this.error.set(e instanceof Error ? e.message : 'Failed to save parent.');
    } finally {
      this.busy.set(false);
    }
  }
}

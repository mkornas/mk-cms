import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { MkMultiSelect, MkFormField, MkAlert } from '@mk-kit/ui';
import {
  TAXONOMIES,
  TERMS,
  ENTRY_TERMS,
  SET_ENTRY_TERMS,
} from '../../core/graphql/operations';

interface Taxonomy {
  id: string;
  slug: string;
  name: string;
}
interface Term {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
}
interface AssignedTerm {
  id: string;
  taxonomyId: string;
}
interface Option {
  label: string;
  value: unknown;
}

/** Flatten a term hierarchy into indented multi-select options. */
function toOptions(terms: Term[]): Option[] {
  const byParent = new Map<string | null, Term[]>();
  for (const t of terms) {
    (byParent.get(t.parentId) ?? byParent.set(t.parentId, []).get(t.parentId)!).push(t);
  }
  const out: Option[] = [];
  const walk = (parent: string | null, depth: number): void => {
    for (const t of (byParent.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ label: `${'— '.repeat(depth)}${t.name}`, value: t.id });
      walk(t.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/**
 * Assigns taxonomy terms to an entry. One multi-select per taxonomy, seeded from
 * the entry's current terms; any change writes the entry's whole term set via
 * `setEntryTerms` (which replaces across all taxonomies), so we send the union
 * of every taxonomy's selection.
 */
@Component({
  selector: 'app-entry-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkMultiSelect, MkFormField, MkAlert],
  template: `
    @if (error(); as msg) {
      <mk-alert tone="danger" style="margin-bottom: var(--mk-space-3)">{{ msg }}</mk-alert>
    }
    @if (taxonomies().length) {
      <div class="fields">
        @for (tax of taxonomies(); track tax.id) {
          <mk-form-field [label]="tax.name">
            <mk-multi-select
              placeholder="Assign terms…"
              [options]="optionsFor(tax.id)"
              [value]="valueFor(tax.id)"
              (valueChange)="onChange(tax.id, $event)"
            />
          </mk-form-field>
        }
      </div>
    } @else {
      <p style="color: var(--mk-text-muted)">
        No taxonomies yet — create one under Taxonomies to tag entries.
      </p>
    }
  `,
  styles: `
    .fields { display: grid; gap: var(--mk-space-4); }
  `,
})
export class EntryTermsPanel {
  private readonly apollo = inject(Apollo);

  readonly entryId = input.required<string>();

  protected readonly taxonomies = signal<Taxonomy[]>([]);
  /** taxonomyId → indented options for that taxonomy's terms. */
  private readonly optionsByTax = signal<Record<string, Option[]>>({});
  /** taxonomyId → selected term ids. */
  private readonly selected = signal<Record<string, string[]>>({});
  protected readonly error = signal<string | null>(null);

  private lastLoaded: string | null = null;

  constructor() {
    effect(() => {
      const id = this.entryId();
      if (id && id !== this.lastLoaded) {
        this.lastLoaded = id;
        void this.load(id);
      }
    });
  }

  protected optionsFor(taxId: string): Option[] {
    return this.optionsByTax()[taxId] ?? [];
  }
  protected valueFor(taxId: string): string[] {
    return this.selected()[taxId] ?? [];
  }

  private async load(entryId: string): Promise<void> {
    this.error.set(null);
    try {
      const [taxRes, assignedRes] = await Promise.all([
        firstValueFrom(this.apollo.query<{ taxonomies: Taxonomy[] }>({ query: TAXONOMIES })),
        firstValueFrom(
          this.apollo.query<{ entryTerms: AssignedTerm[] }>({
            query: ENTRY_TERMS,
            variables: { entryId },
            fetchPolicy: 'network-only',
          }),
        ),
      ]);
      const taxes = (taxRes.data?.taxonomies ?? []) as Taxonomy[];
      this.taxonomies.set(taxes);

      // Seed the current selection, grouped by taxonomy.
      const sel: Record<string, string[]> = {};
      for (const t of assignedRes.data?.entryTerms ?? []) {
        (sel[t.taxonomyId] ??= []).push(t.id);
      }
      this.selected.set(sel);

      // Load each taxonomy's terms for the option lists.
      const byTax: Record<string, Option[]> = {};
      await Promise.all(
        taxes.map(async (tax) => {
          const r = await firstValueFrom(
            this.apollo.query<{ terms: Term[] }>({
              query: TERMS,
              variables: { taxonomy: tax.slug },
            }),
          );
          byTax[tax.id] = toOptions((r.data?.terms ?? []) as Term[]);
        }),
      );
      this.optionsByTax.set(byTax);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load taxonomies.');
    }
  }

  protected async onChange(taxId: string, ids: unknown[]): Promise<void> {
    const next = { ...this.selected(), [taxId]: (ids ?? []).map(String) };
    this.selected.set(next);
    const union = Object.values(next).flat();
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: SET_ENTRY_TERMS,
          variables: { entryId: this.entryId(), termIds: union },
        }),
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to save terms.');
    }
  }
}

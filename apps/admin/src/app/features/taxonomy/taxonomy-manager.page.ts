import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import {
  MkButton,
  MkTable,
  MkTableColumn,
  MkPageHeader,
  MkEmptyState,
  MkSkeletonPreset,
  MkDialogService,
} from '@mk-kit/ui';
import { ConfirmService } from '../../core/ui/confirm.service';
import {
  TAXONOMIES,
  DELETE_TAXONOMY,
  DELETE_TERM,
} from '../../core/graphql/operations';
import { TaxonomyCreateDialog } from './taxonomy-create.dialog';
import {
  TermCreateDialog,
  TermCreateDialogData,
  TermParentOption,
} from './term-create.dialog';

/**
 * Like the shared `TERMS` query, but also pulls each term's `entryCount` — how
 * many content entries are assigned that term (tenant-scoped, resolved server-side).
 */
const TERMS_WITH_COUNTS = gql`
  query TermsWithCounts($taxonomy: String!) {
    terms(taxonomy: $taxonomy) {
      id
      slug
      name
      description
      parentId
      entryCount
    }
  }
`;

interface Taxonomy {
  id: string;
  slug: string;
  name: string;
  isCore: boolean;
}
interface Term {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  entryCount: number;
}

/** Row rendered by the terms table: a term flattened with its indent depth and parent label. */
interface TermRow extends Term {
  depth: number;
  parentName: string;
}

/**
 * Taxonomy manager: a table of taxonomies with create (dialog) and multi-select
 * delete. Selecting a taxonomy reveals its terms as a flat table (hierarchy shown
 * via indentation) with add-term (dialog) and multi-select delete. Deleting a
 * taxonomy or term goes through the API's cascade rules.
 */
@Component({
  selector: 'app-taxonomy-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkTable, MkPageHeader, MkEmptyState, MkSkeletonPreset],
  templateUrl: './taxonomy-manager.page.html',
  styles: `
    .bulk { display: flex; align-items: center; gap: var(--mk-space-2); padding: var(--mk-space-2) var(--mk-space-3); background: var(--mk-surface-2); border-radius: var(--mk-radius-md); margin-bottom: var(--mk-space-3); }
    .bulk__count { font-weight: var(--mk-font-weight-medium); }
    .terms-section { margin-top: var(--mk-space-7); }
    .terms-head { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); margin-bottom: var(--mk-space-4); }
  `,
})
export class TaxonomyManagerPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly dialog = inject(MkDialogService);

  private readonly taxRef = this.apollo.watchQuery<{ taxonomies: Taxonomy[] }>({
    query: TAXONOMIES,
    fetchPolicy: 'cache-and-network',
  });
  protected readonly taxonomies = toSignal(
    this.taxRef.valueChanges.pipe(map((r) => (r.data?.taxonomies ?? []) as Taxonomy[])),
    { initialValue: [] as Taxonomy[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.taxRef.valueChanges.pipe(map((r) => r.loading && !r.data?.taxonomies)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.taxonomies().length === 0,
  );

  protected readonly activeSlug = signal<string | null>(null);
  /** True while terms for the selected taxonomy are being (re)loaded. */
  protected readonly termsLoading = signal(false);
  /** Guards bulk-delete handlers against double-submit. */
  protected readonly busy = signal(false);

  protected readonly selectedTaxonomies = signal<Taxonomy[]>([]);
  protected readonly selectedTerms = signal<TermRow[]>([]);

  private readonly terms = signal<Term[]>([]);

  protected readonly activeTaxonomy = computed(() =>
    this.taxonomies().find((t) => t.slug === this.activeSlug()) ?? null,
  );

  protected readonly taxColumns: MkTableColumn<Taxonomy>[] = [
    { key: 'name', header: 'Name', sortable: true, stack: 'title' },
    { key: 'slug', header: 'Slug', sortable: true, format: (v) => `/${String(v)}` },
    { key: 'isCore', header: 'Type', align: 'center', format: (v) => (v ? 'Core' : 'Custom') },
  ];

  protected readonly termColumns: MkTableColumn<TermRow>[] = [
    { key: 'name', header: 'Name', stack: 'title', format: (v, row) => '\u00A0\u00A0\u00A0'.repeat(row.depth) + String(v) },
    { key: 'slug', header: 'Slug', format: (v) => `/${String(v)}` },
    { key: 'parentName', header: 'Parent' },
    { key: 'entryCount', header: 'Entries', align: 'center' },
  ];

  /** Terms flattened depth-first with an indent depth for rendering. */
  private readonly termTree = computed<{ term: Term; depth: number }[]>(() => {
    const byParent = new Map<string | null, Term[]>();
    for (const t of this.terms()) {
      const k = t.parentId;
      (byParent.get(k) ?? byParent.set(k, []).get(k)!).push(t);
    }
    const out: { term: Term; depth: number }[] = [];
    const walk = (parent: string | null, depth: number): void => {
      for (const t of (byParent.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
        out.push({ term: t, depth });
        walk(t.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  });

  /** Flat table rows with an indent depth and a resolved parent label. */
  protected readonly termRows = computed<TermRow[]>(() => {
    const nameById = new Map(this.terms().map((t) => [t.id, t.name]));
    return this.termTree().map(({ term, depth }) => ({
      ...term,
      depth,
      parentName: term.parentId ? (nameById.get(term.parentId) ?? '—') : '—',
    }));
  });

  /** Parent choices for the add-term dialog (top-level sentinel first). */
  private readonly parentOptions = computed<TermParentOption[]>(() => [
    { label: '— none (top level) —', value: null },
    ...this.termTree().map(({ term, depth }) => ({
      label: `${'\u00A0\u00A0\u00A0'.repeat(depth)}${term.name}`,
      value: term.id,
    })),
  ]);

  protected async selectTaxonomy(tax: Taxonomy): Promise<void> {
    this.activeSlug.set(tax.slug);
    this.selectedTerms.set([]);
    await this.loadTerms(tax.slug);
  }

  private async loadTerms(slug: string): Promise<void> {
    this.termsLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.apollo.query<{ terms: Term[] }>({
          query: TERMS_WITH_COUNTS,
          variables: { taxonomy: slug },
          fetchPolicy: 'network-only',
        }),
      );
      this.terms.set((res.data?.terms ?? []) as Term[]);
    } finally {
      this.termsLoading.set(false);
    }
  }

  private async refreshTerms(): Promise<void> {
    const slug = this.activeSlug();
    if (slug) await this.loadTerms(slug);
  }

  protected async openNewTaxonomy(): Promise<void> {
    const ref = this.dialog.open<TaxonomyCreateDialog, boolean>(TaxonomyCreateDialog);
    const changed = await ref.afterClosed;
    if (changed) await this.taxRef.refetch();
  }

  protected async openAddTerm(): Promise<void> {
    const tax = this.activeTaxonomy();
    if (!tax) return;
    const ref = this.dialog.open<TermCreateDialog, boolean, TermCreateDialogData>(TermCreateDialog, {
      data: { taxonomy: tax.slug, taxonomyName: tax.name, parents: this.parentOptions() },
    });
    const changed = await ref.afterClosed;
    if (changed) await this.refreshTerms();
  }

  protected async deleteTaxonomies(): Promise<void> {
    const rows = this.selectedTaxonomies();
    if (!rows.length || this.busy()) return;
    const subject = rows.length === 1 ? `the “${rows[0].name}” taxonomy` : `these ${rows.length} taxonomies`;
    if (!(await this.confirm.remove(subject, "This removes the taxonomies and all their terms. This can't be undone."))) return;
    this.busy.set(true);
    try {
      await Promise.all(
        rows.map((r) => firstValueFrom(this.apollo.mutate({ mutation: DELETE_TAXONOMY, variables: { slug: r.slug } }))),
      );
      if (rows.some((r) => r.slug === this.activeSlug())) {
        this.activeSlug.set(null);
        this.terms.set([]);
        this.selectedTerms.set([]);
      }
      this.selectedTaxonomies.set([]);
      await this.taxRef.refetch();
    } catch {
      await this.taxRef.refetch();
    } finally {
      this.busy.set(false);
    }
  }

  protected async deleteTerms(): Promise<void> {
    const rows = this.selectedTerms();
    if (!rows.length || this.busy()) return;
    const subject = rows.length === 1 ? `the “${rows[0].name}” term` : `these ${rows.length} terms`;
    if (!(await this.confirm.remove(subject))) return;
    this.busy.set(true);
    try {
      await Promise.all(
        rows.map((r) => firstValueFrom(this.apollo.mutate({ mutation: DELETE_TERM, variables: { id: r.id } }))),
      );
      this.selectedTerms.set([]);
      await this.refreshTerms();
    } catch {
      await this.refreshTerms();
    } finally {
      this.busy.set(false);
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { Apollo } from 'apollo-angular';
import {
  MkCard,
  MkFormField,
  MkInput,
  MkBadge,
  MkButton,
  MkSpinner,
  MkEmptyState,
  MkTone,
} from '@mk-kit/ui';
import { CONTENT_TYPES, SEARCH_CONTENT } from '../../core/graphql/operations';
import { SearchHit } from '../../core/graphql/types';

interface ContentTypeLite {
  slug: string;
  name: string;
}

const STATUS_TONE: Record<string, MkTone> = {
  Published: 'success',
  Draft: 'neutral',
  Scheduled: 'info',
  Trashed: 'danger',
};

/** The three query states we render distinctly. */
type Phase = 'idle' | 'loading' | 'done';

/**
 * Global content search over the API's `searchContent` (Postgres FTS, spans
 * drafts + scheduled). The query and type filter live in the URL (`?q=&type=`)
 * so results are linkable and the ⌘K "Search content" command can deep-link.
 * Typing is debounced; each hit links to its entry editor.
 */
@Component({
  selector: 'app-global-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkCard, MkFormField, MkInput, MkBadge, MkButton, MkSpinner, MkEmptyState],
  templateUrl: './global-search.page.html',
  styles: `
    .search { max-width: 52rem; margin: 0 auto; }
    .search-head { margin-bottom: var(--mk-space-4); }
    .search-box { font-size: var(--mk-font-size-lg); }
    .filters { display: flex; flex-wrap: wrap; gap: var(--mk-space-2); margin-top: var(--mk-space-3); }
    .count { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); margin: var(--mk-space-4) 0 var(--mk-space-2); }
    .results { display: grid; gap: var(--mk-space-3); }
    .hit {
      display: block; width: 100%; text-align: left; cursor: pointer;
      background: none; border: none; padding: 0; font: inherit; color: inherit;
    }
    .hit-card { transition: border-color var(--mk-transition-fast); }
    .hit:hover .hit-card, .hit:focus-visible .hit-card { border-color: var(--mk-border-strong); }
    .hit-top { display: flex; align-items: center; gap: var(--mk-space-2); margin-bottom: var(--mk-space-2); }
    .hit-title { font-weight: var(--mk-font-weight-medium); margin-right: auto; }
    .hit-type { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); text-transform: capitalize; }
    .hit-snippet { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); line-height: 1.5; }
    /* Snippet is injected via innerHTML (no scoping attr) — reach its <b> with ::ng-deep. */
    .hit-snippet ::ng-deep b { color: var(--mk-text); font-weight: var(--mk-font-weight-semibold); background: var(--mk-accent-subtle, transparent); }
    .hit-meta { color: var(--mk-text-subtle); font-size: var(--mk-font-size-xs); margin-top: var(--mk-space-2); }
    .center { display: grid; place-items: center; padding: var(--mk-space-8) 0; }
  `,
})
export class GlobalSearchPage {
  private readonly apollo = inject(Apollo);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Current URL query params (source of truth for the search). */
  private readonly params = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => ({ q: p.get('q') ?? '', type: p.get('type') ?? '' })),
    ),
    { initialValue: { q: '', type: '' } },
  );

  protected readonly query = computed(() => this.params().q);
  protected readonly activeType = computed(() => this.params().type);

  protected readonly phase = signal<Phase>('idle');

  protected readonly contentTypes = toSignal(
    this.apollo
      .watchQuery<{ contentTypes: ContentTypeLite[] }>({ query: CONTENT_TYPES })
      .valueChanges.pipe(map((r) => (r.data?.contentTypes ?? []) as ContentTypeLite[])),
    { initialValue: [] as ContentTypeLite[] },
  );

  /** Debounced server search driven by the URL params. */
  protected readonly hits = toSignal(
    toObservable(this.params).pipe(
      debounceTime(250),
      distinctUntilChanged((a, b) => a.q === b.q && a.type === b.type),
      switchMap(({ q, type }) => {
        const term = q.trim();
        if (term.length < 2) {
          this.phase.set('idle');
          return of([] as SearchHit[]);
        }
        this.phase.set('loading');
        return this.apollo
          .query<{ searchContent: SearchHit[] }>({
            query: SEARCH_CONTENT,
            variables: { query: term, type: type || null, limit: 50 },
            fetchPolicy: 'network-only',
          })
          .pipe(
            map((r) => {
              this.phase.set('done');
              return (r.data?.searchContent ?? []) as SearchHit[];
            }),
          );
      }),
    ),
    { initialValue: [] as SearchHit[] },
  );

  protected readonly hasQuery = computed(() => this.query().trim().length >= 2);

  protected statusTone(status: string): MkTone {
    return STATUS_TONE[status] ?? 'neutral';
  }

  protected fmtDate(iso: string): string {
    return iso ? new Date(iso).toLocaleDateString() : '';
  }

  /** Push a new query into the URL (replace so typing doesn't spam history). */
  protected onInput(target: EventTarget | null): void {
    const q = (target as HTMLInputElement)?.value ?? '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: q || null, type: this.activeType() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected setType(type: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: type || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected open(hit: SearchHit): void {
    void this.router.navigate(['/content', hit.entry.type, hit.entry.id]);
  }
}

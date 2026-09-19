import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map, of } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { MkButton, MkSelect, MkInput, MkOverlayRef, MK_OVERLAY_DATA } from '@mk-kit/ui';
import { CONTENT_TYPES, ENTRIES } from '../../core/graphql/operations';

export interface EntryRef {
  id: string;
  title: string;
  type: string;
  slug: string | null;
}
export interface EntryPickerData {
  /** Lock the picker to one content type; omit to let the user choose. */
  typeSlug?: string;
}

interface ContentTypeLite {
  slug: string;
  name: string;
}
interface EntryLite {
  id: string;
  title: string;
  slug: string | null;
  status: string;
}

/**
 * Entry picker rendered in an overlay: choose a content type, filter by title,
 * and pick an entry. Closes with the chosen {@link EntryRef} or `undefined`.
 */
@Component({
  selector: 'app-entry-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkSelect, MkInput],
  template: `
    <div class="picker">
      <header class="picker__head">
        <h2>Select an entry</h2>
        <button mkButton variant="ghost" size="sm" (click)="cancel()">Close</button>
      </header>

      <div class="picker__controls">
        @if (!lockedType) {
          <mk-select
            [options]="typeOptions()"
            [value]="activeType()"
            (valueChange)="setType($event)"
          />
        }
        <input mkInput placeholder="Filter by title…"
          [value]="query()" (input)="setQuery($event.target)" />
      </div>

      <ul class="picker__list" role="listbox" aria-label="Entries">
        @for (e of filtered(); track e.id) {
          <li class="row" role="option" (click)="pick(e)">
            <span class="title">{{ e.title }}</span>
            <span class="meta">{{ e.status }}@if (e.slug) { · /{{ e.slug }} }</span>
          </li>
        } @empty {
          <li class="empty">No matching entries.</li>
        }
      </ul>
    </div>
  `,
  styles: `
    .picker { display: flex; flex-direction: column; min-height: 0; }
    .picker__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--mk-space-3); }
    .picker__head h2 { margin: 0; font-size: var(--mk-font-size-lg); }
    .picker__controls { display: grid; gap: var(--mk-space-2); grid-template-columns: 12rem 1fr; margin-bottom: var(--mk-space-3); }
    .picker__list { list-style: none; margin: 0; padding: 0; overflow: auto; border: var(--mk-border-width) solid var(--mk-border); border-radius: var(--mk-radius-md); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); padding: var(--mk-space-3); cursor: pointer; border-bottom: var(--mk-border-width) solid var(--mk-border-subtle); }
    .row:last-child { border-bottom: none; }
    .row:hover { background: var(--mk-hover-overlay); }
    .row .title { font-weight: var(--mk-font-weight-medium); }
    .row .meta { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    .empty { padding: var(--mk-space-4); color: var(--mk-text-muted); text-align: center; }
  `,
})
export class EntryPickerDialog {
  private readonly apollo = inject(Apollo);
  private readonly ref = inject<MkOverlayRef<EntryRef>>(MkOverlayRef);
  private readonly data = inject<EntryPickerData>(MK_OVERLAY_DATA);

  protected readonly lockedType = this.data?.typeSlug ?? null;
  protected readonly activeType = signal<string | null>(this.lockedType);
  protected readonly query = signal('');

  private readonly types = toSignal(
    this.apollo
      .watchQuery<{ contentTypes: ContentTypeLite[] }>({ query: CONTENT_TYPES })
      .valueChanges.pipe(map((r) => (r.data?.contentTypes ?? []) as ContentTypeLite[])),
    { initialValue: [] as ContentTypeLite[] },
  );

  protected readonly typeOptions = computed(() =>
    this.types().map((t) => ({ label: t.name, value: t.slug })),
  );

  constructor() {
    // Default to the first content type once they load (when not locked).
    toObservable(this.types).subscribe((types) => {
      if (!this.activeType() && types.length) this.activeType.set(types[0].slug);
    });
  }

  private readonly entries = toSignal(
    toObservable(this.activeType).pipe(
      switchMap((type) =>
        type
          ? this.apollo
              .watchQuery<{ entries: EntryLite[] }>({
                query: ENTRIES,
                variables: { type, limit: 100, offset: 0 },
              })
              .valueChanges.pipe(map((r) => (r.data?.entries ?? []) as EntryLite[]))
          : of<EntryLite[]>([]),
      ),
    ),
    { initialValue: [] as EntryLite[] },
  );

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.entries();
    return q ? list.filter((e) => e.title.toLowerCase().includes(q)) : list;
  });

  protected setType(v: unknown): void {
    this.activeType.set(v == null ? null : String(v));
  }
  protected setQuery(target: EventTarget | null): void {
    this.query.set((target as HTMLInputElement)?.value ?? '');
  }

  protected pick(e: EntryLite): void {
    this.ref.close({ id: e.id, title: e.title, type: this.activeType()!, slug: e.slug });
  }
  protected cancel(): void {
    this.ref.close(undefined);
  }
}

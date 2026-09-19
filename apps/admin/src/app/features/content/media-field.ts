import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { MkButton, MkDialogService } from '@mk-kit/ui';
import { FieldDef } from '../../core/graphql/types';
import { MediaItem } from '../../core/media/media.service';
import { MEDIA_ITEM } from '../../core/graphql/operations';
import { MediaPickerDialog, MediaPickerData } from '../media/media-picker.dialog';

/**
 * Control for a `media` field (e.g. a featured image). Shows the current
 * selection as thumbnails and opens the {@link MediaPickerDialog} to choose.
 * The field value is the media id (single) or an array of ids (`config.multiple`).
 */
@Component({
  selector: 'app-media-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton],
  template: `
    @if (hero()) {
      <!-- Large "featured image" presentation: a single, prominent preview. -->
      <div class="hero">
        @if (items()[0]; as m) {
          <figure class="hero__frame">
            <img
              [src]="heroFailed() ? thumb(m) : heroSrc(m)"
              [alt]="m.alt ?? m.filename"
              (error)="heroFailed.set(true)"
            />
          </figure>
          <div class="hero__actions">
            <button mkButton variant="outline" size="sm" (click)="choose()">Replace</button>
            <button mkButton variant="ghost" size="sm" tone="danger" (click)="remove(m.id)">Remove</button>
          </div>
        } @else {
          <button type="button" class="hero__empty" (click)="choose()">
            <span class="hero__empty-icon">🖼</span>
            <span class="hero__empty-label">Set a featured image</span>
            <span class="hero__empty-hint">Shown as the entry's main image.</span>
          </button>
        }
      </div>
    } @else {
      <div class="media-field">
        @if (items().length) {
          <div class="thumbs">
            @for (m of items(); track m.id) {
              <figure class="thumb">
                <img [src]="thumb(m)" [alt]="m.alt ?? m.filename" />
                <button
                  type="button"
                  class="thumb__remove"
                  aria-label="Remove"
                  (click)="remove(m.id)"
                >×</button>
              </figure>
            }
          </div>
        }
        <button mkButton variant="outline" size="sm" (click)="choose()">
          {{ items().length ? (multiple() ? 'Add / change' : 'Replace') : 'Choose image' }}
        </button>
      </div>
    }
  `,
  styles: `
    .media-field { display: flex; flex-direction: column; gap: var(--mk-space-3); align-items: flex-start; }
    .thumbs { display: flex; flex-wrap: wrap; gap: var(--mk-space-2); }
    .thumb { position: relative; margin: 0; }
    .thumb img {
      width: 6rem; height: 6rem; object-fit: cover;
      border-radius: var(--mk-radius-md); border: var(--mk-border-width) solid var(--mk-border);
    }
    .thumb__remove {
      position: absolute; top: -0.5rem; right: -0.5rem;
      width: 1.4rem; height: 1.4rem; border-radius: var(--mk-radius-circle);
      border: none; cursor: pointer; line-height: 1;
      background: var(--mk-danger); color: var(--mk-text-inverse);
    }

    /* Hero / featured-image mode */
    .hero { display: flex; flex-direction: column; gap: var(--mk-space-3); }
    .hero__frame { margin: 0; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--mk-radius-lg); overflow: hidden; border: var(--mk-border-width) solid var(--mk-border); background: var(--mk-surface-2); }
    .hero__frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .hero__actions { display: flex; gap: var(--mk-space-2); }
    .hero__empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--mk-space-1);
      width: 100%; aspect-ratio: 16 / 9; cursor: pointer;
      border: var(--mk-border-width) dashed var(--mk-border); border-radius: var(--mk-radius-lg);
      background: var(--mk-surface-2); color: var(--mk-text-muted);
      transition: border-color var(--mk-transition-fast, 120ms), background var(--mk-transition-fast, 120ms);
    }
    .hero__empty:hover { border-color: var(--mk-primary); background: var(--mk-surface-1); }
    .hero__empty:focus-visible { outline: var(--mk-focus-ring-width, 2px) solid var(--mk-primary); outline-offset: 2px; }
    .hero__empty-icon { font-size: 1.75rem; line-height: 1; }
    .hero__empty-label { font-weight: var(--mk-font-weight-medium); color: var(--mk-text); }
    .hero__empty-hint { font-size: var(--mk-font-size-sm); }
  `,
})
export class MediaField {
  private readonly apollo = inject(Apollo);
  private readonly dialog = inject(MkDialogService);

  readonly field = input.required<FieldDef>();
  /** Media id (single) or id array (multiple). */
  readonly value = model<unknown>();
  /** Render as a large, prominent "featured image" preview (single selection). */
  readonly hero = input(false, { transform: booleanAttribute });

  protected readonly multiple = computed(() => this.field().config['multiple'] === true);

  /** Current selection as a flat id list. */
  private readonly ids = computed<string[]>(() => {
    const v = this.value();
    if (Array.isArray(v)) return v.map(String);
    return v ? [String(v)] : [];
  });

  /** id → resolved MediaItem, filled lazily so stored ids render thumbnails. */
  private readonly cache = signal<Record<string, MediaItem>>({});

  /** Hero preview fell back to a smaller variant after the large one 404'd. */
  protected readonly heroFailed = signal(false);

  protected readonly items = computed(() =>
    this.ids()
      .map((id) => this.cache()[id])
      .filter((m): m is MediaItem => !!m),
  );

  constructor() {
    // Resolve any id we don't yet have a MediaItem for (edit mode).
    effect(() => {
      for (const id of this.ids()) {
        if (!this.cache()[id]) void this.resolve(id);
      }
    });
    // A new selection gets a fresh shot at the large hero variant.
    effect(() => {
      this.ids();
      this.heroFailed.set(false);
    });
  }

  private async resolve(id: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.apollo.query<{ mediaItem: MediaItem }>({ query: MEDIA_ITEM, variables: { id } }),
      );
      const item = res.data?.mediaItem;
      if (item) this.cache.update((c) => ({ ...c, [id]: item as MediaItem }));
    } catch {
      /* stale id — leave it unresolved (renders nothing) */
    }
  }

  protected thumb(m: MediaItem): string {
    return [...m.variants].sort((a, b) => a.width - b.width)[0]?.url ?? m.url;
  }

  /** A larger variant for the hero preview: the widest that's still ≤ ~1024px,
   *  falling back to the original. */
  protected heroSrc(m: MediaItem): string {
    const byWidth = [...m.variants].sort((a, b) => a.width - b.width);
    const preferred = byWidth.filter((v) => v.width <= 1024).at(-1) ?? byWidth.at(-1);
    return preferred?.url ?? m.url;
  }

  protected async choose(): Promise<void> {
    const ref = this.dialog.open<MediaPickerDialog, MediaItem | MediaItem[], MediaPickerData>(
      MediaPickerDialog,
      {
        data: { multiple: this.multiple(), selectedIds: this.ids() },
        ariaLabel: 'Media picker',
        size: 'lg',
      },
    );
    const result = await ref.afterClosed;
    if (result === undefined) return;

    const chosen = Array.isArray(result) ? result : [result];
    this.cache.update((c) => {
      const next = { ...c };
      for (const m of chosen) next[m.id] = m;
      return next;
    });
    this.value.set(this.multiple() ? chosen.map((m) => m.id) : (chosen[0]?.id ?? null));
  }

  protected remove(id: string): void {
    this.value.set(this.multiple() ? this.ids().filter((x) => x !== id) : null);
  }
}

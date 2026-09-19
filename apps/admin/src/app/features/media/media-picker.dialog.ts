import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { MkButton, MkFileUpload, MkOverlayRef, MK_OVERLAY_DATA } from '@mk-kit/ui';
import { MediaUploadService, MediaItem } from '../../core/media/media.service';
import { MEDIA } from '../../core/graphql/operations';

export interface MediaPickerData {
  multiple?: boolean;
  selectedIds?: string[];
}

/**
 * Media picker rendered in an overlay: browse the library grid, upload new
 * images, and pick one (single mode → resolves immediately) or several
 * (multiple mode → a footer confirm). Closes with the chosen `MediaItem` /
 * `MediaItem[]`, or `undefined` on cancel.
 */
@Component({
  selector: 'app-media-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkFileUpload],
  template: `
    <div class="picker">
      <header class="picker__head">
        <h2 id="media-picker-title">Select media</h2>
        <button mkButton variant="ghost" size="sm" (click)="cancel()">Close</button>
      </header>

      <mk-file-upload
        accept="image/*"
        [multiple]="true"
        [maxSize]="26214400"
        label="Drop images here or click to upload"
        [uploadFn]="upload.uploadFn"
        (uploaded)="onUploaded()"
      />

      <div class="picker__grid">
        @for (m of media(); track m.id) {
          <figure
            class="tile"
            [attr.data-selected]="isSelected(m.id)"
            (click)="pick(m)"
          >
            <img [src]="thumb(m)" [alt]="m.alt ?? m.filename" loading="lazy" />
            <figcaption>{{ m.filename }}</figcaption>
          </figure>
        } @empty {
          <p style="color: var(--mk-text-muted)">No media yet — upload above.</p>
        }
      </div>

      @if (multiple) {
        <footer class="picker__foot">
          <button mkButton variant="outline" (click)="cancel()">Cancel</button>
          <button mkButton tone="primary" [disabled]="selected().size === 0" (click)="confirm()">
            Select ({{ selected().size }})
          </button>
        </footer>
      }
    </div>
  `,
  styles: `
    .picker { display: flex; flex-direction: column; min-height: 0; }
    .picker__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--mk-space-3); }
    .picker__head h2 { margin: 0; font-size: var(--mk-font-size-lg); }
    mk-file-upload { display: block; margin-bottom: var(--mk-space-4); }
    .picker__grid {
      display: grid; gap: var(--mk-space-3); overflow: auto; padding: var(--mk-space-1);
      grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    }
    .tile {
      margin: 0; border: 2px solid var(--mk-border); border-radius: var(--mk-radius-md);
      overflow: hidden; cursor: pointer; background: var(--mk-surface-2);
      transition: border-color var(--mk-duration-fast) var(--mk-ease-standard);
    }
    .tile:hover { border-color: var(--mk-border-strong); }
    .tile[data-selected='true'] { border-color: var(--mk-primary); }
    .tile img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
    .tile figcaption {
      padding: var(--mk-space-2); font-size: var(--mk-font-size-xs); color: var(--mk-text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .picker__foot { display: flex; justify-content: flex-end; gap: var(--mk-space-2); margin-top: var(--mk-space-4); }
  `,
})
export class MediaPickerDialog {
  private readonly apollo = inject(Apollo);
  protected readonly upload = inject(MediaUploadService);
  private readonly ref = inject<MkOverlayRef<MediaItem | MediaItem[]>>(MkOverlayRef);
  private readonly data = inject<MediaPickerData>(MK_OVERLAY_DATA);

  protected readonly multiple = this.data?.multiple ?? false;
  protected readonly selected = signal(new Set<string>(this.data?.selectedIds ?? []));

  private readonly mediaRef = this.apollo.watchQuery<{ media: MediaItem[] }>({
    query: MEDIA,
    variables: { limit: 60, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });

  protected readonly media = toSignal(
    this.mediaRef.valueChanges.pipe(map((r) => (r.data?.media ?? []) as MediaItem[])),
    { initialValue: [] as MediaItem[] },
  );

  protected thumb(m: MediaItem): string {
    return [...m.variants].sort((a, b) => a.width - b.width)[0]?.url ?? m.url;
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected pick(item: MediaItem): void {
    if (!this.multiple) {
      this.ref.close(item);
      return;
    }
    this.selected.update((s) => {
      const next = new Set(s);
      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
      return next;
    });
  }

  protected confirm(): void {
    const ids = this.selected();
    this.ref.close(this.media().filter((m) => ids.has(m.id)));
  }

  protected onUploaded(): void {
    void this.mediaRef.refetch();
  }

  protected cancel(): void {
    this.ref.close(undefined);
  }
}

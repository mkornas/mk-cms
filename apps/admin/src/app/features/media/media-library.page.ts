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
import { ConfirmService } from '../../core/ui/confirm.service';
import {
  MkFileUpload,
  MkCard,
  MkButton,
  MkFormField,
  MkInput,
  MkAlert,
  MkSkeletonPreset,
  MkPageHeader,
  MkCheckbox,
  MkEmptyState,
  MkDescriptionList,
  MkDescItem,
} from '@mk-kit/ui';
import { MediaUploadService, MediaItem } from '../../core/media/media.service';
import { MEDIA, UPDATE_MEDIA, DELETE_MEDIA } from '../../core/graphql/operations';

/** A focal point normalized to the image box (0..1 on each axis). */
interface FocalPoint {
  x: number;
  y: number;
}

/**
 * Loads the stored focal point for one item. The shared `MEDIA` query doesn't
 * select `focalPoint`, so we fetch it lazily when an item is opened. On the API,
 * `focalPoint` is a JSON scalar (no sub-selection).
 */
const MEDIA_FOCAL = gql`
  query MediaFocal($id: ID!) {
    mediaItem(id: $id) {
      id
      focalPoint
    }
  }
`;

/**
 * Persists a focal point. `UPDATE_MEDIA` in operations.ts only returns id/alt/title;
 * this variant sends `focalPoint` (via UpdateMediaInput) and reads it back.
 */
const UPDATE_MEDIA_FOCAL = gql`
  mutation UpdateMediaFocal($id: ID!, $input: UpdateMediaInput!) {
    updateMedia(id: $id, input: $input) {
      id
      focalPoint
    }
  }
`;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Media library: a drag-drop uploader (mk-file-upload streaming to `POST /media`)
 * over a grid of the site's media, with an edit/delete detail panel. Uploads
 * refetch the grid; edits patch alt/title via `updateMedia`.
 */
@Component({
  selector: 'app-media-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkFileUpload,
    MkCard,
    MkButton,
    MkFormField,
    MkInput,
    MkAlert,
    MkSkeletonPreset,
    MkPageHeader,
    MkCheckbox,
    MkEmptyState,
    MkDescriptionList,
    MkDescItem,
  ],
  templateUrl: './media-library.page.html',
  styles: `
    mk-page-header { display: block; margin-bottom: var(--mk-space-4); }
    mk-file-upload { display: block; margin-block: var(--mk-space-4); }
    .layout { display: grid; grid-template-columns: 1fr; gap: var(--mk-space-4); }
    @media (min-width: 60rem) {
      .layout.has-selection { grid-template-columns: 1fr 20rem; }
    }
    .grid {
      display: grid;
      gap: var(--mk-space-3);
      grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    }
    .tile {
      border: var(--mk-border-width) solid var(--mk-border);
      border-radius: var(--mk-radius-md);
      overflow: hidden;
      cursor: pointer;
      background: var(--mk-surface-2);
      transition: border-color var(--mk-duration-fast) var(--mk-ease-standard);
    }
    .tile { position: relative; }
    .tile:hover, .tile[data-selected='true'] { border-color: var(--mk-primary); }
    .tile[data-checked='true'] { border-color: var(--mk-primary); box-shadow: 0 0 0 var(--mk-border-width) var(--mk-primary) inset; }
    .tile img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
    .tile figcaption {
      padding: var(--mk-space-2);
      font-size: var(--mk-font-size-xs);
      color: var(--mk-text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .tile-check {
      position: absolute; top: var(--mk-space-2); left: var(--mk-space-2);
      display: inline-flex; padding: var(--mk-space-1);
      background: var(--mk-surface-1); border-radius: var(--mk-radius-sm);
      box-shadow: var(--mk-shadow-sm); cursor: pointer; line-height: 0;
    }
    .bulk-bar { margin-bottom: var(--mk-space-4); }
    .bulk-bar .bulk-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--mk-space-3); }
    .bulk-bar mk-form-field { flex: 1 1 16rem; }
    .bulk-bar .bulk-actions { display: flex; gap: var(--mk-space-2); }
    .detail img { width: 100%; border-radius: var(--mk-radius-sm); margin-bottom: var(--mk-space-3); }
    .focal-wrap { position: relative; margin-bottom: var(--mk-space-3); line-height: 0; }
    .focal-wrap img { margin-bottom: 0; cursor: crosshair; }
    .focal-marker {
      position: absolute; width: 1.25rem; height: 1.25rem;
      border: 2px solid #fff; border-radius: 50%;
      box-shadow: 0 0 0 2px var(--mk-primary), 0 0 4px rgba(0, 0, 0, 0.6);
      transform: translate(-50%, -50%); pointer-events: none;
    }
    .focal-hint { font-size: var(--mk-font-size-xs); color: var(--mk-text-muted); margin: 0 0 var(--mk-space-3); }
    .detail mk-description-list { display: block; margin-bottom: var(--mk-space-3); font-size: var(--mk-font-size-sm); }
    .detail .fields { display: grid; gap: var(--mk-space-3); }
    .detail .actions { display: flex; gap: var(--mk-space-2); margin-top: var(--mk-space-4); }
  `,
})
export class MediaLibraryPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  protected readonly upload = inject(MediaUploadService);

  private readonly mediaRef = this.apollo.watchQuery<{ media: MediaItem[] }>({
    query: MEDIA,
    variables: { limit: 60, offset: 0 },
    fetchPolicy: 'cache-and-network',
  });

  protected readonly media = toSignal(
    this.mediaRef.valueChanges.pipe(map((r) => (r.data?.media ?? []) as MediaItem[])),
    { initialValue: [] as MediaItem[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.mediaRef.valueChanges.pipe(map((r) => r.loading && !r.data?.media)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.media().length === 0,
  );

  protected readonly selected = signal<MediaItem | null>(null);
  protected readonly alt = signal('');
  protected readonly title = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  /** Focal point currently shown/edited for the selected item (0..1). */
  protected readonly focal = signal<FocalPoint>({ x: 0.5, y: 0.5 });

  /** Bulk selection: tile ids ticked for a bulk alt-text apply. */
  protected readonly checkedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly checkedCount = computed(() => this.checkedIds().size);
  protected readonly bulkAlt = signal('');

  /** A square-ish thumbnail: the smallest variant, else the original. */
  protected thumb(m: MediaItem): string {
    const byWidth = [...m.variants].sort((a, b) => a.width - b.width);
    return byWidth[0]?.url ?? m.url;
  }

  protected async select(m: MediaItem): Promise<void> {
    this.selected.set(m);
    this.alt.set(m.alt ?? '');
    this.title.set(m.title ?? '');
    this.error.set(null);
    // Default to center until the stored point loads.
    this.focal.set({ x: 0.5, y: 0.5 });
    try {
      const res = await firstValueFrom(
        this.apollo.query<{ mediaItem: Partial<MediaItem> }>({
          query: MEDIA_FOCAL,
          variables: { id: m.id },
          fetchPolicy: 'network-only',
        }),
      );
      const fp = res.data?.mediaItem?.focalPoint;
      // Guard against a stale response if the user has since picked another tile.
      if (fp && this.selected()?.id === m.id) {
        this.focal.set({ x: clamp01(Number(fp.x)), y: clamp01(Number(fp.y)) });
      }
    } catch {
      /* Non-fatal: keep the default centre point. */
    }
  }

  /** Translate a click on the preview into a normalized focal point. */
  protected onFocalClick(event: MouseEvent): void {
    const img = event.currentTarget as HTMLImageElement;
    if (!img.clientWidth || !img.clientHeight) return;
    this.focal.set({
      x: clamp01(event.offsetX / img.clientWidth),
      y: clamp01(event.offsetY / img.clientHeight),
    });
  }

  protected async saveFocal(): Promise<void> {
    const item = this.selected();
    if (!item || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_MEDIA_FOCAL,
          variables: { id: item.id, input: { focalPoint: this.focal() } },
        }),
      );
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not save focal point.');
    } finally {
      this.busy.set(false);
    }
  }

  // --- Bulk alt-text ------------------------------------------------------

  protected isChecked(id: string): boolean {
    return this.checkedIds().has(id);
  }

  protected toggleChecked(id: string): void {
    const next = new Set(this.checkedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.checkedIds.set(next);
  }

  protected clearChecked(): void {
    this.checkedIds.set(new Set());
    this.bulkAlt.set('');
  }

  /** Apply one alt text to every ticked item (one `updateMedia` per id). */
  protected async applyBulkAlt(): Promise<void> {
    const ids = [...this.checkedIds()];
    const alt = this.bulkAlt();
    if (!ids.length || !alt || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      for (const id of ids) {
        await firstValueFrom(
          this.apollo.mutate({
            mutation: UPDATE_MEDIA,
            variables: { id, input: { alt } },
          }),
        );
      }
      // Keep the open detail's editor in sync if it was part of the batch.
      if (this.selected() && this.checkedIds().has(this.selected()!.id)) {
        this.alt.set(alt);
      }
      this.clearChecked();
      await this.mediaRef.refetch();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Bulk update failed.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Delete every ticked item (one `DELETE_MEDIA` per id; failures don't abort). */
  protected async removeChecked(): Promise<void> {
    const ids = [...this.checkedIds()];
    if (!ids.length || this.busy()) return;
    if (
      !(await this.confirm.remove(
        'the selected files',
        `Permanently delete ${ids.length} file(s)? This cannot be undone.`,
      ))
    ) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const selectedId = this.selected()?.id;
    try {
      for (const id of ids) {
        try {
          await firstValueFrom(
            this.apollo.mutate({ mutation: DELETE_MEDIA, variables: { id } }),
          );
        } catch {
          /* One failure shouldn't abort the rest; per-delete error toasts fire. */
        }
      }
      // Close the detail panel if its item was in the batch.
      if (selectedId && ids.includes(selectedId)) this.selected.set(null);
      this.clearChecked();
      await this.mediaRef.refetch();
    } finally {
      this.busy.set(false);
    }
  }

  protected setInput(target: EventTarget | null, set: (v: string) => void): void {
    set((target as HTMLInputElement)?.value ?? '');
  }

  protected onUploaded(): void {
    void this.mediaRef.refetch();
  }

  protected async save(): Promise<void> {
    const item = this.selected();
    if (!item || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_MEDIA,
          variables: { id: item.id, input: { alt: this.alt(), title: this.title() } },
        }),
      );
      await this.mediaRef.refetch();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const item = this.selected();
    if (!item || this.busy()) return;
    if (!(await this.confirm.remove('this file'))) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({ mutation: DELETE_MEDIA, variables: { id: item.id } }),
      );
      this.selected.set(null);
      await this.mediaRef.refetch();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      this.busy.set(false);
    }
  }

  protected readonly hasSelection = computed(() => this.selected() !== null);

  protected sizeKb(bytes: number): string {
    return `${(bytes / 1024).toFixed(0)} kB`;
  }
}

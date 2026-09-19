import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, map, of } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConfirmService } from '../../core/ui/confirm.service';
import { CanComponentDeactivate } from './unsaved-changes.guard';
import {
  MkButton,
  MkCard,
  MkFormField,
  MkInput,
  MkAlert,
  MkBadge,
  MkAccordion,
  MkAccordionItem,
  MkIcon,
  MkTooltip,
  MkDialogService,
  MkSkeletonPreset,
} from '@mk-kit/ui';
import { FieldControl } from './field-control';
import { MediaField } from './media-field';
import { EntryTermsPanel } from './entry-terms.panel';
import { EntrySeoPanel } from './entry-seo.panel';
import { EntryTranslationsPanel } from './entry-translations.panel';
import { EntryParentPanel } from './entry-parent.panel';
import { EntrySchedulePanel } from './entry-schedule.panel';
import {
  RevisionHistoryDialog,
  RevisionHistoryData,
  EntrySnapshot,
} from './revision-history.dialog';
import { ContentTypeDetail, EntryDetail, FieldDef } from '../../core/graphql/types';
import {
  CONTENT_TYPE,
  ENTRY,
  CREATE_ENTRY,
  UPDATE_ENTRY,
  PUBLISH_ENTRY,
  UNPUBLISH_ENTRY,
} from '../../core/graphql/operations';

/** Mints a short-lived signed token for previewing a draft entry on the front-end. */
const PREVIEW_TOKEN = gql`
  mutation PreviewToken($id: ID!) {
    previewToken(id: $id)
  }
`;

/**
 * Schema-driven entry editor. Loads a content type's field definitions and
 * (when editing) the entry, renders a title/slug + one {@link FieldControl} per
 * field, and saves via createEntry/updateEntry. Publish/unpublish are separate
 * mutations (status is not part of the update input).
 */
@Component({
  selector: 'app-entry-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkButton,
    MkCard,
    MkFormField,
    MkInput,
    MkAlert,
    MkBadge,
    MkAccordion,
    MkAccordionItem,
    MkIcon,
    MkTooltip,
    MkSkeletonPreset,
    FieldControl,
    MediaField,
    EntryTermsPanel,
    EntrySeoPanel,
    EntryTranslationsPanel,
    EntryParentPanel,
    EntrySchedulePanel,
  ],
  templateUrl: './entry-editor.page.html',
  styles: `
    .editor { max-width: 76rem; margin: 0 auto; }
    .editor-bar {
      position: sticky; top: 0; z-index: var(--mk-z-sticky);
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--mk-space-3);
      padding: var(--mk-space-4) 0; margin-bottom: var(--mk-space-2);
      background: color-mix(in srgb, var(--mk-bg) 84%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: var(--mk-border-width) solid var(--mk-border);
    }
    .editor-bar__title { display: flex; align-items: center; gap: var(--mk-space-3); min-width: 0; }
    .editor-bar__title strong {
      font-size: var(--mk-font-size-xl); text-transform: capitalize;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .editor-bar__actions { display: flex; align-items: center; gap: var(--mk-space-2); flex-shrink: 0; }

    /* Unsaved-changes signal: quiet text, brand-yellow dot. */
    .editor-dirty {
      display: inline-flex; align-items: center; gap: var(--mk-space-2);
      color: var(--mk-text-muted); font-size: var(--mk-font-size-sm);
      white-space: nowrap;
    }
    .editor-dirty__dot {
      width: 8px; height: 8px; border-radius: var(--mk-radius-circle);
      background: var(--app-signal, var(--mk-warning));
    }
    .editor-count {
      color: var(--mk-text-subtle);
      font-family: var(--mk-font-mono);
      font-size: var(--mk-font-size-xs);
      white-space: nowrap;
    }
    @media (max-width: 60rem) { .editor-count { display: none; } }

    .editor-grid { display: grid; gap: var(--mk-space-4); grid-template-columns: 1fr; align-items: start; }
    @media (min-width: 60rem) { .editor-grid { grid-template-columns: minmax(0, 1fr) 20rem; } }
    .editor-main, .editor-side { display: grid; gap: var(--mk-space-4); align-content: start; }
    /* The right rail sticks alongside the (usually taller) content column. */
    @media (min-width: 60rem) { .editor-side { position: sticky; top: 5rem; } }

    /* Big, borderless title — the primary thing an author types. Set in the
       display face so the draft already looks like the article. */
    .title-input {
      width: 100%; border: none; background: transparent;
      padding: var(--mk-space-1) 0; margin: 0;
      color: var(--mk-text);
      font-family: var(--app-font-display, inherit);
      font-size: clamp(1.75rem, 1.2rem + 1.6vw, 2.375rem);
      font-weight: 700; line-height: 1.15;
      letter-spacing: var(--mk-letter-spacing-tight);
    }
    .title-input::placeholder { color: var(--mk-text-subtle, var(--mk-text-muted)); }
    .title-input:focus { outline: none; }
    .slug-input { font-family: var(--mk-font-mono); font-size: var(--mk-font-size-sm); }
    .block-label { display: block; font-size: var(--mk-font-size-sm); font-weight: var(--mk-font-weight-medium); color: var(--mk-text-muted); margin-bottom: var(--mk-space-2); }
    .card-title { margin: 0 0 var(--mk-space-4); font-size: var(--mk-font-size-md); }
    .fields { display: grid; gap: var(--mk-space-4); }
    .side-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--mk-space-3); }
    .muted { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
  `,
})
export class EntryEditorPage implements CanComponentDeactivate {
  private readonly apollo = inject(Apollo);
  private readonly router = inject(Router);
  private readonly dialog = inject(MkDialogService);
  private readonly confirm = inject(ConfirmService);

  /** Content-type slug (`/content/:type/...`). */
  readonly type = input.required<string>();
  /** Entry id when editing; absent for a new entry. */
  readonly id = input<string>();

  // --- content type (field schema) ----------------------------------------
  private readonly contentType = toSignal(
    toObservable(this.type).pipe(
      switchMap((slug) =>
        this.apollo
          .watchQuery<{ contentType: ContentTypeDetail }>({
            query: CONTENT_TYPE,
            variables: { slug },
          })
          .valueChanges.pipe(map((r) => (r.data?.contentType ?? null) as ContentTypeDetail | null)),
      ),
    ),
    { initialValue: null as ContentTypeDetail | null },
  );

  protected readonly fieldDefs = computed<FieldDef[]>(() =>
    [...(this.contentType()?.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  // --- field roles: keep the important things (title/content/featured image)
  // prominent, and tuck everything else into a "Details" block. -------------

  /** The featured image: the first single-value `media` field, if any. */
  protected readonly heroField = computed<FieldDef | null>(
    () =>
      this.fieldDefs().find((f) => f.type === 'media' && f.config['multiple'] !== true) ?? null,
  );

  /** Long-form body fields (the main content). */
  protected readonly bodyFields = computed<FieldDef[]>(() =>
    this.fieldDefs().filter((f) => f.type === 'richtext' || f.type === 'textarea'),
  );

  /** Everything else — secondary fields shown under "Details". */
  protected readonly detailFields = computed<FieldDef[]>(() => {
    const heroKey = this.heroField()?.key;
    return this.fieldDefs().filter(
      (f) => f.type !== 'richtext' && f.type !== 'textarea' && f.key !== heroKey,
    );
  });

  // --- loaded entry (edit mode) -------------------------------------------
  private readonly loaded = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        id
          ? this.apollo
              .query<{ entry: EntryDetail }>({ query: ENTRY, variables: { id } })
              .pipe(map((r) => (r.data?.entry ?? null) as EntryDetail | null))
          : of(null),
      ),
    ),
    { initialValue: null as EntryDetail | null },
  );

  // --- editable form state ------------------------------------------------
  protected readonly title = signal('');
  protected readonly slug = signal('');
  protected readonly fields = signal<Record<string, unknown>>({});
  protected readonly status = signal<string>('Draft');

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly isNew = computed(() => !this.id());
  protected readonly isPublished = computed(() => this.status() === 'Published');

  /** Live word count across the long-form fields (tags stripped). */
  protected readonly wordCount = computed(() => {
    const values = this.fields();
    const text = this.bodyFields()
      .map((f) => String(values[f.key] ?? ''))
      .join(' ')
      .replace(/<[^>]*>/g, ' ');
    return text.match(/\S+/g)?.length ?? 0;
  });

  /** Cold-load state: the field schema (and, when editing, the entry) not in yet. */
  protected readonly loading = computed(
    () => !this.contentType() || (!!this.id() && !this.loaded()),
  );

  private seeded = false;

  // --- unsaved-changes tracking -------------------------------------------
  /** Serialised current form state; compared against {@link baseline} for dirtiness. */
  private readonly currentSnapshot = computed(() =>
    JSON.stringify({
      title: this.title(),
      slug: this.slug(),
      status: this.status(),
      fields: this.fields(),
    }),
  );
  /** Snapshot at the last "clean" point (seed / successful save / publish). */
  private readonly baseline = signal(
    JSON.stringify({ title: '', slug: '', status: 'Draft', fields: {} }),
  );
  /** True once the form diverges from the baseline (unsaved edits present). */
  protected readonly dirty = computed(() => this.currentSnapshot() !== this.baseline());

  constructor() {
    // Seed the form once the entry loads (edit mode).
    effect(() => {
      const e = this.loaded();
      if (!e || this.seeded) return;
      this.seeded = true;
      this.title.set(e.title);
      this.slug.set(e.slug ?? '');
      this.fields.set({ ...e.fields });
      this.status.set(e.status);
      // Reading the snapshot outside tracking keeps this effect keyed only to
      // `loaded()`, not to every keystroke that follows.
      untracked(() => this.resetBaseline());
    });
  }

  /** Mark the current form state as clean (no unsaved changes). */
  private resetBaseline(): void {
    this.baseline.set(this.currentSnapshot());
  }

  protected setInput(target: EventTarget | null, set: (v: string) => void): void {
    set((target as HTMLInputElement)?.value ?? '');
  }

  /** Back to this type's entry list (the unsaved-changes guard still applies). */
  protected backToList(): void {
    void this.router.navigate(['/content', this.type()]);
  }

  protected setField(key: string, value: unknown): void {
    this.fields.update((f) => ({ ...f, [key]: value }));
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.error.set(null);
    this.fieldErrors.set({});
    this.saving.set(true);
    try {
      if (this.isNew()) {
        const res = await firstValueFrom(
          this.apollo.mutate<{ createEntry: { id: string; status: string } }>({
            mutation: CREATE_ENTRY,
            variables: {
              type: this.type(),
              input: {
                title: this.title(),
                slug: this.slug() || null,
                fields: this.fields(),
              },
            },
          }),
        );
        const created = res.data?.createEntry;
        if (created) {
          // Clear dirtiness before navigating so the guard doesn't prompt.
          this.resetBaseline();
          void this.router.navigate(['/content', this.type(), created.id]);
        }
      } else {
        await firstValueFrom(
          this.apollo.mutate({
            mutation: UPDATE_ENTRY,
            variables: {
              id: this.id(),
              input: {
                title: this.title(),
                slug: this.slug() || null,
                fields: this.fields(),
              },
            },
          }),
        );
        this.resetBaseline();
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      this.saving.set(false);
    }
  }

  /** Open the revision history; if the user restores one, apply it to the form
   *  (they still have to Save — restore doesn't publish or mutate on its own). */
  protected async openHistory(): Promise<void> {
    const id = this.id();
    if (!id) return;
    const current: EntrySnapshot = {
      title: this.title(),
      slug: this.slug() || null,
      status: this.status(),
      fields: this.fields(),
    };
    const ref = this.dialog.open<RevisionHistoryDialog, EntrySnapshot, RevisionHistoryData>(
      RevisionHistoryDialog,
      { data: { entryId: id, current }, ariaLabel: 'Revision history', size: 'xl' },
    );
    const restored = await ref.afterClosed;
    if (!restored) return;
    this.title.set(restored.title);
    this.slug.set(restored.slug ?? '');
    this.fields.set({ ...restored.fields });
  }

  protected async togglePublish(): Promise<void> {
    const id = this.id();
    if (!id) return;
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate<{ publishEntry?: { status: string }; unpublishEntry?: { status: string } }>({
          mutation: this.isPublished() ? UNPUBLISH_ENTRY : PUBLISH_ENTRY,
          variables: { id },
        }),
      );
      const next = res.data?.publishEntry?.status ?? res.data?.unpublishEntry?.status;
      if (next) {
        this.status.set(next);
        // Status changed server-side; fold it into the clean baseline.
        this.resetBaseline();
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Status change failed.');
    }
  }

  /** Mint a preview token for the saved entry and open the front-end preview. */
  protected async openPreview(): Promise<void> {
    const id = this.id();
    if (!id) return;
    const res = await firstValueFrom(
      this.apollo.mutate<{ previewToken: string }>({
        mutation: PREVIEW_TOKEN,
        variables: { id },
      }),
    );
    const token = res.data?.previewToken;
    if (!token) return;
    window.open(
      `${environment.previewBaseUrl}?token=${encodeURIComponent(String(token))}`,
      '_blank',
      'noopener',
    );
  }

  /** Route guard hook: allow leaving unless there are unsaved edits the user
   *  declines to discard. */
  canDeactivate(): boolean | Promise<boolean> {
    if (!this.dirty()) return true;
    return this.confirm.confirm({
      title: 'Discard unsaved changes?',
      message: 'You have unsaved edits. Leave without saving?',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      tone: 'danger',
      icon: 'warning',
    });
  }
}

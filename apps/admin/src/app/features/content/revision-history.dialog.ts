import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { MkButton, MkDiff, MkOverlayRef, MK_OVERLAY_DATA } from '@mk-kit/ui';
import { ENTRY_REVISIONS } from '../../core/graphql/operations';

/** The subset of an entry captured in each revision snapshot. */
export interface EntrySnapshot {
  title: string;
  slug: string | null;
  status?: string;
  fields: Record<string, unknown>;
}

export interface RevisionHistoryData {
  entryId: string;
  /** The live editor state, diffed as the "after" side. */
  current: EntrySnapshot;
}

interface Revision {
  id: string;
  authorId: string | null;
  createdAt: string;
  data: EntrySnapshot;
}

/** Render a snapshot as stable, line-per-field text for diffing. */
function snapshotToText(s: EntrySnapshot): string {
  const lines = [`Title: ${s.title ?? ''}`, `Slug: ${s.slug ?? ''}`];
  if (s.status) lines.push(`Status: ${s.status}`);
  lines.push('');
  const fields = s.fields ?? {};
  for (const key of Object.keys(fields).sort()) {
    const v = fields[key];
    const text = v && typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? '');
    lines.push(`${key}: ${text}`);
  }
  return lines.join('\n');
}

/**
 * Revision history for an entry: a timeline of saved snapshots on the left, and
 * a diff of the selected revision against the current (unsaved) editor state on
 * the right. "Restore" closes with the snapshot for the editor to apply.
 */
@Component({
  selector: 'app-revision-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkDiff],
  template: `
    <div class="history">
      <header class="history__head">
        <h2>Revision history</h2>
        <div class="history__actions">
          <button mkButton variant="ghost" size="sm"
            (click)="mode.set(mode() === 'split' ? 'unified' : 'split')">
            {{ mode() === 'split' ? 'Unified' : 'Split' }} view
          </button>
          <button mkButton variant="ghost" size="sm" (click)="cancel()">Close</button>
        </div>
      </header>

      <div class="history__body">
        <ul class="revs" role="listbox" aria-label="Revisions">
          @for (r of revisions(); track r.id; let i = $index) {
            <li
              class="rev"
              role="option"
              [attr.data-active]="selectedId() === r.id"
              (click)="selectedId.set(r.id)"
            >
              <span class="when">{{ formatDate(r.createdAt) }}</span>
              <span class="idx">#{{ revisions().length - i }}</span>
            </li>
          } @empty {
            <li class="empty">No revisions yet.</li>
          }
        </ul>

        <div class="diff">
          @if (selected(); as rev) {
            <mk-diff
              [mode]="mode()"
              [before]="beforeText()"
              [after]="afterText()"
              beforeLabel="This revision"
              afterLabel="Current (unsaved)"
              [wordHighlight]="true"
              [showStats]="true"
            />
            <div class="diff__foot">
              <button mkButton tone="primary" (click)="restore(rev)">
                Restore this version
              </button>
            </div>
          } @else {
            <p class="muted">Select a revision to compare it with the current state.</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .history { display: flex; flex-direction: column; height: min(78vh, 40rem); }
    .history__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--mk-space-3); }
    .history__head h2 { margin: 0; font-size: var(--mk-font-size-lg); }
    .history__actions { display: flex; gap: var(--mk-space-2); }
    .history__body { display: grid; grid-template-columns: 14rem 1fr; gap: var(--mk-space-4); flex: 1; min-height: 0; }
    .revs { list-style: none; margin: 0; padding: 0; overflow: auto; border: var(--mk-border-width) solid var(--mk-border); border-radius: var(--mk-radius-md); }
    .rev { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-2); padding: var(--mk-space-3); cursor: pointer; border-bottom: var(--mk-border-width) solid var(--mk-border-subtle); }
    .rev:last-child { border-bottom: none; }
    .rev:hover { background: var(--mk-hover-overlay); }
    .rev[data-active='true'] { background: var(--mk-selected-bg); color: var(--mk-selected-text); }
    .rev .when { font-size: var(--mk-font-size-sm); }
    .rev .idx { color: var(--mk-text-muted); font-size: var(--mk-font-size-xs); }
    .diff { display: flex; flex-direction: column; min-height: 0; overflow: auto; }
    .diff mk-diff { flex: 1; }
    .diff__foot { margin-top: var(--mk-space-3); }
    .muted { color: var(--mk-text-muted); }
  `,
})
export class RevisionHistoryDialog {
  private readonly apollo = inject(Apollo);
  private readonly ref = inject<MkOverlayRef<EntrySnapshot>>(MkOverlayRef);
  private readonly data = inject<RevisionHistoryData>(MK_OVERLAY_DATA);

  protected readonly mode = signal<'split' | 'unified'>('split');
  protected readonly selectedId = signal<string | null>(null);

  protected readonly revisions = toSignal(
    this.apollo
      .query<{ entryRevisions: Revision[] }>({
        query: ENTRY_REVISIONS,
        variables: { id: this.data.entryId },
      })
      .pipe(map((r) => (r.data?.entryRevisions ?? []) as Revision[])),
    { initialValue: [] as Revision[] },
  );

  protected readonly selected = computed(
    () => this.revisions().find((r) => r.id === this.selectedId()) ?? null,
  );

  protected readonly beforeText = computed(() => {
    const rev = this.selected();
    return rev ? snapshotToText(rev.data) : '';
  });
  protected readonly afterText = computed(() => snapshotToText(this.data.current));

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  protected restore(rev: Revision): void {
    this.ref.close(rev.data);
  }
  protected cancel(): void {
    this.ref.close(undefined);
  }
}

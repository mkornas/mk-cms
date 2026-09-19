import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { MkButton, MkFormField, MkInput, MkSelect, MkOverlayRef, MK_OVERLAY_DATA } from '@mk-kit/ui';
import { slugify } from '../../core/util/slugify';
import { CREATE_TERM } from '../../core/graphql/operations';

/** Option for the parent select (indented by depth in its label). */
export interface TermParentOption {
  label: string;
  value: string | null;
}

export interface TermCreateDialogData {
  /** Slug of the taxonomy the new term belongs to. */
  taxonomy: string;
  /** Human-readable taxonomy name, for the heading. */
  taxonomyName: string;
  /** Parent choices (top-level sentinel first). */
  parents: TermParentOption[];
}

/**
 * Add a term under a taxonomy in a focused overlay: a name (slug derived) and an
 * optional parent. Owns the create mutation (success + error surface as global
 * toasts) and closes with `true` on success so the caller can refetch.
 */
@Component({
  selector: 'app-term-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkFormField, MkInput, MkSelect],
  template: `
    <div class="dlg">
      <header class="dlg__head">
        <h2>Add term to “{{ data.taxonomyName }}”</h2>
        <button mkButton variant="ghost" size="sm" iconOnly aria-label="Close" (click)="cancel()">✕</button>
      </header>

      <div class="dlg__body">
        <mk-form-field label="Name" hint="Slug is derived from the name.">
          <input mkInput placeholder="e.g. News" [value]="name()" (input)="set($event.target)" />
        </mk-form-field>
        <mk-form-field label="Parent">
          <mk-select [options]="data.parents" [value]="parent()" (valueChange)="parent.set(asId($event))" />
        </mk-form-field>
        @if (name().trim()) {
          <p class="dlg__slug">Slug: <code>{{ derivedSlug() }}</code></p>
        }
      </div>

      <footer class="dlg__foot">
        <span class="dlg__spacer"></span>
        <button mkButton variant="ghost" [disabled]="busy()" (click)="cancel()">Cancel</button>
        <button mkButton tone="primary" [loading]="busy()" [disabled]="busy() || !name().trim()" (click)="submit()">
          Add term
        </button>
      </footer>
    </div>
  `,
  styles: `
    .dlg { display: flex; flex-direction: column; min-height: 0; }
    .dlg__head { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); margin-bottom: var(--mk-space-4); }
    .dlg__head h2 { margin: 0; font-size: var(--mk-font-size-lg); }
    .dlg__body { display: flex; flex-direction: column; gap: var(--mk-space-3); }
    .dlg__slug { margin: 0; color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    .dlg__foot { display: flex; align-items: center; gap: var(--mk-space-2); margin-top: var(--mk-space-5); }
    .dlg__spacer { flex: 1; }
  `,
})
export class TermCreateDialog {
  private readonly apollo = inject(Apollo);
  private readonly ref = inject<MkOverlayRef<boolean>>(MkOverlayRef);
  protected readonly data = inject<TermCreateDialogData>(MK_OVERLAY_DATA);

  protected readonly name = signal('');
  protected readonly parent = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly derivedSlug = computed(() => slugify(this.name().trim()));

  protected set(t: EventTarget | null): void {
    this.name.set((t as HTMLInputElement)?.value ?? '');
  }

  /** mk-select emits `unknown`; option values here are a term id or null. */
  protected asId(v: unknown): string | null {
    return v == null ? null : String(v);
  }

  protected async submit(): Promise<void> {
    const name = this.name().trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: CREATE_TERM,
          variables: {
            taxonomy: this.data.taxonomy,
            input: { name, slug: slugify(name), parentId: this.parent() },
          },
        }),
      );
      this.ref.close(true);
    } catch {
      // Error surfaced as a global toast; keep the dialog open.
    } finally {
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.ref.close(false);
  }
}

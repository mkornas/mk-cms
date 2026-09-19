import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { MkButton, MkFormField, MkInput, MkOverlayRef } from '@mk-kit/ui';
import { slugify } from '../../core/util/slugify';
import { CREATE_TAXONOMY } from '../../core/graphql/operations';

/**
 * Create a taxonomy in a focused overlay. Name only — the slug is derived. Owns
 * its mutation (success + error surface as global toasts) and closes with `true`
 * when it created one so the caller can refetch.
 */
@Component({
  selector: 'app-taxonomy-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkFormField, MkInput],
  template: `
    <div class="dlg">
      <header class="dlg__head">
        <h2>New taxonomy</h2>
        <button mkButton variant="ghost" size="sm" iconOnly aria-label="Close" (click)="cancel()">✕</button>
      </header>

      <div class="dlg__body">
        <mk-form-field label="Name" hint="Slug is derived from the name.">
          <input mkInput placeholder="e.g. Category" [value]="name()" (input)="set($event.target)" />
        </mk-form-field>
        @if (name().trim()) {
          <p class="dlg__slug">Slug: <code>{{ derivedSlug() }}</code></p>
        }
      </div>

      <footer class="dlg__foot">
        <span class="dlg__spacer"></span>
        <button mkButton variant="ghost" [disabled]="busy()" (click)="cancel()">Cancel</button>
        <button mkButton tone="primary" [loading]="busy()" [disabled]="busy() || !name().trim()" (click)="submit()">
          Create taxonomy
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
export class TaxonomyCreateDialog {
  private readonly apollo = inject(Apollo);
  private readonly ref = inject<MkOverlayRef<boolean>>(MkOverlayRef);

  protected readonly name = signal('');
  protected readonly busy = signal(false);
  protected readonly derivedSlug = computed(() => slugify(this.name().trim()));

  protected set(t: EventTarget | null): void {
    this.name.set((t as HTMLInputElement)?.value ?? '');
  }

  protected async submit(): Promise<void> {
    const name = this.name().trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: CREATE_TAXONOMY,
          variables: { input: { name, slug: slugify(name) } },
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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { MkButton, MkFormField, MkInput, MkSwitch, MkAlert, MkCode } from '@mk-kit/ui';
import { ENTRY_SEO, SET_ENTRY_SEO } from '../../core/graphql/operations';

interface SeoMeta {
  title: string;
  description: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  noindex: boolean;
  jsonLd: Record<string, unknown>;
}

/**
 * Per-entry SEO overrides. The panel seeds from the entry's *resolved* SEO
 * (override → site default → derived), so the fields show the current effective
 * values; saving stores them as this entry's overrides (clear a text field to
 * fall back to the site default / derived value). A read-only preview shows the
 * schema.org JSON-LD the delivery API emits.
 */
@Component({
  selector: 'app-entry-seo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkFormField, MkInput, MkSwitch, MkAlert, MkCode],
  template: `
    @if (error(); as msg) {
      <mk-alert tone="danger" style="margin-bottom: var(--mk-space-3)">{{ msg }}</mk-alert>
    }

    <p class="hint">
      Seeded from the effective SEO. Saving stores these as this entry's overrides —
      clear a text field to inherit the site default.
    </p>

    <div class="fields">
      <mk-form-field label="Title">
        <input mkInput [value]="title()" (input)="set($event.target, title.set)" />
      </mk-form-field>
      <mk-form-field label="Description">
        <textarea mkInput rows="2" [value]="description()"
          (input)="set($event.target, description.set)"></textarea>
      </mk-form-field>
      <mk-form-field label="Canonical URL">
        <input mkInput [value]="canonical()" (input)="set($event.target, canonical.set)" />
      </mk-form-field>
      <mk-form-field label="OG title">
        <input mkInput [value]="ogTitle()" (input)="set($event.target, ogTitle.set)" />
      </mk-form-field>
      <mk-form-field label="OG description">
        <input mkInput [value]="ogDescription()" (input)="set($event.target, ogDescription.set)" />
      </mk-form-field>
      <mk-form-field label="OG image URL">
        <input mkInput [value]="ogImage()" (input)="set($event.target, ogImage.set)" />
      </mk-form-field>
      <div class="noindex">
        <span>Hide from search engines (noindex)</span>
        <mk-switch [checked]="noindex()" (checkedChange)="noindex.set($event)" />
      </div>
    </div>

    <div class="actions">
      <button mkButton tone="primary" [loading]="busy()" (click)="save()">Save SEO</button>
    </div>

    @if (jsonLdText(); as ld) {
      <h3>schema.org JSON-LD (preview)</h3>
      <mk-code language="json" [code]="ld" />
    }
  `,
  styles: `
    .hint { margin: 0 0 var(--mk-space-4); color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    .fields { display: grid; gap: var(--mk-space-3); }
    .noindex { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); }
    .actions { margin-top: var(--mk-space-4); }
    h3 { margin: var(--mk-space-5) 0 var(--mk-space-2); font-size: var(--mk-font-size-md); }
    mk-code { display: block; max-height: 16rem; overflow: auto; }
  `,
})
export class EntrySeoPanel {
  private readonly apollo = inject(Apollo);

  readonly entryId = input.required<string>();

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly canonical = signal('');
  protected readonly ogTitle = signal('');
  protected readonly ogDescription = signal('');
  protected readonly ogImage = signal('');
  protected readonly noindex = signal(false);
  protected readonly jsonLd = signal<Record<string, unknown>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly jsonLdText = computed(() => {
    const ld = this.jsonLd();
    return ld && Object.keys(ld).length ? JSON.stringify(ld, null, 2) : '';
  });

  private lastLoaded: string | null = null;

  constructor() {
    effect(() => {
      const id = this.entryId();
      if (id && id !== this.lastLoaded) {
        this.lastLoaded = id;
        void this.load(id);
      }
    });
  }

  private async load(entryId: string): Promise<void> {
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.query<{ entry: { seo: SeoMeta } }>({
          query: ENTRY_SEO,
          variables: { id: entryId },
          fetchPolicy: 'network-only',
        }),
      );
      const seo = res.data?.entry?.seo;
      if (!seo) return;
      this.title.set(seo.title ?? '');
      this.description.set(seo.description ?? '');
      this.canonical.set(seo.canonical ?? '');
      this.ogTitle.set(seo.ogTitle ?? '');
      this.ogDescription.set(seo.ogDescription ?? '');
      this.ogImage.set(seo.ogImage ?? '');
      this.noindex.set(seo.noindex ?? false);
      this.jsonLd.set(seo.jsonLd ?? {});
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load SEO.');
    }
  }

  protected set(target: EventTarget | null, setter: (v: string) => void): void {
    setter((target as HTMLInputElement | HTMLTextAreaElement)?.value ?? '');
  }

  private blankToNull(v: string): string | null {
    const t = v.trim();
    return t === '' ? null : t;
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate({
          mutation: SET_ENTRY_SEO,
          variables: {
            entryId: this.entryId(),
            input: {
              title: this.blankToNull(this.title()),
              description: this.blankToNull(this.description()),
              canonical: this.blankToNull(this.canonical()),
              ogTitle: this.blankToNull(this.ogTitle()),
              ogDescription: this.blankToNull(this.ogDescription()),
              ogImage: this.blankToNull(this.ogImage()),
              noindex: this.noindex(),
            },
          },
        }),
      );
      void res;
      // Re-resolve so the JSON-LD preview + fields reflect the saved state.
      this.lastLoaded = null;
      await this.load(this.entryId());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      this.busy.set(false);
    }
  }
}

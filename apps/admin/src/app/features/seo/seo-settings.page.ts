import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { MkButton, MkCard, MkFormField, MkInput, MkSwitch, MkAlert, MkPageHeader } from '@mk-kit/ui';
import { SEO_SETTINGS, UPDATE_SEO_SETTINGS } from '../../core/graphql/operations';

interface SeoSettings {
  baseUrl: string | null;
  titleTemplate: string | null;
  defaultDescription: string | null;
  robotsDisallow: string[];
  noindexSite: boolean;
}

/** Site-wide SEO defaults — the fallback the per-entry SEO panel inherits from. */
@Component({
  selector: 'app-seo-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkCard, MkFormField, MkInput, MkSwitch, MkAlert, MkPageHeader],
  template: `
    <mk-page-header heading="SEO" description="Search-engine defaults applied to every entry (title template, description, indexing)." />
    @if (error(); as m) { <mk-alert tone="danger" style="margin-bottom:var(--mk-space-4)">{{ m }}</mk-alert> }
    <mk-card>
      <div class="fields">
        <mk-form-field label="Base URL" hint="e.g. https://example.com — used for canonical + sitemap URLs.">
          <input mkInput [value]="baseUrl()" (input)="s($event.target, baseUrl.set)" />
        </mk-form-field>
        <mk-form-field label="Title template" hint="Use {'{'}title{'}'} and {'{'}site{'}'}, e.g. “{'{'}title{'}'} · {'{'}site{'}'}”.">
          <input mkInput [value]="titleTemplate()" (input)="s($event.target, titleTemplate.set)" />
        </mk-form-field>
        <mk-form-field label="Default description">
          <textarea mkInput rows="2" [value]="defaultDescription()"
            (input)="s($event.target, defaultDescription.set)"></textarea>
        </mk-form-field>
        <mk-form-field label="Robots disallow" hint="One path per line (robots.txt Disallow rules).">
          <textarea mkInput rows="3" [value]="robotsText()"
            (input)="s($event.target, robotsText.set)"></textarea>
        </mk-form-field>
        <div class="row">
          <span>Hide the whole site from search engines (noindex)</span>
          <mk-switch [checked]="noindexSite()" (checkedChange)="noindexSite.set($event)" />
        </div>
      </div>
      <div class="mk-form-actions" style="margin-top:var(--mk-space-4)">
        <button mkButton tone="primary" [loading]="busy()" (click)="save()">Save settings</button>
      </div>
    </mk-card>
  `,
  styles: `
    :host { --page-max: 48rem; }
    mk-page-header { display: block; margin-bottom: var(--mk-space-5); }
    .fields { display: grid; gap: var(--mk-space-4); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); }
  `,
})
export class SeoSettingsPage {
  private readonly apollo = inject(Apollo);
  protected readonly baseUrl = signal('');
  protected readonly titleTemplate = signal('');
  protected readonly defaultDescription = signal('');
  protected readonly robotsText = signal('');
  protected readonly noindexSite = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    effect(() => void this.load());
  }
  private loaded = false;
  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const res = await firstValueFrom(
        this.apollo.query<{ seoSettings: SeoSettings }>({ query: SEO_SETTINGS, fetchPolicy: 'network-only' }),
      );
      const s = res.data?.seoSettings;
      if (!s) return;
      this.baseUrl.set(s.baseUrl ?? '');
      this.titleTemplate.set(s.titleTemplate ?? '');
      this.defaultDescription.set(s.defaultDescription ?? '');
      this.robotsText.set((s.robotsDisallow ?? []).join('\n'));
      this.noindexSite.set(s.noindexSite ?? false);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load.');
    }
  }

  protected s(t: EventTarget | null, set: (v: string) => void): void {
    set((t as HTMLInputElement | HTMLTextAreaElement)?.value ?? '');
  }
  private blank(v: string): string | null {
    return v.trim() === '' ? null : v.trim();
  }
  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_SEO_SETTINGS,
          variables: {
            input: {
              baseUrl: this.blank(this.baseUrl()),
              titleTemplate: this.blank(this.titleTemplate()),
              defaultDescription: this.blank(this.defaultDescription()),
              robotsDisallow: this.robotsText().split('\n').map((l) => l.trim()).filter(Boolean),
              noindexSite: this.noindexSite(),
            },
          },
        }),
      );
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      this.busy.set(false);
    }
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import {
  MkButton,
  MkCard,
  MkFormField,
  MkInput,
  MkSwitch,
  MkAlert,
  MkPageHeader,
  MkDescriptionList,
  MkDescItem,
} from '@mk-kit/ui';
import { IMPORT_WORDPRESS } from '../../core/graphql/operations';

interface ImportResult {
  siteTitle: string;
  contentTypesEnsured: string[];
  taxonomiesEnsured: string[];
  termsCreated: number;
  entriesImported: number;
  entriesSkipped: number;
  mediaImported: number;
  mediaFailed: number;
  warnings: string[];
}

/** WordPress importer (`settings:manage`): paste or load a WXR/XML export and
 *  import posts/pages/terms (and optionally attachments into the media library). */
@Component({
  selector: 'app-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkButton,
    MkCard,
    MkFormField,
    MkInput,
    MkSwitch,
    MkAlert,
    MkPageHeader,
    MkDescriptionList,
    MkDescItem,
  ],
  template: `
    <mk-page-header
      heading="Import from WordPress"
      description="Paste or load a WXR export (Tools → Export in WordPress)."
    />
    @if (error(); as m) { <mk-alert tone="danger" style="margin-bottom:var(--mk-space-4)">{{ m }}</mk-alert> }

    <mk-card>
      <div class="form">
        <label class="filebtn">
          <input type="file" accept=".xml,text/xml" (change)="onFile($event)" hidden />
          <span mkButton variant="outline" size="sm">Load .xml file…</span>
          <span class="muted">{{ fileName() || 'or paste below' }}</span>
        </label>
        <mk-form-field label="WXR XML">
          <textarea mkInput rows="10" placeholder="<?xml version=…>"
            [value]="xml()" (input)="setXml($event.target)"></textarea>
        </mk-form-field>
        <div class="row"><span>Download attachments into the media library</span>
          <mk-switch [checked]="importMedia()" (checkedChange)="importMedia.set($event)" /></div>
        <div class="mk-form-actions">
          <button mkButton tone="primary" [loading]="busy()" [disabled]="!xml().trim()" (click)="run()">
            Import
          </button>
        </div>
      </div>
    </mk-card>

    @if (result(); as r) {
      <mk-card style="margin-top:var(--mk-space-4)">
        <h2>Imported “{{ r.siteTitle }}”</h2>
        <mk-description-list divided>
          <mk-desc-item term="Entries imported">{{ r.entriesImported }}</mk-desc-item>
          <mk-desc-item term="Entries skipped">{{ r.entriesSkipped }}</mk-desc-item>
          <mk-desc-item term="Terms created">{{ r.termsCreated }}</mk-desc-item>
          <mk-desc-item term="Media imported / failed">{{ r.mediaImported }} / {{ r.mediaFailed }}</mk-desc-item>
          <mk-desc-item term="Content types">{{ r.contentTypesEnsured.join(', ') }}</mk-desc-item>
          <mk-desc-item term="Taxonomies">{{ r.taxonomiesEnsured.join(', ') }}</mk-desc-item>
        </mk-description-list>
        @if (r.warnings.length) {
          <h3>Warnings ({{ r.warnings.length }})</h3>
          <ul class="warnings">@for (w of r.warnings; track w) { <li>{{ w }}</li> }</ul>
        }
      </mk-card>
    }
  `,
  styles: `
    :host { --page-max: 52rem; }
    mk-page-header { display: block; margin-bottom: var(--mk-space-5); }
    .form { display: grid; gap: var(--mk-space-3); }
    .filebtn { display: flex; align-items: center; gap: var(--mk-space-3); cursor: pointer; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); }
    .muted { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    h2 { margin: 0 0 var(--mk-space-3); } h3 { margin: var(--mk-space-4) 0 var(--mk-space-2); font-size: var(--mk-font-size-md); }
    .warnings { margin: 0; padding-left: var(--mk-space-5); color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
  `,
})
export class ImportPage {
  private readonly apollo = inject(Apollo);
  protected readonly xml = signal('');
  protected readonly fileName = signal('');
  protected readonly importMedia = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<ImportResult | null>(null);

  protected setXml(t: EventTarget | null): void {
    this.xml.set((t as HTMLTextAreaElement)?.value ?? '');
  }
  protected onFile(event: Event): void {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => this.xml.set(String(reader.result ?? ''));
    reader.readAsText(file);
  }
  protected async run(): Promise<void> {
    if (this.busy() || !this.xml().trim()) return;
    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate<{ importWordpress: ImportResult }>({
          mutation: IMPORT_WORDPRESS,
          variables: { xml: this.xml(), importMedia: this.importMedia() },
        }),
      );
      if (res.data?.importWordpress) this.result.set(res.data.importWordpress as ImportResult);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      this.busy.set(false);
    }
  }
}

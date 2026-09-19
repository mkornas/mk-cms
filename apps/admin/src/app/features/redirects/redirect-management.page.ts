import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import { ConfirmService } from '../../core/ui/confirm.service';
import {
  MkButton,
  MkCard,
  MkFormField,
  MkInput,
  MkSwitch,
  MkAlert,
  MkSkeletonPreset,
  MkPageHeader,
  MkEmptyState,
  MkTable,
  MkTableColumn,
  MkFileUpload,
} from '@mk-kit/ui';
import {
  REDIRECTS,
  CREATE_REDIRECT,
  UPDATE_REDIRECT,
  DELETE_REDIRECT,
} from '../../core/graphql/operations';

interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  enabled: boolean;
  hits: number;
}

/** Redirect management (`redirect:manage`): from → to path rules with a status
 *  code, enable toggle, and hit counter. */
@Component({
  selector: 'app-redirect-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkCard, MkFormField, MkInput, MkSwitch, MkAlert, MkSkeletonPreset, MkPageHeader, MkEmptyState, MkTable, MkFileUpload],
  template: `
    <mk-page-header heading="Redirects" description="From → to path rules with a status code, an enable toggle, and a hit counter." />
    @if (error(); as m) { <mk-alert tone="danger" style="margin-bottom:var(--mk-space-4)">{{ m }}</mk-alert> }

    <mk-card style="margin-bottom:var(--mk-space-4)">
      <div class="ie-head">
        <h2>Import / export</h2>
        <button mkButton variant="ghost" size="sm" [disabled]="!redirects().length" (click)="exportCsv()">Export CSV</button>
      </div>
      <p class="muted">Paste CSV or load a file (columns: <code>fromPath,toPath,statusCode,enabled</code>; a header row is optional).</p>
      <div class="form">
        <mk-file-upload accept=".csv,text/csv" [hideList]="true"
          label="Load a CSV file" hint="Columns: fromPath, toPath, statusCode, enabled"
          (filesSelected)="onFiles($event)" />
        <mk-form-field label="CSV" hint="One redirect per line">
          <textarea mkInput rows="6" [value]="importText()" (input)="s($event.target, importText.set)"
            placeholder="/old-page,/new-page,301,true"></textarea>
        </mk-form-field>
        <div class="mk-form-actions">
          <button mkButton tone="primary" [disabled]="importing() || !importText().trim()" (click)="importCsv()">
            {{ importing() ? 'Importing…' : 'Import' }}
          </button>
        </div>
        @if (importResult(); as m) { <mk-alert tone="info">{{ m }}</mk-alert> }
      </div>
    </mk-card>

    <mk-card style="margin-bottom:var(--mk-space-4)">
      @if (selected().length) {
        <div class="bulk">
          <span class="bulk__count">{{ selected().length }} selected</span>
          <button mkButton size="sm" variant="outline" tone="danger" [loading]="busy()" (click)="bulkDelete()">Delete</button>
        </div>
      }
      @if (showSkeleton()) {
        <mk-skeleton-preset preset="table" [rows]="5" [columns]="4" loadingLabel="Loading redirects…" />
      } @else if (redirects().length === 0) {
        <mk-empty-state icon="external-link" title="No redirects yet"
          description="Create one below, or import a CSV." />
      } @else {
        <mk-table
          [columns]="columns"
          [data]="redirects()"
          trackKey="id"
          [selectable]="true"
          [(selected)]="selected"
          [hover]="true"
          [zebra]="true"
          [clickableRows]="true"
          (rowClick)="edit($event)"
          emptyMessage="No redirects."
          [stackAt]="640"
        />
      }
    </mk-card>

    <mk-card>
      <h2>{{ editingId() ? 'Edit redirect' : 'New redirect' }}</h2>
      <div class="form">
        <mk-form-field label="From path" [hint]="editingId() ? 'Immutable' : 'e.g. /old-page'">
          <input mkInput [value]="fromPath()" [disabled]="!!editingId()" (input)="s($event.target, fromPath.set)" />
        </mk-form-field>
        <mk-form-field label="To path" hint="e.g. /new-page or an absolute URL">
          <input mkInput [value]="toPath()" (input)="s($event.target, toPath.set)" />
        </mk-form-field>
        <div class="grid">
          <mk-form-field label="Status code" hint="301 / 302 / 307 / 308">
            <input mkInput type="number" [value]="statusCode()" (input)="s($event.target, statusCode.set)" />
          </mk-form-field>
          <div class="row"><span>Enabled</span><mk-switch [checked]="enabled()" (checkedChange)="enabled.set($event)" /></div>
        </div>
        <div class="mk-form-actions">
          <button mkButton tone="primary" [loading]="saving()"
            [disabled]="saving() || !toPath().trim() || (!editingId() && !fromPath().trim())"
            (click)="save()">{{ editingId() ? 'Update' : 'Create' }}</button>
          @if (editingId()) { <button mkButton variant="ghost" (click)="reset()">Cancel</button> }
        </div>
      </div>
    </mk-card>
  `,
  styles: `
    :host { --page-max: 72rem; }
    .muted { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    h2 { margin: 0 0 var(--mk-space-3); font-size: var(--mk-font-size-lg); }
    .ie-head { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-2); }
    .ie-head h2 { margin: 0; }
    .bulk { display: flex; align-items: center; gap: var(--mk-space-2); padding: var(--mk-space-2) var(--mk-space-3); background: var(--mk-surface-2); border-radius: var(--mk-radius-md); margin-bottom: var(--mk-space-3); }
    .bulk__count { font-weight: var(--mk-font-weight-medium); }
    .form { display: grid; gap: var(--mk-space-3); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--mk-space-3); align-items: end; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-2); }
  `,
})
export class RedirectManagementPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly ref = this.apollo.watchQuery<{ redirects: Redirect[] }>({
    query: REDIRECTS,
    fetchPolicy: 'cache-and-network',
  });
  protected readonly redirects = toSignal(
    this.ref.valueChanges.pipe(map((r) => (r.data?.redirects ?? []) as Redirect[])),
    { initialValue: [] as Redirect[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.ref.valueChanges.pipe(map((r) => r.loading && !r.data?.redirects)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.redirects().length === 0,
  );

  /** Guards the create/update save button against double-submit. */
  protected readonly saving = signal(false);

  /** Rows selected in the table for bulk delete. */
  protected readonly selected = signal<Redirect[]>([]);
  /** Guards the bulk-delete handler against double-submit. */
  protected readonly busy = signal(false);

  protected readonly columns: MkTableColumn<Redirect>[] = [
    { key: 'fromPath', header: 'From', sortable: true, stack: 'title' },
    { key: 'toPath', header: 'To', sortable: true },
    {
      key: 'statusCode',
      header: 'Status',
      align: 'center',
      format: (_v, r) => (r.enabled ? String(r.statusCode) : `${r.statusCode} · off`),
    },
    { key: 'hits', header: 'Hits', align: 'end', format: (v) => String(v ?? 0) },
  ];

  protected readonly editingId = signal<string | null>(null);
  protected readonly fromPath = signal('');
  protected readonly toPath = signal('');
  protected readonly statusCode = signal('301');
  protected readonly enabled = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly importText = signal('');
  protected readonly importing = signal(false);
  protected readonly importResult = signal<string | null>(null);

  protected s(t: EventTarget | null, set: (v: string) => void): void {
    set((t as HTMLInputElement)?.value ?? '');
  }
  protected reset(): void {
    this.editingId.set(null);
    this.fromPath.set('');
    this.toPath.set('');
    this.statusCode.set('301');
    this.enabled.set(true);
  }
  protected edit(r: Redirect): void {
    this.editingId.set(r.id);
    this.fromPath.set(r.fromPath);
    this.toPath.set(r.toPath);
    this.statusCode.set(String(r.statusCode));
    this.enabled.set(r.enabled);
  }
  private async run(work: Promise<unknown>): Promise<void> {
    this.error.set(null);
    try {
      await work;
      await this.ref.refetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed.');
    } finally {
      this.saving.set(false);
    }
  }
  protected save(): void {
    if (this.saving()) return;
    const toPath = this.toPath().trim();
    if (!toPath || (!this.editingId() && !this.fromPath().trim())) return;
    this.saving.set(true);
    const statusCode = Number(this.statusCode()) || 301;
    const id = this.editingId();
    if (id) {
      void this.run(
        firstValueFrom(
          this.apollo.mutate({
            mutation: UPDATE_REDIRECT,
            variables: { id, input: { toPath: this.toPath(), statusCode, enabled: this.enabled() } },
          }),
        ).then(() => this.reset()),
      );
    } else {
      void this.run(
        firstValueFrom(
          this.apollo.mutate({
            mutation: CREATE_REDIRECT,
            variables: { input: { fromPath: this.fromPath(), toPath: this.toPath(), statusCode, enabled: this.enabled() } },
          }),
        ).then(() => this.reset()),
      );
    }
  }
  protected async bulkDelete(): Promise<void> {
    const rows = this.selected();
    if (!rows.length || this.busy()) return;
    const subject = rows.length === 1 ? `the redirect from ${rows[0].fromPath}` : `these ${rows.length} redirects`;
    if (!(await this.confirm.remove(subject))) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await Promise.all(
        rows.map((r) => firstValueFrom(this.apollo.mutate({ mutation: DELETE_REDIRECT, variables: { id: r.id } }))),
      );
      if (rows.some((r) => r.id === this.editingId())) this.reset();
      this.selected.set([]);
      await this.ref.refetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed.');
      await this.ref.refetch();
    } finally {
      this.busy.set(false);
    }
  }

  // --- CSV export -----------------------------------------------------------
  /** Wrap a value in quotes when it contains a comma, quote, or newline. */
  private csvCell(v: string): string {
    // Neutralize CSV/formula injection (leading =/+/-/@) before quoting.
    if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }
  protected exportCsv(): void {
    const header = 'fromPath,toPath,statusCode,enabled';
    const body = this.redirects().map((r) =>
      [r.fromPath, r.toPath, String(r.statusCode), String(r.enabled)]
        .map((c) => this.csvCell(String(c ?? '')))
        .join(','),
    );
    const csv = [header, ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redirects.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- CSV import -----------------------------------------------------------
  protected onFiles(files: File[]): void {
    const file = files[0];
    if (!file) return;
    void file.text().then((text) => this.importText.set(text));
  }
  /** Split a single CSV line into cells, honouring quoted fields. */
  private parseLine(line: string): string[] {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  }
  protected async importCsv(): Promise<void> {
    if (this.importing()) return;
    this.importing.set(true);
    this.importResult.set(null);
    this.error.set(null);

    const rows = this.importText()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => this.parseLine(l))
      // Tolerate a header row: drop a first row whose first cell is `fromPath`.
      .filter((cells, i) => !(i === 0 && cells[0]?.toLowerCase() === 'frompath'));

    let imported = 0;
    let skipped = 0;
    for (const cells of rows) {
      const fromPath = String(cells[0] ?? '').trim();
      const toPath = String(cells[1] ?? '').trim();
      if (!fromPath || !toPath) { skipped++; continue; }
      const statusCode = Number(cells[2]) || 301;
      const enabledRaw = String(cells[3] ?? '').trim().toLowerCase();
      const enabled = cells[3] == null || enabledRaw === '' ? true : !['false', '0', 'no', 'off'].includes(enabledRaw);
      try {
        await firstValueFrom(
          this.apollo.mutate({
            mutation: CREATE_REDIRECT,
            variables: { input: { fromPath, toPath, statusCode, enabled } },
          }),
        );
        imported++;
      } catch {
        // Collect per-row failures without aborting the batch.
        skipped++;
      }
    }

    this.importResult.set(
      `Imported ${imported}, skipped ${skipped}${skipped ? ' (errors or invalid rows)' : ''}.`,
    );
    this.importing.set(false);
    if (imported) {
      this.importText.set('');
      await this.ref.refetch();
    }
  }
}

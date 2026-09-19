import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import {
  MkButton,
  MkCard,
  MkFormField,
  MkInput,
  MkAlert,
  MkSkeletonPreset,
  MkPageHeader,
  MkEmptyState,
} from '@mk-kit/ui';

const OPTIONS = gql`
  query Options {
    options {
      key
      value
      autoload
    }
  }
`;

const SET_OPTION = gql`
  mutation SetOption($key: String!, $value: JSON!) {
    setOption(key: $key, value: $value) {
      key
      value
      autoload
    }
  }
`;

interface OptionRow {
  key: string;
  value: unknown;
  autoload: boolean;
}

/** Serialise an option value for editing: plain strings stay raw, everything
 * else is pretty-printed JSON. */
function display(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? null, null, 2);
}

/** Parse an edited value back to JSON; fall back to the raw string when it is
 * not valid JSON (so free-text values keep working). */
function parse(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

/** General settings — the active site's key/value option store. Lists every
 * option and lets the user edit values or add new keys. */
@Component({
  selector: 'app-general-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkButton,
    MkCard,
    MkFormField,
    MkInput,
    MkAlert,
    MkSkeletonPreset,
    MkPageHeader,
    MkEmptyState,
  ],
  templateUrl: './general-settings.page.html',
  styles: `
    :host { --page-max: 48rem; }
    mk-page-header { display: block; margin-bottom: var(--mk-space-5); }
    .stack { display: grid; gap: var(--mk-space-4); }
    .opt { display: grid; gap: var(--mk-space-2); padding-bottom: var(--mk-space-4); border-bottom: 1px solid var(--mk-border); }
    .opt:last-child { border-bottom: 0; padding-bottom: 0; }
    .opt-head { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-3); }
    .opt-key { font-family: var(--mk-font-mono, monospace); font-weight: 600; }
    .opt-key .badge { margin-left: var(--mk-space-2); font-weight: 400; font-size: 0.75rem; color: var(--mk-text-muted); }
    textarea { width: 100%; font-family: var(--mk-font-mono, monospace); }
  `,
})
export class GeneralSettingsPage {
  private readonly apollo = inject(Apollo);

  protected readonly rows = signal<OptionRow[]>([]);
  protected readonly drafts = signal<Record<string, string>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly savingKey = signal<string | null>(null);
  /** True during the initial options load (before anything has arrived). */
  protected readonly loading = signal(true);
  protected readonly showSkeleton = computed(
    () => this.loading() && this.rows().length === 0,
  );

  protected readonly newKey = signal('');
  protected readonly newValue = signal('');
  protected readonly adding = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.apollo.query<{ options: OptionRow[] }>({
          query: OPTIONS,
          fetchPolicy: 'network-only',
        }),
      );
      const rows = res.data?.options ?? [];
      this.rows.set(rows);
      const drafts: Record<string, string> = {};
      for (const r of rows) drafts[r.key] = display(r.value);
      this.drafts.set(drafts);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load options.');
    } finally {
      this.loading.set(false);
    }
  }

  protected draftFor(key: string): string {
    return this.drafts()[key] ?? '';
  }

  protected onDraft(key: string, target: EventTarget | null): void {
    const value = (target as HTMLTextAreaElement | null)?.value ?? '';
    this.drafts.update((d) => ({ ...d, [key]: value }));
  }

  protected onNew(target: EventTarget | null, set: (v: string) => void): void {
    set((target as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '');
  }

  private async setOption(key: string, value: unknown): Promise<void> {
    await firstValueFrom(
      this.apollo.mutate({
        mutation: SET_OPTION,
        variables: { key, value },
      }),
    );
  }

  protected async save(key: string): Promise<void> {
    if (this.savingKey()) return;
    this.savingKey.set(key);
    this.error.set(null);
    try {
      await this.setOption(key, parse(this.draftFor(key)));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      this.savingKey.set(null);
    }
  }

  protected async add(): Promise<void> {
    const key = this.newKey().trim();
    if (this.adding() || key === '') return;
    this.adding.set(true);
    this.error.set(null);
    try {
      await this.setOption(key, parse(this.newValue()));
      this.newKey.set('');
      this.newValue.set('');
      await this.load();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to add option.');
    } finally {
      this.adding.set(false);
    }
  }
}

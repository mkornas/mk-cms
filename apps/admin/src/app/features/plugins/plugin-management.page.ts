import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import {
  MkButton,
  MkCard,
  MkSwitch,
  MkBadge,
  MkAlert,
  MkSkeletonPreset,
  MkPageHeader,
  MkEmptyState,
  MkTable,
  MkTableCell,
  MkTableColumn,
  MkTag,
  MkTone,
} from '@mk-kit/ui';
import { FieldControl } from '../content/field-control';
import { FieldDef, FieldKind } from '../../core/graphql/types';
import {
  PLUGINS,
  ACTIVATE_PLUGIN,
  DEACTIVATE_PLUGIN,
  UPDATE_PLUGIN_SETTINGS,
} from '../../core/graphql/operations';

interface PluginSettingsField {
  key: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
  default: unknown;
}
interface Plugin {
  name: string;
  version: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  capabilities: string[];
  settingsSchema: PluginSettingsField[];
  settings: Record<string, unknown>;
}

/** Row shape rendered by the plugin table (adds a derived status label). */
interface PluginRow extends Plugin {
  status: string;
}

/**
 * Plugin management: activate/deactivate installed plugins and edit their
 * declarative settings. Each plugin's settingsSchema is the same field-schema
 * the content engine uses, so the settings form reuses {@link FieldControl}.
 */
@Component({
  selector: 'app-plugin-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MkButton,
    MkCard,
    MkSwitch,
    MkBadge,
    MkAlert,
    MkSkeletonPreset,
    MkPageHeader,
    MkEmptyState,
    MkTable,
    MkTableCell,
    MkTag,
    FieldControl,
  ],
  templateUrl: './plugin-management.page.html',
  styles: `
    .layout { display: grid; gap: var(--mk-space-4); grid-template-columns: 1fr; }
    @media (min-width: 60rem) { .layout { grid-template-columns: 20rem 1fr; align-items: start; } }
    .detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--mk-space-3); margin-bottom: var(--mk-space-3); }
    .detail-head h2 { margin: 0; }
    .detail-head p { margin: var(--mk-space-1) 0 0; color: var(--mk-text-muted); }
    .caps { display: flex; flex-wrap: wrap; gap: var(--mk-space-1); margin: var(--mk-space-3) 0; }
    .toggle { display: flex; align-items: center; gap: var(--mk-space-2); }
    .settings { display: grid; gap: var(--mk-space-4); margin-top: var(--mk-space-4); }
    .settings-actions { margin-top: var(--mk-space-4); }
    h3 { margin: 0 0 var(--mk-space-2); font-size: var(--mk-font-size-md); }
  `,
})
export class PluginManagementPage {
  private readonly apollo = inject(Apollo);

  private readonly pluginsRef = this.apollo.watchQuery<{ plugins: Plugin[] }>({
    query: PLUGINS,
    fetchPolicy: 'cache-and-network',
  });
  protected readonly plugins = toSignal(
    this.pluginsRef.valueChanges.pipe(map((r) => (r.data?.plugins ?? []) as Plugin[])),
    { initialValue: [] as Plugin[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.pluginsRef.valueChanges.pipe(map((r) => r.loading && !r.data?.plugins)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.plugins().length === 0,
  );

  protected readonly activeName = signal<string | null>(null);
  protected readonly settings = signal<Record<string, unknown>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly active = computed(
    () => this.plugins().find((p) => p.name === this.activeName()) ?? null,
  );

  protected readonly pluginColumns: MkTableColumn<PluginRow>[] = [
    { key: 'displayName', header: 'Plugin', sortable: true, stack: 'title' },
    { key: 'version', header: 'Version', align: 'center', format: (v) => `v${v ?? ''}` },
    { key: 'status', header: 'Status', align: 'center' },
  ];

  /** Tone for the status tag rendered by the `status` cell template. */
  protected statusTone(status: unknown): MkTone {
    return String(status) === 'Active' ? 'success' : 'neutral';
  }
  protected readonly pluginRows = computed<PluginRow[]>(() =>
    this.plugins().map((p) => ({ ...p, status: p.enabled ? 'Active' : 'Inactive' })),
  );

  /** Plugin settings fields → FieldDef so FieldControl can render them. */
  protected readonly fieldDefs = computed<FieldDef[]>(() =>
    (this.active()?.settingsSchema ?? []).map((f, i) => ({
      id: f.key,
      key: f.key,
      name: f.label,
      type: f.type as FieldKind,
      required: f.required,
      config: f.config,
      sortOrder: i,
    })),
  );

  protected select(p: Plugin): void {
    this.activeName.set(p.name);
    this.settings.set({ ...p.settings });
    this.error.set(null);
  }

  protected setField(key: string, value: unknown): void {
    this.settings.update((s) => ({ ...s, [key]: value }));
  }

  protected async toggle(p: Plugin): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: p.enabled ? DEACTIVATE_PLUGIN : ACTIVATE_PLUGIN,
          variables: { name: p.name },
        }),
      );
      await this.pluginsRef.refetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Toggle failed.');
    }
  }

  protected async save(): Promise<void> {
    const p = this.active();
    if (!p || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: UPDATE_PLUGIN_SETTINGS,
          variables: { name: p.name, settings: this.settings() },
        }),
      );
      await this.pluginsRef.refetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      this.busy.set(false);
    }
  }
}

import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HookBus } from '../hooks/hook-bus.service';
import { CoreActions } from '../hooks/hooks.constants';
import { FieldTypeRegistry } from '../content/field-types/field-type.registry';
import { ContentFieldValidator } from '../content/field-types/content-field-validator';
import type { FieldDefinition } from '../content/entities/field-definition.entity';
import { PluginRecord } from './entities/plugin.entity';
import { PLUGIN } from './contracts/plugin.tokens';
import type {
  Plugin,
  PluginContext,
  ScopedHooks,
} from './contracts/plugin.types';
import type { SettingsSchema } from './contracts/settings-schema';

export interface PluginView {
  name: string;
  version: string;
  installedVersion: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  capabilities: string[];
  settingsSchema: SettingsSchema;
  settings: Record<string, unknown>;
}

/**
 * The plugin engine's runtime (ARCHITECTURE §4). At boot it discovers every
 * plugin provided under the {@link PLUGIN} token, calls each one's `register`
 * to wire hooks/field types/settings, reconciles the `plugins` table
 * (install on first sight, upgrade on a version bump), then activates those
 * marked enabled. Activation state is mirrored into the {@link HookBus} so a
 * deactivated plugin's listeners simply stop firing. It also owns the admin
 * operations: list / activate / deactivate / update settings.
 */
@Injectable()
export class PluginManager implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginManager.name);
  private readonly plugins = new Map<string, Plugin>();
  private readonly active = new Set<string>();
  /** Effective (defaults-applied) settings per plugin. */
  private readonly settingsCache = new Map<string, Record<string, unknown>>();

  constructor(
    @Optional() @Inject(PLUGIN) plugins: Plugin[] | undefined,
    private readonly bus: HookBus,
    private readonly fieldTypes: FieldTypeRegistry,
    private readonly validator: ContentFieldValidator,
    @InjectRepository(PluginRecord)
    private readonly records: Repository<PluginRecord>,
  ) {
    for (const plugin of plugins ?? []) {
      const name = plugin.manifest.name;
      if (this.plugins.has(name)) {
        throw new Error(`Duplicate plugin name "${name}".`);
      }
      this.plugins.set(name, plugin);
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    // 1. Let every loaded plugin wire itself in (hooks, field types, schema).
    for (const plugin of this.plugins.values()) {
      await plugin.register?.(this.contextFor(plugin));
    }
    // 2. Reconcile persistent state, then activate the enabled ones.
    for (const plugin of this.plugins.values()) {
      await this.reconcile(plugin);
    }
    this.bus.setActivePlugins(this.active);
    for (const name of this.active) {
      const plugin = this.plugins.get(name)!;
      await plugin.onActivate?.(this.contextFor(plugin));
    }
    this.logger.log(
      `Plugins: ${this.plugins.size} loaded, ${this.active.size} active` +
        (this.plugins.size ? ` [${[...this.plugins.keys()].join(', ')}]` : ''),
    );
  }

  /** Install a newly-seen plugin or upgrade one whose version changed. */
  private async reconcile(plugin: Plugin): Promise<void> {
    const { name, version } = plugin.manifest;
    let record = await this.records.findOne({ where: { name } });

    if (!record) {
      await plugin.onInstall?.(this.contextFor(plugin));
      record = await this.records.save(
        this.records.create({
          name,
          installedVersion: version,
          enabled: false,
          settings: {},
        }),
      );
      this.logger.log(`Installed plugin "${name}" v${version}`);
    } else if (record.installedVersion !== version) {
      await plugin.onUpgrade?.(
        this.contextFor(plugin),
        record.installedVersion,
      );
      this.logger.log(
        `Upgraded plugin "${name}" ${record.installedVersion} → ${version}`,
      );
      record.installedVersion = version;
      await this.records.save(record);
    }

    this.settingsCache.set(name, this.effectiveSettings(plugin, record.settings));
    if (record.enabled) this.active.add(name);
  }

  // ── admin operations ───────────────────────────────
  list(): PluginView[] {
    return [...this.plugins.values()].map((p) => this.view(p));
  }

  private requirePlugin(name: string): Plugin {
    const plugin = this.plugins.get(name);
    if (!plugin) throw new NotFoundException(`Unknown plugin "${name}".`);
    return plugin;
  }

  async activate(name: string): Promise<PluginView> {
    const plugin = this.requirePlugin(name);
    if (!this.active.has(name)) {
      this.active.add(name);
      this.bus.setActivePlugins(this.active);
      await this.records.update({ name }, { enabled: true });
      await plugin.onActivate?.(this.contextFor(plugin));
      await this.bus.doAction(CoreActions.PluginActivated, { name });
      this.logger.log(`Activated plugin "${name}"`);
    }
    return this.view(plugin);
  }

  async deactivate(name: string): Promise<PluginView> {
    const plugin = this.requirePlugin(name);
    if (this.active.has(name)) {
      await plugin.onDeactivate?.(this.contextFor(plugin));
      this.active.delete(name);
      this.bus.setActivePlugins(this.active);
      await this.records.update({ name }, { enabled: false });
      await this.bus.doAction(CoreActions.PluginDeactivated, { name });
      this.logger.log(`Deactivated plugin "${name}"`);
    }
    return this.view(plugin);
  }

  /** Merge + validate a settings patch against the plugin's schema. */
  async updateSettings(
    name: string,
    patch: Record<string, unknown>,
  ): Promise<PluginView> {
    const plugin = this.requirePlugin(name);
    const record = await this.records.findOneOrFail({ where: { name } });
    const merged = { ...record.settings, ...patch };
    const effective = this.effectiveSettings(plugin, merged);
    record.settings = effective;
    await this.records.save(record);
    this.settingsCache.set(name, effective);
    return this.view(plugin);
  }

  // ── helpers ────────────────────────────────────────
  private effectiveSettings(
    plugin: Plugin,
    stored: Record<string, unknown>,
  ): Record<string, unknown> {
    const schema = plugin.manifest.settingsSchema;
    if (!schema || schema.length === 0) return stored;
    const defs = schema.map(
      (f) =>
        ({
          key: f.key,
          type: f.type,
          required: f.required ?? false,
          config: f.config ?? {},
        }) as FieldDefinition,
    );
    // Seed declared defaults, then validate/normalize the stored values.
    const withDefaults: Record<string, unknown> = {};
    for (const f of schema) {
      if (f.default !== undefined) withDefaults[f.key] = f.default;
    }
    return this.validator.validate(defs, { ...withDefaults, ...stored });
  }

  private contextFor(plugin: Plugin): PluginContext {
    const name = plugin.manifest.name;
    const scoped: ScopedHooks = {
      addAction: (hook, handler, opts = {}) =>
        this.bus.addAction(hook, handler, { ...opts, plugin: name }),
      addFilter: (hook, handler, opts = {}) =>
        this.bus.addFilter(hook, handler, { ...opts, plugin: name }),
    };
    return {
      manifest: plugin.manifest,
      hooks: scoped,
      fieldTypes: this.fieldTypes,
      settings: <T>() => (this.settingsCache.get(name) ?? {}) as T,
      logger: new Logger(`plugin:${name}`),
    };
  }

  private view(plugin: Plugin): PluginView {
    const m = plugin.manifest;
    return {
      name: m.name,
      version: m.version,
      installedVersion: m.version,
      displayName: m.displayName ?? m.name,
      description: m.description ?? null,
      enabled: this.active.has(m.name),
      capabilities: m.capabilities ?? [],
      settingsSchema: m.settingsSchema ?? [],
      settings: this.settingsCache.get(m.name) ?? {},
    };
  }
}

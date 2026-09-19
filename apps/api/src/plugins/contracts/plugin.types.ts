import type { Logger } from '@nestjs/common';
import type { HookBus } from '../../hooks/hook-bus.service';
import type { FieldTypeRegistry } from '../../content/field-types/field-type.registry';
import type { SettingsSchema } from './settings-schema';

/**
 * Static description of a plugin. `name` is the stable unique id (kebab-case);
 * `version` is semver and drives install/upgrade detection. `capabilities` are
 * capability strings the plugin introduces (so RBAC can grant them). A plugin
 * that has settings declares their `settingsSchema` here.
 */
export interface PluginManifest {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  requires?: { core?: string };
  capabilities?: string[];
  settingsSchema?: SettingsSchema;
}

/**
 * A hook registrar scoped to one plugin: every listener it adds is tagged with
 * the plugin's name, so the bus can gate it by activation automatically.
 */
export interface ScopedHooks {
  addAction: HookBus['addAction'];
  addFilter: HookBus['addFilter'];
}

/**
 * Everything a plugin is handed to wire itself into the running instance.
 * `settings` reads the plugin's own persisted, schema-validated settings.
 */
export interface PluginContext {
  manifest: PluginManifest;
  hooks: ScopedHooks;
  fieldTypes: FieldTypeRegistry;
  settings: <T = Record<string, unknown>>() => T;
  logger: Logger;
}

/**
 * A plugin is a NestJS provider implementing this interface (ARCHITECTURE §4.1).
 * `register` runs once at boot for every loaded plugin — wire hooks, field
 * types and settings here. The lifecycle hooks run on state transitions and are
 * all optional; migrations belong in `onInstall`/`onUpgrade`.
 */
export interface Plugin {
  readonly manifest: PluginManifest;
  register?(ctx: PluginContext): void | Promise<void>;
  onInstall?(ctx: PluginContext): void | Promise<void>;
  onUpgrade?(ctx: PluginContext, fromVersion: string): void | Promise<void>;
  onActivate?(ctx: PluginContext): void | Promise<void>;
  onDeactivate?(ctx: PluginContext): void | Promise<void>;
  onUninstall?(ctx: PluginContext): void | Promise<void>;
}

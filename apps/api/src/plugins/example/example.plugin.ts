import { Injectable } from '@nestjs/common';
import type { FieldType } from '../../content/field-types/field-type.interface';
import { FieldValidationError } from '../../content/field-types/field-validation.error';
import { CoreActions, CoreFilters } from '../../hooks/hooks.constants';
import type { Plugin, PluginContext, PluginManifest } from '../contracts/plugin.types';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A `color` field type contributed by the plugin — proof that plugins extend
 * the content model's field kinds, not just observe it. */
const colorFieldType: FieldType<string> = {
  id: 'color',
  label: 'Color (hex)',
  validate(value, ctx) {
    if (typeof value !== 'string' || !HEX_RE.test(value.trim())) {
      throw new FieldValidationError(ctx.key, 'must be a hex color like #1a2b3c');
    }
    return value.trim().toLowerCase();
  },
};

interface ExampleSettings {
  greeting: string;
  logOnPublish: boolean;
  stampContent: boolean;
}

/**
 * A first-party demo plugin that exercises every extension point of the engine:
 * a new field type (registered on activate, removed on deactivate), an action
 * listener on `content.afterPublish`, a `content.fields` filter that stamps
 * saved entries, and a declarative settings schema. Its behaviour is fully
 * gated by activation — deactivate it and the hooks stop firing and the `color`
 * field type disappears.
 */
@Injectable()
export class ExamplePlugin implements Plugin {
  readonly manifest: PluginManifest = {
    name: 'example',
    version: '1.0.0',
    displayName: 'Example Plugin',
    description:
      'Reference plugin demonstrating field types, hooks and settings.',
    settingsSchema: [
      {
        key: 'greeting',
        type: 'text',
        label: 'Greeting',
        default: 'Hello from the example plugin',
      },
      { key: 'logOnPublish', type: 'boolean', label: 'Log on publish', default: true },
      {
        key: 'stampContent',
        type: 'boolean',
        label: 'Stamp saved entries with `processedBy`',
        default: true,
      },
    ],
  };

  register(ctx: PluginContext): void {
    // Observe publishes.
    ctx.hooks.addAction(CoreActions.ContentAfterPublish, (payload: unknown) => {
      const settings = ctx.settings<ExampleSettings>();
      if (!settings.logOnPublish) return;
      const entry = (payload as { entry?: { title?: string } }).entry;
      ctx.logger.log(`${settings.greeting} — published "${entry?.title}"`);
    });

    // Transform saved fields: stamp who processed them.
    ctx.hooks.addFilter(
      CoreFilters.ContentFields,
      (fields: Record<string, unknown>) => {
        if (!ctx.settings<ExampleSettings>().stampContent) return fields;
        return { ...fields, processedBy: this.manifest.name };
      },
    );
  }

  onActivate(ctx: PluginContext): void {
    if (!ctx.fieldTypes.has(colorFieldType.id)) {
      ctx.fieldTypes.register(colorFieldType);
    }
  }

  onDeactivate(ctx: PluginContext): void {
    ctx.fieldTypes.unregister(colorFieldType.id);
  }
}

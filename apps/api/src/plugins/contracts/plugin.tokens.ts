/**
 * DI token under which every plugin is registered as a multi-provider. A plugin
 * module contributes `{ provide: PLUGIN, useClass: MyPlugin, multi: true }`; the
 * {@link PluginManager} injects the full `Plugin[]` and drives their lifecycle.
 */
export const PLUGIN = Symbol('MK_CMS_PLUGIN');

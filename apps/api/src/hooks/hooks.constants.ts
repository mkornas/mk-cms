/**
 * The core hook catalogue — the stable extension points plugins subscribe to.
 * Actions are fire-and-observe; filters transform a value through a chain.
 * Plugins may also invent their own hook names (namespaced by convention,
 * e.g. `seo.*`); these are just the ones core itself fires.
 */
export const CoreActions = {
  /** After an entry is created or updated (payload: { entry }). */
  ContentAfterSave: 'content.afterSave',
  /** After an entry transitions to published (payload: { entry }). */
  ContentAfterPublish: 'content.afterPublish',
  /** After an entry is trashed (payload: { entry }). */
  ContentAfterTrash: 'content.afterTrash',
  /** After a plugin is activated / deactivated (payload: { name }). */
  PluginActivated: 'plugin.activated',
  PluginDeactivated: 'plugin.deactivated',
  /** After a public form submission is accepted (payload: { form, submission }). */
  FormSubmitted: 'form.submitted',
} as const;

export const CoreFilters = {
  /** Transform an entry's validated `fields` before persistence
   * (value: Record<string, unknown>, context: { typeSlug, mode }). */
  ContentFields: 'content.fields',
} as const;

export type CoreActionName = (typeof CoreActions)[keyof typeof CoreActions];
export type CoreFilterName = (typeof CoreFilters)[keyof typeof CoreFilters];

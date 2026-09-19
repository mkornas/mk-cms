/**
 * A declarative settings schema. Each field reuses a registered field-type id
 * (the same registry that powers content fields), so the admin can render a
 * plugin's settings form generically and the server validates values through
 * the shared {@link ContentFieldValidator}. `default` seeds a value when the
 * setting is absent and not required.
 */
export interface SettingsField {
  key: string;
  /** Registered field-type id (e.g. "text", "boolean", "number", "select"). */
  type: string;
  label: string;
  required?: boolean;
  config?: Record<string, unknown>;
  default?: unknown;
}

export type SettingsSchema = SettingsField[];

/**
 * A field type is the unit of extensibility for the content model. It knows how
 * to validate and normalize a raw input value for a field, given that field's
 * per-instance configuration. Core ships a dozen; plugins register more.
 *
 * Field types are pure/stateless with respect to a single value — they receive
 * everything they need through {@link FieldTypeContext}. Relational integrity
 * checks (e.g. that a related entry exists) are intentionally NOT done here;
 * they belong to the content service which has DB access. A field type only
 * validates shape/format.
 */
export interface FieldTypeContext {
  /** The field's stored key, e.g. "title". */
  key: string;
  /** Whether the field definition marks this field required. */
  required: boolean;
  /** Arbitrary per-field configuration from the field definition. */
  config: Record<string, unknown>;
}

export interface FieldType<TOut = unknown> {
  /** Stable identifier stored on field definitions, e.g. "text", "number". */
  readonly id: string;

  /** Human label for admin UIs / documentation. */
  readonly label: string;

  /**
   * Validate and normalize a raw value. Throw {@link FieldValidationError} on
   * bad input. Return the value to persist (may differ from input — trimmed,
   * coerced, etc.). Called only when a value is present (not undefined/null);
   * required/absence handling is done by the caller.
   */
  validate(value: unknown, ctx: FieldTypeContext): TOut;

  /** Value to store when the field is absent and not required. */
  defaultValue?(ctx: FieldTypeContext): TOut;
}

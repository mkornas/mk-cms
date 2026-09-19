/**
 * Thrown by a field type when a value fails validation. Carries the field key so
 * the content service can aggregate per-field errors into one response.
 */
export class FieldValidationError extends Error {
  constructor(
    public readonly fieldKey: string,
    message: string,
  ) {
    super(message);
    this.name = 'FieldValidationError';
  }
}

/** Aggregate of per-field validation failures for a single entry. */
export class ContentValidationError extends Error {
  constructor(public readonly errors: { field: string; message: string }[]) {
    super(
      `Content validation failed: ${errors
        .map((e) => `${e.field} — ${e.message}`)
        .join('; ')}`,
    );
    this.name = 'ContentValidationError';
  }
}

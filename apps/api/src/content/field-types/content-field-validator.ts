import { Injectable } from '@nestjs/common';
import { FieldTypeRegistry } from './field-type.registry';
import {
  ContentValidationError,
  FieldValidationError,
} from './field-validation.error';
import type { FieldDefinition } from '../entities/field-definition.entity';

export interface ValidateOptions {
  /**
   * Partial (PATCH) mode: only validate keys that are present in the input;
   * absent fields are left untouched rather than defaulted or required.
   */
  partial?: boolean;
}

/**
 * Validates and normalizes an entry's `fields` payload against its content
 * type's field definitions, using the field-type registry. Aggregates all
 * per-field errors into a single {@link ContentValidationError}.
 */
@Injectable()
export class ContentFieldValidator {
  constructor(private readonly registry: FieldTypeRegistry) {}

  validate(
    defs: FieldDefinition[],
    input: Record<string, unknown>,
    options: ValidateOptions = {},
  ): Record<string, unknown> {
    const errors: { field: string; message: string }[] = [];
    const out: Record<string, unknown> = {};
    const known = new Set(defs.map((d) => d.key));

    for (const key of Object.keys(input)) {
      if (!known.has(key)) {
        errors.push({ field: key, message: 'is not a defined field' });
      }
    }

    for (const def of defs) {
      const type = this.registry.get(def.type);
      if (!type) {
        errors.push({
          field: def.key,
          message: `has unknown field type "${def.type}"`,
        });
        continue;
      }
      const ctx = {
        key: def.key,
        required: def.required,
        config: def.config ?? {},
      };

      const present = Object.prototype.hasOwnProperty.call(input, def.key);
      const value = input[def.key];
      const empty =
        !present || value === undefined || value === null || value === '';

      if (empty) {
        if (options.partial) continue;
        if (def.required) {
          errors.push({ field: def.key, message: 'is required' });
          continue;
        }
        out[def.key] = type.defaultValue ? type.defaultValue(ctx) : null;
        continue;
      }

      try {
        out[def.key] = type.validate(value, ctx);
      } catch (err) {
        if (err instanceof FieldValidationError) {
          errors.push({ field: err.fieldKey, message: err.message });
        } else {
          throw err;
        }
      }
    }

    if (errors.length > 0) {
      throw new ContentValidationError(errors);
    }
    return out;
  }
}

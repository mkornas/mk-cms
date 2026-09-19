import { ContentFieldValidator } from './content-field-validator';
import { FieldTypeRegistry } from './field-type.registry';
import { CORE_FIELD_TYPES } from './core-field-types';
import { ContentValidationError } from './field-validation.error';
import type { FieldDefinition } from '../entities/field-definition.entity';

const def = (
  key: string,
  type: string,
  required = false,
  config: Record<string, unknown> = {},
): FieldDefinition => ({ key, type, required, config }) as FieldDefinition;

describe('ContentFieldValidator', () => {
  let validator: ContentFieldValidator;
  beforeEach(() => {
    const registry = new FieldTypeRegistry();
    for (const t of CORE_FIELD_TYPES) registry.register(t);
    validator = new ContentFieldValidator(registry);
  });

  it('validates and coerces present values', () => {
    const out = validator.validate(
      [def('title', 'text'), def('count', 'number')],
      { title: '  hi ', count: '3' },
    );
    expect(out).toEqual({ title: 'hi', count: 3 });
  });

  it('applies defaults for absent, non-required fields', () => {
    const out = validator.validate([def('title', 'text')], {});
    expect(out).toEqual({ title: '' });
  });

  it('throws with aggregated per-field errors', () => {
    try {
      validator.validate(
        [def('name', 'text', true), def('mail', 'email', true)],
        { mail: 'bad' },
      );
      fail('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ContentValidationError);
      const e = err as ContentValidationError;
      expect(e.errors).toEqual(
        expect.arrayContaining([
          { field: 'name', message: 'is required' },
          expect.objectContaining({ field: 'mail' }),
        ]),
      );
    }
  });

  it('rejects unknown keys', () => {
    expect(() =>
      validator.validate([def('title', 'text')], { title: 'x', bogus: 1 }),
    ).toThrow(ContentValidationError);
  });

  it('partial mode skips absent fields and does not apply defaults', () => {
    const out = validator.validate(
      [def('a', 'text'), def('b', 'text', true)],
      { a: 'x' },
      { partial: true },
    );
    expect(out).toEqual({ a: 'x' }); // b neither required-error nor defaulted
  });
});

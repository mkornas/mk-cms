import { CORE_FIELD_TYPES } from './core-field-types';
import type { FieldType, FieldTypeContext } from './field-type.interface';
import { FieldValidationError } from './field-validation.error';

const byId = new Map(CORE_FIELD_TYPES.map((t) => [t.id, t]));
const get = (id: string): FieldType => byId.get(id)!;
const ctx = (config: Record<string, unknown> = {}): FieldTypeContext => ({
  key: 'f',
  required: false,
  config,
});

describe('core field types', () => {
  it('ships the expected set', () => {
    expect([...byId.keys()].sort()).toEqual(
      [
        'boolean', 'date', 'email', 'json', 'media', 'number', 'relation',
        'richtext', 'select', 'slug', 'text', 'textarea', 'url',
      ].sort(),
    );
  });

  describe('text', () => {
    it('trims by default and enforces length', () => {
      expect(get('text').validate('  hi  ', ctx())).toBe('hi');
      expect(() => get('text').validate('ab', ctx({ minLength: 3 }))).toThrow(
        FieldValidationError,
      );
      expect(() => get('text').validate('abcd', ctx({ maxLength: 3 }))).toThrow(
        FieldValidationError,
      );
    });
    it('enforces a pattern and rejects non-strings', () => {
      expect(() =>
        get('text').validate('xx', ctx({ pattern: '^\\d+$' })),
      ).toThrow(/pattern/);
      expect(() => get('text').validate(5, ctx())).toThrow(/must be a string/);
    });
  });

  describe('number', () => {
    it('coerces numeric strings and enforces bounds/integer', () => {
      expect(get('number').validate('3', ctx())).toBe(3);
      expect(() => get('number').validate(1, ctx({ min: 2 }))).toThrow(/>= 2/);
      expect(() => get('number').validate(9, ctx({ max: 5 }))).toThrow(/<= 5/);
      expect(() => get('number').validate(1.5, ctx({ integer: true }))).toThrow(
        /integer/,
      );
      expect(() => get('number').validate('nope', ctx())).toThrow(/number/);
    });
  });

  describe('boolean', () => {
    it('accepts booleans and their string forms', () => {
      expect(get('boolean').validate(true, ctx())).toBe(true);
      expect(get('boolean').validate('false', ctx())).toBe(false);
      expect(() => get('boolean').validate('maybe', ctx())).toThrow();
    });
  });

  describe('email / url / slug', () => {
    it('validates email', () => {
      expect(get('email').validate('a@b.co', ctx())).toBe('a@b.co');
      expect(() => get('email').validate('nope', ctx())).toThrow();
    });
    it('validates http(s) url and rejects other protocols', () => {
      expect(get('url').validate('https://x.io', ctx())).toBe('https://x.io');
      expect(() => get('url').validate('ftp://x.io', ctx())).toThrow();
    });
    it('lowercases and validates slug shape', () => {
      expect(get('slug').validate('My-Slug', ctx())).toBe('my-slug');
      expect(() => get('slug').validate('bad slug', ctx())).toThrow();
    });
  });

  describe('select', () => {
    const opts = { options: ['a', 'b'] };
    it('accepts an allowed option and rejects others', () => {
      expect(get('select').validate('a', ctx(opts))).toBe('a');
      expect(() => get('select').validate('c', ctx(opts))).toThrow(/allowed/);
    });
    it('supports multiple', () => {
      expect(
        get('select').validate(['a', 'b'], ctx({ ...opts, multiple: true })),
      ).toEqual(['a', 'b']);
      expect(() =>
        get('select').validate('a', ctx({ ...opts, multiple: true })),
      ).toThrow(/array/);
    });
  });

  describe('relation', () => {
    const uuid = '11111111-1111-1111-1111-111111111111';
    it('validates uuids, single and multiple', () => {
      expect(get('relation').validate(uuid, ctx())).toBe(uuid);
      expect(get('relation').validate([uuid], ctx({ multiple: true }))).toEqual([
        uuid,
      ]);
      expect(() => get('relation').validate('not-a-uuid', ctx())).toThrow();
    });
  });

  describe('media', () => {
    const uuid = '22222222-2222-2222-2222-222222222222';
    it('validates media ids, single and multiple', () => {
      expect(get('media').validate(uuid, ctx())).toBe(uuid);
      expect(get('media').validate([uuid], ctx({ multiple: true }))).toEqual([uuid]);
      expect(() => get('media').validate('nope', ctx())).toThrow();
    });
  });

  describe('date / json', () => {
    it('normalizes a date to ISO', () => {
      expect(get('date').validate('2021-05-04T00:00:00Z', ctx())).toBe(
        '2021-05-04T00:00:00.000Z',
      );
      expect(() => get('date').validate('not-a-date', ctx())).toThrow();
    });
    it('passes through JSON-serializable values', () => {
      expect(get('json').validate({ a: 1 }, ctx())).toEqual({ a: 1 });
    });
  });
});

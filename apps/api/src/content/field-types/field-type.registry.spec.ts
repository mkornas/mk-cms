import { FieldTypeRegistry } from './field-type.registry';
import type { FieldType } from './field-type.interface';

const stub = (id: string): FieldType => ({
  id,
  label: id,
  validate: (v) => v,
});

describe('FieldTypeRegistry', () => {
  let registry: FieldTypeRegistry;
  beforeEach(() => {
    registry = new FieldTypeRegistry();
  });

  it('registers and looks up a field type', () => {
    registry.register(stub('text'));
    expect(registry.has('text')).toBe(true);
    expect(registry.get('text')?.id).toBe('text');
    expect(registry.ids()).toEqual(['text']);
  });

  it('throws on a duplicate registration', () => {
    registry.register(stub('text'));
    expect(() => registry.register(stub('text'))).toThrow(/already registered/);
  });

  it('require() throws for an unknown id', () => {
    expect(() => registry.require('nope')).toThrow(/Unknown field type/);
  });

  it('unregister() removes a type (used on plugin deactivation)', () => {
    registry.register(stub('color'));
    registry.unregister('color');
    expect(registry.has('color')).toBe(false);
    // unregistering a missing id is a no-op
    expect(() => registry.unregister('color')).not.toThrow();
  });
});

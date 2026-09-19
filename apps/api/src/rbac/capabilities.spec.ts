import {
  ALL_CAPABILITIES,
  can,
  CAP_ALL,
  SYSTEM_ROLES,
} from './capabilities';

describe('can()', () => {
  it('grants an exact capability match', () => {
    expect(can(['content:read'], 'content:read')).toBe(true);
  });

  it('denies when the capability is absent', () => {
    expect(can(['content:read'], 'content:update')).toBe(false);
    expect(can([], 'content:read')).toBe(false);
  });

  it('honours a resource wildcard', () => {
    expect(can(['content:*'], 'content:publish')).toBe(true);
    expect(can(['content:*'], 'media:upload')).toBe(false);
  });

  it('honours the super wildcard', () => {
    expect(can([CAP_ALL], 'anything:at:all')).toBe(true);
  });
});

describe('capability catalogue', () => {
  it('exposes a flat list of concrete capabilities with no wildcards', () => {
    expect(ALL_CAPABILITIES.length).toBeGreaterThan(0);
    expect(ALL_CAPABILITIES.every((c) => !c.includes('*'))).toBe(true);
    // representative members are present
    expect(ALL_CAPABILITIES).toEqual(
      expect.arrayContaining(['content:read', 'form:manage', 'webhook:manage']),
    );
  });

  it('gives owner the super wildcard and the others concrete/scoped sets', () => {
    const owner = SYSTEM_ROLES.find((r) => r.slug === 'owner');
    expect(owner?.capabilities).toEqual([CAP_ALL]);
    const viewer = SYSTEM_ROLES.find((r) => r.slug === 'viewer');
    expect(can(viewer!.capabilities, 'content:read')).toBe(true);
    expect(can(viewer!.capabilities, 'content:delete')).toBe(false);
  });
});

import { HookBus } from './hook-bus.service';

describe('HookBus', () => {
  let bus: HookBus;
  beforeEach(() => {
    bus = new HookBus();
  });

  describe('actions', () => {
    it('runs listeners in ascending priority order', async () => {
      const calls: string[] = [];
      bus.addAction('e', () => void calls.push('b'), { priority: 20 });
      bus.addAction('e', () => void calls.push('a'), { priority: 5 });
      bus.addAction('e', () => void calls.push('c'), { priority: 50 });
      await bus.doAction('e', null);
      expect(calls).toEqual(['a', 'b', 'c']);
    });

    it('awaits async listeners and passes the payload', async () => {
      const seen: unknown[] = [];
      bus.addAction<{ n: number }>('e', async (p) => {
        await Promise.resolve();
        seen.push(p.n);
      });
      await bus.doAction('e', { n: 42 });
      expect(seen).toEqual([42]);
    });

    it('swallows a throwing action listener and still runs the rest', async () => {
      const calls: string[] = [];
      bus.addAction('e', () => {
        throw new Error('boom');
      });
      bus.addAction('e', () => void calls.push('ok'));
      await expect(bus.doAction('e', null)).resolves.toBeUndefined();
      expect(calls).toEqual(['ok']);
    });

    it('is a no-op for a hook with no listeners', async () => {
      await expect(bus.doAction('nobody', null)).resolves.toBeUndefined();
    });
  });

  describe('filters', () => {
    it('threads the value through the chain in priority order', async () => {
      bus.addFilter<number>('f', (v) => v + 1, { priority: 10 });
      bus.addFilter<number>('f', (v) => v * 2, { priority: 20 });
      expect(await bus.applyFilters('f', 1, {})).toBe(4); // (1+1)*2
    });

    it('returns the input unchanged when no filter is registered', async () => {
      expect(await bus.applyFilters('f', 'x', {})).toBe('x');
    });

    it('propagates a throwing filter (it may enforce an invariant)', async () => {
      bus.addFilter('f', () => {
        throw new Error('bad');
      });
      await expect(bus.applyFilters('f', 1, {})).rejects.toThrow('bad');
    });
  });

  describe('plugin activation gating', () => {
    it('skips listeners of inactive plugins', async () => {
      const calls: string[] = [];
      bus.addAction('e', () => void calls.push('core'));
      bus.addAction('e', () => void calls.push('p1'), { plugin: 'p1' });
      bus.addAction('e', () => void calls.push('p2'), { plugin: 'p2' });
      bus.setActivePlugins(new Set(['p1']));
      await bus.doAction('e', null);
      expect(calls).toEqual(['core', 'p1']); // core always runs, p2 gated
    });

    it('gates plugin filters too', async () => {
      bus.addFilter<number>('f', (v) => v + 100, { plugin: 'off' });
      bus.setActivePlugins(new Set());
      expect(await bus.applyFilters('f', 1, {})).toBe(1);
    });

    it('runs everything before any activation state is set', async () => {
      const calls: string[] = [];
      bus.addAction('e', () => void calls.push('p'), { plugin: 'p' });
      await bus.doAction('e', null);
      expect(calls).toEqual(['p']);
    });
  });
});

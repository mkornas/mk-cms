import { Injectable, Logger } from '@nestjs/common';

export type ActionHandler<T = unknown> = (payload: T) => void | Promise<void>;
export type FilterHandler<T = unknown, C = unknown> = (
  value: T,
  context: C,
) => T | Promise<T>;

export interface HookOptions {
  /** Lower runs first. Default 10 (WordPress convention). */
  priority?: number;
  /** Owning plugin name; listeners of an inactive plugin are skipped. Core
   * listeners omit this and always run. */
  plugin?: string;
}

interface Registration {
  handler: (...args: unknown[]) => unknown;
  priority: number;
  plugin?: string;
}

/**
 * The typed hook bus — the primary decoupling mechanism (ARCHITECTURE §4.3).
 *
 * - **Actions** (`doAction`) fan out to every listener for observation.
 * - **Filters** (`applyFilters`) thread a value through a chain, each listener
 *   returning the next value.
 *
 * Listeners run in ascending `priority`. Every listener may declare an owning
 * plugin; when a plugin is deactivated the manager updates the active set here
 * and that plugin's listeners are silently skipped — so activation gates
 * behaviour without re-wiring. A throwing action listener is logged and
 * swallowed (one plugin can't break a save); a throwing filter propagates,
 * since it may be enforcing an invariant on the value.
 */
@Injectable()
export class HookBus {
  private readonly logger = new Logger(HookBus.name);
  private readonly actions = new Map<string, Registration[]>();
  private readonly filters = new Map<string, Registration[]>();

  /** Names of currently-active plugins. `null` = no gating (used in tests /
   * before the manager has loaded state). */
  private activePlugins: Set<string> | null = null;

  /** Called by the plugin manager whenever activation state changes. */
  setActivePlugins(active: Set<string>): void {
    this.activePlugins = active;
  }

  private isActive(plugin?: string): boolean {
    if (!plugin) return true; // core listener
    if (this.activePlugins === null) return true;
    return this.activePlugins.has(plugin);
  }

  private insert(
    map: Map<string, Registration[]>,
    hook: string,
    reg: Registration,
  ): void {
    const list = map.get(hook) ?? [];
    list.push(reg);
    list.sort((a, b) => a.priority - b.priority);
    map.set(hook, list);
  }

  addAction<T>(
    hook: string,
    handler: ActionHandler<T>,
    opts: HookOptions = {},
  ): void {
    this.insert(this.actions, hook, {
      handler: handler as Registration['handler'],
      priority: opts.priority ?? 10,
      plugin: opts.plugin,
    });
  }

  addFilter<T, C = unknown>(
    hook: string,
    handler: FilterHandler<T, C>,
    opts: HookOptions = {},
  ): void {
    this.insert(this.filters, hook, {
      handler: handler as Registration['handler'],
      priority: opts.priority ?? 10,
      plugin: opts.plugin,
    });
  }

  /** Fire an action: await every active listener in priority order. */
  async doAction<T>(hook: string, payload: T): Promise<void> {
    const regs = this.actions.get(hook);
    if (!regs) return;
    for (const reg of regs) {
      if (!this.isActive(reg.plugin)) continue;
      try {
        await reg.handler(payload);
      } catch (err) {
        this.logger.error(
          `Action "${hook}" listener${
            reg.plugin ? ` (plugin ${reg.plugin})` : ''
          } failed: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Thread a value through every active filter, in priority order. */
  async applyFilters<T, C = unknown>(
    hook: string,
    value: T,
    context: C,
  ): Promise<T> {
    const regs = this.filters.get(hook);
    if (!regs) return value;
    let acc = value;
    for (const reg of regs) {
      if (!this.isActive(reg.plugin)) continue;
      acc = (await reg.handler(acc, context)) as T;
    }
    return acc;
  }

  /** Introspection: how many listeners a hook has (for admin/debug). */
  countListeners(hook: string): number {
    return (this.actions.get(hook)?.length ?? 0) +
      (this.filters.get(hook)?.length ?? 0);
  }
}

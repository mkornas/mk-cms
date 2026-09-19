import { Global, Module } from '@nestjs/common';
import { HookBus } from './hook-bus.service';

/**
 * The hook bus lives in its own global module so both the content engine (which
 * *fires* core hooks) and the plugin engine (whose plugins *subscribe*) can
 * depend on it without importing each other — breaking what would otherwise be
 * a circular module dependency.
 */
@Global()
@Module({
  providers: [HookBus],
  exports: [HookBus],
})
export class HooksModule {}

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginRecord } from './entities/plugin.entity';
import { PluginManager } from './plugin-manager.service';
import { PLUGIN } from './contracts/plugin.tokens';
import type { Plugin } from './contracts/plugin.types';
import { ExamplePlugin } from './example/example.plugin';

/**
 * The plugin engine. Global so the {@link PluginManager} and hook-wired
 * behaviour are available instance-wide. First-party plugins are registered
 * here as {@link PLUGIN} multi-providers; a real deployment would load these
 * from `packages/plugins/*`. The example plugin ships enabled-off and is
 * activated through the admin API.
 *
 * NestJS has no Angular-style `multi` providers, so the full plugin set is
 * assembled by a factory that injects each first-party plugin and hands the
 * {@link PluginManager} the resulting `Plugin[]`. Adding a plugin = provide its
 * class and list it in the factory's `inject`.
 */
const FIRST_PARTY_PLUGINS = [ExamplePlugin];

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PluginRecord])],
  providers: [
    PluginManager,
    ...FIRST_PARTY_PLUGINS,
    {
      provide: PLUGIN,
      useFactory: (...plugins: Plugin[]) => plugins,
      inject: FIRST_PARTY_PLUGINS,
    },
  ],
  exports: [PluginManager],
})
export class PluginsModule {}

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PluginManager, PluginView } from '../../plugins/plugin-manager.service';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { GraphQLJSON } from '../models/scalars';
import { PluginModel } from '../models/plugin.model';

function toModel(view: PluginView): PluginModel {
  return {
    name: view.name,
    version: view.version,
    displayName: view.displayName,
    description: view.description,
    enabled: view.enabled,
    capabilities: view.capabilities,
    settingsSchema: view.settingsSchema.map((f) => ({
      key: f.key,
      type: f.type,
      label: f.label,
      required: f.required ?? false,
      config: f.config ?? {},
      default: f.default,
    })),
    settings: view.settings,
  };
}

/** Plugin management surface — everything gated by `plugin:manage`. */
@Resolver(() => PluginModel)
export class PluginResolver {
  constructor(private readonly manager: PluginManager) {}

  @Query(() => [PluginModel])
  @RequireCapability(Capabilities.Plugin.Manage)
  plugins(): PluginModel[] {
    return this.manager.list().map(toModel);
  }

  @Mutation(() => PluginModel)
  @RequireCapability(Capabilities.Plugin.Manage)
  async activatePlugin(@Args('name') name: string): Promise<PluginModel> {
    return toModel(await this.manager.activate(name));
  }

  @Mutation(() => PluginModel)
  @RequireCapability(Capabilities.Plugin.Manage)
  async deactivatePlugin(@Args('name') name: string): Promise<PluginModel> {
    return toModel(await this.manager.deactivate(name));
  }

  @Mutation(() => PluginModel)
  @RequireCapability(Capabilities.Plugin.Manage)
  async updatePluginSettings(
    @Args('name') name: string,
    @Args('settings', { type: () => GraphQLJSON })
    settings: Record<string, unknown>,
  ): Promise<PluginModel> {
    return toModel(await this.manager.updateSettings(name, settings));
  }
}

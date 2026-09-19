import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { WpImporterService } from '../../importer/wp-importer.service';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { ImportResultModel } from '../models/import.model';

/**
 * WordPress import. Gated by `settings:manage` because it creates content types
 * and taxonomies. The WXR is passed as a string; large exports can also be
 * chunked by the client per post type.
 */
@Resolver()
export class ImportResolver {
  constructor(private readonly importer: WpImporterService) {}

  @Mutation(() => ImportResultModel)
  @RequireCapability(Capabilities.Settings.Manage)
  importWordpress(
    @Args('xml') xml: string,
    @Args('importMedia', { nullable: true }) importMedia?: boolean,
  ): Promise<ImportResultModel> {
    return this.importer.import(xml, { importMedia });
  }
}

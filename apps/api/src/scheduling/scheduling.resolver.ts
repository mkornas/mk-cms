import {
  Args,
  GraphQLISODateTime,
  ID,
  Mutation,
  Resolver,
} from '@nestjs/graphql';
import { SchedulingService } from './scheduling.service';
import { ContentTypesService } from '../content/content-types.service';
import type { ContentEntry } from '../content/entities/content-entry.entity';
import { EntryModel } from '../api/models/content.model';
import { toEntryModel } from '../api/models/mappers';
import { RequireCapability } from '../rbac/require-capability.decorator';
import { Capabilities } from '../rbac/capabilities';

/**
 * Admin mutations for scheduled publishing. Guarded by the same capability as
 * `publishEntry`, since scheduling is a deferred publish. Results are projected
 * with the shared {@link toEntryModel} mapper (type slug resolved per call).
 */
@Resolver(() => EntryModel)
export class SchedulingResolver {
  constructor(
    private readonly scheduling: SchedulingService,
    private readonly types: ContentTypesService,
  ) {}

  private async toModel(entry: ContentEntry): Promise<EntryModel> {
    const type = await this.types.getById(entry.contentTypeId);
    return toEntryModel(entry, type.slug);
  }

  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Publish)
  async scheduleEntry(
    @Args('id', { type: () => ID }) id: string,
    @Args('publishAt', { type: () => GraphQLISODateTime }) publishAt: Date,
  ): Promise<EntryModel> {
    return this.toModel(await this.scheduling.schedule(id, publishAt));
  }

  @Mutation(() => EntryModel)
  @RequireCapability(Capabilities.Content.Publish)
  async unscheduleEntry(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<EntryModel> {
    return this.toModel(await this.scheduling.unschedule(id));
  }
}

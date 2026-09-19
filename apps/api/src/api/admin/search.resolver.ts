import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { SearchService } from '../../search/search.service';
import type { SearchHit } from '../../search/search.types';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { SearchHitModel } from '../models/search.model';
import { toEntryModel } from '../models/mappers';

export function toSearchHitModel(hit: SearchHit): SearchHitModel {
  return {
    entry: toEntryModel(hit.entry, hit.typeSlug),
    rank: hit.rank,
    snippet: hit.snippet,
  };
}

/** Admin search — spans drafts/scheduled as well as published (`content:read`). */
@Resolver(() => SearchHitModel)
export class SearchResolver {
  constructor(private readonly search: SearchService) {}

  @Query(() => [SearchHitModel])
  @RequireCapability(Capabilities.Content.Read)
  async searchContent(
    @Args('query') query: string,
    @Args('type', { nullable: true }) type?: string,
    @Args('locale', { nullable: true }) locale?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<SearchHitModel[]> {
    const hits = await this.search.search(query, {
      type,
      locale,
      limit,
      offset,
      includeUnpublished: true,
    });
    return hits.map(toSearchHitModel);
  }
}

import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TaxonomyService } from '../../taxonomy/taxonomy.service';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { TaxonomyModel, TermModel } from '../models/taxonomy.model';
import { toTaxonomyModel, toTermModel } from '../models/mappers';
import { CreateTaxonomyInput, CreateTermInput } from './admin.inputs';

/** Taxonomy + term management and entry↔term linking (`taxonomy:manage`). */
@Resolver(() => TaxonomyModel)
export class TaxonomyResolver {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Query(() => [TaxonomyModel])
  @RequireCapability(Capabilities.Content.Read)
  async taxonomies(): Promise<TaxonomyModel[]> {
    return (await this.taxonomy.listTaxonomies()).map(toTaxonomyModel);
  }

  @Query(() => [TermModel])
  @RequireCapability(Capabilities.Content.Read)
  async terms(@Args('taxonomy') taxonomy: string): Promise<TermModel[]> {
    const terms = (await this.taxonomy.listTerms(taxonomy)).map(toTermModel);
    const counts = await this.taxonomy.countsForTerms(terms.map((t) => t.id));
    for (const term of terms) term.entryCount = counts.get(term.id) ?? 0;
    return terms;
  }

  @Query(() => [TermModel])
  @RequireCapability(Capabilities.Content.Read)
  async entryTerms(
    @Args('entryId', { type: () => ID }) entryId: string,
  ): Promise<TermModel[]> {
    return (await this.taxonomy.getEntryTerms(entryId)).map(toTermModel);
  }

  @Mutation(() => TaxonomyModel)
  @RequireCapability(Capabilities.Taxonomy.Manage)
  async createTaxonomy(
    @Args('input') input: CreateTaxonomyInput,
  ): Promise<TaxonomyModel> {
    return toTaxonomyModel(await this.taxonomy.createTaxonomy(input));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Taxonomy.Manage)
  async deleteTaxonomy(@Args('slug') slug: string): Promise<boolean> {
    await this.taxonomy.deleteTaxonomy(slug);
    return true;
  }

  @Mutation(() => TermModel)
  @RequireCapability(Capabilities.Taxonomy.Manage)
  async createTerm(
    @Args('taxonomy') taxonomy: string,
    @Args('input') input: CreateTermInput,
  ): Promise<TermModel> {
    return toTermModel(await this.taxonomy.createTerm(taxonomy, input));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Taxonomy.Manage)
  async deleteTerm(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.taxonomy.deleteTerm(id);
    return true;
  }

  /** Replace the full set of terms attached to an entry. */
  @Mutation(() => [TermModel])
  @RequireCapability(Capabilities.Taxonomy.Manage)
  async setEntryTerms(
    @Args('entryId', { type: () => ID }) entryId: string,
    @Args('termIds', { type: () => [ID] }) termIds: string[],
  ): Promise<TermModel[]> {
    return (await this.taxonomy.setEntryTerms(entryId, termIds)).map(
      toTermModel,
    );
  }
}

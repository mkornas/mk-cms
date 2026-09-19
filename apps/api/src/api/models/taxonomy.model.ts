import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from './scalars';

/** A classification scheme (categories, tags, or a custom one). */
@ObjectType('Taxonomy')
export class TaxonomyModel {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field(() => GraphQLJSON)
  config!: Record<string, unknown>;

  @Field()
  isCore!: boolean;
}

/** A single term within a taxonomy (e.g. the "News" category). */
@ObjectType('Term')
export class TermModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  taxonomyId!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => ID, { nullable: true })
  parentId!: string | null;

  /** How many content entries are assigned this term (tenant-scoped). */
  @Field(() => Int)
  entryCount!: number;
}

import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from './scalars';

/** The resolved SEO a frontend renders for an entry (overrides merged with site
 * defaults and derived values). */
@ObjectType('SeoMeta')
export class SeoMetaModel {
  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String, { nullable: true })
  canonical!: string | null;

  @Field(() => String, { nullable: true })
  ogTitle!: string | null;

  @Field(() => String, { nullable: true })
  ogDescription!: string | null;

  @Field(() => String, { nullable: true })
  ogImage!: string | null;

  @Field()
  noindex!: boolean;

  @Field(() => GraphQLJSON)
  jsonLd!: Record<string, unknown>;
}

/** Per-site SEO configuration. */
@ObjectType('SeoSettings')
export class SeoSettingsModel {
  @Field(() => String, { nullable: true })
  baseUrl!: string | null;

  @Field(() => String, { nullable: true })
  titleTemplate!: string | null;

  @Field(() => String, { nullable: true })
  defaultDescription!: string | null;

  @Field(() => [String])
  robotsDisallow!: string[];

  @Field()
  noindexSite!: boolean;
}

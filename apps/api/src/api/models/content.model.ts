import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { GraphQLJSON } from './scalars';
import { ContentStatus } from '../../content/entities/content-entry.entity';

registerEnumType(ContentStatus, { name: 'ContentStatus' });

/** One field on a content type — how clients discover a type's shape. */
@ObjectType('FieldDefinition')
export class FieldDefinitionModel {
  @Field(() => ID)
  id!: string;

  @Field()
  key!: string;

  @Field()
  name!: string;

  @Field()
  type!: string;

  @Field()
  required!: boolean;

  @Field(() => GraphQLJSON)
  config!: Record<string, unknown>;

  @Field(() => Int)
  sortOrder!: number;
}

/** A data-defined content schema (WordPress "post type" analogue). */
@ObjectType('ContentType')
export class ContentTypeModel {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => GraphQLJSON)
  config!: Record<string, unknown>;

  @Field()
  isCore!: boolean;

  /** Populated by the type resolver; absent on list projections. */
  @Field(() => [FieldDefinitionModel], { nullable: true })
  fields?: FieldDefinitionModel[];
}

/** A field type the instance supports (core or plugin-registered). */
@ObjectType('FieldTypeInfo')
export class FieldTypeInfoModel {
  @Field()
  id!: string;

  @Field()
  label!: string;
}

/** A single piece of content. `type` is the content-type slug; `fields` holds
 * the type-specific values as JSON. `author` and `terms` are batch-resolved. */
@ObjectType('Entry')
export class EntryModel {
  @Field(() => ID)
  id!: string;

  /** Content-type slug, e.g. "post". */
  @Field()
  type!: string;

  @Field(() => String, { nullable: true })
  slug!: string | null;

  @Field()
  title!: string;

  @Field(() => ContentStatus)
  status!: ContentStatus;

  @Field()
  locale!: string;

  @Field(() => ID, { nullable: true })
  parentId!: string | null;

  @Field(() => ID, { nullable: true })
  translationGroupId!: string | null;

  @Field(() => GraphQLJSON)
  fields!: Record<string, unknown>;

  @Field(() => GraphQLISODateTime, { nullable: true })
  publishedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  /** Carried for field resolvers (author/terms); not exposed directly. */
  authorId!: string | null;
}

/** An immutable snapshot from an entry's history. */
@ObjectType('Revision')
export class RevisionModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  authorId!: string | null;

  @Field(() => GraphQLJSON)
  data!: Record<string, unknown>;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from './scalars';

/** A responsive rendition of an image. */
@ObjectType('MediaVariant')
export class MediaVariantModel {
  @Field()
  key!: string;

  @Field()
  url!: string;

  @Field()
  format!: string;

  @Field(() => Int)
  width!: number;

  @Field(() => Int)
  height!: number;

  @Field(() => Int)
  size!: number;
}

/** A media-library item. */
@ObjectType('Media')
export class MediaModel {
  @Field(() => ID)
  id!: string;

  @Field()
  filename!: string;

  @Field()
  url!: string;

  @Field()
  mime!: string;

  @Field(() => Int)
  size!: number;

  @Field(() => Int, { nullable: true })
  width!: number | null;

  @Field(() => Int, { nullable: true })
  height!: number | null;

  @Field(() => String, { nullable: true })
  alt!: string | null;

  @Field(() => String, { nullable: true })
  title!: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  focalPoint!: Record<string, unknown> | null;

  @Field(() => [MediaVariantModel])
  variants!: MediaVariantModel[];

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

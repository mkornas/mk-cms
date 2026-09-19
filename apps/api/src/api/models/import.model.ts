import { Field, Int, ObjectType } from '@nestjs/graphql';

/** Summary of a WordPress WXR import. */
@ObjectType('ImportResult')
export class ImportResultModel {
  @Field()
  siteTitle!: string;

  @Field(() => [String])
  contentTypesEnsured!: string[];

  @Field(() => [String])
  taxonomiesEnsured!: string[];

  @Field(() => Int)
  termsCreated!: number;

  @Field(() => Int)
  entriesImported!: number;

  @Field(() => Int)
  entriesSkipped!: number;

  @Field(() => Int)
  mediaImported!: number;

  @Field(() => Int)
  mediaFailed!: number;

  @Field(() => [String])
  warnings!: string[];
}

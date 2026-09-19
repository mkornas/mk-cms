import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from './scalars';

/** A field on a form (data-defined; `type` is a registered field type). */
@ObjectType('FormField')
export class FormFieldModel {
  @Field()
  key!: string;

  @Field()
  type!: string;

  @Field()
  label!: string;

  @Field()
  required!: boolean;

  @Field(() => GraphQLJSON)
  config!: Record<string, unknown>;
}

/** A form definition (admin view — settings include notify addresses). */
@ObjectType('Form')
export class FormModel {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field(() => [FormFieldModel])
  fields!: FormFieldModel[];

  @Field(() => GraphQLJSON)
  settings!: Record<string, unknown>;

  @Field()
  enabled!: boolean;
}

/** One stored submission. */
@ObjectType('FormSubmission')
export class FormSubmissionModel {
  @Field(() => ID)
  id!: string;

  @Field(() => GraphQLJSON)
  data!: Record<string, unknown>;

  @Field(() => GraphQLJSON)
  meta!: Record<string, unknown>;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

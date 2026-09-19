import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from './scalars';

/** One entry in the audit trail. */
@ObjectType('AuditEntry')
export class AuditEntryModel {
  @Field(() => ID)
  id!: string;

  @Field()
  action!: string;

  @Field(() => ID, { nullable: true })
  actorId!: string | null;

  @Field(() => String, { nullable: true })
  actorEmail!: string | null;

  @Field(() => String, { nullable: true })
  targetType!: string | null;

  @Field(() => ID, { nullable: true })
  targetId!: string | null;

  @Field()
  summary!: string;

  @Field(() => GraphQLJSON)
  meta!: Record<string, unknown>;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

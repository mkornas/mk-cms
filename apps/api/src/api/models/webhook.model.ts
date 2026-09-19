import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

/** An outbound webhook configuration. */
@ObjectType('Webhook')
export class WebhookModel {
  @Field(() => ID)
  id!: string;

  @Field()
  url!: string;

  @Field(() => [String])
  events!: string[];

  @Field()
  enabled!: boolean;

  @Field(() => String, { nullable: true })
  description!: string | null;

  /** The signing secret — shown so the receiver can be configured to verify. */
  @Field()
  secret!: string;
}

/** One recorded delivery attempt. */
@ObjectType('WebhookDelivery')
export class WebhookDeliveryModel {
  @Field(() => ID)
  id!: string;

  @Field()
  event!: string;

  @Field()
  success!: boolean;

  @Field(() => Int, { nullable: true })
  statusCode!: number | null;

  @Field(() => Int)
  attempt!: number;

  @Field(() => String, { nullable: true })
  error!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

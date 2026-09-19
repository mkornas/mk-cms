import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/** A redirect rule as managed on the admin surface. */
@ObjectType('Redirect')
export class RedirectModel {
  @Field(() => ID)
  id!: string;

  @Field()
  fromPath!: string;

  @Field()
  toPath!: string;

  @Field(() => Int)
  statusCode!: number;

  @Field()
  enabled!: boolean;

  @Field(() => Int)
  hits!: number;
}

/** The minimal shape a public frontend needs to perform the redirect. */
@ObjectType('RedirectMatch')
export class RedirectMatchModel {
  @Field()
  to!: string;

  @Field(() => Int)
  statusCode!: number;
}

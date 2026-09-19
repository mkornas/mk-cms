import { Field, Int, ObjectType } from '@nestjs/graphql';

/** JWT pair returned by `login` / `refresh`. Mirrors the REST auth surface. */
@ObjectType('AuthTokens')
export class AuthTokensModel {
  @Field()
  accessToken!: string;

  @Field()
  refreshToken!: string;

  @Field()
  tokenType!: string;

  @Field(() => Int)
  expiresIn!: number;
}

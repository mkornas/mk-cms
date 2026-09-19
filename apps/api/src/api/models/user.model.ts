import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserStatus } from '../../users/entities/user.entity';

registerEnumType(UserStatus, { name: 'UserStatus' });

/** Public projection of a {@link User} — never exposes the password hash. */
@ObjectType('User')
export class UserModel {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;

  @Field(() => UserStatus)
  status!: UserStatus;

  @Field()
  isSuperAdmin!: boolean;
}

/** The public-safe author projection exposed by the Delivery API — no email,
 * status or privilege flags ever cross the public surface. */
@ObjectType('PublicAuthor')
export class PublicAuthorModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;
}

/** One of the sites the authenticated user can act on, with their role there. */
@ObjectType('SiteMembership')
export class SiteMembershipModel {
  @Field(() => ID)
  siteId!: string;

  @Field(() => String, { nullable: true })
  siteSlug!: string | null;

  @Field(() => String, { nullable: true })
  siteName!: string | null;

  @Field(() => String, { nullable: true })
  role!: string | null;
}

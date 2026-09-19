import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { SiteStatus } from '../../tenancy/entities/site.entity';

registerEnumType(SiteStatus, { name: 'SiteStatus' });

/** A site/tenant hosted by this instance. */
@ObjectType('Site')
export class SiteModel {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field(() => [String])
  domains!: string[];

  @Field(() => SiteStatus)
  status!: SiteStatus;
}

/** A global system role (owner/admin/editor/viewer). */
@ObjectType('RoleInfo')
export class RoleModel {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field(() => [String])
  capabilities!: string[];
}

/** A user's membership on a site, with their identity + role. */
@ObjectType('SiteMember')
export class SiteMemberModel {
  @Field(() => ID)
  membershipId!: string;

  @Field(() => ID)
  userId!: string;

  @Field()
  email!: string;

  @Field()
  name!: string;

  @Field(() => ID)
  roleId!: string;

  @Field()
  roleSlug!: string;

  @Field()
  roleName!: string;
}

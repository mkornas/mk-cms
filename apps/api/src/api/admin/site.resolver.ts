import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { SitesService } from '../../tenancy/sites.service';
import { MembershipsService } from '../../rbac/memberships.service';
import { RolesService } from '../../rbac/roles.service';
import { UsersService } from '../../users/users.service';
import { SiteStatus, Site } from '../../tenancy/entities/site.entity';
import { SiteMembership } from '../../rbac/entities/site-membership.entity';
import { Role } from '../../rbac/entities/role.entity';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities, can } from '../../rbac/capabilities';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { User } from '../../users/entities/user.entity';
import { SiteModel, SiteMemberModel, RoleModel } from '../models/site.model';

@InputType()
export class CreateSiteInput {
  @Field()
  @IsString()
  slug!: string;

  @Field()
  @IsString()
  name!: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  domains?: string[];

  @Field(() => SiteStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SiteStatus)
  status?: SiteStatus;
}

@InputType()
export class UpdateSiteInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  domains?: string[];

  @Field(() => SiteStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SiteStatus)
  status?: SiteStatus;
}

function toSite(s: Site): SiteModel {
  return { id: s.id, slug: s.slug, name: s.name, domains: s.domains, status: s.status };
}
function toRole(r: Role): RoleModel {
  return { id: r.id, slug: r.slug, name: r.name, capabilities: r.capabilities ?? [] };
}
function toMember(m: SiteMembership): SiteMemberModel {
  return {
    membershipId: m.id,
    userId: m.userId,
    email: m.user?.email ?? '',
    name: m.user?.name ?? '',
    roleId: m.roleId,
    roleSlug: m.role?.slug ?? '',
    roleName: m.role?.name ?? '',
  };
}

/**
 * Site (tenant) management + memberships. Sites and memberships are global
 * resources addressed by an arbitrary id, so the {@link RequireCapability}
 * guard (which only checks the caller's *active* site) is not sufficient on its
 * own: every operation additionally authorizes against the **target** site via
 * {@link assertManages}, preventing a per-site owner/admin from reaching into
 * another tenant. Super-admins bypass.
 */
@Resolver(() => SiteModel)
export class SiteResolver {
  constructor(
    private readonly sitesService: SitesService,
    private readonly memberships: MembershipsService,
    private readonly rolesService: RolesService,
    private readonly users: UsersService,
  ) {}

  /** Throw unless `user` may manage `siteId` (super-admin or `site:manage` on
   *  that specific site — not merely their active site). */
  private async assertManages(user: User, siteId: string): Promise<void> {
    if (user.isSuperAdmin) return;
    const caps = await this.memberships.capabilitiesFor(user.id, siteId);
    if (!can(caps, Capabilities.Site.Manage)) {
      throw new ForbiddenException('You do not manage that site.');
    }
  }

  /** Resolve a membership id → its site, authorizing the caller for it. */
  private async assertManagesMembership(
    user: User,
    membershipId: string,
  ): Promise<SiteMembership> {
    const membership = await this.memberships.findById(membershipId);
    if (!membership) throw new NotFoundException('Membership not found.');
    await this.assertManages(user, membership.siteId);
    return membership;
  }

  @Query(() => [SiteModel])
  @RequireCapability(Capabilities.Site.Manage)
  async sites(@CurrentUser() user: User): Promise<SiteModel[]> {
    // Super-admins see every tenant; everyone else only the sites they belong to.
    const sites = user.isSuperAdmin
      ? await this.sitesService.list()
      : (await this.memberships.listForUser(user.id))
          .map((m) => m.site)
          .filter((s): s is Site => !!s);
    return sites.map(toSite);
  }

  @Query(() => [SiteMemberModel])
  @RequireCapability(Capabilities.Site.Manage)
  async siteMembers(
    @Args('siteId', { type: () => ID }) siteId: string,
    @CurrentUser() user: User,
  ): Promise<SiteMemberModel[]> {
    await this.assertManages(user, siteId);
    return (await this.memberships.listForSite(siteId)).map(toMember);
  }

  @Query(() => [RoleModel])
  @RequireCapability(Capabilities.Site.Manage)
  async roles(): Promise<RoleModel[]> {
    return (await this.rolesService.listSystemRoles()).map(toRole);
  }

  @Mutation(() => SiteModel)
  @RequireCapability(Capabilities.Site.Manage)
  async createSite(
    @Args('input') input: CreateSiteInput,
    @CurrentUser() user: User,
  ): Promise<SiteModel> {
    if (await this.sitesService.findBySlug(input.slug)) {
      throw new BadRequestException(`A site with slug "${input.slug}" already exists.`);
    }
    const site = await this.sitesService.create(input);
    // Give the creator owner access so the new site is immediately usable.
    const owner = await this.rolesService.findSystemRole('owner');
    if (owner) await this.memberships.create(user.id, site.id, owner.id);
    return toSite(site);
  }

  @Mutation(() => SiteModel)
  @RequireCapability(Capabilities.Site.Manage)
  async updateSite(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSiteInput,
    @CurrentUser() user: User,
  ): Promise<SiteModel> {
    await this.assertManages(user, id);
    return toSite(await this.sitesService.update(id, input));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Site.Manage)
  async deleteSite(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    await this.assertManages(user, id);
    await this.sitesService.delete(id);
    return true;
  }

  @Mutation(() => SiteMemberModel)
  @RequireCapability(Capabilities.Site.Manage)
  async addSiteMember(
    @Args('siteId', { type: () => ID }) siteId: string,
    @Args('email') email: string,
    @Args('roleSlug') roleSlug: string,
    @CurrentUser() actor: User,
  ): Promise<SiteMemberModel> {
    await this.assertManages(actor, siteId);
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundException(`No user with email "${email}".`);
    const role = await this.rolesService.findSystemRole(roleSlug);
    if (!role) throw new BadRequestException(`Unknown role "${roleSlug}".`);
    if (await this.memberships.findForUserAndSite(user.id, siteId)) {
      throw new BadRequestException('That user is already a member of this site.');
    }
    const membership = await this.memberships.create(user.id, siteId, role.id);
    return toMember({ ...membership, user, role } as SiteMembership);
  }

  @Mutation(() => SiteMemberModel)
  @RequireCapability(Capabilities.Site.Manage)
  async updateSiteMember(
    @Args('membershipId', { type: () => ID }) membershipId: string,
    @Args('roleSlug') roleSlug: string,
    @CurrentUser() actor: User,
  ): Promise<SiteMemberModel> {
    await this.assertManagesMembership(actor, membershipId);
    const role = await this.rolesService.findSystemRole(roleSlug);
    if (!role) throw new BadRequestException(`Unknown role "${roleSlug}".`);
    return toMember(await this.memberships.updateRole(membershipId, role.id));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Site.Manage)
  async removeSiteMember(
    @Args('membershipId', { type: () => ID }) membershipId: string,
    @CurrentUser() actor: User,
  ): Promise<boolean> {
    await this.assertManagesMembership(actor, membershipId);
    await this.memberships.removeById(membershipId);
    return true;
  }
}

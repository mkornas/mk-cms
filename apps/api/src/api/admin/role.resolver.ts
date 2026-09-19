import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { RolesService } from '../../rbac/roles.service';
import { MembershipsService } from '../../rbac/memberships.service';
import { Role } from '../../rbac/entities/role.entity';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities, ALL_CAPABILITIES, can } from '../../rbac/capabilities';
import { RoleModel } from '../models/site.model';

@InputType()
export class CreateRoleInput {
  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsString()
  slug!: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  capabilities!: string[];
}

@InputType()
export class UpdateRoleInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];
}

function toRole(r: Role): RoleModel {
  return { id: r.id, slug: r.slug, name: r.name, capabilities: r.capabilities ?? [] };
}

/**
 * Per-site custom role management (`role:manage`). Every operation is scoped to
 * the caller's active site via {@link TenantContextService.requireSiteId}, so a
 * site can only ever see and mutate its own roles. Global system roles
 * (siteId = null) are read-only and rejected by the service layer.
 */
@Resolver(() => RoleModel)
export class RoleResolver {
  constructor(
    private readonly rolesService: RolesService,
    private readonly tenant: TenantContextService,
    private readonly memberships: MembershipsService,
  ) {}

  /**
   * A role may only grant capabilities that (a) are real, catalogued
   * capabilities — never the `*` super-wildcard or an unknown string — and
   * (b) the grantor already holds, so a `role:manage` user can't mint a role
   * that escalates beyond their own privileges. Super-admins are unbounded.
   */
  private async assertGrantable(caps: string[]): Promise<void> {
    const known = new Set<string>(ALL_CAPABILITIES);
    const bad = caps.filter((c) => !known.has(c));
    if (bad.length) {
      throw new BadRequestException(`Unknown capabilities: ${bad.join(', ')}`);
    }
    const user = this.tenant.user;
    if (user?.isSuperAdmin) return;
    const own = await this.memberships.capabilitiesFor(
      user!.id,
      this.tenant.requireSiteId(),
    );
    const notHeld = caps.filter((c) => !can(own, c));
    if (notHeld.length) {
      throw new ForbiddenException(
        `You cannot grant capabilities you do not hold: ${notHeld.join(', ')}`,
      );
    }
  }

  /** The active site's custom roles. */
  @Query(() => [RoleModel])
  @RequireCapability(Capabilities.Role.Manage)
  async siteRoles(): Promise<RoleModel[]> {
    const siteId = this.tenant.requireSiteId();
    return (await this.rolesService.listForSite(siteId)).map(toRole);
  }

  /** Every concrete capability string, for the role-editor picker. */
  @Query(() => [String])
  @RequireCapability(Capabilities.Role.Manage)
  capabilityCatalog(): string[] {
    return [...ALL_CAPABILITIES];
  }

  @Mutation(() => RoleModel)
  @RequireCapability(Capabilities.Role.Manage)
  async createRole(@Args('input') input: CreateRoleInput): Promise<RoleModel> {
    await this.assertGrantable(input.capabilities);
    const siteId = this.tenant.requireSiteId();
    return toRole(await this.rolesService.create(input, siteId));
  }

  @Mutation(() => RoleModel)
  @RequireCapability(Capabilities.Role.Manage)
  async updateRole(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateRoleInput,
  ): Promise<RoleModel> {
    if (input.capabilities) await this.assertGrantable(input.capabilities);
    const siteId = this.tenant.requireSiteId();
    return toRole(await this.rolesService.update(id, input, siteId));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Role.Manage)
  async deleteRole(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    const siteId = this.tenant.requireSiteId();
    await this.rolesService.remove(id, siteId);
    return true;
  }
}

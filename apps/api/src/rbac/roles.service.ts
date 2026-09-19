import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { SYSTEM_ROLES } from './capabilities';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
  ) {}

  /** Global system role (siteId = null) by slug. */
  findSystemRole(slug: string): Promise<Role | null> {
    return this.roles.findOne({ where: { slug, siteId: IsNull() } });
  }

  findById(id: string): Promise<Role | null> {
    return this.roles.findOne({ where: { id } });
  }

  /** All global system roles (for the membership role picker). */
  listSystemRoles(): Promise<Role[]> {
    return this.roles.find({ where: { siteId: IsNull() }, order: { name: 'ASC' } });
  }

  /** A single site's custom roles (siteId = the active site). */
  listForSite(siteId: string): Promise<Role[]> {
    return this.roles.find({ where: { siteId }, order: { name: 'ASC' } });
  }

  /** Create a custom role scoped to the given (active) site. */
  async create(
    input: { name: string; slug: string; capabilities: string[] },
    siteId: string,
  ): Promise<Role> {
    const slug = input.slug.trim().toLowerCase();
    if (!slug) throw new BadRequestException('A role slug is required.');
    const existing = await this.roles.findOne({ where: { siteId, slug } });
    if (existing) {
      throw new BadRequestException(
        `A role with slug "${slug}" already exists for this site.`,
      );
    }
    return this.roles.save(
      this.roles.create({
        siteId,
        slug,
        name: input.name,
        capabilities: input.capabilities ?? [],
        isSystem: false,
      }),
    );
  }

  /** Update a custom role's name/capabilities. Refuses system roles. */
  async update(
    id: string,
    patch: { name?: string; capabilities?: string[] },
    siteId: string,
  ): Promise<Role> {
    const role = await this.requireEditableSiteRole(id, siteId);
    if (patch.name !== undefined) role.name = patch.name;
    if (patch.capabilities !== undefined) role.capabilities = patch.capabilities;
    return this.roles.save(role);
  }

  /** Delete a custom role. Refuses system roles and cross-tenant roles. */
  async remove(id: string, siteId: string): Promise<void> {
    const role = await this.requireEditableSiteRole(id, siteId);
    await this.roles.remove(role);
  }

  /**
   * Load a role and assert it is (a) not a protected system role and (b) owned
   * by the active site — the two correctness guards for tenant-safe mutation.
   */
  private async requireEditableSiteRole(id: string, siteId: string): Promise<Role> {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new NotFoundException(`Role "${id}" not found.`);
    if (role.siteId === null || role.isSystem) {
      throw new ForbiddenException('System roles are read-only and cannot be modified.');
    }
    if (role.siteId !== siteId) {
      throw new ForbiddenException('That role belongs to a different site.');
    }
    return role;
  }

  /**
   * Idempotently create/update the global system roles. Safe to run on every
   * boot — capabilities are kept in sync with the code definitions.
   */
  async ensureSystemRoles(): Promise<void> {
    for (const def of SYSTEM_ROLES) {
      const existing = await this.findSystemRole(def.slug);
      if (existing) {
        if (
          JSON.stringify(existing.capabilities) !==
          JSON.stringify(def.capabilities)
        ) {
          existing.capabilities = def.capabilities;
          await this.roles.save(existing);
          this.logger.log(`Updated system role "${def.slug}"`);
        }
        continue;
      }
      await this.roles.save(
        this.roles.create({
          siteId: null,
          slug: def.slug,
          name: def.name,
          capabilities: def.capabilities,
          isSystem: true,
        }),
      );
      this.logger.log(`Created system role "${def.slug}"`);
    }
  }
}

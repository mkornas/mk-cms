import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteMembership } from './entities/site-membership.entity';

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(SiteMembership)
    private readonly memberships: Repository<SiteMembership>,
  ) {}

  /** Membership (with role) for a user on a site, or null if they have no access. */
  findForUserAndSite(
    userId: string,
    siteId: string,
  ): Promise<SiteMembership | null> {
    return this.memberships.findOne({
      where: { userId, siteId },
      relations: { role: true },
    });
  }

  /** Effective capability strings for a user on a site ([] if no membership). */
  async capabilitiesFor(userId: string, siteId: string): Promise<string[]> {
    const membership = await this.findForUserAndSite(userId, siteId);
    return membership?.role?.capabilities ?? [];
  }

  listForUser(userId: string): Promise<SiteMembership[]> {
    return this.memberships.find({
      where: { userId },
      relations: { role: true, site: true },
    });
  }

  create(
    userId: string,
    siteId: string,
    roleId: string,
  ): Promise<SiteMembership> {
    return this.memberships.save(
      this.memberships.create({ userId, siteId, roleId }),
    );
  }

  /** All members of a site, with their user + role (site-management listing). */
  listForSite(siteId: string): Promise<SiteMembership[]> {
    return this.memberships.find({
      where: { siteId },
      relations: { user: true, role: true },
      order: { createdAt: 'ASC' },
    });
  }

  findById(id: string): Promise<SiteMembership | null> {
    return this.memberships.findOne({
      where: { id },
      relations: { user: true, role: true },
    });
  }

  async updateRole(id: string, roleId: string): Promise<SiteMembership> {
    const membership = await this.memberships.findOneByOrFail({ id });
    membership.roleId = roleId;
    await this.memberships.save(membership);
    return this.memberships.findOneOrFail({
      where: { id },
      relations: { user: true, role: true },
    });
  }

  async removeById(id: string): Promise<void> {
    await this.memberships.delete(id);
  }
}

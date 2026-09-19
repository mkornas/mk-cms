import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site, SiteStatus } from './entities/site.entity';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly sites: Repository<Site>,
  ) {}

  findById(id: string): Promise<Site | null> {
    return this.sites.findOne({ where: { id } });
  }

  findBySlug(slug: string): Promise<Site | null> {
    return this.sites.findOne({ where: { slug } });
  }

  /** Resolve a site from a request Host header (domains is a JSONB string array). */
  findByDomain(host: string): Promise<Site | null> {
    return this.sites
      .createQueryBuilder('site')
      .where('site.domains @> :host::jsonb', { host: JSON.stringify([host]) })
      .getOne();
  }

  count(): Promise<number> {
    return this.sites.count();
  }

  /** All sites, oldest first (site-management listing). */
  list(): Promise<Site[]> {
    return this.sites.find({ order: { createdAt: 'ASC' } });
  }

  async update(
    id: string,
    patch: {
      name?: string;
      domains?: string[];
      status?: SiteStatus;
      settings?: Record<string, unknown>;
    },
  ): Promise<Site> {
    const site = await this.sites.findOneByOrFail({ id });
    if (patch.name !== undefined) site.name = patch.name;
    if (patch.domains !== undefined) site.domains = patch.domains;
    if (patch.status !== undefined) site.status = patch.status;
    if (patch.settings !== undefined) site.settings = patch.settings;
    return this.sites.save(site);
  }

  async delete(id: string): Promise<void> {
    await this.sites.delete(id);
  }

  create(input: {
    slug: string;
    name: string;
    domains?: string[];
    status?: SiteStatus;
    settings?: Record<string, unknown>;
  }): Promise<Site> {
    const site = this.sites.create({
      slug: input.slug,
      name: input.name,
      domains: input.domains ?? [],
      status: input.status ?? SiteStatus.Active,
      settings: input.settings ?? {},
    });
    return this.sites.save(site);
  }
}

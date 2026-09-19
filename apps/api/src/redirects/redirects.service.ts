import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redirect } from './entities/redirect.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';

export interface CreateRedirectInput {
  fromPath: string;
  toPath: string;
  statusCode?: number;
  enabled?: boolean;
}

export interface UpdateRedirectInput {
  toPath?: string;
  statusCode?: number;
  enabled?: boolean;
}

const VALID_CODES = new Set([301, 302, 307, 308]);

@Injectable()
export class RedirectsService {
  constructor(
    @InjectRepository(Redirect)
    private readonly redirects: Repository<Redirect>,
    private readonly tenant: TenantContextService,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  /** Normalize a path to a single leading slash, no trailing slash (except root). */
  private normalize(path: string): string {
    const trimmed = path.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed; // absolute target left as-is
    const withLead = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withLead.length > 1 ? withLead.replace(/\/+$/, '') : withLead;
  }

  list(): Promise<Redirect[]> {
    return this.redirects.find({
      where: { siteId: this.siteId() },
      order: { fromPath: 'ASC' },
    });
  }

  async create(input: CreateRedirectInput): Promise<Redirect> {
    const siteId = this.siteId();
    const fromPath = this.normalize(input.fromPath);
    const toPath = this.normalize(input.toPath);
    const statusCode = input.statusCode ?? 301;
    if (!VALID_CODES.has(statusCode)) {
      throw new BadRequestException(
        `statusCode must be one of ${[...VALID_CODES].join(', ')}.`,
      );
    }
    if (fromPath === toPath) {
      throw new BadRequestException('A redirect cannot point to itself.');
    }
    if (await this.redirects.findOne({ where: { siteId, fromPath } })) {
      throw new ConflictException(`A redirect for "${fromPath}" already exists.`);
    }
    return this.redirects.save(
      this.redirects.create({
        siteId,
        fromPath,
        toPath,
        statusCode,
        enabled: input.enabled ?? true,
      }),
    );
  }

  async update(id: string, patch: UpdateRedirectInput): Promise<Redirect> {
    const redirect = await this.getById(id);
    if (patch.statusCode !== undefined && !VALID_CODES.has(patch.statusCode)) {
      throw new BadRequestException(
        `statusCode must be one of ${[...VALID_CODES].join(', ')}.`,
      );
    }
    if (patch.toPath !== undefined) redirect.toPath = this.normalize(patch.toPath);
    if (patch.statusCode !== undefined) redirect.statusCode = patch.statusCode;
    if (patch.enabled !== undefined) redirect.enabled = patch.enabled;
    return this.redirects.save(redirect);
  }

  async delete(id: string): Promise<void> {
    const redirect = await this.getById(id);
    await this.redirects.remove(redirect);
  }

  async getById(id: string): Promise<Redirect> {
    const redirect = await this.redirects.findOne({
      where: { id, siteId: this.siteId() },
    });
    if (!redirect) throw new NotFoundException('Redirect not found.');
    return redirect;
  }

  /**
   * Delivery lookup: resolve an incoming path to an enabled redirect and bump
   * its hit counter. Returns null when there's no match.
   */
  async resolve(path: string): Promise<Redirect | null> {
    const fromPath = this.normalize(path);
    const redirect = await this.redirects.findOne({
      where: { siteId: this.siteId(), fromPath, enabled: true },
    });
    if (!redirect) return null;
    await this.redirects.increment({ id: redirect.id }, 'hits', 1);
    return redirect;
  }
}

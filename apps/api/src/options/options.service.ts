import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Option } from './entities/option.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';

/**
 * Key/value settings store. Tenant-aware methods scope to the active site;
 * `*Global` methods operate on instance-wide options (siteId = null).
 */
@Injectable()
export class OptionsService {
  constructor(
    @InjectRepository(Option)
    private readonly options: Repository<Option>,
    private readonly tenant: TenantContextService,
  ) {}

  // ── site-scoped ────────────────────────────────────
  get<T = unknown>(key: string): Promise<T | undefined> {
    return this.read<T>(this.tenant.requireSiteId(), key);
  }

  set<T = unknown>(key: string, value: T, autoload = true): Promise<void> {
    return this.write(this.tenant.requireSiteId(), key, value, autoload);
  }

  /** All options for the active site, ordered by key. */
  list(): Promise<Option[]> {
    return this.options.find({
      where: { siteId: this.tenant.requireSiteId() },
      order: { key: 'ASC' },
    });
  }

  // ── instance-wide ──────────────────────────────────
  getGlobal<T = unknown>(key: string): Promise<T | undefined> {
    return this.read<T>(null, key);
  }

  setGlobal<T = unknown>(key: string, value: T, autoload = true): Promise<void> {
    return this.write(null, key, value, autoload);
  }

  // ── internals ──────────────────────────────────────
  private async read<T>(
    siteId: string | null,
    key: string,
  ): Promise<T | undefined> {
    const row = await this.options.findOne({
      where: { siteId: siteId ?? IsNull(), key },
    });
    return row ? (row.value as T) : undefined;
  }

  private async write(
    siteId: string | null,
    key: string,
    value: unknown,
    autoload: boolean,
  ): Promise<void> {
    const existing = await this.options.findOne({
      where: { siteId: siteId ?? IsNull(), key },
    });
    if (existing) {
      existing.value = value;
      existing.autoload = autoload;
      await this.options.save(existing);
      return;
    }
    await this.options.save(
      this.options.create({ siteId, key, value, autoload }),
    );
  }
}

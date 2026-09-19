import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import DataLoader from 'dataloader';
import { In, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Term } from '../../taxonomy/entities/term.entity';
import { EntryTerm } from '../../taxonomy/entities/entry-term.entity';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { UserModel } from '../models/user.model';
import { TermModel } from '../models/taxonomy.model';
import { toTermModel, toUserModel } from '../models/mappers';

/** Per-request batch loaders, attached to the GraphQL context. */
export interface GqlLoaders {
  /** author id → user (deduped/batched across a whole query). */
  user: DataLoader<string, UserModel | null>;
  /** entry id → its terms. */
  entryTerms: DataLoader<string, TermModel[]>;
}

/**
 * Builds a fresh set of DataLoaders for each GraphQL request, collapsing the
 * classic N+1 (one author/term lookup per entry) into a single batched query.
 * Loaders read the active site lazily at batch time, so they stay tenant-safe
 * even though the context is created before the tenant guard runs.
 */
@Injectable()
export class LoaderFactory {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Term) private readonly terms: Repository<Term>,
    @InjectRepository(EntryTerm)
    private readonly entryTerms: Repository<EntryTerm>,
    private readonly tenant: TenantContextService,
  ) {}

  create(): GqlLoaders {
    return {
      user: new DataLoader<string, UserModel | null>(async (ids) => {
        const found = await this.users.find({ where: { id: In([...ids]) } });
        const byId = new Map(found.map((u) => [u.id, toUserModel(u)]));
        return ids.map((id) => byId.get(id) ?? null);
      }),
      entryTerms: new DataLoader<string, TermModel[]>(async (entryIds) => {
        const siteId = this.tenant.requireSiteId();
        const links = await this.entryTerms.find({
          where: { siteId, entryId: In([...entryIds]) },
        });
        const termIds = [...new Set(links.map((l) => l.termId))];
        const terms = termIds.length
          ? await this.terms.find({ where: { id: In(termIds) } })
          : [];
        const termById = new Map(terms.map((t) => [t.id, toTermModel(t)]));
        const byEntry = new Map<string, TermModel[]>();
        for (const link of links) {
          const term = termById.get(link.termId);
          if (!term) continue;
          const list = byEntry.get(link.entryId) ?? [];
          list.push(term);
          byEntry.set(link.entryId, list);
        }
        return entryIds.map((id) => byEntry.get(id) ?? []);
      }),
    };
  }
}

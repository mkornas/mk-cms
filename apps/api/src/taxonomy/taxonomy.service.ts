import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Taxonomy, TaxonomyConfig } from './entities/taxonomy.entity';
import { Term } from './entities/term.entity';
import { EntryTerm } from './entities/entry-term.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { ContentEntriesService } from '../content/content-entries.service';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class TaxonomyService {
  constructor(
    @InjectRepository(Taxonomy)
    private readonly taxonomies: Repository<Taxonomy>,
    @InjectRepository(Term)
    private readonly terms: Repository<Term>,
    @InjectRepository(EntryTerm)
    private readonly entryTerms: Repository<EntryTerm>,
    private readonly tenant: TenantContextService,
    private readonly entries: ContentEntriesService,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  private assertSlug(slug: string): void {
    if (!SLUG_RE.test(slug)) {
      throw new BadRequestException(
        'Slug must be lowercase words separated by hyphens.',
      );
    }
  }

  // ── taxonomies ─────────────────────────────────────
  listTaxonomies(): Promise<Taxonomy[]> {
    return this.taxonomies.find({
      where: { siteId: this.siteId() },
      order: { slug: 'ASC' },
    });
  }

  async getTaxonomy(slug: string): Promise<Taxonomy> {
    const tax = await this.taxonomies.findOne({
      where: { siteId: this.siteId(), slug },
    });
    if (!tax) throw new NotFoundException(`Unknown taxonomy "${slug}"`);
    return tax;
  }

  async createTaxonomy(input: {
    slug: string;
    name: string;
    config?: TaxonomyConfig;
  }): Promise<Taxonomy> {
    const siteId = this.siteId();
    this.assertSlug(input.slug);
    if (await this.taxonomies.findOne({ where: { siteId, slug: input.slug } })) {
      throw new ConflictException(`Taxonomy "${input.slug}" already exists.`);
    }
    return this.taxonomies.save(
      this.taxonomies.create({
        siteId,
        slug: input.slug,
        name: input.name,
        config: input.config ?? {},
        isCore: false,
      }),
    );
  }

  async deleteTaxonomy(slug: string): Promise<void> {
    const tax = await this.getTaxonomy(slug);
    if (tax.isCore) {
      throw new ForbiddenException(`Core taxonomy "${slug}" cannot be deleted.`);
    }
    await this.taxonomies.remove(tax);
  }

  // ── terms ──────────────────────────────────────────
  async listTerms(taxonomySlug: string): Promise<Term[]> {
    const tax = await this.getTaxonomy(taxonomySlug);
    return this.terms.find({
      where: { siteId: this.siteId(), taxonomyId: tax.id },
      order: { name: 'ASC' },
    });
  }

  async createTerm(
    taxonomySlug: string,
    input: {
      slug: string;
      name: string;
      description?: string;
      parentId?: string | null;
    },
  ): Promise<Term> {
    const tax = await this.getTaxonomy(taxonomySlug);
    this.assertSlug(input.slug);
    if (
      await this.terms.findOne({
        where: { taxonomyId: tax.id, slug: input.slug },
      })
    ) {
      throw new ConflictException(
        `Term "${input.slug}" already exists in "${taxonomySlug}".`,
      );
    }
    if (input.parentId) {
      await this.getTerm(input.parentId); // ensures parent is in this site
    }
    return this.terms.save(
      this.terms.create({
        siteId: tax.siteId,
        taxonomyId: tax.id,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
      }),
    );
  }

  async getTerm(id: string): Promise<Term> {
    const term = await this.terms.findOne({
      where: { id, siteId: this.siteId() },
    });
    if (!term) throw new NotFoundException('Term not found.');
    return term;
  }

  async deleteTerm(id: string): Promise<void> {
    const term = await this.getTerm(id);
    await this.entryTerms.delete({ termId: term.id });
    await this.terms.remove(term);
  }

  // ── entry ↔ term links ─────────────────────────────
  /** Replace the full set of terms attached to an entry. */
  async setEntryTerms(entryId: string, termIds: string[]): Promise<Term[]> {
    const siteId = this.siteId();
    await this.entries.getById(entryId); // tenant-scoped existence check
    const unique = [...new Set(termIds)];
    if (unique.length > 0) {
      const found = await this.terms.count({
        where: { siteId, id: In(unique) },
      });
      if (found !== unique.length) {
        throw new BadRequestException('One or more terms do not exist.');
      }
    }
    await this.entryTerms.delete({ entryId });
    if (unique.length > 0) {
      await this.entryTerms.save(
        unique.map((termId) =>
          this.entryTerms.create({ siteId, entryId, termId }),
        ),
      );
    }
    return this.getEntryTerms(entryId);
  }

  /**
   * How many content entries are assigned each of the given terms, tenant-scoped.
   * Batched into a single grouped count to avoid an N+1 per term.
   */
  async countsForTerms(termIds: string[]): Promise<Map<string, number>> {
    if (termIds.length === 0) return new Map();
    const rows = await this.entryTerms
      .createQueryBuilder('et')
      .select('et.termId', 'termId')
      .addSelect('COUNT(*)', 'count')
      .where('et.siteId = :siteId', { siteId: this.siteId() })
      .andWhere('et.termId IN (:...termIds)', { termIds })
      .groupBy('et.termId')
      .getRawMany<{ termId: string; count: string }>();
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.termId, Number(row.count));
    return counts;
  }

  async getEntryTerms(entryId: string): Promise<Term[]> {
    const links = await this.entryTerms.find({
      where: { siteId: this.siteId(), entryId },
    });
    if (links.length === 0) return [];
    return this.terms.find({
      where: { id: In(links.map((l) => l.termId)) },
      order: { name: 'ASC' },
    });
  }
}

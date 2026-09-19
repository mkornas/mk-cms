import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentEntry } from '../content/entities/content-entry.entity';
import { ContentTypesService } from '../content/content-types.service';
import { SearchAdapter, SearchHit, SearchQuery } from './search.types';

const CFG = 'simple';

/**
 * Postgres full-text search over the generated `search_vector` column. Ranks
 * with `ts_rank`, highlights with `ts_headline` (over the title + the JSONB
 * field *values*, keys stripped), and matches with `websearch_to_tsquery` so a
 * user can type `foo -bar "exact phrase"` naturally.
 */
@Injectable()
export class PostgresSearchAdapter implements SearchAdapter {
  constructor(
    @InjectRepository(ContentEntry)
    private readonly entries: Repository<ContentEntry>,
    private readonly types: ContentTypesService,
  ) {}

  async search(q: SearchQuery): Promise<SearchHit[]> {
    if (!q.query.trim() || q.statuses.length === 0) return [];

    const qb = this.entries
      .createQueryBuilder('e')
      .where('e.siteId = :siteId', { siteId: q.siteId })
      .andWhere('e.status IN (:...statuses)', { statuses: q.statuses })
      .andWhere(
        `e.search_vector @@ websearch_to_tsquery('${CFG}', :query)`,
        { query: q.query },
      )
      .addSelect(
        `ts_rank(e.search_vector, websearch_to_tsquery('${CFG}', :query))`,
        'rank',
      )
      // HTML-escape the source text BEFORE ts_headline so entry titles/field
      // values (author-controlled) can't inject markup into the admin or any
      // delivery-API consumer — only the `<b>…</b>` match wrappers are markup.
      .addSelect(
        `ts_headline('${CFG}',
           replace(replace(replace(
             coalesce(e.title, '') || ' ' ||
             coalesce((SELECT string_agg(v.value, ' ') FROM jsonb_each_text(e.fields) AS v), ''),
             '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
           websearch_to_tsquery('${CFG}', :query),
           'MaxWords=25, MinWords=8, ShortWord=2, StartSel=<b>, StopSel=</b>')`,
        'snippet',
      )
      .orderBy('rank', 'DESC')
      .addOrderBy('e.updatedAt', 'DESC')
      .limit(q.limit)
      .offset(q.offset);

    if (q.locale) qb.andWhere('e.locale = :locale', { locale: q.locale });
    if (q.type) {
      const type = await this.types.getBySlug(q.type);
      qb.andWhere('e.contentTypeId = :typeId', { typeId: type.id });
    }

    const { entities, raw } = await qb.getRawAndEntities();
    const slugById = new Map(
      (await this.types.list()).map((t) => [t.id, t.slug]),
    );

    return entities.map((entry, i) => ({
      entry,
      typeSlug: slugById.get(entry.contentTypeId) ?? 'unknown',
      rank: Number(raw[i]?.rank ?? 0),
      snippet: String(raw[i]?.snippet ?? ''),
    }));
  }
}

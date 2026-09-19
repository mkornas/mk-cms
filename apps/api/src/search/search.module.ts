import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentEntry } from '../content/entities/content-entry.entity';
import { SearchService } from './search.service';
import { PostgresSearchAdapter } from './postgres-search.adapter';
import { SEARCH_ADAPTER } from './search.types';

/**
 * Search module. Binds the {@link SEARCH_ADAPTER} token to the Postgres FTS
 * adapter; swapping in Meilisearch later is a one-line provider change here.
 * Content-type service is global; the entry repository is registered for the
 * adapter's query builder.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ContentEntry])],
  providers: [
    SearchService,
    { provide: SEARCH_ADAPTER, useClass: PostgresSearchAdapter },
  ],
  exports: [SearchService],
})
export class SearchModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Term } from '../taxonomy/entities/term.entity';
import { EntryTerm } from '../taxonomy/entities/entry-term.entity';
import { LoaderFactory } from './loaders/loader.factory';
import { PreviewService } from './preview.service';

/**
 * Shared GraphQL infrastructure used by both API surfaces: the per-request
 * DataLoader factory and the preview-token service. Exported so the
 * GraphQLModule factories (which build the request context) can inject them.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Term, EntryTerm])],
  providers: [LoaderFactory, PreviewService],
  exports: [LoaderFactory, PreviewService],
})
export class ApiSharedModule {}

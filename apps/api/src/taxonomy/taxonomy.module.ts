import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Taxonomy } from './entities/taxonomy.entity';
import { Term } from './entities/term.entity';
import { EntryTerm } from './entities/entry-term.entity';
import { TaxonomyService } from './taxonomy.service';
import { TaxonomyController } from './taxonomy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Taxonomy, Term, EntryTerm])],
  controllers: [TaxonomyController],
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}

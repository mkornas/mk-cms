import { Module } from '@nestjs/common';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { MediaModule } from '../media/media.module';
import { WpImporterService } from './wp-importer.service';

/**
 * WordPress WXR importer. The content engine is global; taxonomy and media are
 * imported here. It has no entities of its own — imported content lands in the
 * existing content/taxonomy tables and attachments in the media library.
 */
@Module({
  imports: [TaxonomyModule, MediaModule],
  providers: [WpImporterService],
  exports: [WpImporterService],
})
export class ImporterModule {}

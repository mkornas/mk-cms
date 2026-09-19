import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeoMeta } from './entities/seo-meta.entity';
import { SeoService } from './seo.service';
import { SeoController } from './seo.controller';

/**
 * First-party SEO module: per-entry meta + site defaults, the resolved values a
 * frontend renders, and the public sitemap/robots endpoints. Content, options
 * and tenant services come from global modules.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SeoMeta])],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}

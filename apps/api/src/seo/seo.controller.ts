import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SeoService } from './seo.service';

/**
 * Public SEO endpoints served as raw XML/text — search engines fetch these
 * directly (they aren't GraphQL). The active site is resolved from the request
 * Host / `x-site` header by the global tenant guard, so a crawler hitting a
 * site's domain gets that site's sitemap.
 */
@Public()
@Controller('seo')
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  sitemap(): Promise<string> {
    return this.seo.buildSitemap();
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  robots(): Promise<string> {
    return this.seo.buildRobots();
  }
}

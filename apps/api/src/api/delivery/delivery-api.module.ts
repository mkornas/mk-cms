import { Module } from '@nestjs/common';
import { TaxonomyModule } from '../../taxonomy/taxonomy.module';
import { RedirectsModule } from '../../redirects/redirects.module';
import { MenusModule } from '../../menus/menus.module';
import { SearchModule } from '../../search/search.module';
import { MediaModule } from '../../media/media.module';
import { ApiSharedModule } from '../api-shared.module';
import { DeliveryResolver } from './delivery.resolver';

/**
 * The public Content Delivery GraphQL surface (`/graphql/delivery`):
 * read-only, published-only, site-scoped, with preview-token support.
 */
@Module({
  imports: [
    TaxonomyModule,
    RedirectsModule,
    MenusModule,
    SearchModule,
    MediaModule,
    ApiSharedModule,
  ],
  providers: [DeliveryResolver],
})
export class DeliveryApiModule {}

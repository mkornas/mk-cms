import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentEntry } from '../../content/entities/content-entry.entity';
import { TaxonomyModule } from '../../taxonomy/taxonomy.module';
import { AuditModule } from '../../audit/audit.module';
import { RedirectsModule } from '../../redirects/redirects.module';
import { SeoModule } from '../../seo/seo.module';
import { MenusModule } from '../../menus/menus.module';
import { WebhooksModule } from '../../webhooks/webhooks.module';
import { FormsModule } from '../../forms/forms.module';
import { ImporterModule } from '../../importer/importer.module';
import { SearchModule } from '../../search/search.module';
import { MediaModule } from '../../media/media.module';
import { ApiSharedModule } from '../api-shared.module';
import { AuthResolver } from './auth.resolver';
import { ContentTypeResolver } from './content-type.resolver';
import { EntryResolver } from './entry.resolver';
import { TaxonomyResolver } from './taxonomy.resolver';
import { PluginResolver } from './plugin.resolver';
import { AuditResolver } from './audit.resolver';
import { RedirectResolver } from './redirect.resolver';
import { SeoResolver } from './seo.resolver';
import { MenuResolver } from './menu.resolver';
import { WebhookResolver } from './webhook.resolver';
import { FormResolver } from './form.resolver';
import { ImportResolver } from './import.resolver';
import { SearchResolver } from './search.resolver';
import { MediaResolver } from './media.resolver';
import { SiteResolver } from './site.resolver';
import { UserResolver } from './user.resolver';
import { OptionsResolver } from './options.resolver';
import { TranslationResolver } from './translation.resolver';
import { ProfileResolver } from './profile.resolver';
import { RoleResolver } from './role.resolver';

/**
 * The authenticated Admin/Management GraphQL surface (`/graphql`): full CRUD
 * over content types, entries, taxonomies, plugins, redirects and the audit
 * log, plus auth. Content and RBAC services are global; feature modules are
 * imported here.
 */
@Module({
  imports: [
    TaxonomyModule,
    AuditModule,
    RedirectsModule,
    SeoModule,
    MenusModule,
    WebhooksModule,
    FormsModule,
    ImporterModule,
    SearchModule,
    MediaModule,
    ApiSharedModule,
    TypeOrmModule.forFeature([ContentEntry]),
  ],
  providers: [
    AuthResolver,
    ContentTypeResolver,
    EntryResolver,
    TaxonomyResolver,
    PluginResolver,
    AuditResolver,
    RedirectResolver,
    SeoResolver,
    MenuResolver,
    WebhookResolver,
    FormResolver,
    ImportResolver,
    SearchResolver,
    MediaResolver,
    SiteResolver,
    UserResolver,
    OptionsResolver,
    TranslationResolver,
    ProfileResolver,
    RoleResolver,
  ],
})
export class AdminApiModule {}

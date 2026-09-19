import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { TenantResolverGuard } from './tenancy/tenant-resolver.guard';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { CapabilityGuard } from './rbac/capability.guard';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { OptionsModule } from './options/options.module';
import { HooksModule } from './hooks/hooks.module';
import { ContentModule } from './content/content.module';
import { PluginsModule } from './plugins/plugins.module';
import { AuditModule } from './audit/audit.module';
import { RedirectsModule } from './redirects/redirects.module';
import { SeoModule } from './seo/seo.module';
import { MenusModule } from './menus/menus.module';
import { JobsModule } from './jobs/jobs.module';
import { MailModule } from './mail/mail.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { FormsModule } from './forms/forms.module';
import { ImporterModule } from './importer/importer.module';
import { SearchModule } from './search/search.module';
import { MediaModule } from './media/media.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { MeModule } from './me/me.module';
import { GraphqlModule } from './api/graphql.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';

/**
 * Root module.
 *
 * Global guard order is significant and enforced by provider order below:
 *   1. TenantResolverGuard — resolves the active site into the request context
 *   2. JwtAuthGuard        — authenticates the user (unless @Public)
 *   3. CapabilityGuard     — authorizes @RequireCapability handlers
 *
 * ClsModule mounts the AsyncLocalStorage middleware so every guard, resolver
 * and service can read the per-request tenant/user context.
 */
@Module({
  imports: [
    ConfigModule,
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    // Global rate-limit config (the guard is applied per-route, e.g. on the
    // public auth mutations and form submission).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    RedisModule,
    JobsModule,
    MailModule,
    TenancyModule,
    UsersModule,
    RbacModule,
    AuthModule,
    OptionsModule,
    HooksModule,
    ContentModule,
    PluginsModule,
    AuditModule,
    RedirectsModule,
    SeoModule,
    MenusModule,
    WebhooksModule,
    SchedulingModule,
    FormsModule,
    ImporterModule,
    SearchModule,
    MediaModule,
    TaxonomyModule,
    HealthModule,
    MeModule,
    GraphqlModule,
    BootstrapModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: TenantResolverGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
  ],
})
export class AppModule {}

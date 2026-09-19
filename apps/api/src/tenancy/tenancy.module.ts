import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from './entities/site.entity';
import { SitesService } from './sites.service';
import { TenantContextService } from './tenant-context.service';
import { TenantResolverGuard } from './tenant-resolver.guard';

/**
 * Tenancy is global: the context service and site lookups are needed by nearly
 * every feature module, so they're exported once here.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Site])],
  providers: [SitesService, TenantContextService, TenantResolverGuard],
  exports: [SitesService, TenantContextService, TenantResolverGuard],
})
export class TenancyModule {}

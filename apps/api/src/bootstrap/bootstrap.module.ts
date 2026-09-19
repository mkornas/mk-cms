import { Module } from '@nestjs/common';
import { ImporterModule } from '../importer/importer.module';
import { SeedService } from './seed.service';

/**
 * Runs first-boot provisioning. All its dependencies (users, sites, rbac,
 * options, auth) are global modules; the importer is pulled in for the demo
 * content.
 */
@Module({
  imports: [ImporterModule],
  providers: [SeedService],
})
export class BootstrapModule {}

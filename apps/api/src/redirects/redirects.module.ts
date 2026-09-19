import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Redirect } from './entities/redirect.entity';
import { RedirectsService } from './redirects.service';

/**
 * First-party redirects module. Admin CRUD lives on the admin GraphQL surface;
 * the public path lookup is exposed on the Delivery surface. Tenant scoping and
 * the DB come from the usual global modules.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Redirect])],
  providers: [RedirectsService],
  exports: [RedirectsService],
})
export class RedirectsModule {}

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { SiteMembership } from './entities/site-membership.entity';
import { RolesService } from './roles.service';
import { MembershipsService } from './memberships.service';
import { CapabilityGuard } from './capability.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Role, SiteMembership])],
  providers: [RolesService, MembershipsService, CapabilityGuard],
  exports: [RolesService, MembershipsService, CapabilityGuard],
})
export class RbacModule {}

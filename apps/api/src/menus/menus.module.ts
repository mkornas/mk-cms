import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from './entities/menu.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenusService } from './menus.service';

/**
 * First-party menus module. Admin CRUD + reorder live on the admin GraphQL
 * surface; the resolved nested tree is exposed on the Delivery surface. Content
 * and tenant services come from global modules.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Menu, MenuItem])],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}

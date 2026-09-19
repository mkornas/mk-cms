import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  Query,
  ResolveField,
  Resolver,
  Parent,
} from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { MenusService } from '../../menus/menus.service';
import { Menu } from '../../menus/entities/menu.entity';
import { MenuItem, MenuItemType } from '../../menus/entities/menu-item.entity';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { MenuItemModel, MenuModel } from '../models/menu.model';

@InputType()
export class CreateMenuInput {
  @Field()
  @IsString()
  slug!: string;

  @Field()
  @IsString()
  name!: string;
}

@InputType()
export class MenuItemInput {
  @Field()
  @IsString()
  label!: string;

  @Field(() => MenuItemType, { nullable: true })
  @IsOptional()
  @IsEnum(MenuItemType)
  type?: MenuItemType;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  url?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  entryId?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  target?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@InputType()
export class ReorderMenuItemInput {
  @Field(() => ID)
  @IsString()
  id!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @Field(() => Int)
  @IsInt()
  sortOrder!: number;
}

function toMenuModel(m: Menu): MenuModel {
  return { id: m.id, slug: m.slug, name: m.name };
}

function toItemModel(i: MenuItem): MenuItemModel {
  return {
    id: i.id,
    menuId: i.menuId,
    parentId: i.parentId,
    label: i.label,
    type: i.type,
    url: i.url,
    entryId: i.entryId,
    target: i.target,
    sortOrder: i.sortOrder,
  };
}

/** Menu management (`menu:manage`). Items are returned flat; the admin builds
 * the tree from parentId/sortOrder and persists edits via reorderMenu. */
@Resolver(() => MenuModel)
export class MenuResolver {
  constructor(private readonly service: MenusService) {}

  @Query(() => [MenuModel])
  @RequireCapability(Capabilities.Menu.Manage)
  async menus(): Promise<MenuModel[]> {
    return (await this.service.listMenus()).map(toMenuModel);
  }

  @ResolveField(() => [MenuItemModel])
  async items(@Parent() menu: MenuModel): Promise<MenuItemModel[]> {
    return (await this.service.listItems(menu.slug)).map(toItemModel);
  }

  @Mutation(() => MenuModel)
  @RequireCapability(Capabilities.Menu.Manage)
  async createMenu(@Args('input') input: CreateMenuInput): Promise<MenuModel> {
    return toMenuModel(await this.service.createMenu(input));
  }

  @Mutation(() => MenuModel)
  @RequireCapability(Capabilities.Menu.Manage)
  async duplicateMenu(@Args('slug') slug: string): Promise<MenuModel> {
    return toMenuModel(await this.service.duplicate(slug));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Menu.Manage)
  async deleteMenu(@Args('slug') slug: string): Promise<boolean> {
    await this.service.deleteMenu(slug);
    return true;
  }

  @Mutation(() => MenuItemModel)
  @RequireCapability(Capabilities.Menu.Manage)
  async addMenuItem(
    @Args('menu') menu: string,
    @Args('input') input: MenuItemInput,
  ): Promise<MenuItemModel> {
    return toItemModel(await this.service.addItem(menu, input));
  }

  @Mutation(() => MenuItemModel)
  @RequireCapability(Capabilities.Menu.Manage)
  async updateMenuItem(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: MenuItemInput,
  ): Promise<MenuItemModel> {
    return toItemModel(await this.service.updateItem(id, input));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Menu.Manage)
  async deleteMenuItem(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.service.deleteItem(id);
    return true;
  }

  @Mutation(() => [MenuItemModel])
  @RequireCapability(Capabilities.Menu.Manage)
  async reorderMenu(
    @Args('menu') menu: string,
    @Args('items', { type: () => [ReorderMenuItemInput] })
    items: ReorderMenuItemInput[],
  ): Promise<MenuItemModel[]> {
    const updates = items.map((i) => ({
      id: i.id,
      parentId: i.parentId ?? null,
      sortOrder: i.sortOrder,
    }));
    return (await this.service.reorder(menu, updates)).map(toItemModel);
  }
}

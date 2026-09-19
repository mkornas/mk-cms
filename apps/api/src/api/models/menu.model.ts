import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { MenuItemType } from '../../menus/entities/menu-item.entity';

registerEnumType(MenuItemType, { name: 'MenuItemType' });

/** A named navigation menu. */
@ObjectType('Menu')
export class MenuModel {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;
}

/** A menu item in its raw, flat form (admin editing). */
@ObjectType('MenuItem')
export class MenuItemModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  menuId!: string;

  @Field(() => ID, { nullable: true })
  parentId!: string | null;

  @Field()
  label!: string;

  @Field(() => MenuItemType)
  type!: MenuItemType;

  @Field(() => String, { nullable: true })
  url!: string | null;

  @Field(() => ID, { nullable: true })
  entryId!: string | null;

  @Field(() => String, { nullable: true })
  target!: string | null;

  @Field(() => Int)
  sortOrder!: number;
}

/** A resolved, nested menu node for public rendering. */
@ObjectType('MenuNode')
export class MenuNodeModel {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;

  /** Resolved URL (custom URL, or the linked entry's path). Null if a linked
   * entry is unpublished or missing. */
  @Field(() => String, { nullable: true })
  url!: string | null;

  @Field(() => String, { nullable: true })
  target!: string | null;

  @Field(() => [MenuNodeModel])
  children!: MenuNodeModel[];
}

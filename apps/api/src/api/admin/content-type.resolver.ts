import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ContentTypesService } from '../../content/content-types.service';
import { FieldTypeRegistry } from '../../content/field-types/field-type.registry';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import {
  ContentTypeModel,
  FieldDefinitionModel,
  FieldTypeInfoModel,
} from '../models/content.model';
import {
  toContentTypeModel,
  toFieldDefinitionModel,
} from '../models/mappers';
import {
  CreateContentTypeInput,
  FieldDefinitionInput,
  UpdateContentTypeInput,
  UpdateFieldInput,
} from './admin.inputs';

/**
 * Content-type schema management. Reads need `content:read`; schema changes are
 * admin actions gated by `settings:manage` — mirrors the REST controller.
 */
@Resolver(() => ContentTypeModel)
export class ContentTypeResolver {
  constructor(
    private readonly types: ContentTypesService,
    private readonly registry: FieldTypeRegistry,
  ) {}

  @Query(() => [FieldTypeInfoModel])
  @RequireCapability(Capabilities.Content.Read)
  fieldTypes(): FieldTypeInfoModel[] {
    return this.registry.list().map((t) => ({ id: t.id, label: t.label }));
  }

  @Query(() => [ContentTypeModel])
  @RequireCapability(Capabilities.Content.Read)
  async contentTypes(): Promise<ContentTypeModel[]> {
    const types = await this.types.list();
    return types.map((t) => toContentTypeModel(t));
  }

  @Query(() => ContentTypeModel)
  @RequireCapability(Capabilities.Content.Read)
  async contentType(@Args('slug') slug: string): Promise<ContentTypeModel> {
    const type = await this.types.getBySlug(slug);
    return toContentTypeModel(type, await this.types.getFields(type.id));
  }

  @Mutation(() => ContentTypeModel)
  @RequireCapability(Capabilities.Settings.Manage)
  async createContentType(
    @Args('input') input: CreateContentTypeInput,
  ): Promise<ContentTypeModel> {
    const type = await this.types.create(input);
    return toContentTypeModel(type, await this.types.getFields(type.id));
  }

  @Mutation(() => ContentTypeModel)
  @RequireCapability(Capabilities.Settings.Manage)
  async updateContentType(
    @Args('slug') slug: string,
    @Args('input') input: UpdateContentTypeInput,
  ): Promise<ContentTypeModel> {
    const type = await this.types.update(slug, input);
    return toContentTypeModel(type, await this.types.getFields(type.id));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Settings.Manage)
  async deleteContentType(@Args('slug') slug: string): Promise<boolean> {
    await this.types.delete(slug);
    return true;
  }

  @Mutation(() => FieldDefinitionModel)
  @RequireCapability(Capabilities.Settings.Manage)
  async addField(
    @Args('slug') slug: string,
    @Args('input') input: FieldDefinitionInput,
  ): Promise<FieldDefinitionModel> {
    return toFieldDefinitionModel(await this.types.addField(slug, input));
  }

  @Mutation(() => FieldDefinitionModel)
  @RequireCapability(Capabilities.Settings.Manage)
  async updateField(
    @Args('slug') slug: string,
    @Args('key') key: string,
    @Args('input') input: UpdateFieldInput,
  ): Promise<FieldDefinitionModel> {
    return toFieldDefinitionModel(await this.types.updateField(slug, key, input));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Settings.Manage)
  async removeField(
    @Args('slug') slug: string,
    @Args('key') key: string,
  ): Promise<boolean> {
    await this.types.removeField(slug, key);
    return true;
  }
}

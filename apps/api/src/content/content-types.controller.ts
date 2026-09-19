import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ContentTypesService } from './content-types.service';
import { FieldTypeRegistry } from './field-types/field-type.registry';
import { RequireCapability } from '../rbac/require-capability.decorator';
import { Capabilities } from '../rbac/capabilities';
import {
  CreateContentTypeDto,
  FieldDefinitionDto,
  UpdateContentTypeDto,
} from './dto/content-type.dto';

/**
 * Schema management. Reading a type needs content:read; changing the schema
 * (creating types, adding fields) is an admin action gated by settings:manage.
 */
@Controller()
export class ContentTypesController {
  constructor(
    private readonly types: ContentTypesService,
    private readonly registry: FieldTypeRegistry,
  ) {}

  /** The field types this instance supports (core + plugin-registered). */
  @Get('field-types')
  @RequireCapability(Capabilities.Content.Read)
  fieldTypes() {
    return this.registry.list().map((t) => ({ id: t.id, label: t.label }));
  }

  @Get('content-types')
  @RequireCapability(Capabilities.Content.Read)
  list() {
    return this.types.list();
  }

  @Get('content-types/:slug')
  @RequireCapability(Capabilities.Content.Read)
  async get(@Param('slug') slug: string) {
    const type = await this.types.getBySlug(slug);
    return { ...type, fields: await this.types.getFields(type.id) };
  }

  @Post('content-types')
  @RequireCapability(Capabilities.Settings.Manage)
  create(@Body() dto: CreateContentTypeDto) {
    return this.types.create(dto);
  }

  @Patch('content-types/:slug')
  @RequireCapability(Capabilities.Settings.Manage)
  update(@Param('slug') slug: string, @Body() dto: UpdateContentTypeDto) {
    return this.types.update(slug, dto);
  }

  @Delete('content-types/:slug')
  @HttpCode(204)
  @RequireCapability(Capabilities.Settings.Manage)
  async remove(@Param('slug') slug: string) {
    await this.types.delete(slug);
  }

  @Post('content-types/:slug/fields')
  @RequireCapability(Capabilities.Settings.Manage)
  addField(@Param('slug') slug: string, @Body() dto: FieldDefinitionDto) {
    return this.types.addField(slug, dto);
  }

  @Delete('content-types/:slug/fields/:key')
  @HttpCode(204)
  @RequireCapability(Capabilities.Settings.Manage)
  async removeField(@Param('slug') slug: string, @Param('key') key: string) {
    await this.types.removeField(slug, key);
  }
}

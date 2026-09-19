import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TaxonomyService } from './taxonomy.service';
import { RequireCapability } from '../rbac/require-capability.decorator';
import { Capabilities } from '../rbac/capabilities';

class CreateTaxonomyDto {
  @IsString() @MinLength(1) @MaxLength(64) slug!: string;
  @IsString() @MaxLength(128) name!: string;
  @IsOptional() config?: Record<string, unknown>;
}

class CreateTermDto {
  @IsString() @MinLength(1) @MaxLength(128) slug!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() parentId?: string | null;
}

class SetEntryTermsDto {
  @IsArray() @IsString({ each: true }) termIds!: string[];
}

/**
 * Taxonomy/term management (schema-ish, so gated by settings:manage), plus
 * attaching terms to entries (a content edit, gated by content:update).
 */
@Controller()
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get('taxonomies')
  @RequireCapability(Capabilities.Content.Read)
  list() {
    return this.taxonomy.listTaxonomies();
  }

  @Post('taxonomies')
  @RequireCapability(Capabilities.Settings.Manage)
  create(@Body() dto: CreateTaxonomyDto) {
    return this.taxonomy.createTaxonomy(dto);
  }

  @Delete('taxonomies/:slug')
  @HttpCode(204)
  @RequireCapability(Capabilities.Settings.Manage)
  async remove(@Param('slug') slug: string) {
    await this.taxonomy.deleteTaxonomy(slug);
  }

  @Get('taxonomies/:slug/terms')
  @RequireCapability(Capabilities.Content.Read)
  terms(@Param('slug') slug: string) {
    return this.taxonomy.listTerms(slug);
  }

  @Post('taxonomies/:slug/terms')
  @RequireCapability(Capabilities.Settings.Manage)
  createTerm(@Param('slug') slug: string, @Body() dto: CreateTermDto) {
    return this.taxonomy.createTerm(slug, dto);
  }

  @Delete('terms/:id')
  @HttpCode(204)
  @RequireCapability(Capabilities.Settings.Manage)
  async removeTerm(@Param('id') id: string) {
    await this.taxonomy.deleteTerm(id);
  }

  @Get('entries/:id/terms')
  @RequireCapability(Capabilities.Content.Read)
  entryTerms(@Param('id') id: string) {
    return this.taxonomy.getEntryTerms(id);
  }

  @Put('entries/:id/terms')
  @RequireCapability(Capabilities.Content.Update)
  setEntryTerms(@Param('id') id: string, @Body() dto: SetEntryTermsDto) {
    return this.taxonomy.setEntryTerms(id, dto.termIds);
  }
}

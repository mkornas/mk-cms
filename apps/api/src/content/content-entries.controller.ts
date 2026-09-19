import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ContentEntriesService } from './content-entries.service';
import { RequireCapability } from '../rbac/require-capability.decorator';
import { Capabilities } from '../rbac/capabilities';
import { ContentStatus } from './entities/content-entry.entity';
import { CreateEntryDto, UpdateEntryDto } from './dto/content-entry.dto';

@Controller()
export class ContentEntriesController {
  constructor(private readonly entries: ContentEntriesService) {}

  @Post('content/:type/entries')
  @RequireCapability(Capabilities.Content.Create)
  create(@Param('type') type: string, @Body() dto: CreateEntryDto) {
    return this.entries.create(type, dto);
  }

  @Get('content/:type/entries')
  @RequireCapability(Capabilities.Content.Read)
  list(
    @Param('type') type: string,
    @Query('status') status?: ContentStatus,
    @Query('locale') locale?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.entries.list(type, {
      status,
      locale,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('entries/:id')
  @RequireCapability(Capabilities.Content.Read)
  get(@Param('id') id: string) {
    return this.entries.getById(id);
  }

  @Patch('entries/:id')
  @RequireCapability(Capabilities.Content.Update)
  update(@Param('id') id: string, @Body() dto: UpdateEntryDto) {
    return this.entries.update(id, dto);
  }

  @Post('entries/:id/publish')
  @RequireCapability(Capabilities.Content.Publish)
  publish(@Param('id') id: string) {
    return this.entries.publish(id);
  }

  @Post('entries/:id/unpublish')
  @RequireCapability(Capabilities.Content.Publish)
  unpublish(@Param('id') id: string) {
    return this.entries.unpublish(id);
  }

  @Delete('entries/:id')
  @HttpCode(200)
  @RequireCapability(Capabilities.Content.Delete)
  trash(@Param('id') id: string) {
    return this.entries.trash(id);
  }

  @Get('entries/:id/revisions')
  @RequireCapability(Capabilities.Content.Read)
  revisions(@Param('id') id: string) {
    return this.entries.listRevisions(id);
  }
}

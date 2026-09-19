import { Global, Module, OnModuleInit } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentType } from './entities/content-type.entity';
import { FieldDefinition } from './entities/field-definition.entity';
import { ContentEntry } from './entities/content-entry.entity';
import { ContentRevision } from './entities/content-revision.entity';
import { FieldTypeRegistry } from './field-types/field-type.registry';
import { ContentFieldValidator } from './field-types/content-field-validator';
import { CORE_FIELD_TYPES } from './field-types/core-field-types';
import { ContentTypesService } from './content-types.service';
import { ContentEntriesService } from './content-entries.service';
import { ContentTypesController } from './content-types.controller';
import { ContentEntriesController } from './content-entries.controller';
import { ContentExceptionFilter } from './content-exception.filter';

/**
 * The content engine. Global so plugins (P4) can inject the
 * {@link FieldTypeRegistry} to register new field types and the content
 * services to seed/manipulate content. Core field types are registered once at
 * boot.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentType,
      FieldDefinition,
      ContentEntry,
      ContentRevision,
    ]),
  ],
  controllers: [ContentTypesController, ContentEntriesController],
  providers: [
    FieldTypeRegistry,
    ContentFieldValidator,
    ContentTypesService,
    ContentEntriesService,
    { provide: APP_FILTER, useClass: ContentExceptionFilter },
  ],
  exports: [
    FieldTypeRegistry,
    ContentFieldValidator,
    ContentTypesService,
    ContentEntriesService,
  ],
})
export class ContentModule implements OnModuleInit {
  constructor(private readonly registry: FieldTypeRegistry) {}

  onModuleInit(): void {
    for (const fieldType of CORE_FIELD_TYPES) {
      if (!this.registry.has(fieldType.id)) {
        this.registry.register(fieldType);
      }
    }
  }
}

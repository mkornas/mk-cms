import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ContentType, ContentTypeConfig } from './entities/content-type.entity';
import { FieldDefinition } from './entities/field-definition.entity';
import { FieldTypeRegistry } from './field-types/field-type.registry';
import { TenantContextService } from '../tenancy/tenant-context.service';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_RE = /^[a-z][a-z0-9_]*$/;

export interface FieldDefinitionInput {
  key: string;
  name: string;
  type: string;
  required?: boolean;
  config?: Record<string, unknown>;
  sortOrder?: number;
}

export interface CreateContentTypeInput {
  slug: string;
  name: string;
  description?: string;
  config?: ContentTypeConfig;
  fields?: FieldDefinitionInput[];
}

/**
 * Manages content-type schemas and their field definitions. All operations are
 * scoped to the active site, so one tenant can never see or mutate another's
 * types. Field types are validated against the {@link FieldTypeRegistry} so a
 * type can only reference field kinds the instance actually supports.
 */
@Injectable()
export class ContentTypesService {
  constructor(
    @InjectRepository(ContentType)
    private readonly types: Repository<ContentType>,
    @InjectRepository(FieldDefinition)
    private readonly fields: Repository<FieldDefinition>,
    private readonly registry: FieldTypeRegistry,
    private readonly tenant: TenantContextService,
    private readonly dataSource: DataSource,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  list(): Promise<ContentType[]> {
    return this.types.find({
      where: { siteId: this.siteId() },
      order: { slug: 'ASC' },
    });
  }

  async getBySlug(slug: string): Promise<ContentType> {
    const type = await this.types.findOne({
      where: { siteId: this.siteId(), slug },
    });
    if (!type) throw new NotFoundException(`Unknown content type "${slug}"`);
    return type;
  }

  async getById(id: string): Promise<ContentType> {
    const type = await this.types.findOne({
      where: { siteId: this.siteId(), id },
    });
    if (!type) throw new NotFoundException('Content type not found.');
    return type;
  }

  getFields(contentTypeId: string): Promise<FieldDefinition[]> {
    return this.fields.find({
      where: { siteId: this.siteId(), contentTypeId },
      order: { sortOrder: 'ASC', key: 'ASC' },
    });
  }

  async create(input: CreateContentTypeInput): Promise<ContentType> {
    const siteId = this.siteId();
    if (!SLUG_RE.test(input.slug)) {
      throw new BadRequestException(
        'Content type slug must be lowercase words separated by hyphens.',
      );
    }
    if (await this.types.findOne({ where: { siteId, slug: input.slug } })) {
      throw new ConflictException(
        `A content type "${input.slug}" already exists.`,
      );
    }
    const fieldInputs = input.fields ?? [];
    this.assertValidFields(fieldInputs);

    return this.dataSource.transaction(async (manager) => {
      const type = await manager.save(
        manager.create(ContentType, {
          siteId,
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          config: input.config ?? {},
          isCore: false,
        }),
      );
      if (fieldInputs.length > 0) {
        await manager.save(
          fieldInputs.map((f, i) =>
            manager.create(FieldDefinition, {
              siteId,
              contentTypeId: type.id,
              key: f.key,
              name: f.name,
              type: f.type,
              required: f.required ?? false,
              config: f.config ?? {},
              sortOrder: f.sortOrder ?? i,
            }),
          ),
        );
      }
      return type;
    });
  }

  async update(
    slug: string,
    patch: Partial<Pick<ContentType, 'name' | 'description' | 'config'>>,
  ): Promise<ContentType> {
    const type = await this.getBySlug(slug);
    Object.assign(type, {
      name: patch.name ?? type.name,
      description: patch.description ?? type.description,
      config: patch.config ?? type.config,
    });
    return this.types.save(type);
  }

  async delete(slug: string): Promise<void> {
    const type = await this.getBySlug(slug);
    if (type.isCore) {
      throw new ForbiddenException(`Core content type "${slug}" cannot be deleted.`);
    }
    await this.types.remove(type);
  }

  // ── field management ───────────────────────────────
  async addField(
    slug: string,
    input: FieldDefinitionInput,
  ): Promise<FieldDefinition> {
    const type = await this.getBySlug(slug);
    this.assertValidFields([input]);
    const exists = await this.fields.findOne({
      where: { contentTypeId: type.id, key: input.key },
    });
    if (exists) {
      throw new ConflictException(
        `Field "${input.key}" already exists on "${slug}".`,
      );
    }
    return this.fields.save(
      this.fields.create({
        siteId: type.siteId,
        contentTypeId: type.id,
        key: input.key,
        name: input.name,
        type: input.type,
        required: input.required ?? false,
        config: input.config ?? {},
        sortOrder: input.sortOrder ?? 0,
      }),
    );
  }

  async removeField(slug: string, key: string): Promise<void> {
    const type = await this.getBySlug(slug);
    const field = await this.fields.findOne({
      where: { contentTypeId: type.id, key },
    });
    if (!field) throw new NotFoundException(`Unknown field "${key}"`);
    await this.fields.remove(field);
  }

  /** Update an existing field's definition. The `key` is immutable (entry data
   *  is stored under it); everything else can change. */
  async updateField(
    slug: string,
    key: string,
    patch: {
      name?: string;
      type?: string;
      required?: boolean;
      config?: Record<string, unknown>;
      sortOrder?: number;
    },
  ): Promise<FieldDefinition> {
    const type = await this.getBySlug(slug);
    const field = await this.fields.findOne({
      where: { contentTypeId: type.id, key },
    });
    if (!field) throw new NotFoundException(`Unknown field "${key}"`);
    if (patch.type !== undefined && !this.registry.has(patch.type)) {
      throw new BadRequestException(
        `Unknown field type "${patch.type}" (available: ${this.registry.ids().join(', ')}).`,
      );
    }
    if (patch.name !== undefined) field.name = patch.name;
    if (patch.type !== undefined) field.type = patch.type;
    if (patch.required !== undefined) field.required = patch.required;
    if (patch.config !== undefined) field.config = patch.config;
    if (patch.sortOrder !== undefined) field.sortOrder = patch.sortOrder;
    return this.fields.save(field);
  }

  private assertValidFields(fields: FieldDefinitionInput[]): void {
    const seen = new Set<string>();
    for (const f of fields) {
      if (!KEY_RE.test(f.key)) {
        throw new BadRequestException(
          `Field key "${f.key}" must start with a letter and use only a-z, 0-9, _.`,
        );
      }
      if (seen.has(f.key)) {
        throw new BadRequestException(`Duplicate field key "${f.key}".`);
      }
      seen.add(f.key);
      if (!this.registry.has(f.type)) {
        throw new BadRequestException(
          `Unknown field type "${f.type}" (available: ${this.registry
            .ids()
            .join(', ')}).`,
        );
      }
    }
  }
}

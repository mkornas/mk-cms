import type { User } from '../../users/entities/user.entity';
import type { ContentType } from '../../content/entities/content-type.entity';
import type { FieldDefinition } from '../../content/entities/field-definition.entity';
import type { ContentEntry } from '../../content/entities/content-entry.entity';
import type { ContentRevision } from '../../content/entities/content-revision.entity';
import type { Taxonomy } from '../../taxonomy/entities/taxonomy.entity';
import type { Term } from '../../taxonomy/entities/term.entity';
import { UserModel } from './user.model';
import {
  ContentTypeModel,
  EntryModel,
  FieldDefinitionModel,
  RevisionModel,
} from './content.model';
import { TaxonomyModel, TermModel } from './taxonomy.model';

/**
 * Entity → GraphQL model projections. Keeping these pure and centralized means
 * the admin and delivery resolvers expose an identical shape and nothing leaks
 * fields that only exist on the persistence entity (e.g. the password hash).
 */

export function toUserModel(user: User): UserModel {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    status: user.status,
    isSuperAdmin: user.isSuperAdmin,
  };
}

export function toFieldDefinitionModel(
  def: FieldDefinition,
): FieldDefinitionModel {
  return {
    id: def.id,
    key: def.key,
    name: def.name,
    type: def.type,
    required: def.required,
    config: def.config,
    sortOrder: def.sortOrder,
  };
}

export function toContentTypeModel(
  type: ContentType,
  fields?: FieldDefinition[],
): ContentTypeModel {
  return {
    id: type.id,
    slug: type.slug,
    name: type.name,
    description: type.description,
    config: type.config as Record<string, unknown>,
    isCore: type.isCore,
    fields: fields?.map(toFieldDefinitionModel),
  };
}

/** Requires the entry's content-type slug (resolved by the caller). */
export function toEntryModel(entry: ContentEntry, typeSlug: string): EntryModel {
  return {
    id: entry.id,
    type: typeSlug,
    slug: entry.slug,
    title: entry.title,
    status: entry.status,
    locale: entry.locale,
    parentId: entry.parentId,
    translationGroupId: entry.translationGroupId,
    fields: entry.fields,
    publishedAt: entry.publishedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    authorId: entry.authorId,
  };
}

export function toRevisionModel(rev: ContentRevision): RevisionModel {
  return {
    id: rev.id,
    authorId: rev.authorId,
    data: rev.data as unknown as Record<string, unknown>,
    createdAt: rev.createdAt,
  };
}

export function toTaxonomyModel(tax: Taxonomy): TaxonomyModel {
  return {
    id: tax.id,
    slug: tax.slug,
    name: tax.name,
    config: tax.config as Record<string, unknown>,
    isCore: tax.isCore,
  };
}

export function toTermModel(term: Term): TermModel {
  return {
    id: term.id,
    taxonomyId: term.taxonomyId,
    slug: term.slug,
    name: term.name,
    description: term.description,
    parentId: term.parentId,
    entryCount: 0,
  };
}

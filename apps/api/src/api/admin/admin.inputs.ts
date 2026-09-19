import { Field, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { GraphQLJSON } from '../models/scalars';
import { ContentStatus } from '../../content/entities/content-entry.entity';

/**
 * GraphQL input types. Every field carries a class-validator decorator: the
 * global `ValidationPipe({ whitelist: true })` strips any property without one,
 * so the JSON blobs (`fields`, `config`) use `@Allow()` to pass through
 * untouched while the field validator / service enforce their real shape.
 */

@InputType()
export class FieldDefinitionInput {
  @Field()
  @IsString()
  key!: string;

  @Field()
  @IsString()
  name!: string;

  @Field()
  @IsString()
  type!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  config?: Record<string, unknown>;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@InputType()
export class UpdateFieldInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  type?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  config?: Record<string, unknown>;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@InputType()
export class CreateContentTypeInput {
  @Field()
  @IsString()
  slug!: string;

  @Field()
  @IsString()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  config?: Record<string, unknown>;

  @Field(() => [FieldDefinitionInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionInput)
  fields?: FieldDefinitionInput[];
}

@InputType()
export class UpdateContentTypeInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  config?: Record<string, unknown>;
}

@InputType()
export class CreateEntryInput {
  @Field()
  @IsString()
  title!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  slug?: string;

  @Field(() => ContentStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  locale?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  fields?: Record<string, unknown>;
}

@InputType()
export class UpdateEntryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  slug?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  fields?: Record<string, unknown>;
}

@InputType()
export class CreateTaxonomyInput {
  @Field()
  @IsString()
  slug!: string;

  @Field()
  @IsString()
  name!: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  config?: Record<string, unknown>;
}

@InputType()
export class CreateTermInput {
  @Field()
  @IsString()
  slug!: string;

  @Field()
  @IsString()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

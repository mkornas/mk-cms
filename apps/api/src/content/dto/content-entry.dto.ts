import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContentStatus } from '../entities/content-entry.entity';

export class CreateEntryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  locale?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;
}

export class UpdateEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string | null;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;
}

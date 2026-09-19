import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class FieldDefinitionDto {
  @IsString()
  @MaxLength(64)
  key!: string;

  @IsString()
  @MaxLength(128)
  name!: string;

  @IsString()
  @MaxLength(64)
  type!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateContentTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  slug!: string;

  @IsString()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionDto)
  fields?: FieldDefinitionDto[];
}

export class UpdateContentTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

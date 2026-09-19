import {
  Args,
  Field,
  Float,
  ID,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { MediaService } from '../../media/media.service';
import { Media } from '../../media/entities/media.entity';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { MediaModel } from '../models/media.model';

@InputType()
export class FocalPointInput {
  @Field(() => Float)
  @IsNumber()
  x!: number;

  @Field(() => Float)
  @IsNumber()
  y!: number;
}

@InputType()
export class UpdateMediaInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  alt?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  title?: string | null;

  @Field(() => FocalPointInput, { nullable: true })
  @IsOptional()
  focalPoint?: FocalPointInput | null;
}

export function toMediaModel(m: Media): MediaModel {
  return {
    id: m.id,
    filename: m.filename,
    url: m.url,
    mime: m.mime,
    size: m.size,
    width: m.width,
    height: m.height,
    alt: m.alt,
    title: m.title,
    focalPoint: m.focalPoint as Record<string, unknown> | null,
    variants: m.variants,
    createdAt: m.createdAt,
  };
}

/** Media-library management. Uploads happen over REST (`POST /media`); this
 * covers browsing and editing metadata. */
@Resolver(() => MediaModel)
export class MediaResolver {
  constructor(private readonly service: MediaService) {}

  @Query(() => [MediaModel])
  @RequireCapability(Capabilities.Media.Read)
  async media(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<MediaModel[]> {
    return (await this.service.list({ limit, offset })).map(toMediaModel);
  }

  @Query(() => MediaModel)
  @RequireCapability(Capabilities.Media.Read)
  async mediaItem(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<MediaModel> {
    return toMediaModel(await this.service.getById(id));
  }

  @Mutation(() => MediaModel)
  @RequireCapability(Capabilities.Media.Upload)
  async updateMedia(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateMediaInput,
  ): Promise<MediaModel> {
    return toMediaModel(await this.service.update(id, input));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Media.Delete)
  async deleteMedia(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.service.delete(id);
    return true;
  }
}

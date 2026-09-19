import { Args, ID, InputType, Field, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { RedirectsService } from '../../redirects/redirects.service';
import { Redirect } from '../../redirects/entities/redirect.entity';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { RedirectModel } from '../models/redirect.model';

@InputType()
export class CreateRedirectInput {
  @Field()
  @IsString()
  fromPath!: string;

  @Field()
  @IsString()
  toPath!: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  statusCode?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@InputType()
export class UpdateRedirectInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  toPath?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  statusCode?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

function toModel(r: Redirect): RedirectModel {
  return {
    id: r.id,
    fromPath: r.fromPath,
    toPath: r.toPath,
    statusCode: r.statusCode,
    enabled: r.enabled,
    hits: r.hits,
  };
}

/** Redirect management (`redirect:manage`). */
@Resolver(() => RedirectModel)
export class RedirectResolver {
  constructor(private readonly service: RedirectsService) {}

  @Query(() => [RedirectModel])
  @RequireCapability(Capabilities.Redirect.Manage)
  async redirects(): Promise<RedirectModel[]> {
    return (await this.service.list()).map(toModel);
  }

  @Mutation(() => RedirectModel)
  @RequireCapability(Capabilities.Redirect.Manage)
  async createRedirect(
    @Args('input') input: CreateRedirectInput,
  ): Promise<RedirectModel> {
    return toModel(await this.service.create(input));
  }

  @Mutation(() => RedirectModel)
  @RequireCapability(Capabilities.Redirect.Manage)
  async updateRedirect(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateRedirectInput,
  ): Promise<RedirectModel> {
    return toModel(await this.service.update(id, input));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Redirect.Manage)
  async deleteRedirect(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.service.delete(id);
    return true;
  }
}

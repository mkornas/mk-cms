import {
  Args,
  Field,
  ID,
  InputType,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import {
  Allow,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  ResolvedSeo,
  SeoService,
  SeoSiteSettings,
} from '../../seo/seo.service';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { GraphQLJSON } from '../models/scalars';
import { SeoMetaModel, SeoSettingsModel } from '../models/seo.model';

@InputType()
export class SeoMetaInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  title?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  canonical?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  ogTitle?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  ogDescription?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  ogImage?: string | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  noindex?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  jsonLd?: Record<string, unknown> | null;
}

@InputType()
export class SeoSettingsInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  titleTemplate?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  defaultDescription?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsString({ each: true })
  robotsDisallow?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  noindexSite?: boolean;
}

function toSettingsModel(s: SeoSiteSettings): SeoSettingsModel {
  return {
    baseUrl: s.baseUrl ?? null,
    titleTemplate: s.titleTemplate ?? null,
    defaultDescription: s.defaultDescription ?? null,
    robotsDisallow: s.robotsDisallow ?? [],
    noindexSite: s.noindexSite ?? false,
  };
}

export function toSeoMetaModel(r: ResolvedSeo): SeoMetaModel {
  return {
    title: r.title,
    description: r.description,
    canonical: r.canonical,
    ogTitle: r.ogTitle,
    ogDescription: r.ogDescription,
    ogImage: r.ogImage,
    noindex: r.noindex,
    jsonLd: r.jsonLd,
  };
}

/** SEO administration: per-entry overrides (needs `content:update`) and
 * per-site settings (needs `settings:manage`). */
@Resolver()
export class SeoResolver {
  constructor(private readonly seo: SeoService) {}

  @Query(() => SeoSettingsModel)
  @RequireCapability(Capabilities.Settings.Manage)
  async seoSettings(): Promise<SeoSettingsModel> {
    return toSettingsModel(await this.seo.siteSettings());
  }

  @Mutation(() => SeoSettingsModel)
  @RequireCapability(Capabilities.Settings.Manage)
  async updateSeoSettings(
    @Args('input') input: SeoSettingsInput,
  ): Promise<SeoSettingsModel> {
    return toSettingsModel(await this.seo.updateSiteSettings(input));
  }

  @Mutation(() => SeoMetaModel)
  @RequireCapability(Capabilities.Content.Update)
  async setEntrySeo(
    @Args('entryId', { type: () => ID }) entryId: string,
    @Args('input') input: SeoMetaInput,
  ): Promise<SeoMetaModel> {
    await this.seo.setForEntry(entryId, input);
    // Return the fully-resolved SEO so the admin sees the effective result.
    return toSeoMetaModel(await this.seo.resolveForEntryId(entryId));
  }
}

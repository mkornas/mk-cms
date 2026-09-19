import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { Allow, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FormsService } from '../../forms/forms.service';
import { Form } from '../../forms/entities/form.entity';
import { FormSubmission } from '../../forms/entities/form-submission.entity';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { GraphQLJSON } from '../models/scalars';
import { FormModel, FormSubmissionModel } from '../models/form.model';

@InputType()
export class FormFieldInput {
  @Field()
  @IsString()
  key!: string;

  @Field()
  @IsString()
  type!: string;

  @Field()
  @IsString()
  label!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  config?: Record<string, unknown>;
}

@InputType()
export class CreateFormInput {
  @Field()
  @IsString()
  slug!: string;

  @Field()
  @IsString()
  name!: string;

  @Field(() => [FormFieldInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FormFieldInput)
  fields?: FormFieldInput[];

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  settings?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@InputType()
export class UpdateFormInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [FormFieldInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FormFieldInput)
  fields?: FormFieldInput[];

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @Allow()
  settings?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

function toFormModel(f: Form): FormModel {
  return {
    id: f.id,
    slug: f.slug,
    name: f.name,
    fields: f.fields.map((x) => ({
      key: x.key,
      type: x.type,
      label: x.label,
      required: x.required ?? false,
      config: x.config ?? {},
    })),
    settings: f.settings as Record<string, unknown>,
    enabled: f.enabled,
  };
}

function toSubmissionModel(s: FormSubmission): FormSubmissionModel {
  return {
    id: s.id,
    data: s.data,
    meta: s.meta as Record<string, unknown>,
    createdAt: s.createdAt,
  };
}

/** Form builder + submissions management (`form:manage`). */
@Resolver(() => FormModel)
export class FormResolver {
  constructor(private readonly service: FormsService) {}

  @Query(() => [FormModel])
  @RequireCapability(Capabilities.Form.Manage)
  async forms(): Promise<FormModel[]> {
    return (await this.service.list()).map(toFormModel);
  }

  @Query(() => FormModel)
  @RequireCapability(Capabilities.Form.Manage)
  async form(@Args('slug') slug: string): Promise<FormModel> {
    return toFormModel(await this.service.getBySlug(slug));
  }

  @Query(() => [FormSubmissionModel])
  @RequireCapability(Capabilities.Form.Manage)
  async formSubmissions(
    @Args('slug') slug: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<FormSubmissionModel[]> {
    return (await this.service.listSubmissions(slug, { limit, offset })).map(
      toSubmissionModel,
    );
  }

  @Mutation(() => FormModel)
  @RequireCapability(Capabilities.Form.Manage)
  async createForm(@Args('input') input: CreateFormInput): Promise<FormModel> {
    return toFormModel(await this.service.create(input));
  }

  @Mutation(() => FormModel)
  @RequireCapability(Capabilities.Form.Manage)
  async updateForm(
    @Args('slug') slug: string,
    @Args('input') input: UpdateFormInput,
  ): Promise<FormModel> {
    return toFormModel(await this.service.update(slug, input));
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Form.Manage)
  async deleteForm(@Args('slug') slug: string): Promise<boolean> {
    await this.service.delete(slug);
    return true;
  }

  @Mutation(() => Boolean)
  @RequireCapability(Capabilities.Form.Manage)
  async deleteFormSubmission(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.service.deleteSubmission(id);
    return true;
  }
}

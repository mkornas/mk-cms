import { BadRequestException } from '@nestjs/common';
import { Args, Field, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { OptionsService } from '../../options/options.service';
import { Option } from '../../options/entities/option.entity';
import { RequireCapability } from '../../rbac/require-capability.decorator';
import { Capabilities } from '../../rbac/capabilities';
import { GraphQLJSON } from '../models/scalars';

/** A single site option (key/value pair from the settings store). */
@ObjectType('Option')
export class OptionModel {
  @Field()
  key!: string;

  @Field(() => GraphQLJSON, { nullable: true })
  value!: unknown;

  @Field()
  autoload!: boolean;
}

function toModel(o: Option): OptionModel {
  return { key: o.key, value: o.value, autoload: o.autoload };
}

/** General settings: the active site's key/value option store. Gated by
 * `settings:manage`. */
@Resolver(() => OptionModel)
export class OptionsResolver {
  constructor(private readonly optionsSvc: OptionsService) {}

  @Query(() => [OptionModel])
  @RequireCapability(Capabilities.Settings.Manage)
  async options(): Promise<OptionModel[]> {
    return (await this.optionsSvc.list()).map(toModel);
  }

  @Mutation(() => OptionModel)
  @RequireCapability(Capabilities.Settings.Manage)
  async setOption(
    @Args('key') key: string,
    @Args('value', { type: () => GraphQLJSON }) value: unknown,
  ): Promise<OptionModel> {
    const k = key.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,190}$/.test(k)) {
      throw new BadRequestException(
        'Option key must be 1–191 chars of letters, digits, and . _ : -',
      );
    }
    await this.optionsSvc.set(k, value);
    return { key: k, value, autoload: true };
  }
}

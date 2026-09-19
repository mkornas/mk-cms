import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from './scalars';

/** One field in a plugin's declarative settings schema (rendered generically
 * by the admin). */
@ObjectType('PluginSettingsField')
export class PluginSettingsFieldModel {
  @Field()
  key!: string;

  @Field()
  type!: string;

  @Field()
  label!: string;

  @Field()
  required!: boolean;

  @Field(() => GraphQLJSON)
  config!: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  default!: unknown;
}

/** An installed plugin as seen by the admin. */
@ObjectType('Plugin')
export class PluginModel {
  @Field()
  name!: string;

  @Field()
  version!: string;

  @Field()
  displayName!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field()
  enabled!: boolean;

  @Field(() => [String])
  capabilities!: string[];

  @Field(() => [PluginSettingsFieldModel])
  settingsSchema!: PluginSettingsFieldModel[];

  /** Effective (defaults-applied) settings values. */
  @Field(() => GraphQLJSON)
  settings!: Record<string, unknown>;
}

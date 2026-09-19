import { Field, Float, ObjectType } from '@nestjs/graphql';
import { EntryModel } from './content.model';

/** One search result: the matched entry plus its relevance and a highlighted
 * snippet (matches wrapped in `<b>…</b>`). */
@ObjectType('SearchHit')
export class SearchHitModel {
  @Field(() => EntryModel)
  entry!: EntryModel;

  @Field(() => Float)
  rank!: number;

  @Field()
  snippet!: string;
}

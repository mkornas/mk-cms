import { GraphQLJSON } from 'graphql-scalars';

/**
 * The flexible half of the hybrid content model is untyped by nature: an
 * entry's `fields` and a content type's `config` differ per site/type, so they
 * cross the API as a `JSON` scalar rather than a statically-generated object
 * type. Clients introspect a type's shape via its {@link FieldDefinitionModel}s.
 */
export { GraphQLJSON };

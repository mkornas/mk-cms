import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { GqlLoaders } from './loader.factory';

/** Injects the per-request DataLoaders attached to the GraphQL context. */
export const Loaders = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GqlLoaders => {
    return GqlExecutionContext.create(ctx).getContext<{ loaders: GqlLoaders }>()
      .loaders;
  },
);

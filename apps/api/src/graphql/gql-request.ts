import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { GqlContextType } from '@nestjs/graphql';
import type { Request } from 'express';

/**
 * Extract the underlying Express request regardless of transport. Our global
 * guards (tenant / auth / capability) run on both the REST controllers and the
 * two GraphQL surfaces; for GraphQL the request lives on the Apollo context
 * (`{ req }`) rather than on `switchToHttp()`.
 */
export function requestFromContext(ctx: ExecutionContext): Request {
  if (ctx.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(ctx).getContext<{ req: Request }>().req;
  }
  return ctx.switchToHttp().getRequest<Request>();
}

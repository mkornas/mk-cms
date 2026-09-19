import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit guard that works inside GraphQL resolvers: pulls the underlying
 * HTTP req/res out of the Apollo context so `@nestjs/throttler` can key on the
 * client IP. Applied to public, brute-forceable mutations (login/refresh/
 * accept-invite) so credential stuffing and token guessing are bounded.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>;
    res: Record<string, unknown>;
  } {
    const gqlCtx = GqlExecutionContext.create(context).getContext();
    return { req: gqlCtx.req, res: gqlCtx.res ?? gqlCtx.req?.res };
  }
}

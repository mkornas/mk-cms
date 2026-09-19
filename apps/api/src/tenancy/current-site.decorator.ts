import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import type { AppClsStore } from './cls-store';
import type { Site } from './entities/site.entity';

/**
 * Injects the resolved active {@link Site} (or undefined) into a handler param.
 * Reads from the request-scoped CLS store populated by the tenant guard.
 */
export const CurrentSite = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): Site | undefined => {
    return ClsServiceManager.getClsService<AppClsStore>().get('site');
  },
);

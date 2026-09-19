import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import type { AppClsStore } from '../tenancy/cls-store';
import type { User } from '../users/entities/user.entity';

/**
 * Injects the authenticated {@link User} (or undefined on public routes) into a
 * handler param, from the CLS store populated by the auth guard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): User | undefined => {
    return ClsServiceManager.getClsService<AppClsStore>().get('user');
  },
);

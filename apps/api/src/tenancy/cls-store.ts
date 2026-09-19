import type { ClsStore } from 'nestjs-cls';
import type { Site } from './entities/site.entity';
import type { User } from '../users/entities/user.entity';

/**
 * Per-request context carried in AsyncLocalStorage (nestjs-cls). Populated by
 * the tenant middleware (site) and the auth guard (user), then read anywhere
 * downstream without threading request objects through every call.
 */
export interface AppClsStore extends ClsStore {
  site?: Site;
  siteId?: string;
  user?: User;
  userId?: string;
}

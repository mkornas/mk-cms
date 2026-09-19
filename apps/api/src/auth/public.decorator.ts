import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'mk:public';

/**
 * Marks a route as not requiring authentication. Applied to login/refresh and
 * health checks; every other route requires a valid access token by default.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

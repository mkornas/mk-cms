import { SetMetadata } from '@nestjs/common';
import type { Capability } from './capabilities';

export const REQUIRE_CAPABILITY_KEY = 'mk:capabilities';

/**
 * Guards a route/resolver behind one or more capabilities on the active site.
 * All listed capabilities must be satisfied (AND). Example:
 *   @RequireCapability(Capabilities.Content.Publish)
 */
export const RequireCapability = (...capabilities: Capability[]) =>
  SetMetadata(REQUIRE_CAPABILITY_KEY, capabilities);

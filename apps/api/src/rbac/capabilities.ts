/**
 * Capability catalogue. Authorization is capability-based (not role-name-based):
 * guards check for a capability string, roles are just bundles of them. This
 * keeps permissions extensible — a plugin can register new capabilities without
 * touching the guard logic.
 *
 * Convention: `resource:action`. Wildcards: `resource:*` grants every action on
 * a resource; `*` grants everything (owner/super-admin).
 */
export const Capabilities = {
  Content: {
    Read: 'content:read',
    Create: 'content:create',
    Update: 'content:update',
    Delete: 'content:delete',
    Publish: 'content:publish',
  },
  Media: {
    Read: 'media:read',
    Upload: 'media:upload',
    Delete: 'media:delete',
  },
  Taxonomy: {
    Manage: 'taxonomy:manage',
  },
  Redirect: {
    Manage: 'redirect:manage',
  },
  Webhook: {
    Manage: 'webhook:manage',
  },
  Audit: {
    Read: 'audit:read',
  },
  Menu: {
    Manage: 'menu:manage',
  },
  Form: {
    Manage: 'form:manage',
  },
  User: {
    Read: 'user:read',
    Invite: 'user:invite',
    Manage: 'user:manage',
  },
  Role: {
    Manage: 'role:manage',
  },
  Settings: {
    Manage: 'settings:manage',
  },
  Site: {
    Manage: 'site:manage',
  },
  Plugin: {
    Manage: 'plugin:manage',
  },
} as const;

/** The super-wildcard — grants every capability. */
export const CAP_ALL = '*';

type Leaf<T> = T extends string ? T : { [K in keyof T]: Leaf<T[K]> }[keyof T];
export type Capability = Leaf<typeof Capabilities>;

/** Flat list of every concrete capability the core ships with. */
export const ALL_CAPABILITIES: Capability[] = Object.values(Capabilities).flatMap(
  (group) => Object.values(group) as Capability[],
);

/**
 * Does a set of granted capability strings satisfy a required capability?
 * Honours `*` and `resource:*` wildcards.
 */
export function can(granted: readonly string[], required: string): boolean {
  if (granted.includes(CAP_ALL)) return true;
  if (granted.includes(required)) return true;
  const resource = required.split(':', 1)[0];
  return granted.includes(`${resource}:*`);
}

export interface SystemRoleDef {
  slug: string;
  name: string;
  capabilities: string[];
}

/**
 * Seeded once as global roles (siteId = null). "owner" is all-powerful; the
 * rest map to familiar WordPress-ish tiers.
 */
export const SYSTEM_ROLES: SystemRoleDef[] = [
  { slug: 'owner', name: 'Owner', capabilities: [CAP_ALL] },
  {
    slug: 'admin',
    name: 'Administrator',
    capabilities: [
      'content:*',
      'media:*',
      Capabilities.Taxonomy.Manage,
      Capabilities.Menu.Manage,
      Capabilities.Form.Manage,
      Capabilities.Redirect.Manage,
      Capabilities.Webhook.Manage,
      Capabilities.Audit.Read,
      'user:*',
      Capabilities.Role.Manage,
      Capabilities.Settings.Manage,
      Capabilities.Site.Manage,
      Capabilities.Plugin.Manage,
    ],
  },
  {
    slug: 'editor',
    name: 'Editor',
    capabilities: [
      'content:*',
      'media:*',
      Capabilities.Taxonomy.Manage,
      Capabilities.Menu.Manage,
      Capabilities.Form.Manage,
      Capabilities.Redirect.Manage,
    ],
  },
  {
    slug: 'author',
    name: 'Author',
    capabilities: [
      Capabilities.Content.Read,
      Capabilities.Content.Create,
      Capabilities.Content.Update,
      Capabilities.Content.Publish,
      Capabilities.Media.Read,
      Capabilities.Media.Upload,
    ],
  },
  {
    slug: 'viewer',
    name: 'Viewer',
    capabilities: [Capabilities.Content.Read, Capabilities.Media.Read],
  },
];

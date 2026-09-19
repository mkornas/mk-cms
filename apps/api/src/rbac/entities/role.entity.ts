import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * A named bundle of capabilities. A role with `siteId = null` is a global
 * system template (owner/admin/editor/…) available to every site; a role with
 * a `siteId` is a custom role defined by that one site.
 *
 * `capabilities` are capability strings (see rbac/capabilities.ts), supporting
 * exact matches, `resource:*` wildcards, and the `*` super-wildcard.
 */
@Entity('roles')
@Index(['siteId', 'slug'], { unique: true })
export class Role extends BaseEntity {
  /** null → global system role shared by all sites. */
  @Column({ type: 'uuid', nullable: true })
  siteId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  slug!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  capabilities!: string[];

  /** System roles are seeded and protected from deletion/editing. */
  @Column({ type: 'boolean', default: false })
  isSystem!: boolean;
}

import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Base for any entity that belongs to a single site. Carries the `siteId`
 * discriminator that the tenant-scoping layer filters on. Every tenant-owned
 * table indexes `siteId` because virtually every query is scoped by it.
 */
export abstract class TenantEntity extends BaseEntity {
  @Index()
  @Column('uuid')
  siteId!: string;
}

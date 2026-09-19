import { Column, Entity, Index } from 'typeorm';
import { TenantEntity } from '../../common/entities/tenant.entity';

/** A processed size of an image. */
export interface MediaVariant {
  key: string; // e.g. "w640"
  storageKey: string;
  url: string;
  format: string; // "webp"
  width: number;
  height: number;
  size: number;
}

/** Normalized focal point (0..1) for art-directed cropping by the frontend. */
export interface FocalPoint {
  x: number;
  y: number;
}

/**
 * A media-library item. The original binary lives in the storage adapter under
 * `storageKey`; for images, `variants` holds responsive renditions and
 * `width`/`height` the intrinsic size. Tenant-scoped. `focalPoint`/`alt` are
 * editorial metadata.
 */
@Entity('media')
@Index(['siteId', 'createdAt'])
export class Media extends TenantEntity {
  @Column({ type: 'varchar', length: 255 })
  filename!: string;

  @Column({ type: 'varchar', length: 1024 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ type: 'varchar', length: 128 })
  mime!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  alt!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  focalPoint!: FocalPoint | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  variants!: MediaVariant[];

  @Column({ type: 'uuid', nullable: true })
  uploadedBy!: string | null;
}

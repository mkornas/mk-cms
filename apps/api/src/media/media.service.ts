import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media, MediaVariant } from './entities/media.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { STORAGE_ADAPTER, StorageAdapter } from './storage/storage.adapter';
import { ImageProcessor } from './image-processor';

export interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface UpdateMediaInput {
  alt?: string | null;
  title?: string | null;
  focalPoint?: { x: number; y: number } | null;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media) private readonly media: Repository<Media>,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    private readonly images: ImageProcessor,
    private readonly tenant: TenantContextService,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  private safeName(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100) || 'file'
    );
  }

  /** Uploadable MIME types. Deliberately excludes SVG and any HTML/script
   *  type: those are served back inline and would be a stored-XSS vector. */
  private static readonly ALLOWED_MIME = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
  ]);

  async upload(file: UploadFile): Promise<Media> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded.');
    }
    if (!MediaService.ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: PNG, JPEG, WebP, GIF, PDF.`,
      );
    }
    const siteId = this.siteId();
    const id = randomUUID();
    const base = `${siteId}/${id}`;
    const filename = this.safeName(file.originalname);
    const storageKey = `${base}/original-${filename}`;

    await this.storage.put(storageKey, file.buffer, file.mimetype);

    let width: number | null = null;
    let height: number | null = null;
    const variants: MediaVariant[] = [];

    if (this.images.isRasterImage(file.mimetype)) {
      const dims = await this.images.probe(file.buffer);
      if (dims) {
        width = dims.width;
        height = dims.height;
        for (const v of await this.images.renderVariants(file.buffer, dims.width)) {
          const key = `${base}/${v.key}.${v.format}`;
          await this.storage.put(key, v.buffer, `image/${v.format}`);
          variants.push({
            key: v.key,
            storageKey: key,
            url: this.storage.url(key),
            format: v.format,
            width: v.width,
            height: v.height,
            size: v.size,
          });
        }
      }
    }

    return this.media.save(
      this.media.create({
        siteId,
        filename,
        storageKey,
        url: this.storage.url(storageKey),
        mime: file.mimetype,
        size: file.size,
        width,
        height,
        variants,
        uploadedBy: this.tenant.userId ?? null,
      }),
    );
  }

  list(opts: { limit?: number; offset?: number } = {}): Promise<Media[]> {
    return this.media.find({
      where: { siteId: this.siteId() },
      order: { createdAt: 'DESC' },
      take: Math.min(opts.limit ?? 50, 200),
      skip: opts.offset ?? 0,
    });
  }

  async getById(id: string): Promise<Media> {
    const item = await this.media.findOne({
      where: { id, siteId: this.siteId() },
    });
    if (!item) throw new NotFoundException('Media not found.');
    return item;
  }

  async update(id: string, patch: UpdateMediaInput): Promise<Media> {
    const item = await this.getById(id);
    if (patch.alt !== undefined) item.alt = patch.alt;
    if (patch.title !== undefined) item.title = patch.title;
    if (patch.focalPoint !== undefined) item.focalPoint = patch.focalPoint;
    return this.media.save(item);
  }

  async delete(id: string): Promise<void> {
    const item = await this.getById(id);
    await Promise.all([
      this.storage.delete(item.storageKey),
      ...item.variants.map((v) => this.storage.delete(v.storageKey)),
    ]);
    await this.media.remove(item);
  }
}

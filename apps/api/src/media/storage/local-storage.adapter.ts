import { promises as fs } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { StorageAdapter } from './storage.adapter';

/**
 * Local-filesystem storage. Objects are written under `MEDIA_LOCAL_DIR` and
 * served by {@link MediaFileController} at `${MEDIA_PUBLIC_URL}/media/file/<key>`.
 * Keys are validated to stay within the root so a crafted key can't escape the
 * media directory (path traversal).
 */
@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string;
  private readonly publicUrl: string;

  constructor(config: AppConfigService) {
    this.root = resolve(config.media.localDir);
    this.publicUrl = config.media.publicUrl.replace(/\/+$/, '');
  }

  private resolveKey(key: string): string {
    const full = resolve(this.root, normalize(key));
    if (full !== this.root && !full.startsWith(this.root + '/')) {
      throw new NotFoundException('Invalid storage key.');
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.resolveKey(key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, data);
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolveKey(key));
    } catch {
      throw new NotFoundException('File not found.');
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolveKey(key), { force: true });
  }

  url(key: string): string {
    return `${this.publicUrl}/media/file/${key
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  }
}

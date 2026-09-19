import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { AppConfigService } from '../../config/app-config.service';
import { StorageAdapter } from './storage.adapter';

/**
 * S3-compatible object storage — works with AWS S3 and MinIO (the self-hosted
 * store). Objects are written to `S3_BUCKET`; public URLs are built from
 * `S3_PUBLIC_URL` (defaulting to `${endpoint}/${bucket}` for a path-style
 * public bucket). Config-selected against {@link LocalStorageAdapter} in the
 * media module, so nothing else changes when you switch backends.
 */
@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: AppConfigService) {
    const s3 = config.s3;
    this.bucket = s3.bucket;
    this.publicUrl = s3.publicUrl;
    this.client = new S3Client({
      endpoint: s3.endpoint,
      region: s3.region,
      forcePathStyle: s3.forcePathStyle,
      credentials: { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return Buffer.from(await res.Body!.transformToByteArray());
    } catch {
      throw new NotFoundException('File not found.');
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  url(key: string): string {
    return `${this.publicUrl}/${key
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  }
}

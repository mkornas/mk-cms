import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/app-config.service';
import { Media } from './entities/media.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { ImageProcessor } from './image-processor';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { S3StorageAdapter } from './storage/s3-storage.adapter';
import { STORAGE_ADAPTER, StorageAdapter } from './storage/storage.adapter';

/**
 * Media library. The {@link STORAGE_ADAPTER} is chosen at boot from
 * `MEDIA_DRIVER` — local filesystem or S3/MinIO — so switching object stores is
 * a config change, not a code change. Image uploads are processed with sharp.
 * Exposes upload + public serving over REST and CRUD over admin GraphQL.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Media])],
  controllers: [MediaController],
  providers: [
    MediaService,
    ImageProcessor,
    {
      provide: STORAGE_ADAPTER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): StorageAdapter =>
        config.media.driver === 's3'
          ? new S3StorageAdapter(config)
          : new LocalStorageAdapter(config),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}

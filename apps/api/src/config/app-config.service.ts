import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

/**
 * Thin, fully-typed accessor over the validated environment. Feature modules
 * inject this instead of reaching into `ConfigService.get('SOME_STRING')`, so
 * config access is autocompleted and refactor-safe.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get app() {
    return {
      env: this.get('NODE_ENV'),
      port: this.get('API_PORT'),
      adminDir: this.get('ADMIN_DIR'),
      host: this.get('API_HOST'),
      adminBaseUrl: this.get('ADMIN_BASE_URL').replace(/\/+$/, ''),
    };
  }

  get database() {
    return {
      host: this.get('DB_HOST'),
      port: this.get('DB_PORT'),
      user: this.get('DB_USER'),
      password: this.get('DB_PASSWORD'),
      name: this.get('DB_NAME'),
      synchronize: this.get('DB_SYNCHRONIZE'),
      logging: this.get('DB_LOGGING'),
      runMigrations: this.get('DB_RUN_MIGRATIONS'),
    };
  }

  get redis() {
    return {
      host: this.get('REDIS_HOST'),
      port: this.get('REDIS_PORT'),
      password: this.get('REDIS_PASSWORD'),
    };
  }

  get jwt() {
    return {
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
    };
  }

  get media() {
    return {
      driver: this.get('MEDIA_DRIVER'),
      localDir: this.get('MEDIA_LOCAL_DIR'),
      publicUrl: this.get('MEDIA_PUBLIC_URL').replace(/\/+$/, ''),
      maxDownloadBytes: this.get('MEDIA_MAX_DOWNLOAD_BYTES'),
    };
  }

  get s3() {
    const endpoint = this.get('S3_ENDPOINT').replace(/\/+$/, '');
    const bucket = this.get('S3_BUCKET');
    const publicUrl = this.get('S3_PUBLIC_URL').replace(/\/+$/, '');
    return {
      endpoint,
      region: this.get('S3_REGION'),
      bucket,
      accessKey: this.get('S3_ACCESS_KEY'),
      secretKey: this.get('S3_SECRET_KEY'),
      forcePathStyle: this.get('S3_FORCE_PATH_STYLE'),
      publicUrl: publicUrl || `${endpoint}/${bucket}`,
    };
  }

  get seed() {
    return {
      enabled: this.get('SEED_ENABLED'),
      ownerEmail: this.get('SEED_OWNER_EMAIL'),
      ownerPassword: this.get('SEED_OWNER_PASSWORD'),
      ownerName: this.get('SEED_OWNER_NAME'),
      siteSlug: this.get('SEED_SITE_SLUG'),
      siteName: this.get('SEED_SITE_NAME'),
      demo: this.get('SEED_DEMO'),
    };
  }
}

import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';
import { ConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';

/** Injection token for the shared ioredis client. */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Provides a single shared ioredis connection used for caching, queues and
 * rate limiting. `lazyConnect` keeps boot resilient; consumers (and the health
 * check) trigger the actual connection.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const { host, port, password } = config.redis;
        return new Redis({
          host,
          port,
          password: password || undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT, { strict: false });
    if (client) {
      await client.quit().catch(() => client.disconnect());
    }
  }
}

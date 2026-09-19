import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Terminus health indicator for Redis. Terminus ships DB/HTTP/memory
 * indicators but not Redis, so we PING the shared client ourselves.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly indicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.indicatorService.check(key);
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect().catch(() => undefined);
      }
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return indicator.down({ message: `unexpected ping reply: ${pong}` });
      }
      return indicator.up();
    } catch (err) {
      return indicator.down({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
import { Public } from '../auth/public.decorator';

/**
 * Liveness/readiness endpoints.
 *   GET /health       → full readiness (DB + Redis) for orchestrators & humans
 *   GET /health/live  → cheap liveness probe (process is up)
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('postgres', { timeout: 3000 }),
      () => this.redis.isHealthy('redis'),
    ]);
  }

  @Get('live')
  live() {
    return { status: 'ok' };
  }
}

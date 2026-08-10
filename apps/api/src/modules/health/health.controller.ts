import { Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common'
import { HealthCheckService, HealthCheckResult } from '@nestjs/terminus'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { PostgresHealthIndicator } from './indicators/postgres.health-indicator'
import { RedisHealthIndicator } from './indicators/redis.health-indicator'
import { RabbitmqHealthIndicator } from './indicators/rabbitmq.health-indicator'

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PostgresHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly rabbitmq: RabbitmqHealthIndicator,
  ) {}

  @Get('health')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60 })
  async check(): Promise<HealthCheckResult> {
    try {
      return await this.health.check([
        () => this.postgres.isHealthy(),
        () => this.redis.isHealthy(),
        () => this.rabbitmq.isHealthy(),
      ])
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return error.getResponse() as HealthCheckResult
      }
      throw error
    }
  }
}

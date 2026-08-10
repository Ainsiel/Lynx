import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorResult } from '@nestjs/terminus'
import Redis from 'ioredis'
import { REDIS_CLIENT } from '../../../common/infra/tokens'
import { LynxHealthIndicator } from './check.helper'

@Injectable()
export class RedisHealthIndicator extends LynxHealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super()
  }

  isHealthy(): Promise<HealthIndicatorResult> {
    return this.runCheck('redis', async () => {
      const pong = await this.redis.ping()
      if (pong !== 'PONG') {
        throw new Error(`unexpected redis response: ${pong}`)
      }
    })
  }
}

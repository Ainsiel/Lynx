import { Inject, Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { z } from 'zod'
import { RateLimitConfigSchema } from '@lynx/shared'
import { REDIS_CLIENT } from '../infra/tokens'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

@Injectable()
export class FixedWindowRateLimiter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(
    config: z.input<typeof RateLimitConfigSchema>,
    key: string,
  ): Promise<RateLimitResult> {
    const { windowMs, limit } = RateLimitConfigSchema.parse(config)
    const count = await this.redis.incr(key)
    if (count === 1) {
      await this.redis.pexpire(key, windowMs)
    }
    if (count > limit) {
      const ttl = await this.redis.pttl(key)
      return { allowed: false, remaining: 0, retryAfterMs: ttl > 0 ? ttl : windowMs }
    }
    return { allowed: true, remaining: limit - count, retryAfterMs: 0 }
  }
}

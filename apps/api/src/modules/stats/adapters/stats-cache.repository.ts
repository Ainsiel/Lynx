import { Inject, Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { REDIS_CLIENT } from '../../../common/infra/tokens'
import type { StatsResponse } from '@lynx/shared'

const CACHE_PREFIX = 'lynx:stats:'
const CACHE_TTL = 60

@Injectable()
export class StatsCacheRepository {
  private readonly logger = new Logger(StatsCacheRepository.name)

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  buildKey(
    slug: string,
    groupBy: string,
    from: string | undefined,
    to: string | undefined,
    page: number,
    pageSize: number,
  ): string {
    return `${CACHE_PREFIX}${slug}:${groupBy}:${from ?? '*'}:${to ?? '*'}:${page}:${pageSize}`
  }

  async get(key: string): Promise<StatsResponse | null> {
    const cached = await this.redis.get(key)
    if (!cached) return null
    try {
      const parsed = JSON.parse(cached) as StatsResponse
      if (parsed && typeof parsed === 'object' && 'total' in parsed && 'breakdown' in parsed) {
        return parsed
      }
    } catch {
      this.logger.warn(`Failed to parse cache key: ${key}`)
    }
    return null
  }

  async set(key: string, data: StatsResponse): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL)
    } catch (err) {
      this.logger.warn(`Failed to set cache key: ${key}`, err)
    }
  }
}

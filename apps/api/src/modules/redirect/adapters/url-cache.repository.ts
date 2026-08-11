import { Inject, Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { REDIS_CLIENT } from '../../../common/infra/tokens'
import type { UrlRecord } from '../../links/adapters/link.repository'

const CACHE_PREFIX = 'lynx:url:'

@Injectable()
export class UrlCacheRepository {
  private readonly logger = new Logger(UrlCacheRepository.name)
  private readonly inflight = new Map<string, Promise<UrlRecord | null>>()

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async resolve(
    slug: string,
    fetchFromDb: () => Promise<UrlRecord | null>,
  ): Promise<UrlRecord | null> {
    const cached = await this.redis.get(`${CACHE_PREFIX}${slug}`)
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as UrlRecord
        if (parsed && typeof parsed === 'object' && 'originalUrl' in parsed) {
          return parsed
        }
      } catch {
        // Cache contains plain URL string from LinksService, need DB query
      }
    }

    const existing = this.inflight.get(slug)
    if (existing) {
      return existing
    }

    const promise = fetchFromDb()
      .then(async (record) => {
        if (record && record.isActive) {
          await this.redis.set(
            `${CACHE_PREFIX}${slug}`,
            JSON.stringify(record),
            'NX',
          )
        }
        return record
      })
      .finally(() => {
        this.inflight.delete(slug)
      })

    this.inflight.set(slug, promise)
    return promise
  }
}

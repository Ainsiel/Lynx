import { Inject, Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { REDIS_CLIENT } from '../../../common/infra/tokens'

const IDEMPOTENCY_PREFIX = 'lynx:idem:'
const IDEMPOTENCY_TTL_SECONDS = 86400 // 24h

export interface IdempotencyRecord {
  userId: string
  response: unknown
}

@Injectable()
export class IdempotencyRepository {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async find(key: string): Promise<IdempotencyRecord | null> {
    const raw = await this.redis.get(`${IDEMPOTENCY_PREFIX}${key}`)
    if (!raw) return null
    try {
      return JSON.parse(raw) as IdempotencyRecord
    } catch {
      return null
    }
  }

  async store(key: string, userId: string, response: unknown): Promise<void> {
    const record: IdempotencyRecord = { userId, response }
    await this.redis.set(
      `${IDEMPOTENCY_PREFIX}${key}`,
      JSON.stringify(record),
      'EX',
      IDEMPOTENCY_TTL_SECONDS,
    )
  }
}

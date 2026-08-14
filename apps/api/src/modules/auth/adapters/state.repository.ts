import { Inject, Injectable } from '@nestjs/common'
import { randomBytes, createHash } from 'node:crypto'
import Redis from 'ioredis'
import { REDIS_CLIENT } from '../../../common/infra/tokens'

const STATE_PREFIX = 'lynx:oauth:state:'
const STATE_TTL_SECONDS = 600

@Injectable()
export class StateRepository {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  createState(): string {
    const state = randomBytes(32).toString('hex')
    const hash = createHash('sha256').update(state).digest('hex')
    this.redis.set(`${STATE_PREFIX}${hash}`, '1', 'EX', STATE_TTL_SECONDS)
    return state
  }

  async verifyState(state: string): Promise<boolean> {
    const hash = createHash('sha256').update(state).digest('hex')
    const key = `${STATE_PREFIX}${hash}`
    const exists = await this.redis.exists(key)
    if (exists) {
      await this.redis.del(key)
    }
    return exists === 1
  }
}

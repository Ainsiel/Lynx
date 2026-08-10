import Redis from 'ioredis'
import { FixedWindowRateLimiter } from '../src/common/rate-limit/fixed-window-rate-limiter.service'

describe('FixedWindowRateLimiter — ventana fija sobre Redis real', () => {
  let redis: Redis
  let limiter: FixedWindowRateLimiter

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
    await redis.ping()
    limiter = new FixedWindowRateLimiter(redis)
  })

  afterAll(async () => {
    await redis.quit()
  })

  beforeEach(async () => {
    await redis.flushdb()
  })

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  it('permite hasta el límite y bloquea el siguiente request en la misma ventana', async () => {
    const results = [
      await limiter.consume({ windowMs: 1000, limit: 3 }, 'lynx:rate:test:1'),
      await limiter.consume({ windowMs: 1000, limit: 3 }, 'lynx:rate:test:1'),
      await limiter.consume({ windowMs: 1000, limit: 3 }, 'lynx:rate:test:1'),
      await limiter.consume({ windowMs: 1000, limit: 3 }, 'lynx:rate:test:1'),
    ]

    expect(results[0]).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 })
    expect(results[1]).toEqual({ allowed: true, remaining: 1, retryAfterMs: 0 })
    expect(results[2]).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 })
    expect(results[3]?.allowed).toBe(false)
    expect(results[3]?.remaining).toBe(0)
    expect(results[3]?.retryAfterMs).toBeGreaterThan(0)
  })

  it('reinicia el contador cuando expira la ventana', async () => {
    await limiter.consume({ windowMs: 600, limit: 2 }, 'lynx:rate:test:2')
    await limiter.consume({ windowMs: 600, limit: 2 }, 'lynx:rate:test:2')
    const blocked = await limiter.consume({ windowMs: 600, limit: 2 }, 'lynx:rate:test:2')
    expect(blocked.allowed).toBe(false)

    await sleep(700)

    const afterReset = await limiter.consume({ windowMs: 600, limit: 2 }, 'lynx:rate:test:2')
    expect(afterReset.allowed).toBe(true)
    expect(afterReset.remaining).toBe(1)
  })

  it('no comparte el contador entre claves distintas', async () => {
    const a = await limiter.consume({ windowMs: 1000, limit: 1 }, 'lynx:rate:test:client-a')
    const b = await limiter.consume({ windowMs: 1000, limit: 1 }, 'lynx:rate:test:client-b')

    expect(a.allowed).toBe(true)
    expect(b.allowed).toBe(true)
  })
})

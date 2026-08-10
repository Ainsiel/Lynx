import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import Redis from 'ioredis'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('Rate limit fixed-window por endpoint (S3b)', () => {
  let app: INestApplication
  let redis: Redis

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
    await redis.ping()

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    await redis.quit()
  })

  beforeEach(async () => {
    await redis.flushdb()
  })

  it('expone X-RateLimit-Remaining decreciente en /health', async () => {
    const first = await request(app.getHttpServer()).get('/health')
    expect(first.status).toBe(200)
    expect(first.headers['x-ratelimit-limit']).toBe('60')
    expect(first.headers['x-ratelimit-remaining']).toBe('59')
  })

  it('bloquea con 429 + Retry-After al superar el límite', async () => {
    let blocked: request.Response | undefined

    for (let i = 0; i < 61; i += 1) {
      blocked = await request(app.getHttpServer()).get('/health')
    }

    expect(blocked?.status).toBe(429)
    expect(blocked?.headers['x-ratelimit-remaining']).toBe('0')
    expect(Number(blocked?.headers['retry-after'])).toBeGreaterThan(0)
    expect(blocked?.headers['content-type']).toContain('application/problem+json')
    expect(blocked?.body.status).toBe(429)
    expect(blocked?.body.title).toBe('Too Many Requests')
  })
})

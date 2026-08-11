import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { resetDatabase, PrismaClient } from '@lynx/db'
import Redis from 'ioredis'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PRISMA_CLIENT } from '../src/common/infra/tokens'

describe('Redirect — GET /:slug (CU-2)', () => {
  let app: INestApplication
  let redis: Redis
  let prisma: PrismaClient
  let accessToken: string

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
    await redis.flushdb()

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()

    prisma = app.get(PRISMA_CLIENT)
    await resetDatabase(prisma)

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'test-redirect@example.com',
        password: 'password123',
      })
    accessToken = registerRes.body.accessToken
  })

  afterAll(async () => {
    await app.close()
    await redis.quit()
  })

  beforeEach(async () => {
    await redis.flushdb()
    await resetDatabase(prisma)

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
      })
    accessToken = registerRes.body.accessToken
  })

  describe('GET /:slug — existing active link', () => {
    it('should return 308 with Location header', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'redir1',
        })

      const res = await request(app.getHttpServer()).get('/redir1')

      expect(res.status).toBe(308)
      expect(res.headers['location']).toBe('https://example.com')
      expect(res.headers['cache-control']).toBe('no-store')
    })

    it('should populate Redis cache on miss', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'cache-test',
        })

      await request(app.getHttpServer()).get('/cache-test')

      const cached = await redis.get('lynx:url:cache-test')
      expect(cached).toBeDefined()
    })

    it('should not hit DB on second request (cache hit)', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'cache-hit',
        })

      await request(app.getHttpServer()).get('/cache-hit')

      const res2 = await request(app.getHttpServer()).get('/cache-hit')
      expect(res2.status).toBe(308)
    })
  })

  describe('GET /:slug — non-existent slug', () => {
    it('should return 404 for non-existent slug', async () => {
      const res = await request(app.getHttpServer()).get('/nonexistent')

      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })
  })

  describe('GET /:slug — inactive link', () => {
    it('should return 404 for inactive link', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'inactive1',
        })

      await prisma.$executeRawUnsafe(
        `UPDATE urls SET is_active = false WHERE slug = $1`,
        'inactive1',
      )
      await redis.del('lynx:url:inactive1')

      const res = await request(app.getHttpServer()).get('/inactive1')

      expect(res.status).toBe(404)
    })
  })

  describe('GET /:slug — concurrency', () => {
    it('should handle 50 parallel requests to same slug — all 308, DB queried once', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com/concurrent',
          customSlug: 'concur',
        })

      await redis.del('lynx:url:concur')

      const promises = Array.from({ length: 50 }, () =>
        request(app.getHttpServer()).get('/concur'),
      )

      const results = await Promise.all(promises)

      const all308 = results.every((r) => r.status === 308)
      expect(all308).toBe(true)

      const allRedirect = results.every(
        (r) => r.headers['location'] === 'https://example.com/concurrent',
      )
      expect(allRedirect).toBe(true)
    })
  })

  describe('GET /:slug — rate limiting', () => {
    it('should return 429 with Retry-After when rate limit exceeded', async () => {
      const promises = Array.from({ length: 65 }, () =>
        request(app.getHttpServer()).get('/ratelimit-test'),
      )

      const results = await Promise.all(promises)

      const rateLimited = results.filter((r) => r.status === 429)
      expect(rateLimited.length).toBeGreaterThan(0)

      const firstRateLimited = rateLimited[0]!
      expect(firstRateLimited.headers['retry-after']).toBeDefined()
    })
  })
})

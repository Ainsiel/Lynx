import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { resetDatabase } from '@lynx/db'
import Redis from 'ioredis'
import request, { Response } from 'supertest'
import { AppModule } from '../src/app.module'
import { PRISMA_CLIENT } from '../src/common/infra/tokens'

describe('Links — POST /links (CU-1)', () => {
  let app: INestApplication
  let redis: Redis
  let accessToken: string

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
    await redis.flushdb()

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()

    await resetDatabase(app.get(PRISMA_CLIENT))

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: 'test-links@example.com',
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
    await resetDatabase(app.get(PRISMA_CLIENT))

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
      })
    accessToken = registerRes.body.accessToken
  })

  describe('POST /links with customSlug', () => {
    it('should create a link with free customSlug → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'my-link',
        })

      expect(res.status).toBe(201)
      expect(res.body.slug).toBe('my-link')
      expect(res.body.originalUrl).toBe('https://example.com')
      expect(res.body.isActive).toBe(true)
      expect(res.body.id).toBeDefined()
      expect(res.body.shortUrl).toContain('my-link')

      const cached = await redis.get('lynx:url:my-link')
      expect(cached).toBe('https://example.com')
    })

    it('should return 409 for occupied customSlug', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'occupied',
        })

      const res = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example2.com',
          customSlug: 'occupied',
        })

      expect(res.status).toBe(409)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })
  })

  describe('POST /links without customSlug', () => {
    it('should create a link with auto-generated slug → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
        })

      expect(res.status).toBe(201)
      expect(res.body.slug).toHaveLength(8)
      expect(res.body.originalUrl).toBe('https://example.com')
      expect(res.body.isActive).toBe(true)
    })
  })

  describe('Concurrency', () => {
    it('should handle 20 parallel requests with same customSlug → exactly 1×201, rest 409/429', async () => {
      const results: Response[] = []
      const total = 20
      const waveSize = 5
      for (let sent = 0; sent < total; sent += waveSize) {
        const wave = await Promise.all(
          Array.from({ length: Math.min(waveSize, total - sent) }, (_, i) =>
            request(app.getHttpServer())
              .post('/links')
              .set('Authorization', `Bearer ${accessToken}`)
              .send({
                originalUrl: `https://example.com/${sent + i}`,
                customSlug: 'curslug',
              }),
          ),
        )
        results.push(...wave)
      }
      const statuses = results.map((r) => r.status).sort()

      const successCount = statuses.filter((s) => s === 201).length
      const blockedCount = statuses.filter(
        (s) => s === 409 || s === 429,
      ).length

      expect(successCount).toBe(1)
      expect(blockedCount).toBe(19)
    })
  })

  describe('Idempotency', () => {
    it('should return same result for repeated Idempotency-Key → 200', async () => {
      const idempotencyKey = 'test-idempotency-key-123'

      const res1 = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'idem-test',
        })

      expect(res1.status).toBe(201)

      const res2 = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'idem-test',
        })

      expect(res2.status).toBe(200)
      expect(res2.body).toEqual(res1.body)
    })
  })

  describe('Validation', () => {
    it('should return 400 for invalid URL', async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'not-a-url',
        })

      expect(res.status).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('should return 400 for URL pointing to LYNX', async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'http://localhost:3000/some-path',
        })

      expect(res.status).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('should return 400 for invalid customSlug format', async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'ab',
        })

      expect(res.status).toBe(400)
    })

    it('should return 400 for reserved customSlug', async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'api',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('Authentication', () => {
    it('should return 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .post('/links')
        .send({
          originalUrl: 'https://example.com',
        })

      expect(res.status).toBe(401)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })
  })
})

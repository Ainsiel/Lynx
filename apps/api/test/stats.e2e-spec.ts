import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { resetDatabase, PrismaClient } from '@lynx/db'
import Redis from 'ioredis'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PRISMA_CLIENT } from '../src/common/infra/tokens'

describe('Stats — GET /links/:slug/stats (CU-3)', () => {
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

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Second User',
        email: `test-2-${Date.now()}@example.com`,
        password: 'password123',
      })

    const userRows = await prisma.$queryRawUnsafe<Array<{ id: string; email: string }>>(
      `SELECT id, email FROM users WHERE email LIKE 'test-2-%' ORDER BY created_at DESC LIMIT 1`,
    )
    const secondUserId = userRows[0]?.id as string

    await request(app.getHttpServer())
      .post('/links')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        originalUrl: 'https://example.com/stats-test',
        customSlug: 'stats-test',
      })

    const secondUserRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM urls WHERE slug = $1`,
      'stats-test-2',
    )
    if (secondUserRows.length === 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO urls (id, owner_id, original_url, slug, updated_at)
         VALUES (gen_random_uuid(), $1, 'https://example.com/stats-test-2', 'stats-test-2', now())`,
        secondUserId,
      )
    }

    const linkRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM urls WHERE slug = $1`,
      'stats-test',
    )
    const linkId = linkRows[0]?.id as string

    await prisma.$executeRawUnsafe(
      `INSERT INTO daily_stats (url_id, day, clicks) VALUES ($1, '2026-08-13', 50), ($1, '2026-08-12', 30), ($1, '2026-08-11', 20)`,
      linkId,
    )

    await prisma.$executeRawUnsafe(
      `INSERT INTO stats_country (url_id, day, country, clicks) VALUES ($1, '2026-08-13', 'US', 30), ($1, '2026-08-13', 'MX', 20), ($1, '2026-08-12', 'US', 25), ($1, '2026-08-12', 'CA', 5)`,
      linkId,
    )

    await prisma.$executeRawUnsafe(
      `INSERT INTO stats_device (url_id, day, device, clicks) VALUES ($1, '2026-08-13', 'desktop', 35), ($1, '2026-08-13', 'mobile', 15), ($1, '2026-08-12', 'desktop', 20), ($1, '2026-08-12', 'tablet', 10)`,
      linkId,
    )
  })

  describe('GET /links/:slug/stats — groupBy=day', () => {
    it('should return total and breakdown by day', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test/stats')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(100)
      expect(res.body.breakdown).toHaveLength(3)
      expect(res.body.breakdown[0]).toHaveProperty('date')
      expect(res.body.breakdown[0]).toHaveProperty('clicks')
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(20)
      expect(res.body.totalItems).toBe(3)
    })
  })

  describe('GET /links/:slug/stats — groupBy=country', () => {
    it('should return total and breakdown by country', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test/stats?groupBy=country')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(80)
      expect(res.body.breakdown).toHaveLength(3)
      expect(res.body.breakdown[0]).toHaveProperty('country')
      expect(res.body.breakdown[0]).toHaveProperty('clicks')
    })
  })

  describe('GET /links/:slug/stats — groupBy=device', () => {
    it('should return total and breakdown by device', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test/stats?groupBy=device')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(80)
      expect(res.body.breakdown).toHaveLength(3)
      expect(res.body.breakdown[0]).toHaveProperty('device')
      expect(res.body.breakdown[0]).toHaveProperty('clicks')
    })
  })

  describe('GET /links/:slug/stats — from/to filters', () => {
    it('should filter by date range', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test/stats?from=2026-08-12T00:00:00.000Z&to=2026-08-12T23:59:59.999Z')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(30)
      expect(res.body.breakdown).toHaveLength(1)
      expect(res.body.breakdown[0].date).toBe('2026-08-12')
    })
  })

  describe('GET /links/:slug/stats — pagination', () => {
    it('should paginate results', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test/stats?pageSize=2&page=1')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.breakdown).toHaveLength(2)
      expect(res.body.totalItems).toBe(3)
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(2)

      const res2 = await request(app.getHttpServer())
        .get('/links/stats-test/stats?pageSize=2&page=2')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res2.status).toBe(200)
      expect(res2.body.breakdown).toHaveLength(1)
      expect(res2.body.page).toBe(2)
    })
  })

  describe('GET /links/:slug/stats — 404 non-existent slug', () => {
    it('should return 404 for non-existent slug', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/non-existent/stats')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })
  })

  describe('GET /links/:slug/stats — 403 forbidden', () => {
    it('should return 403 for link owned by another user', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test-2/stats')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(403)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })
  })

  describe('GET /links/:slug/stats — 401 unauthorized', () => {
    it('should return 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test/stats')

      expect(res.status).toBe(401)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })
  })

  describe('GET /links/:slug/stats — cache', () => {
    it('should cache response and not recalculate on second call', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/links/stats-test/stats')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res1.status).toBe(200)

      const cached = await redis.get('lynx:stats:stats-test:day:*:*:1:20')
      expect(cached).toBeDefined()

      const res2 = await request(app.getHttpServer())
        .get('/links/stats-test/stats')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res2.status).toBe(200)
      expect(res2.body).toEqual(res1.body)
    })
  })

  describe('GET /links/:slug/stats — validation', () => {
    it('should return 400 for invalid groupBy', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test/stats?groupBy=invalid')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('should return 400 for invalid pageSize', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test/stats?pageSize=200')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(400)
    })

    it('should return 400 for invalid page', async () => {
      const res = await request(app.getHttpServer())
        .get('/links/stats-test/stats?page=0')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(400)
    })
  })
})

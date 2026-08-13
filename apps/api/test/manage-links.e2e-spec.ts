import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { resetDatabase, PrismaClient } from '@lynx/db'
import Redis from 'ioredis'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PRISMA_CLIENT } from '../src/common/infra/tokens'

describe('Manage Links — CU-4', () => {
  let app: INestApplication
  let redis: Redis
  let prisma: PrismaClient
  let accessToken: string
  let adminToken: string

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
        email: 'test-manage@example.com',
        password: 'password123',
      })
    accessToken = registerRes.body.accessToken

    await prisma.$executeRawUnsafe(
      `UPDATE users SET role = 'ADMIN' WHERE email = $1`,
      'test-manage@example.com',
    )

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test-manage@example.com',
        password: 'password123',
      })
    adminToken = loginRes.body.accessToken
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

    const adminEmail = `admin-${Date.now()}@example.com`
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Admin User',
        email: adminEmail,
        password: 'password123',
      })
    await prisma.$executeRawUnsafe(
      `UPDATE users SET role = 'ADMIN' WHERE email = $1`,
      adminEmail,
    )
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: adminEmail,
        password: 'password123',
      })
    adminToken = loginRes.body.accessToken
  })

  describe('GET /links', () => {
    it('should list links created by the user', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'list01',
        })

      const res = await request(app.getHttpServer())
        .get('/links')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].slug).toBe('list01')
      expect(res.body.totalItems).toBe(1)
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(20)
    })

    it('should return empty list for user with no links', async () => {
      const res = await request(app.getHttpServer())
        .get('/links')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(0)
      expect(res.body.totalItems).toBe(0)
    })

    it('should filter by isActive', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'filt01',
        })

      await request(app.getHttpServer())
        .patch('/links/filt01')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false })

      const activeRes = await request(app.getHttpServer())
        .get('/links?isActive=true')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(activeRes.body.data).toHaveLength(0)

      const inactiveRes = await request(app.getHttpServer())
        .get('/links?isActive=false')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(inactiveRes.body.data).toHaveLength(1)
      expect(inactiveRes.body.data[0].slug).toBe('filt01')
    })

    it('should paginate results', async () => {
      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer())
          .post('/links')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            originalUrl: `https://example.com/${i}`,
            customSlug: `page${String(i).padStart(2, '0')}`,
          })
      }

      const res = await request(app.getHttpServer())
        .get('/links?page=1&pageSize=2')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(2)
      expect(res.body.totalItems).toBe(5)
      expect(res.body.page).toBe(1)
      expect(res.body.pageSize).toBe(2)
    })
  })

  describe('PATCH /links/:slug', () => {
    it('should update originalUrl', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'patch01',
        })

      const res = await request(app.getHttpServer())
        .patch('/links/patch01')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'https://updated.com' })

      expect(res.status).toBe(200)
      expect(res.body.originalUrl).toBe('https://updated.com')
      expect(res.body.updatedAt).toBeDefined()

      const cached = await redis.get('lynx:url:patch01')
      expect(cached).toBe('https://updated.com')
    })

    it('should set isActive=false and invalidate cache', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'patch02',
        })

      const res = await request(app.getHttpServer())
        .patch('/links/patch02')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false })

      expect(res.status).toBe(200)
      expect(res.body.isActive).toBe(false)

      const cached = await redis.get('lynx:url:patch02')
      expect(cached).toBeNull()

      const redirectRes = await request(app.getHttpServer()).get('/patch02')
      expect(redirectRes.status).toBe(404)
    })

    it('should set isActive=true and re-populate cache on next redirect', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'patch03',
        })

      await request(app.getHttpServer())
        .patch('/links/patch03')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false })

      const res = await request(app.getHttpServer())
        .patch('/links/patch03')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: true })

      expect(res.status).toBe(200)
      expect(res.body.isActive).toBe(true)

      const cached = await redis.get('lynx:url:patch03')
      expect(cached).toBe('https://example.com')

      const redirectRes = await request(app.getHttpServer()).get('/patch03')
      expect(redirectRes.status).toBe(308)
      expect(redirectRes.headers['location']).toBe('https://example.com')
    })

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app.getHttpServer())
        .patch('/links/nonexistent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: false })

      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('should return 403 for link owned by another user', async () => {
      const otherUserRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Other User',
          email: `other-${Date.now()}@example.com`,
          password: 'password123',
        })
      const otherToken = otherUserRes.body.accessToken

      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'patch04',
        })

      const res = await request(app.getHttpServer())
        .patch('/links/patch04')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ isActive: false })

      expect(res.status).toBe(403)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('should return 400 with empty body', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'patch05',
        })

      const res = await request(app.getHttpServer())
        .patch('/links/patch05')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})

      expect(res.status).toBe(400)
    })

    it('should return 400 for invalid URL', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'patch06',
        })

      const res = await request(app.getHttpServer())
        .patch('/links/patch06')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalUrl: 'not-a-url' })

      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /links/:slug', () => {
    it('should soft delete and return 204', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'del0001',
        })

      const res = await request(app.getHttpServer())
        .delete('/links/del0001')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(204)

      const cached = await redis.get('lynx:url:del0001')
      expect(cached).toBeNull()

      const listRes = await request(app.getHttpServer())
        .get('/links')
        .set('Authorization', `Bearer ${accessToken}`)

      const found = listRes.body.data.find(
        (l: { slug: string }) => l.slug === 'del0001',
      )
      expect(found).toBeUndefined()
    })

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app.getHttpServer())
        .delete('/links/nonexistent')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 403 for link owned by another user', async () => {
      const otherUserRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Other User',
          email: `other-del-${Date.now()}@example.com`,
          password: 'password123',
        })
      const otherToken = otherUserRes.body.accessToken

      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'del0002',
        })

      const res = await request(app.getHttpServer())
        .delete('/links/del0002')
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('Authentication', () => {
    it('should return 401 on GET /links without token', async () => {
      const res = await request(app.getHttpServer()).get('/links')

      expect(res.status).toBe(401)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('should return 401 on PATCH /links/:slug without token', async () => {
      const res = await request(app.getHttpServer())
        .patch('/links/any-slug')
        .send({ isActive: false })

      expect(res.status).toBe(401)
    })

    it('should return 401 on DELETE /links/:slug without token', async () => {
      const res = await request(app.getHttpServer()).delete('/links/any-slug')

      expect(res.status).toBe(401)
    })
  })

  describe('Admin', () => {
    it('should allow admin to list all links', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'adm0001',
        })

      const res = await request(app.getHttpServer())
        .get('/links')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('should allow admin to update any link', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'adm0002',
        })

      const res = await request(app.getHttpServer())
        .patch('/links/adm0002')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })

      expect(res.status).toBe(200)
      expect(res.body.isActive).toBe(false)
    })

    it('should allow admin to delete any link', async () => {
      await request(app.getHttpServer())
        .post('/links')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          originalUrl: 'https://example.com',
          customSlug: 'adm0003',
        })

      const res = await request(app.getHttpServer())
        .delete('/links/adm0003')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(204)
    })
  })
})

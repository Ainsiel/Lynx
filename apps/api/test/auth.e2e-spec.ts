import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { resetDatabase } from '@lynx/db'
import { AuthResponseSchema } from '@lynx/shared'
import Redis from 'ioredis'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PRISMA_CLIENT } from '../src/common/infra/tokens'

describe('Auth — register + login (S4)', () => {
  let app: INestApplication
  let redis: Redis

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
    await redis.flushdb()

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()

    await resetDatabase(app.get(PRISMA_CLIENT))
  })

  afterAll(async () => {
    await app.close()
    await redis.quit()
  })

  beforeEach(async () => {
    await redis.flushdb()
    await resetDatabase(app.get(PRISMA_CLIENT))
  })

  describe('POST /auth/register', () => {
    it('registra un usuario nuevo y devuelve 201 con user + accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        })

      expect(res.status).toBe(201)

      const parsed = AuthResponseSchema.safeParse(res.body)
      expect(parsed.success).toBe(true)
      if (!parsed.success) {
        return
      }

      expect(parsed.data.user.email).toBe('test@example.com')
      expect(parsed.data.user.name).toBe('Test User')
      expect(parsed.data.user.role).toBe('USER')
      expect(parsed.data.accessToken).toBeDefined()
      expect(typeof parsed.data.accessToken).toBe('string')
    })

    it('devuelve 409 con RFC 7807 cuando el email ya existe', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'duplicate@example.com',
          password: 'password123',
        })

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Another User',
          email: 'duplicate@example.com',
          password: 'password456',
        })

      expect(res.status).toBe(409)
      expect(res.headers['content-type']).toContain('application/problem+json')
      expect(res.body.type).toBe('https://lynx.dev/errors/http-409')
      expect(res.body.title).toBe('Conflict')
      expect(res.body.status).toBe(409)
    })

    it('devuelve 400 con email inválido', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'not-an-email',
          password: 'password123',
        })

      expect(res.status).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('devuelve 400 con contraseña menor a 8 caracteres', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'short',
        })

      expect(res.status).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })
  })

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Login User',
          email: 'login@example.com',
          password: 'password123',
        })
    })

    it('login exitoso devuelve 200 con user + accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })

      expect(res.status).toBe(200)

      const parsed = AuthResponseSchema.safeParse(res.body)
      expect(parsed.success).toBe(true)
      if (!parsed.success) {
        return
      }

      expect(parsed.data.user.email).toBe('login@example.com')
      expect(parsed.data.accessToken).toBeDefined()
    })

    it('devuelve 401 con contraseña incorrecta', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        })

      expect(res.status).toBe(401)
      expect(res.headers['content-type']).toContain('application/problem+json')
      expect(res.body.type).toBe('https://lynx.dev/errors/http-401')
      expect(res.body.title).toBe('Unauthorized')
      expect(res.body.detail).toBe('Invalid credentials')
    })

    it('devuelve 401 con email inexistente', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })

      expect(res.status).toBe(401)
      expect(res.headers['content-type']).toContain('application/problem+json')
      expect(res.body.detail).toBe('Invalid credentials')
    })
  })

  describe('Rate limit', () => {
    it('bloquea con 429 + Retry-After al superar 5 requests en /auth/register', async () => {
      let blocked: request.Response | undefined

      for (let i = 0; i < 6; i += 1) {
        blocked = await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`,
            password: 'password123',
          })
      }

      expect(blocked?.status).toBe(429)
      expect(blocked?.headers['x-ratelimit-remaining']).toBe('0')
      expect(Number(blocked?.headers['retry-after'])).toBeGreaterThan(0)
      expect(blocked?.headers['content-type']).toContain(
        'application/problem+json',
      )
      expect(blocked?.body.status).toBe(429)
      expect(blocked?.body.title).toBe('Too Many Requests')
    })

    it('bloquea con 429 + Retry-After al superar 5 requests en /auth/login', async () => {
      let blocked: request.Response | undefined

      for (let i = 0; i < 6; i += 1) {
        blocked = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123',
          })
      }

      expect(blocked?.status).toBe(429)
      expect(blocked?.headers['x-ratelimit-remaining']).toBe('0')
      expect(Number(blocked?.headers['retry-after'])).toBeGreaterThan(0)
    })
  })
})

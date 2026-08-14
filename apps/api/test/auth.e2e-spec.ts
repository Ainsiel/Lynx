import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { randomBytes, createHash } from 'node:crypto'
import { resetDatabase } from '@lynx/db'
import Redis from 'ioredis'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PRISMA_CLIENT } from '../src/common/infra/tokens'

function extractCookie(res: request.Response, name: string): string | undefined {
  const setCookie = res.headers['set-cookie'] as string[] | undefined
  if (!setCookie) return undefined
  const match = setCookie.find((c) => c.startsWith(`${name}=`))
  return match?.split(';')[0]?.split('=')[1]
}

describe('Auth — register + login + refresh + logout + /me (S4)', () => {
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
    it('registra un usuario nuevo y devuelve 201 con user + accessToken + set-cookie refresh_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        })

      expect(res.status).toBe(201)
      expect(res.body.user).toBeDefined()
      expect(res.body.accessToken).toBeDefined()
      expect(res.body.user.email).toBe('test@example.com')
      expect(res.body.user.name).toBe('Test User')
      expect(res.body.user.role).toBe('USER')

      const cookie = extractCookie(res, 'refresh_token')
      expect(cookie).toBeDefined()
      expect(cookie!.length).toBeGreaterThan(0)
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

    it('login exitoso devuelve 200 con user + accessToken + set-cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        })

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()
      expect(res.body.accessToken).toBeDefined()
      expect(res.body.user.email).toBe('login@example.com')

      const cookie = extractCookie(res, 'refresh_token')
      expect(cookie).toBeDefined()
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

  describe('POST /auth/refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Refresh User',
          email: 'refresh@example.com',
          password: 'password123',
        })
      refreshToken = extractCookie(res, 'refresh_token')!
    })

    it('rota el refresh token y devuelve nuevo accessToken + set-cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBeDefined()
      expect(typeof res.body.accessToken).toBe('string')

      const newCookie = extractCookie(res, 'refresh_token')
      expect(newCookie).toBeDefined()
      expect(newCookie).not.toBe(refreshToken)
    })

    it('devuelve 401 al reusar un refresh token ya usado', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })

      expect(res.status).toBe(401)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('devuelve 401 con token inválido', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /auth/logout', () => {
    let accessToken: string
    let refreshToken: string

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Logout User',
          email: 'logout@example.com',
          password: 'password123',
        })
      accessToken = res.body.accessToken
      refreshToken = extractCookie(res, 'refresh_token')!
    })

    it('revoca el refresh token y devuelve 204', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })

      expect(res.status).toBe(204)

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })

      expect(refreshRes.status).toBe(401)
    })

    it('devuelve 401 sin token de acceso', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /auth/me', () => {
    let accessToken: string

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Me User',
          email: 'me@example.com',
          password: 'password123',
        })
      accessToken = res.body.accessToken
    })

    it('devuelve el usuario autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('Me User')
      expect(res.body.email).toBe('me@example.com')
      expect(res.body.role).toBe('USER')
    })

    it('devuelve 401 sin token de acceso', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me')

      expect(res.status).toBe(401)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('devuelve 401 con token inválido', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')

      expect(res.status).toBe(401)
    })
  })

  describe('POST /auth/forgot-password', () => {
    it('devuelve 202 con email válido', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Forgot User',
          email: 'forgot@example.com',
          password: 'password123',
        })

      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'forgot@example.com' })

      expect(res.status).toBe(202)
    })

    it('devuelve 202 aunque el email no exista (no revela existencia)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })

      expect(res.status).toBe(202)
    })

    it('devuelve 400 con email inválido', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' })

      expect(res.status).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })
  })

  describe('POST /auth/reset-password', () => {
    it('resetea la contraseña con token válido y permite login con la nueva', async () => {
      const prisma = app.get(PRISMA_CLIENT)

      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Reset User',
          email: 'reset-happy@example.com',
          password: 'oldpassword123',
        })

      const userId = registerRes.body.user.id
      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')

      await prisma.passwordResetToken.create({
        data: {
          userId,
          token: tokenHash,
          expiresAt: new Date(Date.now() + 3600000),
        },
      })

      const resetRes = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, password: 'newpassword123' })

      expect(resetRes.status).toBe(200)
      expect(resetRes.body.message).toBe('Password updated')

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'reset-happy@example.com', password: 'newpassword123' })

      expect(loginRes.status).toBe(200)
      expect(loginRes.body.user.email).toBe('reset-happy@example.com')

      const oldLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'reset-happy@example.com', password: 'oldpassword123' })

      expect(oldLoginRes.status).toBe(401)
    })

    it('devuelve 400 con token inválido', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'invalid-token', password: 'newpassword123' })

      expect(res.status).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('devuelve 400 con contraseña menor a 8 caracteres', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'some-token', password: 'short' })

      expect(res.status).toBe(400)
      expect(res.headers['content-type']).toContain('application/problem+json')
    })

    it('devuelve 400 con token ausente', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ password: 'newpassword123' })

      expect(res.status).toBe(400)
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

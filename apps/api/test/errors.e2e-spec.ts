import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import Redis from 'ioredis'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('Convenciones HTTP — RFC 7807 y X-Request-Id (S2)', () => {
  let app: INestApplication
  let redis: Redis

  beforeAll(async () => {
    // El rate limiter vive en Redis y comparte IP entre suites: sin este
    // flush la suite puede recibir 429 en vez del 404 esperado.
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
    await redis.flushdb()

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
    await redis.quit()
  })

  it('una ruta desconocida responde 404 con formato RFC 7807', async () => {
    const res = await request(app.getHttpServer()).get('/ruta-que-no-existe')

    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toContain('application/problem+json')
    expect(res.body.type).toBe('https://lynx.dev/errors/http-404')
    expect(res.body.title).toBe('Not Found')
    expect(res.body.status).toBe(404)
    expect(typeof res.body.detail).toBe('string')
    expect(res.body.instance).toBe('/ruta-que-no-existe')
  })

  it('cada respuesta lleva X-Request-Id', async () => {
    const res = await request(app.getHttpServer()).get('/ruta-que-no-existe')

    expect(res.headers['x-request-id']).toBeTruthy()
  })

  it('honra el X-Request-Id entrante', async () => {
    const res = await request(app.getHttpServer())
      .get('/ruta-que-no-existe')
      .set('X-Request-Id', 'req-abc-123')

    expect(res.headers['x-request-id']).toBe('req-abc-123')
  })

  it('genera un X-Request-Id uuid cuando no llega', async () => {
    const res = await request(app.getHttpServer()).get('/ruta-que-no-existe')

    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })
})

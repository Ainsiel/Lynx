import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { resetDatabase } from '@lynx/db'
import { HealthResponseSchema } from '@lynx/shared'
import Redis from 'ioredis'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PRISMA_CLIENT } from '../src/common/infra/tokens'

describe('GET /health — estado de infraestructura (S1)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
    await redis.flushdb()
    await redis.quit()

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()

    await resetDatabase(app.get(PRISMA_CLIENT))
  })

  afterAll(async () => {
    await app.close()
  })

  it('responde 200 con postgres, redis y rabbitmq en estado up', async () => {
    const res = await request(app.getHttpServer()).get('/health')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')

    const parsed = HealthResponseSchema.safeParse(res.body)
    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect(parsed.data.status).toBe('ok')
    expect(parsed.data.info['postgres']?.status).toBe('up')
    expect(parsed.data.info['redis']?.status).toBe('up')
    expect(parsed.data.info['rabbitmq']?.status).toBe('up')
    expect(Object.keys(parsed.data.error)).toHaveLength(0)
  })

  it('reporta en error el componente caído sin perder el estado de los demás', async () => {
    const originalUrl = process.env.RABBITMQ_URL
    process.env.RABBITMQ_URL = 'amqp://localhost:59999'

    try {
      const res = await request(app.getHttpServer()).get('/health')

      expect(res.status).toBe(200)

      const parsed = HealthResponseSchema.safeParse(res.body)
      expect(parsed.success).toBe(true)
      if (!parsed.success) {
        return
      }

      expect(parsed.data.status).toBe('error')
      expect(parsed.data.error['rabbitmq']?.status).toBe('down')
      expect(parsed.data.info['postgres']?.status).toBe('up')
      expect(parsed.data.info['redis']?.status).toBe('up')
    } finally {
      process.env.RABBITMQ_URL = originalUrl
    }
  })
})

import { randomUUID } from 'node:crypto'
import amqplib, { type Channel, type ChannelModel, type Message } from 'amqplib'
import { createPrismaClient, resetDatabase, type PrismaClient } from '@lynx/db'
import { loadConfig, type WorkerConfig } from '../src/config'
import { startClickConsumer, type ClickConsumer, type ClickProcessor } from '../src/consumer'
import { processClickEvent } from '../src/process-click'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor<T>(
  fn: () => Promise<T> | T,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 15000
  const intervalMs = opts?.intervalMs ?? 100
  const deadline = Date.now() + timeoutMs
  let last: T | undefined
  while (Date.now() < deadline) {
    last = await fn()
    if (last) return last
    await delay(intervalMs)
  }
  throw new Error(`waitFor agotó el tiempo (${timeoutMs}ms); último valor: ${JSON.stringify(last)}`)
}

describe('Worker agregador — CU-3 (Issue #7)', () => {
  let config: WorkerConfig
  let prisma: PrismaClient
  let conn: ChannelModel
  let pub: Channel
  const consumers: ClickConsumer[] = []

  beforeAll(async () => {
    config = loadConfig()
    prisma = createPrismaClient()
    await resetDatabase(prisma)
    conn = await amqplib.connect(config.rabbitmqUrl)
    pub = await conn.createChannel()
  })

  afterEach(async () => {
    for (const consumer of consumers) {
      await consumer.close()
    }
    consumers.length = 0
    try {
      await pub.purgeQueue(config.queue)
    } catch {
      // cola aún no declarada
    }
    try {
      await pub.purgeQueue(config.dlq)
    } catch {
      // cola aún no declarada
    }
  })

  afterAll(async () => {
    await pub.close()
    await conn.close()
    await prisma.$disconnect()
  })

  async function startTestConsumer(processor?: ClickProcessor): Promise<ClickConsumer> {
    const consumer = await startClickConsumer({ config, prisma, processor })
    consumers.push(consumer)
    return consumer
  }

  async function createUrl(slug: string): Promise<string> {
    const url = await prisma.url.create({
      data: { slug, originalUrl: `https://example.com/${slug}` },
    })
    return url.id
  }

  async function publishRaw(payload: unknown): Promise<void> {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
    pub.sendToQueue(config.queue, Buffer.from(body), { persistent: true })
  }

  describe('agregación y persistencia', () => {
    it('persiste un ClickEvent completo y agrega daily_stats/country/device', async () => {
      const urlId = await createUrl('aggfull')
      await startTestConsumer()

      const eventId = randomUUID()
      await publishRaw({
        eventId,
        slug: 'aggfull',
        ip: '203.0.113.7',
        country: 'MX',
        device: 'desktop',
        userAgent: 'Mozilla/5.0 (test)',
        occurredAt: '2026-08-09T10:05:12Z',
      })

      const click = await waitFor(() => prisma.click.findFirst({ where: { eventId } }))
      expect(click?.urlId).toBe(urlId)
      expect(click?.ip).toBe('203.0.113.7')
      expect(click?.country).toBe('MX')
      expect(click?.device).toBe('desktop')
      expect(click?.userAgent).toBe('Mozilla/5.0 (test)')

      const daily = await waitFor(() => prisma.dailyStats.findFirst({ where: { urlId } }))
      expect(daily?.clicks).toBe(1n)
      expect(daily?.day.toISOString().slice(0, 10)).toBe('2026-08-09')

      const country = await waitFor(() =>
        prisma.statsCountry.findFirst({ where: { urlId, country: 'MX' } }),
      )
      expect(country?.clicks).toBe(1n)

      const device = await waitFor(() =>
        prisma.statsDevice.findFirst({ where: { urlId, device: 'desktop' } }),
      )
      expect(device?.clicks).toBe(1n)

      const info = await waitFor(async () => {
        const q = await pub.checkQueue(config.queue)
        return q.messageCount === 0 ? q : null
      })
      expect(info?.messageCount).toBe(0)
    })

    it('mismo eventId entregado dos veces → cuenta una sola vez', async () => {
      const urlId = await createUrl('dedup')
      await startTestConsumer()

      const event = {
        eventId: randomUUID(),
        slug: 'dedup',
        country: 'US',
        device: 'mobile',
        occurredAt: '2026-08-09T10:05:12Z',
      }
      await publishRaw(event)
      await publishRaw(event)

      await waitFor(() => prisma.click.findFirst({ where: { eventId: event.eventId } }))

      await waitFor(async () => {
        const q = await pub.checkQueue(config.queue)
        return q.messageCount === 0 ? q : null
      })

      expect(await prisma.click.count({ where: { eventId: event.eventId } })).toBe(1)
      const daily = await prisma.dailyStats.findFirst({ where: { urlId } })
      expect(daily?.clicks).toBe(1n)
    })

    it('persiste un evento mínimo (forma actual de la API) sin desgloses', async () => {
      const urlId = await createUrl('minimal')
      await startTestConsumer()

      const eventId = randomUUID()
      await publishRaw({
        eventId,
        slug: 'minimal',
        timestamp: '2026-08-10T00:30:00Z',
      })

      const click = await waitFor(() => prisma.click.findFirst({ where: { eventId } }))
      expect(click?.ip).toBeNull()
      expect(click?.country).toBeNull()
      expect(click?.device).toBeNull()
      expect(click?.userAgent).toBeNull()

      await waitFor(() => prisma.dailyStats.findFirst({ where: { urlId } }))
      expect(await prisma.statsCountry.count({ where: { urlId } })).toBe(0)
      expect(await prisma.statsDevice.count({ where: { urlId } })).toBe(0)
    })
  })

  describe('reintentos y DLQ', () => {
    it('fallo transitorio → requeue con backoff, eventual ack y conteo único', async () => {
      const urlId = await createUrl('retry')

      let calls = 0
      const flakyProcessor: ClickProcessor = async (db, event) => {
        calls += 1
        if (calls <= 2) {
          throw new Error('DB connection reset (transitorio)')
        }
        return processClickEvent(db, event)
      }
      await startTestConsumer(flakyProcessor)

      const eventId = randomUUID()
      await publishRaw({ eventId, slug: 'retry', occurredAt: '2026-08-09T10:05:12Z' })

      await waitFor(() => prisma.click.findFirst({ where: { eventId } }))
      await waitFor(async () => {
        const q = await pub.checkQueue(config.queue)
        return q.messageCount === 0 ? q : null
      })

      expect(calls).toBe(3)
      expect(await prisma.click.count({ where: { eventId } })).toBe(1)
      const daily = await prisma.dailyStats.findFirst({ where: { urlId } })
      expect(daily?.clicks).toBe(1n)
    })

    it('fallo transitorio agotado → DLQ tras 3 entregas', async () => {
      let calls = 0
      const alwaysFail: ClickProcessor = async () => {
        calls += 1
        throw new Error('siempre falla (transitorio agotado)')
      }
      await startTestConsumer(alwaysFail)

      const eventId = randomUUID()
      await publishRaw({ eventId, slug: 'never-matters', occurredAt: '2026-08-09T10:05:12Z' })

      const dlqMsg = (await waitFor(async () => pub.get(config.dlq))) as Message
      const parsed = JSON.parse(dlqMsg.content.toString()) as { eventId: string }
      expect(parsed.eventId).toBe(eventId)
      pub.ack(dlqMsg)

      expect(calls).toBe(3)

      const remaining = await pub.checkQueue(config.queue)
      expect(remaining.messageCount).toBe(0)
      expect(await prisma.click.count({ where: { eventId } })).toBe(0)
    })

    it('slug inexistente → DLQ (fallo persistente)', async () => {
      await startTestConsumer()

      const eventId = randomUUID()
      await publishRaw({ eventId, slug: 'nosuchlink', occurredAt: '2026-08-09T10:05:12Z' })

      const dlqMsg = (await waitFor(async () => pub.get(config.dlq))) as Message
      const parsed = JSON.parse(dlqMsg.content.toString()) as { eventId: string }
      expect(parsed.eventId).toBe(eventId)
      pub.ack(dlqMsg)
    })

    it('mensaje no-JSON → DLQ', async () => {
      await startTestConsumer()

      const garbage = 'this is not json {{{'
      await publishRaw(garbage)

      const dlqMsg = (await waitFor(async () => pub.get(config.dlq))) as Message
      expect(dlqMsg.content.toString()).toBe(garbage)
      pub.ack(dlqMsg)
    })
  })

  describe('concurrencia', () => {
    it('2 consumidores × 50 eventos → contadores sin pérdida', async () => {
      const urlId = await createUrl('conc')
      await startTestConsumer()
      await startTestConsumer()

      const events = Array.from({ length: 50 }, (_, i) => ({
        eventId: randomUUID(),
        slug: 'conc',
        country: i % 2 === 0 ? 'MX' : 'US',
        device: i % 2 === 0 ? 'desktop' : 'mobile',
        occurredAt: '2026-08-09T10:05:12Z',
      }))

      for (const event of events) {
        await publishRaw(event)
      }

      const clickCount = await waitFor(async () => {
        const count = await prisma.click.count({ where: { urlId } })
        return count >= 50 ? count : null
      })
      expect(clickCount).toBe(50)

      const daily = await waitFor(async () => {
        const row = await prisma.dailyStats.findFirst({ where: { urlId } })
        return row && row.clicks >= 50n ? row : null
      })
      expect(daily?.clicks).toBe(50n)

      const mx = await prisma.statsCountry.findFirst({ where: { urlId, country: 'MX' } })
      const us = await prisma.statsCountry.findFirst({ where: { urlId, country: 'US' } })
      expect(mx?.clicks).toBe(25n)
      expect(us?.clicks).toBe(25n)
    })
  })
})

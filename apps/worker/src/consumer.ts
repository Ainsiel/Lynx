import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib'
import type { PrismaClient } from '@lynx/db'
import { PersistentError, parseClickEvent, type ClickEvent } from './click-event'
import type { WorkerConfig } from './config'
import { processClickEvent } from './process-click'
import { clickProcessedTotal, clickDlqTotal } from './metrics'
import { delay } from './util'

export type ClickProcessor = (prisma: PrismaClient, event: ClickEvent) => Promise<void>

export interface ClickConsumerOptions {
  config: WorkerConfig
  prisma: PrismaClient
  processor?: ClickProcessor
}

export interface ClickConsumer {
  readonly closed: Promise<void>
  close(): Promise<void>
}

/**
 * Levanta un consumidor de `clicks.ingest`: declara la topología
 * (exchange 'clicks' → cola, DLX + DLQ), consume con prefetch 1 y acks
 * manuales, aplica backoff exponencial a los fallos transitorios (máx N
 * intentos) y enruta a la DLQ los fallos persistentes o agotados.
 */
export async function startClickConsumer(
  options: ClickConsumerOptions,
): Promise<ClickConsumer> {
  const { config } = options
  const processor = options.processor ?? processClickEvent

  let resolveClosed!: () => void
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve
  })

  const connection = await connectWithRetry(config.rabbitmqUrl)
  connection.on('close', () => resolveClosed())
  connection.on('error', () => resolveClosed())

  const channel = await connection.createChannel()
  channel.on('error', () => resolveClosed())

  await channel.prefetch(config.prefetch)
  await declareTopology(channel, config)

  await channel.consume(
    config.queue,
    (msg) => {
      if (msg) {
        void handleMessage({ channel, msg, config, prisma: options.prisma, processor })
      }
    },
    { noAck: false },
  )

  return {
    closed,
    close: async () => {
      try {
        await channel.close()
      } catch {
        // canal ya cerrado
      }
      try {
        await connection.close()
      } catch {
        // conexión ya cerrada
      }
      resolveClosed()
    },
  }
}

async function connectWithRetry(
  url: string,
  attempts = 5,
  baseMs = 2000,
): Promise<ChannelModel> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await amqplib.connect(url)
    } catch (error) {
      lastError = error
      console.error(`RabbitMQ no disponible (intento ${attempt}/${attempts}): ${String(error)}`)
      await delay(baseMs)
    }
  }
  throw lastError
}

async function declareTopology(channel: Channel, config: WorkerConfig): Promise<void> {
  await channel.assertExchange(config.exchange, 'direct', { durable: true })
  await channel.assertExchange(config.dlx, 'direct', { durable: true })
  await channel.assertQueue(config.queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': config.dlx,
      'x-dead-letter-routing-key': config.dlq,
    },
  })
  await channel.assertQueue(config.dlq, { durable: true })
  await channel.bindQueue(config.queue, config.exchange, config.queue)
  await channel.bindQueue(config.dlq, config.dlx, config.dlq)
}

interface HandleMessageArgs {
  channel: Channel
  msg: ConsumeMessage
  config: WorkerConfig
  prisma: PrismaClient
  processor: ClickProcessor
}

const RETRY_HEADER = 'x-lynx-retries'

/**
 * Reintentos acumulados del mensaje, leídos del header `x-lynx-retries` que
 * el propio worker estampa al reencolar por republish. Al ser un dato del
 * mensaje (no del consumidor), el límite de reintentos se mantiene aunque la
 * cola la atiendan varias instancias del worker.
 */
function retryCount(msg: ConsumeMessage): number {
  const headers = msg.properties.headers as Record<string, unknown> | undefined
  const count = headers?.[RETRY_HEADER]
  return typeof count === 'number' ? count : 0
}

async function handleMessage(args: HandleMessageArgs): Promise<void> {
  const { channel, msg, config, prisma, processor } = args

  let event: ClickEvent
  try {
    event = parseClickEvent(msg.content)
  } catch (error) {
    const reason = error instanceof PersistentError ? error.reason : 'invalid-message'
    console.warn(`Mensaje inválido (${reason}) → DLQ`)
    clickDlqTotal.inc()
    safeNack(channel, msg, false)
    return
  }

  try {
    await processor(prisma, event)
    clickProcessedTotal.inc()
    safeAck(channel, msg)
  } catch (error) {
    if (error instanceof PersistentError) {
      console.warn(`[${event.eventId}] ${error.message} → DLQ`)
      clickDlqTotal.inc()
      safeNack(channel, msg, false)
      return
    }

    const count = retryCount(msg) + 1

    if (count >= config.maxRetries) {
      console.error(
        `[${event.eventId}] fallo definitivo tras ${count} entregas → DLQ:`,
        error,
      )
      clickDlqTotal.inc()
      safeNack(channel, msg, false)
      return
    }

    const backoff = config.retryBaseMs * 2 ** (count - 1)
    console.warn(
      `[${event.eventId}] fallo transitorio (entrega ${count}/${config.maxRetries}), requeue en ${backoff}ms:`,
      error,
    )
    requeueWithRetry(channel, msg, config, count, backoff)
  }
}

/**
 * Reencola el mensaje estampando el contador de reintentos: república una
 * copia con el header `x-lynx-retries` y ackea el original. Así el límite
 * "máx N" sobrevive a redeliveries entre instancias distintas del worker.
 */
function requeueWithRetry(
  channel: Channel,
  msg: ConsumeMessage,
  config: WorkerConfig,
  count: number,
  backoff: number,
): void {
  setTimeout(() => {
    try {
      channel.sendToQueue(config.queue, msg.content, {
        persistent: true,
        contentType: msg.properties.contentType,
        headers: {
          ...(msg.properties.headers as Record<string, unknown> | undefined),
          [RETRY_HEADER]: count,
        },
      })
      safeAck(channel, msg)
    } catch (error) {
      console.error(`[reencolar] no se pudo republicar (${String(error)}); el broker reentregará el original`)
    }
  }, backoff)
}

function safeAck(channel: Channel, msg: ConsumeMessage): void {
  try {
    channel.ack(msg)
  } catch {
    // canal cerrado: el broker reentrega el mensaje no-acked
  }
}

function safeNack(channel: Channel, msg: ConsumeMessage, requeue: boolean): void {
  try {
    channel.nack(msg, false, requeue)
  } catch {
    // canal cerrado: el broker reentrega el mensaje no-acked
  }
}

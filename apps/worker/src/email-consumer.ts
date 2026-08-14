import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib'
import type { EmailEvent } from '@lynx/shared'
import type { EmailConfig } from './config'
import type { EmailSender } from './email-sender'
import { delay } from './util'

export interface EmailConsumer {
  readonly closed: Promise<void>
  close(): Promise<void>
}

interface EmailConsumerOptions {
  config: EmailConfig
  rabbitmqUrl: string
  emailSender: EmailSender
}

const RETRY_HEADER = 'x-lynx-retries'

function parseEmailEvent(content: Buffer): EmailEvent {
  const raw = content.toString()
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (
      typeof parsed.type === 'string' &&
      typeof parsed.to === 'string' &&
      typeof parsed.timestamp === 'string'
    ) {
      return parsed as unknown as EmailEvent
    }
    throw new Error('Invalid email event shape')
  } catch {
    throw new Error('invalid-message')
  }
}

function retryCount(msg: ConsumeMessage): number {
  const headers = msg.properties.headers as Record<string, unknown> | undefined
  const count = headers?.[RETRY_HEADER]
  return typeof count === 'number' ? count : 0
}

export async function startEmailConsumer(
  options: EmailConsumerOptions,
): Promise<EmailConsumer> {
  const { config, rabbitmqUrl, emailSender } = options

  let resolveClosed!: () => void
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve
  })

  const connection = await connectWithRetry(rabbitmqUrl)
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
        void handleMessage({ channel, msg, config, emailSender })
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
        // channel already closed
      }
      try {
        await connection.close()
      } catch {
        // connection already closed
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

async function declareTopology(channel: Channel, config: EmailConfig): Promise<void> {
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
  config: EmailConfig
  emailSender: EmailSender
}

async function handleMessage(args: HandleMessageArgs): Promise<void> {
  const { channel, msg, config, emailSender } = args

  let event: EmailEvent
  try {
    event = parseEmailEvent(msg.content)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid-message'
    console.warn(`Email message invalid (${reason}) → DLQ`)
    safeNack(channel, msg, false)
    return
  }

  try {
    await emailSender.sendEmail(event)
    console.log(`[email] ${event.type} email sent to ${event.to}`)
    safeAck(channel, msg)
  } catch (error) {
    const count = retryCount(msg) + 1

    if (count >= config.maxRetries) {
      console.error(
        `[email] fallo definitivo tras ${count} entregas → DLQ:`,
        error,
      )
      safeNack(channel, msg, false)
      return
    }

    const backoff = config.retryBaseMs * 2 ** (count - 1)
    console.warn(
      `[email] fallo transitorio (entrega ${count}/${config.maxRetries}), requeue en ${backoff}ms:`,
      error,
    )
    requeueWithRetry(channel, msg, config, count, backoff)
  }
}

function requeueWithRetry(
  channel: Channel,
  msg: ConsumeMessage,
  config: EmailConfig,
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
      console.error(`[email-reencolar] no se pudo republicar: ${String(error)}`)
    }
  }, backoff)
}

function safeAck(channel: Channel, msg: ConsumeMessage): void {
  try {
    channel.ack(msg)
  } catch {
    // channel closed
  }
}

function safeNack(channel: Channel, msg: ConsumeMessage, requeue: boolean): void {
  try {
    channel.nack(msg, false, requeue)
  } catch {
    // channel closed
  }
}

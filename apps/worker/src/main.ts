import 'dotenv/config'
import { setDefaultResultOrder } from 'node:dns'
import { createPrismaClient } from '@lynx/db'
import { loadConfig } from './config'
import { startClickConsumer, type ClickConsumer } from './consumer'
import { startEmailConsumer, type EmailConsumer } from './email-consumer'
import { createEmailSender } from './email-sender'
import { delay } from './util'

setDefaultResultOrder('ipv4first')

const config = loadConfig()
const prisma = createPrismaClient()

let shuttingDown = false
let currentClick: ClickConsumer | null = null
let currentEmail: EmailConsumer | null = null

async function runClickConsumer(): Promise<void> {
  while (!shuttingDown) {
    try {
      const consumer = await startClickConsumer({ config, prisma })
      currentClick = consumer
      console.log(`LYNX worker clicks consumiendo de "${config.queue}" (DLQ: "${config.dlq}")`)
      await consumer.closed
    } catch (error) {
      if (shuttingDown) break
      console.error('LYNX worker clicks error:', error)
    }
    if (shuttingDown) break
    console.log(`LYNX worker clicks: reconexión en ${config.reconnectDelayMs}ms`)
    await delay(config.reconnectDelayMs)
  }
}

async function runEmailConsumer(): Promise<void> {
  const emailSender = await createEmailSender(config.smtp)
  while (!shuttingDown) {
    try {
      const consumer = await startEmailConsumer({
        config: config.email,
        rabbitmqUrl: config.rabbitmqUrl,
        emailSender,
      })
      currentEmail = consumer
      console.log(`LYNX worker emails consumiendo de "${config.email.queue}" (DLQ: "${config.email.dlq}")`)
      await consumer.closed
    } catch (error) {
      if (shuttingDown) break
      console.error('LYNX worker emails error:', error)
    }
    if (shuttingDown) break
    console.log(`LYNX worker emails: reconexión en ${config.email.reconnectDelayMs}ms`)
    await delay(config.email.reconnectDelayMs)
  }
}

async function shutdown(): Promise<void> {
  shuttingDown = true
  console.log('LYNX worker: apagando...')
  await currentClick?.close()
  await currentEmail?.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

void Promise.all([
  runClickConsumer().catch((error: unknown) => {
    console.error('LYNX worker clicks no pudo arrancar:', error)
  }),
  runEmailConsumer().catch((error: unknown) => {
    console.error('LYNX worker emails no pudo arrancar:', error)
  }),
]).catch(() => {
  process.exit(1)
})

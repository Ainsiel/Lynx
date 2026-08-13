import 'dotenv/config'
import { setDefaultResultOrder } from 'node:dns'
import { createPrismaClient } from '@lynx/db'
import { loadConfig } from './config'
import { startClickConsumer, type ClickConsumer } from './consumer'
import { delay } from './util'

// En Windows, localhost resuelve a ::1 antes que a IPv4; RabbitMQ local
// publica solo en IPv4. Fijar el orden evita ECONNREFUSED en amqplib.
setDefaultResultOrder('ipv4first')

const config = loadConfig()
const prisma = createPrismaClient()

let shuttingDown = false
let current: ClickConsumer | null = null

async function run(): Promise<void> {
  while (!shuttingDown) {
    try {
      const consumer = await startClickConsumer({ config, prisma })
      current = consumer
      console.log(`LYNX worker consumiendo de "${config.queue}" (DLQ: "${config.dlq}")`)
      await consumer.closed
    } catch (error) {
      if (shuttingDown) break
      console.error('LYNX worker error:', error)
    }
    if (shuttingDown) break
    console.log(`LYNX worker: reconexión en ${config.reconnectDelayMs}ms`)
    await delay(config.reconnectDelayMs)
  }
}

async function shutdown(): Promise<void> {
  shuttingDown = true
  console.log('LYNX worker: apagando...')
  await current?.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

void run().catch((error: unknown) => {
  console.error('LYNX worker no pudo arrancar:', error)
  process.exit(1)
})

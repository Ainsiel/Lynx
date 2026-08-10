import { connect } from 'amqplib'

const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'

async function main(): Promise<void> {
  const connection = await connect(url)
  console.log('LYNX worker conectado a RabbitMQ')

  const shutdown = async (): Promise<void> => {
    await connection.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

void main().catch((error: unknown) => {
  console.error('LYNX worker no pudo arrancar:', error)
  process.exit(1)
})

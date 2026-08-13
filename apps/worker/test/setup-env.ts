import * as dotenv from 'dotenv'
import * as path from 'node:path'
import { setDefaultResultOrder } from 'node:dns'

process.env.NODE_ENV = 'test'

// En Windows, localhost resuelve a ::1 antes que a IPv4; RabbitMQ local
// publica solo en IPv4. Fijar el orden evita ECONNREFUSED en amqplib.
setDefaultResultOrder('ipv4first')

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.test'),
})

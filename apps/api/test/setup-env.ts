import * as dotenv from 'dotenv'
import * as path from 'node:path'

process.env.NODE_ENV = 'test'

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.test'),
})

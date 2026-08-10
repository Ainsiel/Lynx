import { Injectable } from '@nestjs/common'
import { HealthIndicatorResult } from '@nestjs/terminus'
import { connect, type ChannelModel } from 'amqplib'
import { LynxHealthIndicator } from './check.helper'

const RABBITMQ_TIMEOUT_MS = 3000

function connectWithTimeout(url: string): Promise<ChannelModel> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      reject(new Error(`rabbitmq connection timed out after ${RABBITMQ_TIMEOUT_MS}ms`))
    }, RABBITMQ_TIMEOUT_MS)
    connect(url).then(
      (connection) => {
        clearTimeout(timer)
        if (settled) {
          void connection.close()
          return
        }
        settled = true
        resolve(connection)
      },
      (error: unknown) => {
        clearTimeout(timer)
        if (settled) {
          return
        }
        settled = true
        reject(error)
      },
    )
  })
}

@Injectable()
export class RabbitmqHealthIndicator extends LynxHealthIndicator {
  isHealthy(): Promise<HealthIndicatorResult> {
    const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'
    return this.runCheck('rabbitmq', async () => {
      const connection = await connectWithTimeout(url)
      await connection.close()
    })
  }
}

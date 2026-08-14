import { Inject, Injectable, Logger } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { EMAIL_RABBITMQ_TOKEN } from '../../../common/infra/tokens'

export interface EmailEvent {
  type: 'welcome' | 'reset'
  to: string
  name?: string
  token?: string
  timestamp: string
}

@Injectable()
export class EmailPublisherAdapter {
  private readonly logger = new Logger(EmailPublisherAdapter.name)

  constructor(
    @Inject(EMAIL_RABBITMQ_TOKEN) private readonly client: ClientProxy,
  ) {}

  publishWelcome(to: string, name: string): void {
    const event: EmailEvent = {
      type: 'welcome',
      to,
      name,
      timestamp: new Date().toISOString(),
    }
    this.client.emit('emails', event).subscribe({
      error: (err: unknown) => {
        this.logger.warn(`Failed to publish welcome email for ${to}: ${err}`)
      },
    })
  }

  publishReset(to: string, token: string): void {
    const event: EmailEvent = {
      type: 'reset',
      to,
      token,
      timestamp: new Date().toISOString(),
    }
    this.client.emit('emails', event).subscribe({
      error: (err: unknown) => {
        this.logger.warn(`Failed to publish reset email for ${to}: ${err}`)
      },
    })
  }
}

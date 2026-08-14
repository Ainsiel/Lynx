import { Inject, Injectable, Logger } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import type { EmailEvent } from '@lynx/shared'
import { EMAIL_RABBITMQ_TOKEN } from '../../../common/infra/tokens'

@Injectable()
export class EmailPublisherAdapter {
  private readonly logger = new Logger(EmailPublisherAdapter.name)

  constructor(
    @Inject(EMAIL_RABBITMQ_TOKEN) private readonly client: ClientProxy,
  ) {}

  publishWelcome(to: string, name: string): void {
    this.publish({ type: 'welcome', to, name, timestamp: new Date().toISOString() })
  }

  publishReset(to: string, token: string): void {
    this.publish({ type: 'reset', to, token, timestamp: new Date().toISOString() })
  }

  private publish(event: EmailEvent): void {
    this.client.emit('emails.send', event).subscribe({
      error: (err: unknown) => {
        this.logger.warn(`Failed to publish email event for ${event.to}: ${err}`)
      },
    })
  }
}

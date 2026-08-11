import { Inject, Injectable, Logger } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { randomUUID } from 'node:crypto'
import { RABBITMQ_TOKEN } from '../../../common/infra/tokens'

export interface ClickEvent {
  eventId: string
  slug: string
  timestamp: string
}

@Injectable()
export class ClickPublisherAdapter {
  private readonly logger = new Logger(ClickPublisherAdapter.name)

  constructor(
    @Inject(RABBITMQ_TOKEN) private readonly client: ClientProxy,
  ) {}

  publish(slug: string): void {
    const event: ClickEvent = {
      eventId: randomUUID(),
      slug,
      timestamp: new Date().toISOString(),
    }
    this.client.emit('clicks', event).subscribe({
      error: (err: unknown) => {
        this.logger.warn(
          `Failed to publish click event for slug ${slug}: ${err}`,
        )
      },
    })
  }
}

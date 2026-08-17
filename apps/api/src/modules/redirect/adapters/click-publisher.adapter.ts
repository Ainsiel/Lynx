import { Inject, Injectable, Logger } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { randomUUID } from 'node:crypto'
import { RABBITMQ_TOKEN } from '../../../common/infra/tokens'
import { MetricsService } from '../../metrics/metrics.service'

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
    private readonly metrics: MetricsService,
  ) {}

  publish(slug: string): void {
    const event: ClickEvent = {
      eventId: randomUUID(),
      slug,
      timestamp: new Date().toISOString(),
    }
    this.client.emit('clicks', event).subscribe({
      next: () => {
        this.metrics.clickPublishedTotal.inc()
      },
      error: (err: unknown) => {
        this.metrics.clickPublishErrorsTotal.inc()
        this.logger.warn(
          `Failed to publish click event for slug ${slug}: ${err}`,
        )
      },
    })
  }
}

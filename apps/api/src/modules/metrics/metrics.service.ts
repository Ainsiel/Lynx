import { Global, Injectable, OnModuleInit } from '@nestjs/common'
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client'

@Injectable()
@Global()
export class MetricsService implements OnModuleInit {
  readonly register = new Registry()

  readonly redirectTotal: Counter<string>
  readonly redirectLatency: Histogram<string>
  readonly cacheHitTotal: Counter<string>
  readonly cacheMissTotal: Counter<string>
  readonly clickPublishedTotal: Counter<string>
  readonly clickPublishErrorsTotal: Counter<string>

  constructor() {
    this.redirectTotal = new Counter({
      name: 'lynx_redirect_total',
      help: 'Total number of redirect requests',
      labelNames: ['status'] as const,
      registers: [this.register],
    })

    this.redirectLatency = new Histogram({
      name: 'lynx_redirect_latency_seconds',
      help: 'Latency of redirect requests in seconds',
      labelNames: ['status'] as const,
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.register],
    })

    this.cacheHitTotal = new Counter({
      name: 'lynx_cache_hit_total',
      help: 'Total number of cache hits',
      registers: [this.register],
    })

    this.cacheMissTotal = new Counter({
      name: 'lynx_cache_miss_total',
      help: 'Total number of cache misses',
      registers: [this.register],
    })

    this.clickPublishedTotal = new Counter({
      name: 'lynx_click_published_total',
      help: 'Total number of click events published to RabbitMQ',
      registers: [this.register],
    })

    this.clickPublishErrorsTotal = new Counter({
      name: 'lynx_click_publish_errors_total',
      help: 'Total number of failed click event publications',
      registers: [this.register],
    })
  }

  async onModuleInit(): Promise<void> {
    await collectDefaultMetrics({ register: this.register })
  }
}

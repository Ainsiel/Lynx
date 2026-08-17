import { Controller, Get, Header, UseGuards } from '@nestjs/common'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { MetricsService } from './metrics.service'

@Controller()
@UseGuards(RateLimitGuard)
@RateLimit({ limit: 60, dimension: 'ip' })
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.metricsService.register.metrics()
  }
}

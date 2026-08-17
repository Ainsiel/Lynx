import { Controller, Get, HttpStatus, NotFoundException, Param, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { RedirectService } from './redirect.service'
import { MetricsService } from '../metrics/metrics.service'

@Controller()
export class RedirectController {
  constructor(
    private readonly redirectService: RedirectService,
    private readonly metrics: MetricsService,
  ) {}

  @Get(':slug')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowMs: 60_000, dimension: 'ip' })
  async redirect(
    @Param('slug') slug: string,
    @Res() res: Response,
  ) {
    const start = performance.now()
    const result = await this.redirectService.resolve(slug)
    const elapsed = (performance.now() - start) / 1000

    if (!result) {
      this.metrics.redirectTotal.inc({ status: '404' })
      this.metrics.redirectLatency.observe({ status: '404' }, elapsed)
      throw new NotFoundException()
    }

    this.metrics.redirectTotal.inc({ status: '308' })
    this.metrics.redirectLatency.observe({ status: '308' }, elapsed)

    res.setHeader('Location', result.originalUrl)
    res.setHeader('Cache-Control', 'no-store')
    res.status(HttpStatus.PERMANENT_REDIRECT).send()
  }
}

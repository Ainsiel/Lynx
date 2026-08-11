import { Controller, Get, HttpStatus, NotFoundException, Param, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { RedirectService } from './redirect.service'

@Controller()
export class RedirectController {
  constructor(private readonly redirectService: RedirectService) {}

  @Get(':slug')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowMs: 60_000, dimension: 'ip' })
  async redirect(
    @Param('slug') slug: string,
    @Res() res: Response,
  ) {
    const result = await this.redirectService.resolve(slug)

    if (!result) {
      throw new NotFoundException()
    }

    res.setHeader('Location', result.originalUrl)
    res.setHeader('Cache-Control', 'no-store')
    res.status(HttpStatus.PERMANENT_REDIRECT).send()
  }
}

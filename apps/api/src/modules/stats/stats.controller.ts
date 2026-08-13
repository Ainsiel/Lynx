import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { StatsQuerySchema, type StatsQuery } from '@lynx/shared'
import { RateLimits } from '../../common/rate-limit/rate-limit.decorator'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { JwtAuthGuard, AuthenticatedRequest } from '../../common/guards/jwt-auth.guard'
import { userFromRequest } from '../../common/guards/user-from-request'
import { StatsService } from './stats.service'
import { Req } from '@nestjs/common'

@Controller('links')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get(':slug/stats')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimits({ limit: 30, dimension: 'user' }, { limit: 60, dimension: 'ip' })
  async getStats(
    @Req() req: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(StatsQuerySchema)) query: StatsQuery,
  ) {
    const user = userFromRequest(req)
    return this.statsService.getStats(slug, user.sub, query)
  }
}

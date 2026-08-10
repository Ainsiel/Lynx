import { Module } from '@nestjs/common'
import { FixedWindowRateLimiter } from './fixed-window-rate-limiter.service'
import { RateLimitGuard } from './rate-limit.guard'

@Module({
  providers: [FixedWindowRateLimiter, RateLimitGuard],
  exports: [FixedWindowRateLimiter, RateLimitGuard],
})
export class RateLimitModule {}

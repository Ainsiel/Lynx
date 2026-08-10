import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request, Response } from 'express'
import { TooManyRequestsException } from '../errors/too-many-requests.exception'
import { FixedWindowRateLimiter } from './fixed-window-rate-limiter.service'
import { RATE_LIMIT_METADATA, RateLimitOptions } from './rate-limit.decorator'

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: FixedWindowRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_METADATA,
      context.getHandler(),
    )
    if (!options) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()
    const ip = request.ip ?? 'unknown'
    const key = `lynx:rate:${options.dimension}:${ip}`

    const result = await this.limiter.consume(
      { windowMs: options.windowMs, limit: options.limit },
      key,
    )

    response.setHeader('X-RateLimit-Limit', String(options.limit))
    response.setHeader('X-RateLimit-Remaining', String(result.remaining))

    if (!result.allowed) {
      throw new TooManyRequestsException(result.retryAfterMs)
    }
    return true
  }
}

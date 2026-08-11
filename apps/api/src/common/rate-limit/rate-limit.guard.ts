import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request, Response } from 'express'
import { TooManyRequestsException } from '../errors/too-many-requests.exception'
import { FixedWindowRateLimiter } from './fixed-window-rate-limiter.service'
import {
  RATE_LIMIT_METADATA,
  RATE_LIMITS_METADATA,
  RateLimitOptions,
} from './rate-limit.decorator'

interface AuthenticatedUser {
  sub?: string
  userId?: string
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: FixedWindowRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const multi = this.reflector.getAllAndOverride<RateLimitOptions[]>(
      RATE_LIMITS_METADATA,
      [context.getHandler(), context.getClass()],
    )
    const single = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_METADATA,
      context.getHandler(),
    )
    const optionsList = multi ?? (single ? [single] : [])
    if (optionsList.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()
    const ip = request.ip ?? 'unknown'
    const user = (request as unknown as { user?: AuthenticatedUser }).user
    const userId = user?.sub ?? user?.userId ?? 'anonymous'

    for (let i = 0; i < optionsList.length; i++) {
      const options = optionsList[i]!
      const id = options.dimension === 'user' ? userId : ip
      const key = `lynx:rate:${options.dimension}:${id}`

      const result = await this.limiter.consume(
        { windowMs: options.windowMs, limit: options.limit },
        key,
      )

      response.setHeader(
        `X-RateLimit-${options.dimension}-Limit`,
        String(options.limit),
      )
      response.setHeader(
        `X-RateLimit-${options.dimension}-Remaining`,
        String(result.remaining),
      )
      if (i === 0) {
        response.setHeader('X-RateLimit-Limit', String(options.limit))
        response.setHeader(
          'X-RateLimit-Remaining',
          String(result.remaining),
        )
      }

      if (!result.allowed) {
        throw new TooManyRequestsException(result.retryAfterMs)
      }
    }
    return true
  }
}

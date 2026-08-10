import { SetMetadata } from '@nestjs/common'

export const RATE_LIMIT_METADATA = 'lynx:rate-limit'

export interface RateLimitOptions {
  limit: number
  windowMs: number
  dimension: string
}

export const RateLimit = (
  options: Partial<RateLimitOptions> & { limit: number },
): ReturnType<typeof SetMetadata> =>
  SetMetadata(RATE_LIMIT_METADATA, {
    windowMs: 60_000,
    dimension: 'ip',
    ...options,
  })

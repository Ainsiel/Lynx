import { z } from 'zod'

export const RateLimitConfigSchema = z.object({
  windowMs: z.number().int().positive().default(60_000),
  limit: z.number().int().positive().default(100),
})

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>

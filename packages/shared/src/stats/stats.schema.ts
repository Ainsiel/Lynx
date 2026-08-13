import { z } from 'zod'

export const StatsGroupBySchema = z.enum(['day', 'country', 'device'])
export type StatsGroupBy = z.infer<typeof StatsGroupBySchema>

export const StatsQuerySchema = z.object({
  groupBy: StatsGroupBySchema.default('day'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type StatsQuery = z.infer<typeof StatsQuerySchema>

export const StatsBreakdownItemSchema = z.object({
  date: z.string().optional(),
  country: z.string().optional(),
  device: z.string().optional(),
  clicks: z.number(),
})

export type StatsBreakdownItem = z.infer<typeof StatsBreakdownItemSchema>

export const StatsResponseSchema = z.object({
  total: z.number(),
  breakdown: z.array(StatsBreakdownItemSchema),
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
})

export type StatsResponse = z.infer<typeof StatsResponseSchema>

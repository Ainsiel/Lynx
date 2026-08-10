import { z } from 'zod'

export const HealthCheckStateSchema = z.enum(['up', 'down'])
export const HealthStatusSchema = z.enum(['ok', 'error'])

export const HealthComponentSchema = z.object({
  status: HealthCheckStateSchema,
})

export const HealthComponentRecordSchema = z.record(
  z.string(),
  HealthComponentSchema,
)

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  info: HealthComponentRecordSchema,
  error: HealthComponentRecordSchema,
  details: HealthComponentRecordSchema,
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>

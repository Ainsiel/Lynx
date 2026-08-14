import { z } from 'zod'

export const AuditQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().uuid().optional(),
})

export type AuditQuery = z.infer<typeof AuditQuerySchema>

import { z } from 'zod'

export const EmailEventSchema = z.object({
  type: z.enum(['welcome', 'reset']),
  to: z.string().email(),
  name: z.string().optional(),
  token: z.string().optional(),
  timestamp: z.string().datetime(),
})

export type EmailEvent = z.infer<typeof EmailEventSchema>

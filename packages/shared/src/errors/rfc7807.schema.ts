import { z } from 'zod'

export const Rfc7807ProblemSchema = z.object({
  type: z.string().url(),
  title: z.string().min(1),
  status: z.number().int().positive(),
  detail: z.string(),
  instance: z.string(),
})

export type Rfc7807Problem = z.infer<typeof Rfc7807ProblemSchema>

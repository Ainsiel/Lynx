import { z } from 'zod'

const CUSTOM_SLUG_REGEX = /^[a-zA-Z0-9_-]{6,10}$/

export const RESERVED_SLUGS = [
  'api',
  'admin',
  'auth',
  'health',
  'metrics',
  'links',
  'login',
  'register',
  'logout',
  'refresh',
  'me',
  'users',
  'dashboard',
  'static',
  'assets',
  'favicon',
  'robots',
  'sitemap',
]

export const CreateLinkInputSchema = z.object({
  originalUrl: z.string().url('Invalid URL format'),
  customSlug: z
    .string()
    .regex(CUSTOM_SLUG_REGEX, 'Slug must be 6-10 chars: [a-zA-Z0-9_-]')
    .optional(),
})

export const LinkResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  shortUrl: z.string().url(),
  originalUrl: z.string().url(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const UpdateLinkInputSchema = z
  .object({
    originalUrl: z.string().url('Invalid URL format').optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => data.originalUrl !== undefined || data.isActive !== undefined,
    { message: 'At least one of originalUrl or isActive must be provided' },
  )

export const LinkListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z
    .preprocess(
      (val) => {
        if (val === 'true' || val === '1') return true
        if (val === 'false' || val === '0') return false
        return undefined
      },
      z.boolean().optional(),
    )
    .optional(),
})

export const LinkListResponseSchema = z.object({
  data: z.array(LinkResponseSchema),
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
})

export type CreateLinkInput = z.infer<typeof CreateLinkInputSchema>
export type LinkResponse = z.infer<typeof LinkResponseSchema>
export type UpdateLinkInput = z.infer<typeof UpdateLinkInputSchema>
export type LinkListQuery = z.infer<typeof LinkListQuerySchema>
export type LinkListResponse = z.infer<typeof LinkListResponseSchema>

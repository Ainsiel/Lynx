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
})

export type CreateLinkInput = z.infer<typeof CreateLinkInputSchema>
export type LinkResponse = z.infer<typeof LinkResponseSchema>

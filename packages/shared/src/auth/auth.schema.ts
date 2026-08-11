import { z } from 'zod'

export const RegisterInputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['USER', 'ADMIN']),
})

export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
  accessToken: z.string(),
})

export type RegisterInput = z.infer<typeof RegisterInputSchema>
export type LoginInput = z.infer<typeof LoginInputSchema>
export type UserResponse = z.infer<typeof UserResponseSchema>
export type AuthResponse = z.infer<typeof AuthResponseSchema>

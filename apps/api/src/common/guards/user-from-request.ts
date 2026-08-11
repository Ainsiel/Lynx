import type { AuthenticatedRequest, AuthenticatedUser } from './jwt-auth.guard'

export function userFromRequest(request: AuthenticatedRequest): AuthenticatedUser {
  const user = request.user
  if (!user) {
    throw new Error('User not set on request — ensure JwtAuthGuard runs first')
  }
  return user
}

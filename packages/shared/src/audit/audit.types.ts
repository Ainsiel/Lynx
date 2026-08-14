export const AUDIT_ACTIONS = {
  // Auth
  REGISTER: 'REGISTER',
  LOGIN: 'LOGIN',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  LOGOUT: 'LOGOUT',
  FORGOT_PASSWORD: 'FORGOT_PASSWORD',
  PASSWORD_RESET: 'PASSWORD_RESET',
  OAUTH_REGISTER: 'OAUTH_REGISTER',
  OAUTH_LINK: 'OAUTH_LINK',
  // Links
  LINK_CREATED: 'LINK_CREATED',
  LINK_UPDATED: 'LINK_UPDATED',
  LINK_DELETED: 'LINK_DELETED',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export const AUDIT_ENTITY_TYPES = {
  USER: 'USER',
  URL: 'URL',
  SESSION: 'SESSION',
} as const

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES]

export interface LogAuditInput {
  userId?: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
  userAgent?: string | null
}

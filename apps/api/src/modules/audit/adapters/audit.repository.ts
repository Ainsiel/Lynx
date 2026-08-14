import { Inject, Injectable, Logger } from '@nestjs/common'
import { PRISMA_CLIENT } from '../../../common/infra/tokens'
import type { PrismaClient } from '@lynx/db'
import type { LogAuditInput } from '@lynx/shared'
import { InputJsonValue } from '@lynx/db/generated/internal/prismaNamespace'

export interface AuditLogRecord {
  id: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  metadata: unknown
  ip: string | null
  userAgent: string | null
  createdAt: Date
}

interface FindAllInput {
  cursor?: string
  take: number
  action?: string
  entityType?: string
  userId?: string
}

export interface PaginatedResult {
  data: AuditLogRecord[]
  nextCursor: string | null
}

@Injectable()
export class AuditRepository {
  private readonly logger = new Logger(AuditRepository.name)

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async log(input: LogAuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          metadata: input.metadata as InputJsonValue | undefined,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      })
    } catch (error) {
      // Fail-open: audit logging should never block the main flow
      this.logger.warn(`Failed to write audit log: ${error}`)
    }
  }

  async findAll(input: FindAllInput): Promise<PaginatedResult> {
    const where: Record<string, unknown> = {}
    if (input.action) where.action = input.action
    if (input.entityType) where.entityType = input.entityType
    if (input.userId) where.userId = input.userId

    const results = await this.prisma.auditLog.findMany({
      where,
      take: input.take + 1,
      orderBy: { createdAt: 'desc' },
      ...(input.cursor
        ? { cursor: { id: input.cursor }, skip: 1 }
        : {}),
    })

    const hasMore = results.length > input.take
    const data = hasMore ? results.slice(0, input.take) : results
    const last = data[data.length - 1]
    const nextCursor = hasMore && last ? last.id : null

    return { data, nextCursor }
  }
}

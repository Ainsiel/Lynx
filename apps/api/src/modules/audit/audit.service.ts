import { Injectable } from '@nestjs/common'
import { AuditRepository } from './adapters/audit.repository'
import type { LogAuditInput } from '@lynx/shared'

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async log(input: LogAuditInput): Promise<void> {
    await this.auditRepository.log(input)
  }

  async findAll(input: {
    cursor?: string
    take: number
    action?: string
    entityType?: string
    userId?: string
  }) {
    return this.auditRepository.findAll(input)
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { AdminGuard } from '../../common/guards/admin.guard'
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard'
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator'
import { AuditService } from './audit.service'
import { AuditQuerySchema, type AuditQuery } from '@lynx/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, AdminGuard, RateLimitGuard)
@RateLimit({ limit: 60, dimension: 'user' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(AuditQuerySchema)) query: AuditQuery,
  ) {
    return this.auditService.findAll(query)
  }
}

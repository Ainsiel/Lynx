import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorResult } from '@nestjs/terminus'
import { PrismaClient } from '@lynx/db'
import { PRISMA_CLIENT } from '../../../common/infra/tokens'
import { LynxHealthIndicator } from './check.helper'

@Injectable()
export class PostgresHealthIndicator extends LynxHealthIndicator {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {
    super()
  }

  isHealthy(): Promise<HealthIndicatorResult> {
    return this.runCheck('postgres', () => this.prisma.$queryRaw`SELECT 1`)
  }
}

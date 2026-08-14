import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuditService } from './audit.service'
import { AuditRepository } from './adapters/audit.repository'
import { AuditController } from './audit.controller'
import { InfraModule } from '../../common/infra/infra.module'
import { JWT_SECRET } from '../../common/infra/tokens'
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module'

@Module({
  imports: [
    InfraModule,
    RateLimitModule,
    JwtModule.registerAsync({
      inject: [JWT_SECRET],
      useFactory: (secret: string) => ({
        secret,
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}

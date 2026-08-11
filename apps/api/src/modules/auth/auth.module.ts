import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { InfraModule } from '../../common/infra/infra.module'
import { JWT_SECRET } from '../../common/infra/tokens'
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { UserRepository } from './adapters/user.repository'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@Module({
  imports: [
    InfraModule,
    JwtModule.registerAsync({
      inject: [JWT_SECRET],
      useFactory: (secret: string) => ({
        secret,
        signOptions: { expiresIn: '15m' },
      }),
    }),
    RateLimitModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, UserRepository, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}

import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { InfraModule } from '../../common/infra/infra.module'
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { UserRepository } from './adapters/user.repository'

@Module({
  imports: [
    InfraModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'dev-secret',
        signOptions: { expiresIn: '15m' },
      }),
    }),
    RateLimitModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, UserRepository],
})
export class AuthModule {}

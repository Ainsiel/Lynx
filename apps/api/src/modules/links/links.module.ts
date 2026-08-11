import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module'
import { LinksController } from './links.controller'
import { LinksService } from './links.service'
import { LinkRepository } from './adapters/link.repository'
import { IdempotencyRepository } from './adapters/idempotency.repository'

@Module({
  imports: [AuthModule, RateLimitModule],
  controllers: [LinksController],
  providers: [LinksService, LinkRepository, IdempotencyRepository],
})
export class LinksModule {}

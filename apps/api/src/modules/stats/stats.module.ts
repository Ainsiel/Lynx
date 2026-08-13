import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module'
import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'
import { StatsRepository } from './adapters/stats.repository'
import { StatsCacheRepository } from './adapters/stats-cache.repository'

@Module({
  imports: [AuthModule, RateLimitModule],
  controllers: [StatsController],
  providers: [StatsService, StatsRepository, StatsCacheRepository],
})
export class StatsModule {}

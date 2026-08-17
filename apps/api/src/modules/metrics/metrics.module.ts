import { Module } from '@nestjs/common'
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module'
import { MetricsController } from './metrics.controller'
import { MetricsService } from './metrics.service'

@Module({
  imports: [RateLimitModule],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}

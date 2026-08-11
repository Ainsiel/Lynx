import { Module } from '@nestjs/common'
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module'
import { LinkRepository } from '../links/adapters/link.repository'
import { RedirectController } from './redirect.controller'
import { RedirectService } from './redirect.service'
import { UrlCacheRepository } from './adapters/url-cache.repository'
import { ClickPublisherAdapter } from './adapters/click-publisher.adapter'

@Module({
  imports: [RateLimitModule],
  controllers: [RedirectController],
  providers: [
    RedirectService,
    UrlCacheRepository,
    ClickPublisherAdapter,
    LinkRepository,
  ],
})
export class RedirectModule {}

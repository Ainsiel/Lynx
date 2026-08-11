import { Injectable } from '@nestjs/common'
import { LinkRepository } from '../links/adapters/link.repository'
import { UrlCacheRepository } from './adapters/url-cache.repository'
import { ClickPublisherAdapter } from './adapters/click-publisher.adapter'

@Injectable()
export class RedirectService {
  constructor(
    private readonly urlCache: UrlCacheRepository,
    private readonly clickPublisher: ClickPublisherAdapter,
    private readonly linkRepository: LinkRepository,
  ) {}

  async resolve(slug: string): Promise<{ originalUrl: string } | null> {
    const record = await this.urlCache.resolve(slug, () =>
      this.linkRepository.findBySlug(slug),
    )

    if (!record || !record.isActive) {
      return null
    }

    this.clickPublisher.publish(slug)

    return { originalUrl: record.originalUrl }
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { StatsQuery, StatsResponse } from '@lynx/shared'
import { StatsRepository } from './adapters/stats.repository'
import { StatsCacheRepository } from './adapters/stats-cache.repository'

@Injectable()
export class StatsService {
  constructor(
    private readonly statsRepository: StatsRepository,
    private readonly statsCacheRepository: StatsCacheRepository,
  ) {}

  async getStats(
    slug: string,
    userId: string,
    query: StatsQuery,
  ): Promise<StatsResponse> {
    const url = await this.statsRepository.findUrlBySlug(slug)
    if (!url) {
      throw new NotFoundException(`Link with slug '${slug}' not found`)
    }
    if (url.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this link stats')
    }

    const cacheKey = this.statsCacheRepository.buildKey(
      slug,
      query.groupBy,
      query.from,
      query.to,
      query.page,
      query.pageSize,
    )

    const cached = await this.statsCacheRepository.get(cacheKey)
    if (cached) {
      return cached
    }

    const [total, breakdown, totalItems] = await Promise.all([
      this.statsRepository.getTotal(url.id, query.groupBy, query.from, query.to),
      this.statsRepository.getBreakdown(
        url.id,
        query.groupBy,
        query.from,
        query.to,
        query.page,
        query.pageSize,
      ),
      this.statsRepository.getTotalBreakdownItems(
        url.id,
        query.groupBy,
        query.from,
        query.to,
      ),
    ])

    const response: StatsResponse = {
      total,
      breakdown: breakdown.map((item) => ({
        [query.groupBy === 'day' ? 'date' : query.groupBy]: item.key,
        clicks: item.clicks,
      })),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
    }

    await this.statsCacheRepository.set(cacheKey, response)

    return response
  }
}

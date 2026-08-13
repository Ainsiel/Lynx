import { Test, TestingModule } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { StatsService } from './stats.service'
import { StatsRepository } from './adapters/stats.repository'
import { StatsCacheRepository } from './adapters/stats-cache.repository'

describe('StatsService', () => {
  let service: StatsService
  let statsRepository: jest.Mocked<StatsRepository>
  let statsCacheRepository: jest.Mocked<StatsCacheRepository>

  const mockUrl = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    ownerId: 'user-123',
    slug: 'test-slug',
  }

  const defaultQuery = {
    groupBy: 'day' as const,
    page: 1,
    pageSize: 20,
  }

  beforeEach(async () => {
    const mockStatsRepository = {
      findUrlBySlug: jest.fn(),
      getTotal: jest.fn(),
      getBreakdown: jest.fn(),
      getTotalBreakdownItems: jest.fn(),
    }

    const mockStatsCacheRepository = {
      buildKey: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: StatsRepository, useValue: mockStatsRepository },
        { provide: StatsCacheRepository, useValue: mockStatsCacheRepository },
      ],
    }).compile()

    service = module.get<StatsService>(StatsService)
    statsRepository = module.get(StatsRepository)
    statsCacheRepository = module.get(StatsCacheRepository)

    statsCacheRepository.buildKey.mockReturnValue('lynx:stats:test-slug:day:*:*:1:20')
  })

  describe('getStats', () => {
    it('should return stats correctly on cache miss', async () => {
      statsRepository.findUrlBySlug.mockResolvedValue(mockUrl)
      statsCacheRepository.get.mockResolvedValue(null)
      statsRepository.getTotal.mockResolvedValue(100)
      statsRepository.getBreakdown.mockResolvedValue([
        { key: '2026-08-13', clicks: 50 },
        { key: '2026-08-12', clicks: 50 },
      ])
      statsRepository.getTotalBreakdownItems.mockResolvedValue(2)

      const result = await service.getStats('test-slug', 'user-123', defaultQuery)

      expect(result.total).toBe(100)
      expect(result.breakdown).toHaveLength(2)
      expect(result.breakdown[0]).toEqual({ date: '2026-08-13', clicks: 50 })
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
      expect(result.totalItems).toBe(2)
      expect(statsCacheRepository.set).toHaveBeenCalled()
    })

    it('should return stats from cache on cache hit', async () => {
      statsRepository.findUrlBySlug.mockResolvedValue(mockUrl)
      const cachedData = {
        total: 100,
        breakdown: [{ date: '2026-08-13', clicks: 100 }],
        page: 1,
        pageSize: 20,
        totalItems: 1,
      }
      statsCacheRepository.get.mockResolvedValue(cachedData)

      const result = await service.getStats('test-slug', 'user-123', defaultQuery)

      expect(result).toEqual(cachedData)
      expect(statsRepository.getTotal).not.toHaveBeenCalled()
      expect(statsRepository.getBreakdown).not.toHaveBeenCalled()
    })

    it('should throw NotFoundException for non-existent slug', async () => {
      statsRepository.findUrlBySlug.mockResolvedValue(null)

      await expect(
        service.getStats('non-existent', 'user-123', defaultQuery),
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException for non-owner', async () => {
      statsRepository.findUrlBySlug.mockResolvedValue(mockUrl)

      await expect(
        service.getStats('test-slug', 'other-user', defaultQuery),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should convert BigInt to Number in response', async () => {
      statsRepository.findUrlBySlug.mockResolvedValue(mockUrl)
      statsCacheRepository.get.mockResolvedValue(null)
      statsRepository.getTotal.mockResolvedValue(100)
      statsRepository.getBreakdown.mockResolvedValue([
        { key: '2026-08-13', clicks: 50 },
      ])
      statsRepository.getTotalBreakdownItems.mockResolvedValue(1)

      const result = await service.getStats('test-slug', 'user-123', defaultQuery)

      expect(typeof result.total).toBe('number')
      expect(result.breakdown[0]).toBeDefined()
      expect(typeof result.breakdown[0]!.clicks).toBe('number')
    })

    it('should handle pagination correctly', async () => {
      statsRepository.findUrlBySlug.mockResolvedValue(mockUrl)
      statsCacheRepository.get.mockResolvedValue(null)
      statsRepository.getTotal.mockResolvedValue(100)
      statsRepository.getBreakdown.mockResolvedValue([
        { key: '2026-08-10', clicks: 30 },
      ])
      statsRepository.getTotalBreakdownItems.mockResolvedValue(5)

      const query = { ...defaultQuery, page: 2, pageSize: 2 }
      const result = await service.getStats('test-slug', 'user-123', query)

      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(2)
      expect(statsRepository.getBreakdown).toHaveBeenCalledWith(
        mockUrl.id,
        'day',
        undefined,
        undefined,
        2,
        2,
      )
    })

    it('should pass from/to filters to repository', async () => {
      statsRepository.findUrlBySlug.mockResolvedValue(mockUrl)
      statsCacheRepository.get.mockResolvedValue(null)
      statsRepository.getTotal.mockResolvedValue(50)
      statsRepository.getBreakdown.mockResolvedValue([])
      statsRepository.getTotalBreakdownItems.mockResolvedValue(0)

      const query = {
        ...defaultQuery,
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-31T23:59:59.999Z',
      }
      await service.getStats('test-slug', 'user-123', query)

      expect(statsRepository.getTotal).toHaveBeenCalledWith(
        mockUrl.id,
        'day',
        '2026-08-01T00:00:00.000Z',
        '2026-08-31T23:59:59.999Z',
      )
      expect(statsRepository.getBreakdown).toHaveBeenCalledWith(
        mockUrl.id,
        'day',
        '2026-08-01T00:00:00.000Z',
        '2026-08-31T23:59:59.999Z',
        1,
        20,
      )
    })

    it('should use correct table for groupBy=country', async () => {
      statsRepository.findUrlBySlug.mockResolvedValue(mockUrl)
      statsCacheRepository.get.mockResolvedValue(null)
      statsRepository.getTotal.mockResolvedValue(75)
      statsRepository.getBreakdown.mockResolvedValue([
        { key: 'US', clicks: 50 },
        { key: 'MX', clicks: 25 },
      ])
      statsRepository.getTotalBreakdownItems.mockResolvedValue(2)

      const query = { ...defaultQuery, groupBy: 'country' as const }
      statsCacheRepository.buildKey.mockReturnValue('lynx:stats:test-slug:country:*:*:1:20')

      const result = await service.getStats('test-slug', 'user-123', query)

      expect(result.breakdown[0]).toEqual({ country: 'US', clicks: 50 })
      expect(statsRepository.getTotal).toHaveBeenCalledWith(mockUrl.id, 'country', undefined, undefined)
    })

    it('should use correct table for groupBy=device', async () => {
      statsRepository.findUrlBySlug.mockResolvedValue(mockUrl)
      statsCacheRepository.get.mockResolvedValue(null)
      statsRepository.getTotal.mockResolvedValue(60)
      statsRepository.getBreakdown.mockResolvedValue([
        { key: 'desktop', clicks: 40 },
        { key: 'mobile', clicks: 20 },
      ])
      statsRepository.getTotalBreakdownItems.mockResolvedValue(2)

      const query = { ...defaultQuery, groupBy: 'device' as const }
      statsCacheRepository.buildKey.mockReturnValue('lynx:stats:test-slug:device:*:*:1:20')

      const result = await service.getStats('test-slug', 'user-123', query)

      expect(result.breakdown[0]).toEqual({ device: 'desktop', clicks: 40 })
      expect(statsRepository.getTotal).toHaveBeenCalledWith(mockUrl.id, 'device', undefined, undefined)
    })
  })
})

import { Test, TestingModule } from '@nestjs/testing'
import { RedirectService } from './redirect.service'
import { UrlCacheRepository } from './adapters/url-cache.repository'
import { ClickPublisherAdapter } from './adapters/click-publisher.adapter'
import { LinkRepository } from '../links/adapters/link.repository'

describe('RedirectService', () => {
  let service: RedirectService
  let urlCache: jest.Mocked<UrlCacheRepository>
  let clickPublisher: jest.Mocked<ClickPublisherAdapter>
  let linkRepository: jest.Mocked<LinkRepository>

  const mockUrlRecord = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    ownerId: 'user-123',
    originalUrl: 'https://example.com',
    slug: 'test1234',
    isActive: true,
    createdAt: '2026-08-11T10:00:00.000Z',
    updatedAt: '2026-08-11T10:00:00.000Z',
  }

  beforeEach(async () => {
    const mockUrlCache = {
      resolve: jest.fn(),
    }

    const mockClickPublisher = {
      publish: jest.fn(),
    }

    const mockLinkRepository = {
      create: jest.fn(),
      findBySlug: jest.fn(),
      slugExists: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedirectService,
        { provide: UrlCacheRepository, useValue: mockUrlCache },
        { provide: ClickPublisherAdapter, useValue: mockClickPublisher },
        { provide: LinkRepository, useValue: mockLinkRepository },
      ],
    }).compile()

    service = module.get<RedirectService>(RedirectService)
    urlCache = module.get(UrlCacheRepository)
    clickPublisher = module.get(ClickPublisherAdapter)
    linkRepository = module.get(LinkRepository)
  })

  describe('resolve', () => {
    it('should return original URL for active slug', async () => {
      urlCache.resolve.mockResolvedValue(mockUrlRecord)

      const result = await service.resolve('test1234')

      expect(result).toEqual({ originalUrl: 'https://example.com' })
      expect(clickPublisher.publish).toHaveBeenCalledWith('test1234')
    })

    it('should return null for non-existent slug', async () => {
      urlCache.resolve.mockResolvedValue(null)

      const result = await service.resolve('nonexistent')

      expect(result).toBeNull()
      expect(clickPublisher.publish).not.toHaveBeenCalled()
    })

    it('should return null for inactive slug', async () => {
      urlCache.resolve.mockResolvedValue({ ...mockUrlRecord, isActive: false })

      const result = await service.resolve('inactive')

      expect(result).toBeNull()
      expect(clickPublisher.publish).not.toHaveBeenCalled()
    })

    it('should call urlCache.resolve with fetchFromDb callback', async () => {
      urlCache.resolve.mockResolvedValue(mockUrlRecord)
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)

      await service.resolve('test1234')

      expect(urlCache.resolve).toHaveBeenCalledWith(
        'test1234',
        expect.any(Function),
      )
    })

    it('should publish click event asynchronously', async () => {
      urlCache.resolve.mockResolvedValue(mockUrlRecord)

      await service.resolve('test1234')

      expect(clickPublisher.publish).toHaveBeenCalledTimes(1)
      expect(clickPublisher.publish).toHaveBeenCalledWith('test1234')
    })
  })
})

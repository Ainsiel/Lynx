import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, ConflictException } from '@nestjs/common'
import Redis from 'ioredis'
import { LinksService } from './links.service'
import { LinkRepository } from './adapters/link.repository'
import { IdempotencyRepository } from './adapters/idempotency.repository'
import { REDIS_CLIENT } from '../../common/infra/tokens'

describe('LinksService', () => {
  let service: LinksService
  let linkRepository: jest.Mocked<LinkRepository>
  let idempotencyRepository: jest.Mocked<IdempotencyRepository>
  let redis: jest.Mocked<Redis>

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
    const mockLinkRepository = {
      create: jest.fn(),
      findBySlug: jest.fn(),
      slugExists: jest.fn(),
    }

    const mockIdempotencyRepository = {
      find: jest.fn(),
      store: jest.fn(),
    }

    const mockRedis = {
      set: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        { provide: LinkRepository, useValue: mockLinkRepository },
        { provide: IdempotencyRepository, useValue: mockIdempotencyRepository },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile()

    service = module.get<LinksService>(LinksService)
    linkRepository = module.get(LinkRepository)
    idempotencyRepository = module.get(IdempotencyRepository)
    redis = module.get(REDIS_CLIENT)
  })

  describe('create', () => {
    it('should create a link with custom slug', async () => {
      linkRepository.create.mockResolvedValue(mockUrlRecord)
      redis.set.mockResolvedValue('OK')

      const result = await service.create(
        { originalUrl: 'https://example.com', customSlug: 'test1234' },
        'user-123',
      )

      expect(result.status).toBe(201)
      expect(result.data.slug).toBe('test1234')
      expect(result.data.originalUrl).toBe('https://example.com')
      expect(redis.set).toHaveBeenCalledWith(
        'lynx:url:test1234',
        'https://example.com',
        'NX',
      )
    })

    it('should create a link with auto-generated slug', async () => {
      linkRepository.slugExists.mockResolvedValue(false)
      linkRepository.create.mockResolvedValue(mockUrlRecord)
      redis.set.mockResolvedValue('OK')

      const result = await service.create(
        { originalUrl: 'https://example.com' },
        'user-123',
      )

      expect(result.status).toBe(201)
      expect(result.data.slug).toBe('test1234')
    })

    it('should return 200 for idempotent request', async () => {
      const cachedResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'test1234',
        shortUrl: 'http://localhost:3000/test1234',
        originalUrl: 'https://example.com',
        isActive: true,
        createdAt: '2026-08-11T10:00:00.000Z',
      }
      idempotencyRepository.find.mockResolvedValue({
        userId: 'user-123',
        response: cachedResponse,
      })

      const result = await service.create(
        { originalUrl: 'https://example.com', customSlug: 'test1234' },
        'user-123',
        'idempotency-key-123',
      )

      expect(result.status).toBe(200)
      expect(result.data).toEqual(cachedResponse)
    })

    it('should throw ConflictException for occupied slug', async () => {
      linkRepository.create.mockResolvedValue(null)

      await expect(
        service.create(
          { originalUrl: 'https://example.com', customSlug: 'occupied' },
          'user-123',
        ),
      ).rejects.toThrow(ConflictException)
    })

    it('should throw BadRequestException for invalid URL', async () => {
      await expect(
        service.create(
          { originalUrl: 'not-a-url' },
          'user-123',
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException for LYNX URL', async () => {
      await expect(
        service.create(
          { originalUrl: 'http://localhost:3000/some-path' },
          'user-123',
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should store idempotency key after creation', async () => {
      linkRepository.create.mockResolvedValue(mockUrlRecord)
      redis.set.mockResolvedValue('OK')

      await service.create(
        { originalUrl: 'https://example.com', customSlug: 'test1234' },
        'user-123',
        'idempotency-key-123',
      )

      expect(idempotencyRepository.store).toHaveBeenCalledWith(
        'idempotency-key-123',
        'user-123',
        expect.objectContaining({ slug: 'test1234' }),
      )
    })
  })
})

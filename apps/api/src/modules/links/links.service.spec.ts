import { Test, TestingModule } from '@nestjs/testing'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
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
      findMany: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    }

    const mockIdempotencyRepository = {
      find: jest.fn(),
      store: jest.fn(),
    }

    const mockRedis = {
      set: jest.fn(),
      del: jest.fn(),
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

  describe('list', () => {
    it('should return links for the owner', async () => {
      linkRepository.findMany.mockResolvedValue({
        data: [mockUrlRecord],
        total: 1,
      })

      const result = await service.list('user-123', 'USER', {
        page: 1,
        pageSize: 20,
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0]!.slug).toBe('test1234')
      expect(result.totalItems).toBe(1)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
      expect(linkRepository.findMany).toHaveBeenCalledWith({
        ownerId: 'user-123',
        isActive: true,
        page: 1,
        pageSize: 20,
      })
    })

    it('should return all links for admin', async () => {
      linkRepository.findMany.mockResolvedValue({
        data: [mockUrlRecord],
        total: 1,
      })

      await service.list('admin-id', 'ADMIN', {
        page: 1,
        pageSize: 20,
      })

      expect(linkRepository.findMany).toHaveBeenCalledWith({
        ownerId: null,
        isActive: true,
        page: 1,
        pageSize: 20,
      })
    })

    it('should filter by isActive', async () => {
      linkRepository.findMany.mockResolvedValue({ data: [], total: 0 })

      await service.list('user-123', 'USER', {
        page: 1,
        pageSize: 20,
        isActive: false,
      })

      expect(linkRepository.findMany).toHaveBeenCalledWith({
        ownerId: 'user-123',
        isActive: false,
        page: 1,
        pageSize: 20,
      })
    })
  })

  describe('update', () => {
    it('should update originalUrl and invalidate cache', async () => {
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)
      linkRepository.update.mockResolvedValue({
        ...mockUrlRecord,
        originalUrl: 'https://new-url.com',
      })
      redis.del.mockResolvedValue(1)
      redis.set.mockResolvedValue('OK')

      const result = await service.update('test1234', 'user-123', 'USER', {
        originalUrl: 'https://new-url.com',
      })

      expect(result.originalUrl).toBe('https://new-url.com')
      expect(redis.del).toHaveBeenCalledWith('lynx:url:test1234')
      expect(redis.set).toHaveBeenCalledWith(
        'lynx:url:test1234',
        'https://new-url.com',
      )
    })

    it('should update isActive and invalidate cache', async () => {
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)
      linkRepository.update.mockResolvedValue({
        ...mockUrlRecord,
        isActive: false,
      })
      redis.del.mockResolvedValue(1)

      const result = await service.update('test1234', 'user-123', 'USER', {
        isActive: false,
      })

      expect(result.isActive).toBe(false)
      expect(redis.del).toHaveBeenCalledWith('lynx:url:test1234')
      expect(redis.set).not.toHaveBeenCalled()
    })

    it('should re-populate cache when setting isActive=true', async () => {
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)
      linkRepository.update.mockResolvedValue({
        ...mockUrlRecord,
        isActive: true,
      })
      redis.del.mockResolvedValue(1)
      redis.set.mockResolvedValue('OK')

      const result = await service.update('test1234', 'user-123', 'USER', {
        isActive: true,
      })

      expect(result.isActive).toBe(true)
      expect(redis.del).toHaveBeenCalledWith('lynx:url:test1234')
      expect(redis.set).toHaveBeenCalledWith(
        'lynx:url:test1234',
        'https://example.com',
      )
    })

    it('should throw NotFoundException for non-existent slug', async () => {
      linkRepository.findBySlug.mockResolvedValue(null)

      await expect(
        service.update('nonexistent', 'user-123', 'USER', {
          isActive: false,
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException for non-owner', async () => {
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)

      await expect(
        service.update('test1234', 'other-user', 'USER', {
          isActive: false,
        }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should allow admin to update any link', async () => {
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)
      linkRepository.update.mockResolvedValue({
        ...mockUrlRecord,
        isActive: false,
      })
      redis.del.mockResolvedValue(1)

      const result = await service.update('test1234', 'admin-id', 'ADMIN', {
        isActive: false,
      })

      expect(result.isActive).toBe(false)
    })

    it('should throw BadRequestException for invalid URL', async () => {
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)

      await expect(
        service.update('test1234', 'user-123', 'USER', {
          originalUrl: 'not-a-url',
        }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('delete', () => {
    it('should soft delete and invalidate cache', async () => {
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)
      linkRepository.softDelete.mockResolvedValue({
        ...mockUrlRecord,
        isActive: false,
      })
      redis.del.mockResolvedValue(1)

      await service.delete('test1234', 'user-123', 'USER')

      expect(linkRepository.softDelete).toHaveBeenCalledWith('test1234')
      expect(redis.del).toHaveBeenCalledWith('lynx:url:test1234')
    })

    it('should throw NotFoundException for non-existent slug', async () => {
      linkRepository.findBySlug.mockResolvedValue(null)

      await expect(
        service.delete('nonexistent', 'user-123', 'USER'),
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException for non-owner', async () => {
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)

      await expect(
        service.delete('test1234', 'other-user', 'USER'),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should allow admin to delete any link', async () => {
      linkRepository.findBySlug.mockResolvedValue(mockUrlRecord)
      linkRepository.softDelete.mockResolvedValue({
        ...mockUrlRecord,
        isActive: false,
      })
      redis.del.mockResolvedValue(1)

      await service.delete('test1234', 'admin-id', 'ADMIN')

      expect(linkRepository.softDelete).toHaveBeenCalledWith('test1234')
    })
  })
})

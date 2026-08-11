import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common'
import Redis from 'ioredis'
import { REDIS_CLIENT } from '../../common/infra/tokens'
import { CreateLinkInput, LinkResponse } from '@lynx/shared'
import { Slug, InvalidSlugError } from './domain/slug'
import { Url } from './domain/url'
import { UrlFactory } from './domain/url-factory'
import { LinkRepository } from './adapters/link.repository'
import { IdempotencyRepository } from './adapters/idempotency.repository'

const CACHE_PREFIX = 'lynx:url:'
const LYNX_BASE_URL = process.env.LYNX_BASE_URL ?? 'http://localhost:3000'

@Injectable()
export class LinksService {
  constructor(
    private readonly linkRepository: LinkRepository,
    private readonly idempotencyRepository: IdempotencyRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(
    input: CreateLinkInput,
    userId: string,
    idempotencyKey?: string,
  ): Promise<{ status: 200 | 201; data: LinkResponse }> {
    if (idempotencyKey) {
      const existing = await this.idempotencyRepository.find(idempotencyKey)
      if (existing) {
        if (!existing.response) {
          throw new UnprocessableEntityException(
            'Idempotency key has no cached response',
          )
        }
        if (existing.userId === userId) {
          return { status: 200, data: existing.response as LinkResponse }
        }
      }
    }

    this.validateUrl(input.originalUrl)

    let slug: string
    if (input.customSlug) {
      try {
        const slugValue = Slug.create(input.customSlug)
        slug = slugValue.toString()
      } catch (e) {
        if (e instanceof InvalidSlugError) {
          throw new BadRequestException(e.message)
        }
        throw e
      }
    } else {
      slug = await UrlFactory.generateUniqueSlug((s) =>
        this.linkRepository.slugExists(s),
      )
    }

    const record = await this.linkRepository.create({
      ownerId: userId,
      originalUrl: input.originalUrl,
      slug,
    })

    if (!record) {
      throw new ConflictException(`Slug '${slug}' is not available`)
    }

    await this.redis.set(
      `${CACHE_PREFIX}${slug}`,
      input.originalUrl,
      'NX',
    )

    const url = Url.create(record)
    const response = url.toResponse(LYNX_BASE_URL)

    if (idempotencyKey) {
      await this.idempotencyRepository.store(idempotencyKey, userId, response)
    }

    return { status: 201, data: response }
  }

  private validateUrl(originalUrl: string): void {
    let parsed: URL
    try {
      parsed = new URL(originalUrl)
    } catch {
      throw new BadRequestException('Invalid URL format')
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('URL must use http or https protocol')
    }

    const baseUrl = new URL(LYNX_BASE_URL)
    if (parsed.hostname === baseUrl.hostname) {
      throw new BadRequestException('Cannot shorten URLs pointing to LYNX')
    }
  }
}

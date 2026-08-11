import { Inject, Injectable } from '@nestjs/common'
import { PRISMA_CLIENT } from '../../../common/infra/tokens'
import type { PrismaClient } from '@lynx/db'

export interface CreateUrlInput {
  ownerId: string | null
  originalUrl: string
  slug: string
}

export interface UrlRecord {
  id: string
  ownerId: string | null
  originalUrl: string
  slug: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

@Injectable()
export class LinkRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async create(input: CreateUrlInput): Promise<UrlRecord | null> {
    const result = await this.prisma.$queryRawUnsafe<UrlRecord[]>(
      `INSERT INTO urls (owner_id, original_url, slug, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (slug) DO NOTHING
       RETURNING
         id,
         owner_id       AS "ownerId",
         original_url   AS "originalUrl",
         slug,
         is_active      AS "isActive",
         created_at     AS "createdAt",
         updated_at     AS "updatedAt"`,
      input.ownerId,
      input.originalUrl,
      input.slug,
    )
    return result[0] ?? null
  }

  async findBySlug(slug: string): Promise<UrlRecord | null> {
    const result = await this.prisma.$queryRawUnsafe<UrlRecord[]>(
      `SELECT
         id,
         owner_id       AS "ownerId",
         original_url   AS "originalUrl",
         slug,
         is_active      AS "isActive",
         created_at     AS "createdAt",
         updated_at     AS "updatedAt"
       FROM urls
       WHERE slug = $1`,
      slug,
    )
    return result[0] ?? null
  }

  async slugExists(slug: string): Promise<boolean> {
    const result = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM urls WHERE slug = $1`,
      slug,
    )
    const first = result[0]
    return first !== undefined && first.count > 0n
  }
}

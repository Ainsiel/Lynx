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

  async findMany(params: {
    ownerId?: string | null
    isActive?: boolean
    page: number
    pageSize: number
  }): Promise<{ data: UrlRecord[]; total: number }> {
    const conditions: string[] = []
    const binds: unknown[] = []
    let paramIdx = 1

    if (params.ownerId !== null && params.ownerId !== undefined) {
      conditions.push(`owner_id = $${paramIdx}`)
      binds.push(params.ownerId)
      paramIdx++
    }
    if (params.isActive !== undefined) {
      conditions.push(`is_active = $${paramIdx}`)
      binds.push(params.isActive)
      paramIdx++
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (params.page - 1) * params.pageSize

    const countResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM urls ${where}`,
      ...binds,
    )
    const total = Number(countResult[0]?.count ?? 0n)

    const data = await this.prisma.$queryRawUnsafe<UrlRecord[]>(
      `SELECT
         id,
         owner_id       AS "ownerId",
         original_url   AS "originalUrl",
         slug,
         is_active      AS "isActive",
         created_at     AS "createdAt",
         updated_at     AS "updatedAt"
       FROM urls ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      ...binds,
      BigInt(params.pageSize),
      BigInt(offset),
    )

    return { data, total }
  }

  async update(
    slug: string,
    fields: { originalUrl?: string; isActive?: boolean },
  ): Promise<UrlRecord | null> {
    const setClauses: string[] = []
    const binds: unknown[] = []
    let paramIdx = 1

    if (fields.originalUrl !== undefined) {
      setClauses.push(`original_url = $${paramIdx}`)
      binds.push(fields.originalUrl)
      paramIdx++
    }
    if (fields.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIdx}`)
      binds.push(fields.isActive)
      paramIdx++
    }

    if (setClauses.length === 0) return this.findBySlug(slug)

    setClauses.push('updated_at = now()')
    binds.push(slug)

    const result = await this.prisma.$queryRawUnsafe<UrlRecord[]>(
      `UPDATE urls
       SET ${setClauses.join(', ')}
       WHERE slug = $${paramIdx}
       RETURNING
         id,
         owner_id       AS "ownerId",
         original_url   AS "originalUrl",
         slug,
         is_active      AS "isActive",
         created_at     AS "createdAt",
         updated_at     AS "updatedAt"`,
      ...binds,
    )
    return result[0] ?? null
  }

  async softDelete(slug: string): Promise<UrlRecord | null> {
    return this.update(slug, { isActive: false })
  }
}

import { Inject, Injectable } from '@nestjs/common'
import { PRISMA_CLIENT } from '../../../common/infra/tokens'
import type { PrismaClient } from '@lynx/db'
import type { StatsGroupBy } from '@lynx/shared'

export interface UrlOwnerRecord {
  id: string
  ownerId: string | null
  slug: string
}

interface TotalResult {
  total: bigint
}

interface BreakdownRow {
  dimension: string
  clicks: bigint
}

interface CountResult {
  count: bigint
}

const TABLE_MAP: Record<StatsGroupBy, string> = {
  day: 'daily_stats',
  country: 'stats_country',
  device: 'stats_device',
}

const DIMENSION_COLUMN: Record<StatsGroupBy, string> = {
  day: 'day',
  country: 'country',
  device: 'device',
}

const ALLOWED_TABLES = new Set(Object.values(TABLE_MAP))

function buildWhereClause(
  urlId: string,
  from?: string,
  to?: string,
): { where: string; binds: unknown[] } {
  const conditions: string[] = ['url_id = $1']
  const binds: unknown[] = [urlId]
  let paramIdx = 2

  if (from) {
    conditions.push(`day >= ($${paramIdx}::timestamptz AT TIME ZONE 'UTC')::date`)
    binds.push(from)
    paramIdx++
  }
  if (to) {
    conditions.push(`day <= ($${paramIdx}::timestamptz AT TIME ZONE 'UTC')::date`)
    binds.push(to)
    paramIdx++
  }

  return { where: conditions.join(' AND '), binds }
}

@Injectable()
export class StatsRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findUrlBySlug(slug: string): Promise<UrlOwnerRecord | null> {
    const result = await this.prisma.$queryRawUnsafe<UrlOwnerRecord[]>(
      `SELECT
         id,
         owner_id AS "ownerId",
         slug
       FROM urls
       WHERE slug = $1`,
      slug,
    )
    return result[0] ?? null
  }

  async getTotal(
    urlId: string,
    groupBy: StatsGroupBy,
    from?: string,
    to?: string,
  ): Promise<number> {
    const table = TABLE_MAP[groupBy]
    if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`)

    const { where, binds } = buildWhereClause(urlId, from, to)
    const result = await this.prisma.$queryRawUnsafe<TotalResult[]>(
      `SELECT COALESCE(SUM(clicks), 0) AS total FROM ${table} WHERE ${where}`,
      ...binds,
    )
    return Number(result[0]?.total ?? 0n)
  }

  async getBreakdown(
    urlId: string,
    groupBy: StatsGroupBy,
    from?: string,
    to?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<Array<{ key: string; clicks: number }>> {
    const table = TABLE_MAP[groupBy]
    if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`)
    const dimCol = DIMENSION_COLUMN[groupBy]
    const { where, binds } = buildWhereClause(urlId, from, to)
    const offset = (page - 1) * pageSize

    const dimExpr = groupBy === 'day' ? `TO_CHAR(${dimCol}, 'YYYY-MM-DD')` : dimCol
    const nextParam = binds.length + 1

    const result = await this.prisma.$queryRawUnsafe<BreakdownRow[]>(
      `SELECT
         ${dimExpr} AS dimension,
         SUM(clicks) AS clicks
       FROM ${table}
       WHERE ${where}
       GROUP BY ${dimCol}
       ORDER BY SUM(clicks) DESC
       LIMIT $${nextParam} OFFSET $${nextParam + 1}`,
      ...binds,
      BigInt(pageSize),
      BigInt(offset),
    )

    return result.map((row) => ({
      key: String(row.dimension),
      clicks: Number(row.clicks),
    }))
  }

  async getTotalBreakdownItems(
    urlId: string,
    groupBy: StatsGroupBy,
    from?: string,
    to?: string,
  ): Promise<number> {
    const table = TABLE_MAP[groupBy]
    if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table: ${table}`)
    const dimCol = DIMENSION_COLUMN[groupBy]
    const { where, binds } = buildWhereClause(urlId, from, to)

    const result = await this.prisma.$queryRawUnsafe<CountResult[]>(
      `SELECT COUNT(*) AS count FROM (SELECT ${dimCol} FROM ${table} WHERE ${where} GROUP BY ${dimCol}) sub`,
      ...binds,
    )
    return Number(result[0]?.count ?? 0n)
  }
}

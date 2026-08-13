import type { PrismaClient } from '@lynx/db'

export interface ClickRecord {
  urlId: string
  eventId: string
  ip: string | null
  country: string | null
  device: string | null
  userAgent: string | null
  occurredAt: Date
}

export type PersistOutcome = 'inserted' | 'duplicate'

export async function findUrlIdBySlug(
  prisma: PrismaClient,
  slug: string,
): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM urls WHERE slug = $1`,
    slug,
  )
  return rows[0]?.id ?? null
}

type ProjectionKind = 'daily' | 'country' | 'device'

interface ProjectionDef {
  table: string
  columns: string
  conflict: string
  dimension: boolean
}

const PROJECTION_DEFS: Record<ProjectionKind, ProjectionDef> = {
  daily: { table: 'daily_stats', columns: 'url_id, day', conflict: '(url_id, day)', dimension: false },
  country: {
    table: 'stats_country',
    columns: 'url_id, day, country',
    conflict: '(url_id, day, country)',
    dimension: true,
  },
  device: {
    table: 'stats_device',
    columns: 'url_id, day, device',
    conflict: '(url_id, day, device)',
    dimension: true,
  },
}

const DAY_UTC = "(($2)::timestamptz AT TIME ZONE 'UTC')::date"

/**
 * Compila el INSERT ... ON CONFLICT DO UPDATE de una proyección. Los tres
 * upserts comparten la misma forma: incrementan `clicks` atómicamente
 * (nunca read-modify-write) y agrupan el día en UTC.
 */
function projectionUpsert(
  kind: ProjectionKind,
  urlId: string,
  dayIso: string,
): [sql: string, bind: unknown[]] {
  const def = PROJECTION_DEFS[kind]
  const dayCol = def.dimension ? '$1, ' + DAY_UTC + ', $3' : '$1, ' + DAY_UTC
  const bind = def.dimension ? [urlId, dayIso, undefined] : [urlId, dayIso]
  const sql =
    `INSERT INTO ${def.table} (${def.columns}, clicks) VALUES (${dayCol}, 1) ` +
    `ON CONFLICT ${def.conflict} DO UPDATE SET clicks = ${def.table}.clicks + 1`
  return [sql, bind]
}

/**
 * Persiste un click y sus proyecciones en una única transacción.
 *
 * Deduplicación: `clicks.event_id` es UNIQUE; el INSERT ... ON CONFLICT DO
 * NOTHING devuelve 0 filas si el evento ya se procesó, y entonces se omite
 * la agregación (el mismo eventId entregado dos veces cuenta una sola vez).
 *
 * Contadores sin pérdida: los upserts de daily_stats/stats_country/
 * stats_device usan `ON CONFLICT ... DO UPDATE SET clicks = clicks + 1`,
 * nunca SELECT + UPDATE. El día se agrupa en UTC.
 */
export async function persistClick(
  prisma: PrismaClient,
  record: ClickRecord,
): Promise<PersistOutcome> {
  const occurredAtIso = record.occurredAt.toISOString()

  return prisma.$transaction(async (tx) => {
    const inserted = await tx.$executeRawUnsafe(
      `INSERT INTO clicks (url_id, event_id, ip, country, device, user_agent, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (event_id) DO NOTHING`,
      record.urlId,
      record.eventId,
      record.ip,
      record.country,
      record.device,
      record.userAgent,
      occurredAtIso,
    )

    if (inserted === 0) {
      return 'duplicate'
    }

    const applyProjection = (
      kind: ProjectionKind,
      dimension?: string,
    ): Promise<unknown> => {
      const [sql, bind] = projectionUpsert(kind, record.urlId, occurredAtIso)
      if (dimension !== undefined) bind[2] = dimension
      return tx.$executeRawUnsafe(sql, ...bind)
    }

    await applyProjection('daily')

    if (record.country) {
      await applyProjection('country', record.country)
    }

    if (record.device) {
      await applyProjection('device', record.device)
    }

    return 'inserted'
  })
}

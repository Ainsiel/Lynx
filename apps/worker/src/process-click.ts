import type { PrismaClient } from '@lynx/db'
import { PersistentError, type ClickEvent } from './click-event'
import { findUrlIdBySlug, persistClick } from './click.repository'

/**
 * Procesa un ClickEvent: resuelve slug → url_id, persiste el click con
 * deduplicación y actualiza las proyecciones diarias por país y device.
 *
 * Errores:
 * - `PersistentError` → fallo permanente (DLQ directa).
 * - cualquier otra excepción → fallo transitorio (requeue con backoff).
 */
export async function processClickEvent(
  prisma: PrismaClient,
  event: ClickEvent,
): Promise<void> {
  const occurredAt = new Date(event.occurredAt ?? Date.now())
  if (Number.isNaN(occurredAt.getTime())) {
    throw new PersistentError(
      'invalid-occurred-at',
      `occurredAt inválido: ${event.occurredAt}`,
    )
  }

  const urlId = await findUrlIdBySlug(prisma, event.slug)
  if (!urlId) {
    throw new PersistentError('slug-not-found', `No existe un link para el slug: ${event.slug}`)
  }

  try {
    await persistClick(prisma, {
      urlId,
      eventId: event.eventId,
      ip: event.ip ?? null,
      country: event.country ?? null,
      device: event.device ?? null,
      userAgent: event.userAgent ?? null,
      occurredAt,
    })
  } catch (error) {
    // El slug se resolvió, pero el url pudo borrarse entre el lookup y el
    // insert: la FK violada es el mismo fallo persistente de slug inexistente.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2003'
    ) {
      throw new PersistentError(
        'slug-not-found',
        `No existe un link para el slug: ${event.slug}`,
      )
    }
    throw error
  }
}

export interface ClickEvent {
  eventId: string
  slug: string
  occurredAt?: string
  ip?: string
  country?: string
  device?: string
  userAgent?: string
}

/**
 * Un error de negocio permanente: el mensaje no es recuperable aunque se
 * reintente (payload malformado, slug inexistente, fecha inválida). Se
 * enruta directamente a la DLQ sin reintentos.
 */
export class PersistentError extends Error {
  readonly reason: string

  constructor(reason: string, message: string) {
    super(message)
    this.name = 'PersistentError'
    this.reason = reason
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringField = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

/**
 * Parsea el contenido crudo de un mensaje de `clicks.ingest`.
 *
 * La API publica con el cliente RMQ de NestJS, que envuelve el evento como
 * `{ pattern, data }`; los mensajes manuales (tests, reproceso) pueden venir
 * como el ClickEvent plano. Se aceptan ambas formas.
 *
 * Lanza `PersistentError` ante payloads que no pueden ser un ClickEvent.
 */
export function parseClickEvent(buffer: Buffer): ClickEvent {
  let parsed: unknown
  try {
    parsed = JSON.parse(buffer.toString('utf8'))
  } catch {
    throw new PersistentError('invalid-json', 'El mensaje no es JSON válido')
  }

  if (!isRecord(parsed)) {
    throw new PersistentError('invalid-payload', 'El mensaje no es un objeto')
  }

  const candidate = isRecord(parsed.data) ? parsed.data : parsed

  const eventId = stringField(candidate.eventId)
  if (!eventId || !UUID_RE.test(eventId)) {
    throw new PersistentError(
      'invalid-event-id',
      `eventId inválido: ${String(candidate.eventId)}`,
    )
  }

  const slug = stringField(candidate.slug)
  if (!slug) {
    throw new PersistentError('invalid-slug', 'Falta el slug del evento')
  }

  const occurredAt = stringField(candidate.occurredAt) ?? stringField(candidate.timestamp)

  return {
    eventId,
    slug,
    occurredAt,
    ip: stringField(candidate.ip),
    country: stringField(candidate.country),
    device: stringField(candidate.device),
    userAgent: stringField(candidate.userAgent),
  }
}

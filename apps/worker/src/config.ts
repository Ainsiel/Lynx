export interface WorkerConfig {
  rabbitmqUrl: string
  exchange: string
  dlx: string
  queue: string
  dlq: string
  retryBaseMs: number
  maxRetries: number
  prefetch: number
  reconnectDelayMs: number
}

const numberOr = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    rabbitmqUrl: env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    exchange: env.CLICKS_EXCHANGE ?? 'clicks',
    dlx: env.CLICKS_DLX ?? 'clicks.dlx',
    queue: env.CLICKS_QUEUE ?? 'clicks.ingest',
    dlq: env.CLICKS_DLQ ?? 'clicks.dlq',
    retryBaseMs: numberOr(env.CLICK_RETRY_BASE_MS, 1000),
    maxRetries: numberOr(env.CLICK_MAX_RETRIES, 3),
    prefetch: numberOr(env.CLICK_PREFETCH, 1),
    reconnectDelayMs: numberOr(env.CLICK_RECONNECT_DELAY_MS, 5000),
  }
}

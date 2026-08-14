export interface SmtpConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  mailFrom: string
}

export interface EmailConfig {
  exchange: string
  dlx: string
  queue: string
  dlq: string
  retryBaseMs: number
  maxRetries: number
  prefetch: number
  reconnectDelayMs: number
}

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
  email: EmailConfig
  smtp: SmtpConfig
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
    email: {
      exchange: env.EMAILS_EXCHANGE ?? 'emails',
      dlx: env.EMAILS_DLX ?? 'emails.dlx',
      queue: env.EMAILS_QUEUE ?? 'emails.send',
      dlq: env.EMAILS_DLQ ?? 'emails.dlq',
      retryBaseMs: numberOr(env.EMAIL_RETRY_BASE_MS, 1000),
      maxRetries: numberOr(env.EMAIL_MAX_RETRIES, 3),
      prefetch: numberOr(env.EMAIL_PREFETCH, 1),
      reconnectDelayMs: numberOr(env.EMAIL_RECONNECT_DELAY_MS, 5000),
    },
    smtp: {
      smtpHost: env.SMTP_HOST ?? 'localhost',
      smtpPort: numberOr(env.SMTP_PORT, 1025),
      smtpUser: env.SMTP_USER ?? '',
      smtpPass: env.SMTP_PASS ?? '',
      mailFrom: env.MAIL_FROM ?? 'noreply@lynx.dev',
    },
  }
}

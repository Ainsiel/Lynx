import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common'
import { ClientProxyFactory, Transport } from '@nestjs/microservices'
import Redis from 'ioredis'
import { createPrismaClient, PrismaClient } from '@lynx/db'
import { JWT_SECRET, PRISMA_CLIENT, RABBITMQ_TOKEN, REDIS_CLIENT, EMAIL_RABBITMQ_TOKEN, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from './tokens'

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: () => createPrismaClient(),
    },
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
    },
    {
      provide: JWT_SECRET,
      useFactory: () => {
        const secret = process.env.JWT_SECRET
        if (!secret) throw new Error('JWT_SECRET env var is required')
        return secret
      },
    },
    {
      provide: RABBITMQ_TOKEN,
      useFactory: () => {
        const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'
        return ClientProxyFactory.create({
          transport: Transport.RMQ,
          options: {
            urls: [url],
            queue: 'clicks.ingest',
            // La topología (cola durable + DLX/DLQ) la declara el worker;
            // noAssert evita que la API compita por la declaración y fije la
            // cola sin los argumentos de dead-letter.
            queueOptions: {
              durable: true,
              noAssert: true,
            },
          },
        })
      },
    },
    {
      provide: EMAIL_RABBITMQ_TOKEN,
      useFactory: () => {
        const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'
        return ClientProxyFactory.create({
          transport: Transport.RMQ,
          options: {
            urls: [url],
            queue: 'emails.send',
            queueOptions: {
              durable: true,
              noAssert: true,
            },
          },
        })
      },
    },
    {
      provide: GITHUB_CLIENT_ID,
      useFactory: () => process.env.GITHUB_CLIENT_ID ?? null,
    },
    {
      provide: GITHUB_CLIENT_SECRET,
      useFactory: () => process.env.GITHUB_CLIENT_SECRET ?? null,
    },
  ],
  exports: [PRISMA_CLIENT, REDIS_CLIENT, JWT_SECRET, RABBITMQ_TOKEN, EMAIL_RABBITMQ_TOKEN, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET],
})
export class InfraModule implements OnApplicationShutdown {
  private readonly logger = new Logger(InfraModule.name)

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(RABBITMQ_TOKEN) private readonly rabbitmq: { close: () => Promise<void> },
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit()
    await this.prisma.$disconnect()
    try {
      await this.rabbitmq.close()
    } catch {
      this.logger.warn('Error closing RabbitMQ connection')
    }
  }
}

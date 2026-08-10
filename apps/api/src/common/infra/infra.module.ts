import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common'
import Redis from 'ioredis'
import { createPrismaClient, PrismaClient } from '@lynx/db'
import { PRISMA_CLIENT, REDIS_CLIENT } from './tokens'

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
  ],
  exports: [PRISMA_CLIENT, REDIS_CLIENT],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit()
    await this.prisma.$disconnect()
  }
}

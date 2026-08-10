import type { PrismaClient } from '../generated/client'

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_%'`,
  )
  const tables = Array.isArray(rows) ? rows : []
  for (const { tablename } of tables) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "public"."${tablename}" RESTART IDENTITY CASCADE`,
    )
  }
}

import 'dotenv/config'
import { hash } from 'bcryptjs'
import { createPrismaClient } from './client'
import { SALT_ROUNDS } from './constants'

async function main() {
  const prisma = createPrismaClient()

  try {
    const adminEmail = 'admin@lynx.dev'
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123'

    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (existing) {
      console.log(`Admin user ${adminEmail} already exists, skipping seed.`)
      return
    }

    const passwordHash = await hash(adminPassword, SALT_ROUNDS)

    await prisma.user.create({
      data: {
        name: 'Admin',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
      },
    })

    console.log(`Admin user ${adminEmail} created successfully.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})

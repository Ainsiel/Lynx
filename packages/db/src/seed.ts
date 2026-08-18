import 'dotenv/config'
import { hash } from 'bcryptjs'
import { createPrismaClient } from './client'
import { SALT_ROUNDS } from './constants'

const SAMPLE_LINKS = [
  { slug: 'google', originalUrl: 'https://www.google.com' },
  { slug: 'github', originalUrl: 'https://github.com' },
  { slug: 'nestjs', originalUrl: 'https://nestjs.com' },
  { slug: 'nextjs', originalUrl: 'https://nextjs.org' },
  { slug: 'tailwind', originalUrl: 'https://tailwindcss.com' },
]

async function main() {
  const prisma = createPrismaClient()

  try {
    const adminEmail = 'admin@lynx.dev'
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123'

    let admin = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (!admin) {
      const passwordHash = await hash(adminPassword, SALT_ROUNDS)
      admin = await prisma.user.create({
        data: {
          name: 'Admin',
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
        },
      })
      console.log(`Admin user ${adminEmail} created successfully.`)
    } else {
      console.log(`Admin user ${adminEmail} already exists, skipping user seed.`)
    }

    const existingLinks = await prisma.url.count({
      where: { ownerId: admin.id },
    })

    if (existingLinks > 0) {
      console.log(`User already has ${existingLinks} links, skipping link seed.`)
      return
    }

    for (const link of SAMPLE_LINKS) {
      await prisma.url.create({
        data: {
          slug: link.slug,
          originalUrl: link.originalUrl,
          ownerId: admin.id,
        },
      })
    }

    console.log(`Created ${SAMPLE_LINKS.length} sample links.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})

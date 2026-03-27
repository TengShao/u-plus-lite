import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('88888888', 10)
  await prisma.user.upsert({
    where: { name: '邵腾' },
    update: {},
    create: {
      name: '邵腾',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })
  console.log('Seed complete: admin user created')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

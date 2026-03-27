import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const url = new URL(req.url)
  const q = url.searchParams.get('q')
  if (!q) return NextResponse.json([])

  const lower = q.toLowerCase()
  const requirements = await prisma.requirementGroup.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { workloads: { some: { user: { name: { contains: q } } } } },
      ],
    },
    include: {
      cycle: { select: { id: true, label: true } },
    },
    take: 20,
  })
  return NextResponse.json(requirements)
}

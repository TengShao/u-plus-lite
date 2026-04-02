import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  const cycleId = searchParams.get('cycleId')
  if (!cycleId) {
    return NextResponse.json({ error: 'cycleId is required' }, { status: 400 })
  }

  const record = await prisma.userCyclePipeline.findUnique({
    where: {
      userId_cycleId: {
        userId: parseInt(session.user.id),
        cycleId: parseInt(cycleId),
      },
    },
  })

  return NextResponse.json({ pipeline: record?.pipeline ?? null })
}

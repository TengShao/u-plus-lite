import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { billingCycleId, manDays } = await req.json()

  // Check cycle status for non-admin
  if (session.user.role !== 'ADMIN') {
    const cycle = await prisma.billingCycle.findUnique({ where: { id: billingCycleId } })
    if (cycle?.status === 'CLOSED') return forbidden()
  }

  const userId = parseInt(session.user.id)
  const requirementGroupId = parseInt(params.id)

  // If manDays is 0, delete the workload record instead of creating/updating
  if (manDays === 0) {
    await prisma.workload.deleteMany({
      where: {
        userId,
        requirementGroupId,
        billingCycleId,
      },
    })
    return NextResponse.json({ success: true, deleted: true })
  }

  const workload = await prisma.workload.upsert({
    where: {
      userId_requirementGroupId_billingCycleId: {
        userId,
        requirementGroupId,
        billingCycleId,
      },
    },
    update: { manDays },
    create: { userId, requirementGroupId, billingCycleId, manDays },
  })
  return NextResponse.json(workload)
}

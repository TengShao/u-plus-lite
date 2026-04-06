import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const { status } = await req.json()
  if (!['OPEN', 'CLOSED'].includes(status)) {
    return NextResponse.json({ error: '无效状态' }, { status: 400 })
  }

  const cycleId = parseInt(params.id)

  // Delete all drafts when closing the cycle
  if (status === 'CLOSED') {
    await prisma.requirementGroup.deleteMany({
      where: {
        createdInCycleId: cycleId,
        isDraft: true,
      },
    })
  }

  const cycle = await prisma.billingCycle.update({
    where: { id: cycleId },
    data: { status },
  })
  return NextResponse.json(cycle)
}

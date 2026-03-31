import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const data = await req.json()
  const rg = await prisma.requirementGroup.create({
    data: {
      name: data.name || '',
      rating: data.rating,
      module: data.module,
      pipeline: data.pipeline,
      types: data.types ? JSON.stringify(data.types) : null,
      budgetItem: data.budgetItem,
      canClose: data.canClose ?? true,
      isBuilt: data.isBuilt ?? false,
      funcPoints: data.funcPoints,
      pageCount: data.pageCount,
      createdInCycleId: data.cycleId,
      createdBy: parseInt(session.user.id),
    },
  })
  // Update lastUsedPipeline for the user
  if (data.pipeline) {
    await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: { lastUsedPipeline: data.pipeline },
    })
  }
  return NextResponse.json(rg)
}

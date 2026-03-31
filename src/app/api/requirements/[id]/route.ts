import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const id = parseInt(params.id)
  const data = await req.json()

  // Check cycle status for non-admin
  if (session.user.role !== 'ADMIN') {
    const rg = await prisma.requirementGroup.findUnique({
      where: { id },
      include: { cycle: true },
    })
    if (!rg) return NextResponse.json({ error: '需求组不存在' }, { status: 404 })
    if (rg.cycle.status === 'CLOSED') return forbidden()
  }

  // Optimistic lock
  if (data.version !== undefined) {
    const current = await prisma.requirementGroup.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: '需求组不存在' }, { status: 404 })
    if (current.version !== data.version) {
      return NextResponse.json({ error: '数据已被其他人修改，请刷新后重试' }, { status: 409 })
    }
  }

  const updated = await prisma.requirementGroup.update({
    where: { id },
    data: {
      name: data.name,
      rating: data.rating,
      module: data.module,
      pipeline: data.pipeline,
      types: data.types !== undefined ? JSON.stringify(data.types) : undefined,
      budgetItem: data.budgetItem,
      canClose: data.canClose,
      isBuilt: data.isBuilt,
      funcPoints: data.funcPoints,
      pageCount: data.pageCount,
      version: { increment: 1 },
      lastSubmittedAt: new Date(),
    },
  })
  // Update lastUsedPipeline for the user
  if (data.pipeline) {
    await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: { lastUsedPipeline: data.pipeline },
    })
  }
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const id = parseInt(params.id)

  if (session.user.role !== 'ADMIN') {
    const rg = await prisma.requirementGroup.findUnique({
      where: { id },
      include: { cycle: true },
    })
    if (!rg) return NextResponse.json({ error: '需求组不存在' }, { status: 404 })
    if (rg.cycle.status === 'CLOSED') return forbidden()
  }

  await prisma.requirementGroup.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

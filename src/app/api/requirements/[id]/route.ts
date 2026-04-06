import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'
import { getConvertedManDays } from '@/lib/compute'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const id = parseInt(params.id)
  const url = new URL(req.url)
  const cycleId = parseInt(url.searchParams.get('cycleId') || '0')

  const rg = await prisma.requirementGroup.findUnique({
    where: { id },
    include: {
      workloads: {
        include: { user: { select: { id: true, name: true, level: true } } },
      },
      creator: { select: { id: true, name: true } },
    },
  })
  if (!rg) return NextResponse.json({ error: '需求组不存在' }, { status: 404 })

  // Manual join for lastSubmitter to avoid Prisma relation issues
  const lastSubmitterName = rg.lastSubmittedBy
    ? (await prisma.user.findUnique({ where: { id: rg.lastSubmittedBy }, select: { name: true } }))?.name ?? null
    : null

  const cycleWorkloads = rg.workloads
    .filter((w) => w.billingCycleId === cycleId)
    .map((w) => ({
      id: w.id,
      userId: w.userId,
      userName: w.user.name,
      userLevel: w.user.level,
      manDays: w.manDays,
      convertedManDays: getConvertedManDays(w.manDays, w.user.level),
    }))

  return NextResponse.json({
    ...rg,
    types: rg.types ? JSON.parse(rg.types) : [],
    cycleWorkloads,
    lastSubmitterName,
  })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()
  console.log('[PATCH] session.user:', JSON.stringify(session.user))

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
      lastSubmittedBy: parseInt(session.user.id),
      isDraft: false,
    },
  })
  // Upsert cycle-specific pipeline memory
  if (data.pipeline && data.cycleId) {
    await prisma.userCyclePipeline.upsert({
      where: {
        userId_cycleId: {
          userId: parseInt(session.user.id),
          cycleId: parseInt(data.cycleId),
        },
      },
      update: { pipeline: data.pipeline },
      create: {
        userId: parseInt(session.user.id),
        cycleId: parseInt(data.cycleId),
        pipeline: data.pipeline,
      },
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

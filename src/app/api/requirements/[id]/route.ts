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

  const totalManDays = cycleWorkloads.reduce((sum, w) => sum + w.manDays, 0)

  return NextResponse.json({
    ...rg,
    types: rg.types ? JSON.parse(rg.types) : [],
    cycleWorkloads,
    totalManDays: Math.round(totalManDays * 10) / 10,
    funcPointsRecommended: Math.round(totalManDays * 6.2),
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

  const isStagingSave = data.isDraft === true

  // 草稿保存时验证名称不能为空
  if (isStagingSave && (!data.name || data.name.trim() === '')) {
    return NextResponse.json({ error: '名称不能为空' }, { status: 400 })
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
      // 暂存：保持 isDraft=true，不设置 lastSubmittedAt
      // 提交：isDraft=false，设置 lastSubmittedAt
      lastSubmittedAt: isStagingSave ? null : new Date(),
      lastSubmittedBy: isStagingSave ? null : parseInt(session.user.id),
      isDraft: isStagingSave ? true : false,
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
      include: { cycle: true, creator: true },
    })
    if (!rg) return NextResponse.json({ error: '需求组不存在' }, { status: 404 })
    if (rg.cycle.status === 'CLOSED') return forbidden()
    if (rg.createdBy !== parseInt(session.user.id)) {
      return NextResponse.json(
        { error: '仅创建者可删除此需求组', creatorName: rg.creator?.name ?? null },
        { status: 403 }
      )
    }
  }

  await prisma.requirementGroup.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

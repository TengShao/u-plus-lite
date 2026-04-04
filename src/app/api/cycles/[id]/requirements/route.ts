import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'
import { getConvertedManDays, getRecommendedRating, getInputRatio, getHealthStatus } from '@/lib/compute'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const cycleId = parseInt(params.id)
  const url = new URL(req.url)

  const cycle = await prisma.billingCycle.findUnique({ where: { id: cycleId } })
  if (!cycle) return NextResponse.json({ error: '周期不存在' }, { status: 404 })

  // Delete unsubmitted drafts older than 1 minute (to avoid deleting just-created requirements)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
  await prisma.requirementGroup.deleteMany({
    where: {
      lastSubmittedAt: null,
      rating: null,
      createdAt: { lt: oneMinuteAgo },
    },
  })

  // Visible in this cycle: have workload in cycle OR (INCOMPLETE and created by current user)
  const requirements = await prisma.requirementGroup.findMany({
    where: {
      OR: [
        { workloads: { some: { billingCycleId: cycleId } } },
        { status: 'INCOMPLETE', createdInCycleId: { lte: cycleId }, createdBy: parseInt(session.user.id) },
      ],
    },
    include: {
      workloads: {
        include: { user: { select: { id: true, name: true, level: true } } },
      },
      creator: { select: { id: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  const result = requirements.map((rg) => {
    const cycleWorkloads = rg.workloads.filter((w) => w.billingCycleId === cycleId)
    const totalManDays = cycleWorkloads.reduce((sum, w) => sum + w.manDays, 0)
    const participantCount = cycleWorkloads.filter((w) => w.manDays > 0).length

    // Total converted: INCOMPLETE sums all cycles, COMPLETE sums only this cycle
    const allWorkloads = rg.status === 'INCOMPLETE' ? rg.workloads : cycleWorkloads
    const totalConvertedManDays = allWorkloads.reduce(
      (sum, w) => sum + getConvertedManDays(w.manDays, w.user.level),
      0
    )

    const inputRatio = getInputRatio(totalConvertedManDays, rg.rating)
    const healthStatus = rg.rating ? getHealthStatus(inputRatio) : null
    const recommendedRating = getRecommendedRating(totalConvertedManDays)

    return {
      ...rg,
      types: rg.types ? JSON.parse(rg.types) : [],
      totalManDays: Math.round(totalManDays * 10) / 10,
      totalConvertedManDays: Math.round(totalConvertedManDays * 10) / 10,
      participantCount,
      inputRatio,
      healthStatus,
      recommendedRating,
      funcPointsRecommended: Math.round(totalManDays * 6.2),
      cycleWorkloads: cycleWorkloads.map((w) => ({
        id: w.id,
        userId: w.userId,
        userName: w.user.name,
        userLevel: w.user.level,
        manDays: w.manDays,
        convertedManDays: getConvertedManDays(w.manDays, w.user.level),
      })),
    }
  })

  // Filters
  let filtered = result
  const pipeline = url.searchParams.get('pipeline')
  const rating = url.searchParams.get('rating')
  const health = url.searchParams.get('health')
  const designer = url.searchParams.get('designer')
  const canClose = url.searchParams.get('canClose')
  const q = url.searchParams.get('q')

  if (pipeline) {
    const vals = pipeline.split(',')
    filtered = filtered.filter((r) => r.pipeline && vals.includes(r.pipeline))
  }
  if (rating) {
    const vals = rating.split(',')
    filtered = filtered.filter((r) => r.rating && vals.includes(r.rating))
  }
  if (health) {
    const vals = health.split(',')
    filtered = filtered.filter((r) => r.healthStatus && vals.includes(r.healthStatus))
  }
  if (designer) {
    const ids = designer.split(',').map(Number)
    filtered = filtered.filter((r) => r.cycleWorkloads.some((w) => ids.includes(w.userId)))
  }
  if (canClose === 'true') filtered = filtered.filter((r) => r.canClose)
  if (canClose === 'false') filtered = filtered.filter((r) => !r.canClose)
  if (q) {
    const lower = q.toLowerCase()
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.cycleWorkloads.some((w) => w.userName.toLowerCase().includes(lower))
    )
  }

  return NextResponse.json(filtered)
}

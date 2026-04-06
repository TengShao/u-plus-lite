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

  // Visible in this cycle:
  // - isDraft=false: have workload in cycle OR (INCOMPLETE and created by current user)
  // - isDraft=true: only visible to creator
  const requirements = await prisma.requirementGroup.findMany({
    where: {
      OR: [
        // Non-drafts: visible to all with workload in this cycle
        { isDraft: false, workloads: { some: { billingCycleId: cycleId } } },
        // Non-drafts: visible if INCOMPLETE and created by current user in this or earlier cycle
        { isDraft: false, status: 'INCOMPLETE', createdInCycleId: { lte: cycleId }, createdBy: parseInt(session.user.id) },
        // Drafts: only visible to creator in this cycle
        { isDraft: true, createdBy: parseInt(session.user.id), createdInCycleId: cycleId },
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

  // Manual join for lastSubmitter to avoid Prisma relation issues
  const lastSubmitterIds = Array.from(new Set(requirements.map((rg) => rg.lastSubmittedBy).filter((id): id is number => id !== null)))
  const lastSubmitters = lastSubmitterIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: lastSubmitterIds } }, select: { id: true, name: true } })
    : []
  const lastSubmitterMap = Object.fromEntries(lastSubmitters.map((u) => [u.id, u.name]))

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
      lastSubmitterName: rg.lastSubmittedBy ? (lastSubmitterMap[rg.lastSubmittedBy] ?? null) : null,
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

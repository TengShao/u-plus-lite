// src/app/api/import/confirm/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'

interface ImportItem {
  manDays: number
  designers: string[]
  originalText: string
}

interface Decision {
  name: string
  action: 'MERGE' | 'CREATE'
  targetGroupId: number | null
  items: ImportItem[]
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { cycleId, decisions } = await req.json()

  if (!cycleId || !decisions?.length) {
    return NextResponse.json({ error: 'cycleId and decisions are required' }, { status: 400 })
  }

  const results: { groupId: number; importedCount: number }[] = []

  for (const decision of decisions) {
    const typedDecision = decision as Decision

    if (typedDecision.action === 'MERGE' && typedDecision.targetGroupId) {
      // 追加 Workload 到已有需求组
      for (const item of typedDecision.items) {
        const user = await prisma.user.findFirst({
          where: { name: { in: item.designers } },
        })
        if (user) {
          await prisma.workload.create({
            data: {
              userId: user.id,
              requirementGroupId: typedDecision.targetGroupId,
              billingCycleId: parseInt(String(cycleId)),
              manDays: item.manDays,
            },
          })
        }
      }
      results.push({ groupId: typedDecision.targetGroupId, importedCount: typedDecision.items.length })
    } else if (typedDecision.action === 'CREATE') {
      // 创建新需求组 + Workload
      const newGroup = await prisma.requirementGroup.create({
        data: {
          name: typedDecision.name,
          createdInCycleId: parseInt(String(cycleId)),
          createdBy: parseInt(session.user.id),
        },
      })
      for (const item of typedDecision.items) {
        const user = await prisma.user.findFirst({
          where: { name: { in: item.designers } },
        })
        if (user) {
          await prisma.workload.create({
            data: {
              userId: user.id,
              requirementGroupId: newGroup.id,
              billingCycleId: parseInt(String(cycleId)),
              manDays: item.manDays,
            },
          })
        }
      }
      results.push({ groupId: newGroup.id, importedCount: typedDecision.items.length })
    }
  }

  return NextResponse.json({ results })
}

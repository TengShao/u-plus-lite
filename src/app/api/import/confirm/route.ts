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

  let body: { cycleId?: number; decisions?: Decision[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { cycleId, decisions } = body

  if (!cycleId || !decisions?.length) {
    return NextResponse.json({ error: 'cycleId and decisions are required' }, { status: 400 })
  }

  const results: { groupId: number; importedCount: number; isDraft: boolean }[] = []

  try {
    for (const decision of decisions) {
      if (decision.action === 'MERGE' && decision.targetGroupId) {
        // 按设计师去重合并：同组同设计师的多条人天累加为一条 Workload
        const byDesigner = new Map<number, number>()
        for (const item of decision.items) {
          for (const designer of item.designers) {
            const user = await prisma.user.findFirst({ where: { name: designer } })
            if (user) {
              byDesigner.set(user.id, (byDesigner.get(user.id) ?? 0) + item.manDays)
            }
          }
        }
        for (const [userId, manDays] of Array.from(byDesigner.entries())) {
          try {
            await prisma.workload.create({
              data: { userId, requirementGroupId: decision.targetGroupId, billingCycleId: cycleId, manDays },
            })
          } catch (err: any) {
            if (err?.code !== 'P2002') throw err
          }
        }
        results.push({ groupId: decision.targetGroupId, importedCount: byDesigner.size, isDraft: false })
      } else if (decision.action === 'CREATE') {
        const newGroup = await prisma.requirementGroup.create({
          data: {
            name: decision.name,
            createdInCycleId: cycleId,
            createdBy: parseInt(session.user.id),
            isDraft: true,
          },
        })
        const byDesigner = new Map<number, number>()
        for (const item of decision.items) {
          for (const designer of item.designers) {
            const user = await prisma.user.findFirst({ where: { name: designer } })
            if (user) {
              byDesigner.set(user.id, (byDesigner.get(user.id) ?? 0) + item.manDays)
            }
          }
        }
        for (const [userId, manDays] of Array.from(byDesigner.entries())) {
          try {
            await prisma.workload.create({
              data: { userId, requirementGroupId: newGroup.id, billingCycleId: cycleId, manDays },
            })
          } catch (err: any) {
            if (err?.code !== 'P2002') throw err
          }
        }
        results.push({ groupId: newGroup.id, importedCount: byDesigner.size, isDraft: true })
      }
    }
    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}

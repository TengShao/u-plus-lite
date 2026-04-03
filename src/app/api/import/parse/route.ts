// src/app/api/import/parse/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'
import { parseWorkload } from '@/lib/llm'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { content, cycleId } = await req.json()

  if (!content?.trim() || !cycleId) {
    return NextResponse.json({ error: 'content and cycleId are required' }, { status: 400 })
  }

  // 获取当前周期已有需求组
  const existingGroups = await prisma.requirementGroup.findMany({
    where: { createdInCycleId: parseInt(String(cycleId)) },
    select: { id: true, name: true },
  })

  // 获取系统用户账号列表
  const systemUsers = await prisma.user.findMany({
    select: { name: true },
  })
  const userNames = systemUsers.map(u => u.name)

  try {
    const result = await parseWorkload(content, existingGroups, userNames)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const { name, pipelineId } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })

  const item = await prisma.budgetItemSetting.create({
    data: {
      name: name.trim(),
      pipelineId: pipelineId || null,
    },
  })
  return NextResponse.json(item)
}

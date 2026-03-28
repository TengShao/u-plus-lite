import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })

  const pipeline = await prisma.pipelineSetting.create({ data: { name: name.trim() } })
  return NextResponse.json(pipeline)
}

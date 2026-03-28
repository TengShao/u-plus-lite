import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })

  const pipeline = await prisma.pipelineSetting.update({
    where: { id: parseInt(params.id) },
    data: { name: name.trim() },
  })
  return NextResponse.json(pipeline)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  await prisma.pipelineSetting.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const userId = parseInt(params.id)

  if (userId === parseInt(session.user.id)) {
    return NextResponse.json({ error: '不能删除自己' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (target?.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (adminCount <= 1) {
      return NextResponse.json({ error: '不能删除最后一个管理员' }, { status: 400 })
    }
  }

  await prisma.user.delete({ where: { id: userId } })
  return NextResponse.json({ success: true })
}

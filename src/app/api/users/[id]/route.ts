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

  await prisma.user.delete({ where: { id: userId } })
  return NextResponse.json({ success: true })
}

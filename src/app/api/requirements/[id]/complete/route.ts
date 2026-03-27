import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const updated = await prisma.requirementGroup.update({
    where: { id: parseInt(params.id) },
    data: { status: 'COMPLETE' },
  })
  return NextResponse.json(updated)
}

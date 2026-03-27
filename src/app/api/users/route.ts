import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, level: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const { userId, role, level } = await req.json()
  const data: Record<string, string> = {}
  if (role) data.role = role
  if (level !== undefined) data.level = level

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, role: true, level: true },
  })
  return NextResponse.json(user)
}

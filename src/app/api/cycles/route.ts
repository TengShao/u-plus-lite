import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const cycles = await prisma.billingCycle.findMany({
    orderBy: { startDate: 'desc' },
  })
  return NextResponse.json(cycles)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const now = new Date()
  const day = now.getDate()
  let startDate: Date, endDate: Date, label: string

  if (day <= 25) {
    // Current month cycle: prev month 26th to this month 25th
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 26)
    endDate = new Date(now.getFullYear(), now.getMonth(), 25)
    label = `${now.getMonth() + 1}月`
  } else {
    // Next month cycle: this month 26th to next month 25th
    startDate = new Date(now.getFullYear(), now.getMonth(), 26)
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 25)
    label = `${now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2}月`
  }

  const cycle = await prisma.billingCycle.create({
    data: {
      label,
      startDate,
      endDate,
      status: 'OPEN',
      createdBy: parseInt(session.user.id),
    },
  })
  return NextResponse.json(cycle)
}

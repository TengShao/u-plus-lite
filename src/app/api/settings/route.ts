import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const pipelines = await prisma.pipelineSetting.findMany({
    include: { budgetItems: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  })
  return NextResponse.json(pipelines)
}

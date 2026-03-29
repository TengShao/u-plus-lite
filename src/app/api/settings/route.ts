import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const pipelines = await prisma.pipelineSetting.findMany({
    include: { budgetItems: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  })
  return NextResponse.json(pipelines)
}

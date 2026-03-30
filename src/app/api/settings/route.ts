import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const pipelines = await prisma.pipelineSetting.findMany({
    include: { budgetItems: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  })
  // Append pipelineId: null budget items to "其他" pipeline
  const otherPipeline = pipelines.find((p) => p.name === '其他')
  if (otherPipeline) {
    const uncategorizedItems = await prisma.budgetItemSetting.findMany({
      where: { pipelineId: null },
      orderBy: { id: 'asc' },
    })
    otherPipeline.budgetItems = [...otherPipeline.budgetItems, ...uncategorizedItems]
  }
  return NextResponse.json(pipelines)
}

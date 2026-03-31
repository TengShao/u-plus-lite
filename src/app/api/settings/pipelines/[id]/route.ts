import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized, forbidden } from '@/lib/api-utils'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })

  const pipelineId = parseInt(params.id)

  // 获取旧名称
  const oldPipeline = await prisma.pipelineSetting.findUnique({
    where: { id: pipelineId },
  })
  if (!oldPipeline) return NextResponse.json({ error: '管线不存在' }, { status: 404 })

  const oldName = oldPipeline.name
  const newName = name.trim()

  if (oldName === newName) return NextResponse.json(oldPipeline)

  // 事务：更新管线名称 + 同步更新 RequirementGroup
  await prisma.$transaction([
    prisma.pipelineSetting.update({
      where: { id: pipelineId },
      data: { name: newName },
    }),
    prisma.requirementGroup.updateMany({
      where: { pipeline: oldName },
      data: { pipeline: newName },
    }),
  ])

  // 事务完成后，查询更新后的记录
  const updatedPipeline = await prisma.pipelineSetting.findUnique({
    where: { id: pipelineId },
  })
  return NextResponse.json(updatedPipeline)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const pipelineId = parseInt(params.id)

  // 获取待删除管线
  const pipelineToDelete = await prisma.pipelineSetting.findUnique({
    where: { id: pipelineId },
  })
  if (!pipelineToDelete) return NextResponse.json({ error: '管线不存在' }, { status: 404 })

  // 不能删除"其他"管线
  if (pipelineToDelete.name === '其他') {
    return NextResponse.json({ error: '不能删除"其他"管线' }, { status: 400 })
  }

  // 查找或创建"其他"管线
  let otherPipeline = await prisma.pipelineSetting.findUnique({
    where: { name: '其他' },
  })
  if (!otherPipeline) {
    otherPipeline = await prisma.pipelineSetting.create({
      data: { name: '其他' },
    })
  }

  // 事务：迁移数据 + 删除管线
  await prisma.$transaction([
    // 1. 将 BudgetItemSetting 的 pipelineId 指向"其他"
    prisma.budgetItemSetting.updateMany({
      where: { pipelineId },
      data: { pipelineId: otherPipeline.id },
    }),
    // 2. 将 RequirementGroup.pipeline 改为"其他"
    prisma.requirementGroup.updateMany({
      where: { pipeline: pipelineToDelete.name },
      data: { pipeline: '其他' },
    }),
    // 3. 删除管线
    prisma.pipelineSetting.delete({
      where: { id: pipelineId },
    }),
  ])

  return NextResponse.json({ success: true })
}

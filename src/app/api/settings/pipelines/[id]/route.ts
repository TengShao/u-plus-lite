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

  await prisma.pipelineSetting.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ success: true })
}

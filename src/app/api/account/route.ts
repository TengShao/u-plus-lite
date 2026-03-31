import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { name, currentPassword, newPassword, confirmPassword, lastUsedPipeline } = await req.json()
  const userId = Number(session.user.id)

  const updates: { name?: string; password?: string; lastUsedPipeline?: string } = {}

  if (name !== undefined) {
    const trimmed = String(name).trim()
    if (!trimmed) {
      return NextResponse.json({ error: '姓名不能为空' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { name: trimmed } })
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: '该姓名已被使用' }, { status: 400 })
    }
    updates.name = trimmed
  }

  if (lastUsedPipeline !== undefined) {
    updates.lastUsedPipeline = String(lastUsedPipeline)
  }

  const wantsPasswordChange =
    currentPassword !== undefined || newPassword !== undefined || confirmPassword !== undefined

  if (wantsPasswordChange) {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: '请完整填写密码字段' }, { status: 400 })
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: '新密码至少8位' }, { status: 400 })
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: '两次新密码不一致' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const valid = await bcrypt.compare(String(currentPassword), user.password)
    if (!valid) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 400 })
    }

    updates.password = await bcrypt.hash(String(newPassword), 10)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '没有可更新内容' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: { id: true, name: true, role: true, level: true, pipelines: true, lastUsedPipeline: true },
  })

  return NextResponse.json(updated)
}

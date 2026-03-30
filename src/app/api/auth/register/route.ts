import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { name, password, confirmPassword, role, level, primaryPipeline } = await req.json()

  if (!name || !password || !confirmPassword) {
    return NextResponse.json({ error: '请填写所有字段' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: '密码至少8位' }, { status: 400 })
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: '两次密码不一致' }, { status: 400 })
  }

  const validLevels = ['P5', 'P4', 'P3', 'INTERN', 'OUTSOURCE']
  if (!level || !validLevels.includes(level)) {
    return NextResponse.json({ error: '请选择有效职级' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { name } })
  if (existing) {
    return NextResponse.json({ error: '该姓名已被注册' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      name,
      password: hashedPassword,
      role: role || 'MEMBER',
      level: level || null,
      primaryPipeline: primaryPipeline || null,
    },
  })

  return NextResponse.json({ id: user.id, name: user.name, role: user.role, level: user.level, primaryPipeline: user.primaryPipeline })
}

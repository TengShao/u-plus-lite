import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'

export async function getSession() {
  return getServerSession(authOptions)
}

export function unauthorized() {
  return NextResponse.json({ error: '未授权' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: '无权限' }, { status: 403 })
}

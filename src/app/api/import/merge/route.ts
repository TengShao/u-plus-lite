// src/app/api/import/merge/route.ts

import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/api-utils'
import { mergeWorkload, type ParsedGroup } from '@/lib/llm'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  let body: { groups: ParsedGroup[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { groups } = body

  if (!groups || !Array.isArray(groups) || groups.length < 2) {
    return NextResponse.json({ error: '至少需要2个需求组才能合并' }, { status: 400 })
  }

  try {
    const mergedGroup = await mergeWorkload(groups)
    return NextResponse.json({ group: mergedGroup })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

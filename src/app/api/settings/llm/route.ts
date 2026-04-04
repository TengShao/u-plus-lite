import { NextResponse } from 'next/server'
import { getSession, unauthorized } from '@/lib/api-utils'
import * as fs from 'fs'
import * as path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env.local')

function readEnv(): Record<string, string> {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8')
    const lines = content.split('\n')
    const env: Record<string, string> = {}
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx)
      const value = trimmed.slice(eqIdx + 1)
      env[key] = value
    }
    return env
  } catch {
    return {}
  }
}

function writeEnv(env: Record<string, string>) {
  const lines: string[] = []
  for (const [key, value] of Object.entries(env)) {
    lines.push(`${key}=${value}`)
  }
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8')
}

export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const env = readEnv()
  return NextResponse.json({
    provider: env['NEXT_PUBLIC_LLM_PROVIDER'] ?? 'ollama',
    ollamaModel: env['NEXT_PUBLIC_OLLAMA_MODEL'] ?? 'qwen3:4b',
    // Never expose actual minimax key — return masked placeholder
    minimaxKeySet: !!env['MINIMAX_API_KEY'] && env['MINIMAX_API_KEY'] !== 'your_api_key_here',
  })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { provider, ollamaModel, minimaxKey } = await req.json()

  const env = readEnv()

  if (provider === 'ollama' || provider === 'minimax') {
    env['NEXT_PUBLIC_LLM_PROVIDER'] = provider
  }
  if (ollamaModel) {
    env['NEXT_PUBLIC_OLLAMA_MODEL'] = ollamaModel
  }
  if (minimaxKey === null) {
    delete env['MINIMAX_API_KEY']
  } else if (minimaxKey) {
    env['MINIMAX_API_KEY'] = minimaxKey
  }

  try {
    writeEnv(env)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

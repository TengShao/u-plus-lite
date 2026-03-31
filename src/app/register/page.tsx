'use client'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([])
  const [pipelines, setPipelines] = useState<string[]>([])
  const [error, setError] = useState('')
  const router = useRouter()

  function togglePipeline(pipeline: string) {
    setSelectedPipelines(prev =>
      prev.includes(pipeline)
        ? prev.filter(p => p !== pipeline)
        : [...prev, pipeline]
    )
  }

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        const names = data.map((p: any) => p.name)
        setPipelines(names)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, confirmPassword, pipelines: selectedPipelines }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      return
    }

    // Auto login after registration
    const loginRes = await signIn('credentials', { name, password, redirect: false })
    if (loginRes?.error) {
      setError('注册成功但登录失败，请手动登录')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-80 space-y-4 rounded-lg bg-white p-8 shadow">
        <h1 className="text-center text-xl font-bold">注册</h1>
        <input
          type="text" placeholder="姓名（真实姓名）" value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border px-3 py-2 outline-none focus:border-blue-500"
        />
        <input
          type="password" placeholder="密码（至少8位）" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2 outline-none focus:border-blue-500"
        />
        <input
          type="password" placeholder="确认密码" value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded border px-3 py-2 outline-none focus:border-blue-500"
        />
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">选择负责管线（可多选）</label>
          {pipelines.map(p => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPipelines.includes(p)}
                onChange={() => togglePipeline(p)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">{p}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700">
          注册
        </button>
        <p className="text-center text-sm text-gray-500">
          已有账号？<a href="/login" className="text-blue-600 hover:underline">登录</a>
        </p>
      </form>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, confirmPassword }),
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

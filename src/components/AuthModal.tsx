'use client'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'

const FONT = { fontFamily: 'Alibaba PuHuiTi 2.0' }

export default function AuthModal({
  mode,
  onSwitch,
  onSuccess,
}: {
  mode: 'signin' | 'signup'
  onSwitch: (mode: 'signin' | 'signup') => void
  onSuccess: () => void
}) {
  // Shared form state
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [primaryPipeline, setPrimaryPipeline] = useState('')
  const [pipelines, setPipelines] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Clear error and form when switching modes
  useEffect(() => {
    setError('')
    setName('')
    setPassword('')
    setConfirmPassword('')
    setPrimaryPipeline('')
  }, [mode])

  // Fetch pipelines on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: { name: string }[]) => setPipelines(data.map(p => p.name)))
      .catch(() => {})
  }, [])

  // Signin handler
  async function handleSignin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const res = await signIn('credentials', { name, password, redirect: false })
    if (res?.error) {
      setError('姓名或密码错误')
      setIsLoading(false)
    } else {
      onSuccess()
    }
  }

  // Signup handler
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('两次密码输入不一致')
      return
    }
    if (password.length < 8) {
      setError('密码至少8位')
      return
    }
    setIsLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, confirmPassword, primaryPipeline }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || '注册失败')
      setIsLoading(false)
      return
    }
    // Auto login
    const loginRes = await signIn('credentials', { name, password, redirect: false })
    if (loginRes?.error) {
      setError('注册成功但登录失败，请手动登录')
      setIsLoading(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" style={FONT}>
      <div
        className="flex flex-col items-center rounded-[24px] bg-[#F4F4F4]"
        style={{
          width: 369,
          padding: '28px 17.5px 18px',
          boxShadow: '0 0 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Title */}
        <div
          className="text-[29px] text-black"
          style={{ fontWeight: 700, letterSpacing: '-1px' }}
        >
          {mode === 'signin' ? '来了啊！' : '怎么才来？'}
        </div>

        {mode === 'signin' ? (
          <form onSubmit={handleSignin} className="mt-[27px] flex w-[334px] flex-col gap-[12px]">
            {/* 账号 */}
            <div>
              <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>账号</div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="请输入真实姓名"
                className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
                style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
              />
            </div>

            {/* 密码 */}
            <div>
              <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>密码</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
                style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
              />
            </div>

            {/* Error */}
            {error && <div className="text-[14px] text-red-500">{error}</div>}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-[14px] flex h-[46px] items-center justify-center rounded-[12px] bg-black text-[25px] font-black text-white hover:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
              style={{ letterSpacing: '-0.5px' }}
            >
              {isLoading ? '登录中...' : '登录'}
            </button>

            {/* Switch to signup */}
            <button
              type="button"
              onClick={() => onSwitch('signup')}
              className="mt-[14px] text-center text-[20px] text-black underline underline-offset-4"
              style={{ fontWeight: 400 }}
            >
              注册
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="mt-[27px] flex w-[334px] flex-col gap-[12px]">
            {/* 账号 */}
            <div>
              <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>账号</div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="请输入真实姓名"
                className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
                style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
              />
            </div>

            {/* 密码 */}
            <div>
              <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>密码</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码（至少8位）"
                className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
                style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
              />
            </div>

            {/* 确认密码 */}
            <div>
              <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>确认密码</div>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="再输入一次"
                className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
                style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
              />
            </div>

            {/* 主要管线 */}
            <div>
              <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>主要管线</div>
              <div className="relative">
                <select
                  value={primaryPipeline}
                  onChange={e => setPrimaryPipeline(e.target.value)}
                  required
                  className="h-[42px] w-full appearance-none rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] pr-[40px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
                  style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
                >
                  <option value="">请选择</option>
                  {pipelines.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {/* S icon + chevron */}
                <span className="pointer-events-none absolute right-[15px] top-[9px]">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                    <path d="M1 1L5 5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
              </div>
            </div>

            {/* Error */}
            {error && <div className="text-[14px] text-red-500">{error}</div>}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-[14px] flex h-[46px] items-center justify-center rounded-[12px] bg-black text-[25px] font-black text-white hover:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
              style={{ letterSpacing: '-0.5px' }}
            >
              {isLoading ? '注册中...' : '注册'}
            </button>

            {/* Switch to signin */}
            <button
              type="button"
              onClick={() => onSwitch('signin')}
              className="mt-[14px] text-center text-[20px] text-black underline underline-offset-4"
              style={{ fontWeight: 400 }}
            >
              登录
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

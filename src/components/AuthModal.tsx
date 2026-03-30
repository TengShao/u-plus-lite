'use client'
import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'

const FONT = { fontFamily: 'Alibaba PuHuiTi 2.0' }

function ArrowIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      width="7" height="5" viewBox="0 0 7 5" fill="#000" xmlns="http://www.w3.org/2000/svg"
      className="opacity-20" style={flipped ? { transform: 'scaleY(-1)' } : undefined}
      aria-hidden="true"
    >
      <path d="M0.5 0.5 L3.5 4.5 L6.5 0.5 Z" rx="0.5" />
    </svg>
  )
}

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
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const pipelineRef = useRef<HTMLDivElement>(null)
  const [level, setLevel] = useState('')
  const [levelOpen, setLevelOpen] = useState(false)
  const levelRef = useRef<HTMLDivElement>(null)

  // Clear error and form when switching modes
  useEffect(() => {
    setError('')
    setName('')
    setPassword('')
    setConfirmPassword('')
    setPrimaryPipeline('')
    setLevel('')
  }, [mode])

  // Fetch pipelines on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: { name: string }[]) => setPipelines(data.map(p => p.name)))
      .catch(() => {})
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pipelineRef.current && !pipelineRef.current.contains(e.target as Node)) {
        setPipelineOpen(false)
      }
      if (levelRef.current && !levelRef.current.contains(e.target as Node)) {
        setLevelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Signin handler
  async function handleSignin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('请输入账号')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }
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
    if (!name.trim()) {
      setError('请输入账号')
      return
    }
    if (!password || password.length < 8) {
      setError('密码至少8位')
      return
    }
    if (password !== confirmPassword) {
      setError('两次密码输入不一致')
      return
    }
    if (!primaryPipeline) {
      setError('请选择主要管线')
      return
    }
    if (!level) {
      setError('请选择职级')
      return
    }
    setIsLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, confirmPassword, primaryPipeline, level }),
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
          width: 370,
          padding: '30px 18px 30px',
          boxShadow: '0 0 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Title */}
        <div
          className="text-[18px] text-black"
          style={{ fontWeight: 700, letterSpacing: '-1px' }}
        >
          {mode === 'signin' ? '来了啊！' : '怎么才来？'}
        </div>

        {/* Error message for signup */}
        {mode === 'signup' && error && (
          <div className="mt-[8px] text-[14px] text-red-500">{error}</div>
        )}

        {/* Error message for signin */}
        {mode === 'signin' && error && (
          <div className="mt-[8px] text-[14px] text-red-500">{error}</div>
        )}

        {mode === 'signin' ? (
          <div className="mt-[32px] flex w-[334px] flex-col">
            {/* Form content - 306px centered within 334px */}
            <form onSubmit={handleSignin} className="flex w-[306px] flex-col gap-[6px] self-center">
              {/* 账号 */}
              <div>
                <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>账号</div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="请输入姓名"
                  className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none hover:border-[#8ECA2E] focus:border-[#8ECA2E]"
                  style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)', fontWeight: 800 }}
                />
              </div>

              {/* 密码 */}
              <div className="mt-[12px]">
                <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>密码</div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none hover:border-[#8ECA2E] focus:border-[#8ECA2E]"
                  style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)', fontWeight: 800 }}
                />
              </div>

              {/* Submit - 306px full width */}
              <button
                type="submit"
                disabled={isLoading}
                className="mt-[32px] flex h-[46px] w-full items-center justify-center rounded-[12px] bg-black text-[18px] font-black text-white hover:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
                style={{ letterSpacing: '-0.5px' }}
              >
                {isLoading ? '登录中...' : '登录'}
              </button>
            </form>

            {/* Switch to signup */}
            <button
              type="button"
              onClick={() => onSwitch('signup')}
              className="mt-[14px] self-center text-center text-[14px] text-black underline underline-offset-4"
              style={{ fontWeight: 700 }}
            >
              注册
            </button>
          </div>
        ) : (
          <div className="mt-[32px] flex w-[334px] flex-col">
            {/* Form content - 306px centered within 334px */}
            <form onSubmit={handleSignup} className="flex w-[306px] flex-col gap-0 self-center">
              {/* 账号 */}
              <div>
                <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>账号</div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="请输入真实姓名"
                  className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none hover:border-[#8ECA2E] focus:border-[#8ECA2E]"
                  style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)', fontWeight: 800 }}
                />
              </div>

              {/* 密码 */}
              <div className="mt-[24px]">
                <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>密码</div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码（至少8位）"
                  className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none hover:border-[#8ECA2E] focus:border-[#8ECA2E]"
                  style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)', fontWeight: 800 }}
                />
              </div>

              {/* 确认密码 */}
              <div className="mt-[6px]">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="再输入一次"
                  className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none hover:border-[#8ECA2E] focus:border-[#8ECA2E]"
                  style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)', fontWeight: 800 }}
                />
              </div>

              {/* 主要管线和职级 - 同一行并排，标题和下拉框上下结构 */}
              <div className="mt-[24px] flex gap-[28px]">
                {/* 主要管线 */}
                <div style={{ width: 139 }}>
                  <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>主要管线</div>
                  <div className="relative" ref={pipelineRef}>
                    <button
                      type="button"
                      onClick={() => setPipelineOpen(!pipelineOpen)}
                      className="relative z-10 h-[36px] w-full rounded-[8px] border border-[#EEEEEE] bg-white px-[10px] hover:border-[#8ECA2E]"
                      style={{ boxShadow: 'none', transition: 'border-color 0.15s' }}
                    >
                      <span
                        className="absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center leading-[22px]"
                        style={{ color: primaryPipeline ? '#000' : '#C3C3C3', fontSize: 16, fontWeight: 800 }}
                      >
                        {primaryPipeline || '请选择'}
                      </span>
                      <span className="absolute right-[10px] top-1/2 -translate-y-1/2"><ArrowIcon flipped={pipelineOpen} /></span>
                    </button>
                    {pipelineOpen && (
                      <div className="absolute left-0 top-0 z-20 w-full overflow-hidden rounded-[8px] bg-white shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ border: '1px solid #8ECA2E' }}>
                        {/* Trigger clone */}
                        <div className="relative h-[36px] px-[10px]">
                          <span className="absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center text-[16px] leading-[22px]" style={{ fontWeight: 800 }}>
                            {primaryPipeline || '请选择'}
                          </span>
                          <span className="absolute right-[10px] top-1/2 -translate-y-1/2"><ArrowIcon flipped /></span>
                        </div>
                        <div className="h-px bg-[#0000000B] mx-px" />
                        {pipelines.map((p) => (
                          <button
                            key={p}
                            onClick={() => { setPrimaryPipeline(p); setPipelineOpen(false) }}
                            className="flex h-[30px] w-full items-center justify-center text-[14px] hover:bg-[rgba(142,202,46,0.15)]"
                            style={{ fontWeight: 800 }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 职级 */}
                <div style={{ width: 139 }}>
                  <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>职级</div>
                  <div className="relative" ref={levelRef}>
                    <button
                      type="button"
                      onClick={() => setLevelOpen(!levelOpen)}
                      className="relative z-10 h-[36px] w-full rounded-[8px] border border-[#EEEEEE] bg-white px-[10px] hover:border-[#8ECA2E]"
                      style={{ boxShadow: 'none', transition: 'border-color 0.15s' }}
                    >
                      <span
                        className="absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center leading-[22px]"
                        style={{ color: level ? '#000' : '#C3C3C3', fontSize: 16, fontWeight: 800 }}
                      >
                        {level || '请选择'}
                      </span>
                      <span className="absolute right-[10px] top-1/2 -translate-y-1/2"><ArrowIcon flipped={levelOpen} /></span>
                    </button>
                    {levelOpen && (
                      <div className="absolute left-0 top-0 z-20 w-full overflow-hidden rounded-[8px] bg-white shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ border: '1px solid #8ECA2E' }}>
                        {/* Trigger clone */}
                        <div className="relative h-[36px] px-[10px]">
                          <span className="absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center text-[16px] leading-[22px]" style={{ fontWeight: 800 }}>
                            {level || '请选择'}
                          </span>
                          <span className="absolute right-[10px] top-1/2 -translate-y-1/2"><ArrowIcon flipped /></span>
                        </div>
                        <div className="h-px bg-[#0000000B] mx-px" />
                        {['P5', 'P4', 'P3', 'INTERN', 'OUTSOURCE'].map((l) => (
                          <button
                            key={l}
                            onClick={() => { setLevel(l); setLevelOpen(false) }}
                            className={`flex h-[30px] w-full items-center justify-center text-[14px] ${level === l ? 'bg-[rgba(142,202,46,0.15)]' : 'hover:bg-[rgba(142,202,46,0.15)]'}`}
                            style={{ fontWeight: 800 }}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hidden input for form submission */}
              <input type="hidden" name="level" value={level} />

              {/* Submit - 306px full width */}
              <button
                type="submit"
                disabled={isLoading}
                className="mt-[33px] flex h-[46px] w-full items-center justify-center rounded-[12px] bg-black text-[18px] font-black text-white hover:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
                style={{ letterSpacing: '-0.5px' }}
              >
                {isLoading ? '注册中...' : '注册'}
              </button>
            </form>

            {/* Switch to signin */}
            <button
              type="button"
              onClick={() => onSwitch('signin')}
              className="mt-[14px] self-center text-center text-[14px] text-black underline underline-offset-4"
              style={{ fontWeight: 700 }}
            >
              登录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

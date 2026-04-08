'use client'
import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'

function fitDropdownTextSize(text: string, width: number) {
  const available = Math.max(width - 48, 40)
  const units = text.split('').reduce((sum, ch) => sum + (/^[\x20-\x7E]$/.test(ch) ? 0.55 : 1), 0)
  const size = Math.floor(available / Math.max(units, 1))
  return Math.max(10, Math.min(16, size))
}

function ArrowIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: flipped ? 'rotate(180deg)' : undefined }}>
      <path d="M1 1L5 5L9 1" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SelectTrigger({ width, value, placeholder = '请选择', isOpen, onToggle }: { width: number; value: string; placeholder?: string; isOpen: boolean; onToggle: () => void }) {
  const borderColor = isOpen ? 'transparent' : 'var(--u-border)'
  const boxShadow = 'none'
  const displayText = value || placeholder
  const fontSize = fitDropdownTextSize(displayText, width)
  return (
    <button
      type="button"
      data-dropdown-root="true"
      onClick={onToggle}
      className={`relative z-10 flex h-[36px] items-center rounded-[8px] border bg-white px-[10px]`}
      style={{ width, borderColor, boxShadow, fontWeight: 800, transition: 'border-color 0.15s', gap: 8 }}
    >
      <span
        className="flex-1 overflow-hidden whitespace-nowrap text-center text-[16px] leading-[22px]"
        style={{ color: value ? undefined : 'var(--u-text-muted)', fontSize }}
      >
        {displayText}
      </span>
      <ArrowIcon flipped={isOpen} />
    </button>
  )
}

function PipelineMultiMenu({ width, value, options, selected, onToggle }: { width: number; value: string; options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div data-dropdown-root="true" className="absolute left-0 top-0 z-20 overflow-hidden rounded-[8px] bg-white shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ border: '1px solid var(--color-brand)', width }}>
      {/* Trigger clone (arrow flipped) */}
      <div className="relative flex h-[36px] items-center justify-center px-[10px]">
        <span className="flex-1 overflow-hidden whitespace-nowrap text-center text-[16px] leading-[22px]" style={{ fontWeight: 800 }}>
          {value}
        </span>
        <ArrowIcon flipped />
      </div>
      <div className="h-px mx-px" style={{ backgroundColor: 'var(--u-border)', opacity: 0.4 }} />
      {/* Options */}
      <div className="overflow-y-auto" style={{ maxHeight: 260, scrollbarWidth: 'thin', scrollbarColor: 'var(--u-scrollbar-thumb) transparent' }}>
        {options.map((opt) => {
          const checked = selected.includes(opt)
          return (
            <button
              type="button"
              key={opt}
              onClick={() => onToggle(opt)}
              className={`flex h-[30px] w-full items-center px-[8px] text-[14px] ${checked ? 'bg-brand-hover' : 'hover:bg-brand-hover'}`}
            >
              <span className="mr-[8px] flex h-[12px] w-[12px] items-center justify-center rounded-[4px] border border-border-default bg-bg-panel">
                {checked && <span className="h-[6px] w-[6px] rounded-[1px] bg-brand" />}
              </span>
              <span className="mx-auto truncate" style={{ fontWeight: 800 }}>{opt}</span>
            </button>
          )
        })}
      </div>
    </div>
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
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([])
  const [pipelines, setPipelines] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const pipelineRef = useRef<HTMLDivElement>(null)
  const [level, setLevel] = useState('')
  const [levelOpen, setLevelOpen] = useState(false)
  const levelRef = useRef<HTMLDivElement>(null)

  function togglePipeline(pipeline: string) {
    setSelectedPipelines(prev =>
      prev.includes(pipeline)
        ? prev.filter(p => p !== pipeline)
        : [...prev, pipeline]
    )
  }

  // Clear error and form when switching modes
  useEffect(() => {
    setError('')
    setName('')
    setPassword('')
    setConfirmPassword('')
    setSelectedPipelines([])
    setLevel('')
  }, [mode])

  // Fetch pipelines on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: { name: string }[]) => setPipelines(data.map((p: any) => p.name)))
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
    if (!level) {
      setError('请选择职级')
      return
    }
    setIsLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, confirmPassword, pipelines: selectedPipelines, level }),
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

  const pipelineDisplayValue = selectedPipelines.length > 0 ? selectedPipelines.join(' / ') : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 font-alibaba">
      <div
        className="flex flex-col items-center rounded-[24px] bg-bg-panel"
        style={{
          width: 370,
          padding: '30px 18px 30px',
          boxShadow: '0 0 20px rgba(0,0,0,0.15)',
        }}
      >
        {/* Title */}
        <div
          className="text-[18px] text-text-primary"
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
                  className="h-[42px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[15px] text-[16px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand"
                  style={{ boxShadow: 'var(--u-shadow-sm)', fontWeight: 800 }}
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
                  className="h-[42px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[15px] text-[16px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand"
                  style={{ boxShadow: 'var(--u-shadow-sm)', fontWeight: 800 }}
                />
              </div>

              {/* Submit - 306px full width */}
              <button
                type="submit"
                disabled={isLoading}
                className="mt-[32px] flex h-[46px] w-full items-center justify-center rounded-[12px] text-[18px] font-black"
                style={{ letterSpacing: '-0.5px', backgroundColor: 'var(--u-text-primary)', color: 'var(--u-bg-panel)' }}
              >
                {isLoading ? '登录中...' : '登录'}
              </button>
            </form>

            {/* Switch to signup */}
            <button
              type="button"
              onClick={() => onSwitch('signup')}
              className="mt-[14px] self-center text-center text-[14px] underline underline-offset-4 text-text-primary"
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
                  className="h-[42px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[15px] text-[16px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand"
                  style={{ boxShadow: 'var(--u-shadow-sm)', fontWeight: 800 }}
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
                  className="h-[42px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[15px] text-[16px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand"
                  style={{ boxShadow: 'var(--u-shadow-sm)', fontWeight: 800 }}
                />
              </div>

              {/* 确认密码 */}
              <div className="mt-[6px]">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="再输入一次"
                  className="h-[42px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[15px] text-[16px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand"
                  style={{ boxShadow: 'var(--u-shadow-sm)', fontWeight: 800 }}
                />
              </div>

              {/* 主要管线和职级 - 同一行并排，标题和下拉框上下结构 */}
              <div className="mt-[24px] flex gap-[28px]">
                {/* 管线 - 下拉多选 */}
                <div style={{ width: 139 }}>
                  <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>管线</div>
                  <div className="relative" ref={pipelineRef}>
                    <SelectTrigger
                      width={139}
                      value={pipelineDisplayValue}
                      isOpen={pipelineOpen}
                      onToggle={() => setPipelineOpen(!pipelineOpen)}
                    />
                    {pipelineOpen && (
                      <PipelineMultiMenu
                        width={139}
                        value={pipelineDisplayValue}
                        options={pipelines as readonly string[]}
                        selected={selectedPipelines}
                        onToggle={togglePipeline}
                      />
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
                      className="relative z-10 h-[36px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[10px] hover:border-brand"
                      style={{ boxShadow: 'none', transition: 'border-color 0.15s' }}
                    >
                      <span
                        className="absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center leading-[22px]"
                        style={{ color: level ? 'var(--u-text-primary)' : 'var(--u-text-muted)', fontSize: 16, fontWeight: 800 }}
                      >
                        {level || '请选择'}
                      </span>
                      <span className="absolute right-[10px] top-1/2 -translate-y-1/2"><ArrowIcon flipped={levelOpen} /></span>
                    </button>
                    {levelOpen && (
                      <div className="absolute left-0 top-0 z-20 w-full overflow-hidden rounded-[8px] bg-white shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ border: '1px solid var(--color-brand)' }}>
                        {/* Trigger clone */}
                        <div className="relative h-[36px] px-[10px]">
                          <span className="absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center text-[16px] leading-[22px]" style={{ fontWeight: 800 }}>
                            {level || '请选择'}
                          </span>
                          <span className="absolute right-[10px] top-1/2 -translate-y-1/2"><ArrowIcon flipped /></span>
                        </div>
                        <div className="h-px mx-px" style={{ backgroundColor: 'var(--u-border)', opacity: 0.4 }} />
                        {['P5', 'P4', 'P3', 'INTERN', 'OUTSOURCE'].map((l) => (
                          <button
                            type="button"
                            key={l}
                            onClick={() => { setLevel(l); setLevelOpen(false) }}
                            className={`flex h-[30px] w-full items-center justify-center text-[14px] ${level === l ? 'bg-brand-hover' : 'hover:bg-brand-hover'}`}
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
                className="mt-[33px] flex h-[46px] w-full items-center justify-center rounded-[12px] text-[18px] font-black"
                style={{ letterSpacing: '-0.5px', backgroundColor: 'var(--u-text-primary)', color: 'var(--u-bg-panel)' }}
              >
                {isLoading ? '注册中...' : '注册'}
              </button>
            </form>

            {/* Switch to signin */}
            <button
              type="button"
              onClick={() => onSwitch('signin')}
              className="mt-[14px] self-center text-center text-[14px] underline underline-offset-4 text-text-primary"
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

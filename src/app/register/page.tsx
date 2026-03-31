'use client'
import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const GREEN = '#8ECA2E'

function fitDropdownTextSize(text: string, width: number) {
  const available = Math.max(width - 48, 40)
  const units = text.split('').reduce((sum, ch) => sum + (/^[\x20-\x7E]$/.test(ch) ? 0.55 : 1), 0)
  const size = Math.floor(available / Math.max(units, 1))
  return Math.max(10, Math.min(16, size))
}

function ArrowIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: flipped ? 'rotate(180deg)' : undefined }}>
      <path d="M1 1L5 5L9 1" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SelectTrigger({ width, value, placeholder = '请选择', isOpen, onToggle }: { width: number; value: string; placeholder?: string; isOpen: boolean; onToggle: () => void }) {
  const borderColor = isOpen ? 'transparent' : '#EEEEEE'
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
        style={{ color: value ? undefined : '#C3C3C3', fontSize }}
      >
        {displayText}
      </span>
      <ArrowIcon flipped={isOpen} />
    </button>
  )
}

function PipelineMultiMenu({ width, value, options, selected, onToggle }: { width: number; value: string; options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div data-dropdown-root="true" className="absolute left-0 top-0 z-20 overflow-hidden rounded-[8px] bg-white shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ border: '1px solid #8ECA2E', width }}>
      {/* Trigger clone (arrow flipped) */}
      <div className="relative flex h-[36px] items-center justify-center px-[10px]">
        <span className="flex-1 overflow-hidden whitespace-nowrap text-center text-[16px] leading-[22px]" style={{ fontWeight: 800 }}>
          {value}
        </span>
        <ArrowIcon flipped />
      </div>
      <div className="h-px bg-[#0000000B] mx-px" />
      {/* Options */}
      <div className="overflow-y-auto" style={{ maxHeight: 260, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.2) transparent' }}>
        {options.map((opt) => {
          const checked = selected.includes(opt)
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`flex h-[30px] w-full items-center px-[8px] text-[14px] ${checked ? 'bg-[rgba(142,202,46,0.15)]' : 'hover:bg-[rgba(142,202,46,0.15)]'}`}
            >
              <span className="mr-[8px] flex h-[12px] w-[12px] items-center justify-center rounded-[4px] border border-[#EEEEEE] bg-[#FDFDFD]">
                {checked && <span className="h-[6px] w-[6px] rounded-[1px] bg-[#8ECA2E]" />}
              </span>
              <span className="mx-auto truncate" style={{ fontWeight: 800 }}>{opt}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([])
  const [pipelines, setPipelines] = useState<string[]>([])
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const pipelineRef = useRef<HTMLDivElement>(null)

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
      .then((data: { name: string }[]) => {
        const names = data.map((p: any) => p.name)
        setPipelines(names)
      })
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pipelineRef.current && !pipelineRef.current.contains(e.target as Node)) {
        setPipelineOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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

  const displayValue = selectedPipelines.length > 0 ? selectedPipelines.join(' / ') : ''

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
        {/* 管线多选下拉 — 和需求组"类型"编辑块一致 */}
        <div className="relative" ref={pipelineRef}>
          <div className="mb-[6px] pl-[11px] text-sm font-medium text-gray-700">选择负责管线</div>
          <SelectTrigger
            width={288}
            value={displayValue}
            isOpen={pipelineOpen}
            onToggle={() => setPipelineOpen(!pipelineOpen)}
          />
          {pipelineOpen && (
            <PipelineMultiMenu
              width={288}
              value={displayValue}
              options={pipelines as readonly string[]}
              selected={selectedPipelines}
              onToggle={togglePipeline}
            />
          )}
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

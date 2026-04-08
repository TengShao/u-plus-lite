'use client'
import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import AdminSettingsModal from './AdminSettingsModal'

/* ---------- inline SVG icons (from Sketch export, display-p3 → standard) ---------- */

function IconSetting() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--u-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings" aria-hidden="true">
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <g transform="translate(2.25,2.25)" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="13.5" y1="13.5" x2="10.245" y2="10.245" />
        <circle cx="6" cy="6" r="6" />
      </g>
    </svg>
  )
}

function IconClear() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="var(--u-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="7.5" />
        <line x1="11.25" y1="6.75" x2="6.75" y2="11.25" />
        <line x1="6.75" y1="6.75" x2="11.25" y2="11.25" />
      </g>
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="var(--u-text-muted)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.925,20.056 C17.461,17.143 14.949,14.999 11.999,14.999 C9.049,14.999 6.537,17.144 6.074,20.057" />
        <circle cx="12" cy="11" r="4" />
        <circle cx="12" cy="12" r="10" />
      </g>
    </svg>
  )
}

function ArrowIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      width="7" height="5" viewBox="0 0 7 5" fill="currentColor" xmlns="http://www.w3.org/2000/svg"
      className="opacity-20" style={flipped ? { transform: 'scaleY(-1)' } : undefined}
      aria-hidden="true"
    >
      <path d="M0.5 0.5 L3.5 4.5 L6.5 0.5 Z" rx="0.5" />
    </svg>
  )
}

function AccountSettingsModal({
  initialName,
  onClose,
  onUpdated,
}: {
  initialName: string
  onClose: () => void
  onUpdated: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pipelines, setPipelines] = useState<string[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState('')
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const pipelineRef = useRef<HTMLDivElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: { name: string }[]) => setPipelines(data.map(p => p.name)))
      .catch(() => {})
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

  async function handleSave() {
    const trimmedName = name.trim()
    const payload: Record<string, string> = {}

    if (trimmedName !== initialName) {
      payload.name = trimmedName
    }

    const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword)
    if (wantsPasswordChange) {
      payload.currentPassword = currentPassword
      payload.newPassword = newPassword
      payload.confirmPassword = confirmPassword
    }

    if (Object.keys(payload).length === 0) {
      setError('没有可更新内容')
      setSuccess('')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await res.json()

    if (!res.ok) {
      setError(result.error || '保存失败')
      setIsSaving(false)
      return
    }

    await onUpdated(result.name)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSuccess('保存成功')
    setIsSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 font-alibaba" onClick={onClose}>
      <div
        className="flex flex-col items-center rounded-[24px] bg-bg-panel"
        style={{
          width: 369,
          padding: '28px 17.5px 18px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[18px]" style={{ fontWeight: 700, letterSpacing: '-1px', color: 'var(--u-text-primary)' }}>账户设置</h3>

        {error && <div className="mt-[8px] text-[14px] text-red-500">{error}</div>}
        {success && <div className="mt-[8px] text-[14px]" style={{ color: 'var(--u-success)' }}>{success}</div>}

        <div className="mt-[32px] flex w-[334px] flex-col">
          <div className="flex w-[306px] flex-col gap-0 self-center">
            <div>
              <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-text-primary" style={{ fontWeight: 500 }}>姓名</div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-[42px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[15px] text-[16px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand"
                style={{ boxShadow: 'var(--u-shadow-sm)', fontWeight: 800 }}
                placeholder="请输入姓名"
              />
            </div>

            <div className="mt-[24px]">
              <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-text-primary" style={{ fontWeight: 500 }}>当前密码</div>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-[42px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[15px] text-[16px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand"
                style={{ boxShadow: 'var(--u-shadow-sm)', fontWeight: 800 }}
                placeholder="如需修改密码请填写"
              />
            </div>

            <div className="mt-[24px]">
              <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-text-primary" style={{ fontWeight: 500 }}>新密码</div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-[42px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[15px] text-[16px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand"
                style={{ boxShadow: 'var(--u-shadow-sm)', fontWeight: 800 }}
                placeholder="不少于8位"
              />
            </div>

            <div className="mt-[6px]">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-[42px] w-full rounded-[8px] border border-border-default bg-bg-panel px-[15px] text-[16px] text-text-primary placeholder:text-text-muted outline-none hover:border-brand focus:border-brand"
                style={{ boxShadow: 'var(--u-shadow-sm)', fontWeight: 800 }}
                placeholder="再输入一次"
              />
            </div>

            <div className="mt-[24px] relative" ref={pipelineRef}>
              <div className="flex items-center gap-[10px]">
                <div className="pl-[11px] text-[14px] leading-[20px] text-text-primary" style={{ fontWeight: 500 }}>主要管线</div>
                <button
                  type="button"
                  onClick={() => setPipelineOpen(!pipelineOpen)}
                  className="relative z-10 h-[42px] rounded-[8px] border border-border-default bg-bg-panel px-[10px] hover:border-brand"
                  style={{ width: 144, boxShadow: 'none', marginLeft: 'auto' }}
                >
                  <span
                    className="absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center leading-[22px]"
                    style={{ color: selectedPipeline ? 'var(--u-text-primary)' : 'var(--u-text-muted)', fontSize: 16, fontWeight: 800 }}
                  >
                    {selectedPipeline || '请选择'}
                  </span>
                  <span className="absolute right-[10px] top-1/2 -translate-y-1/2"><ArrowIcon /></span>
                </button>
              </div>
              {pipelineOpen && (
                <div className="absolute z-20 overflow-hidden rounded-[8px] bg-bg-panel" style={{ width: 144, right: 0, border: '1px solid var(--color-brand)', marginTop: 4, boxShadow: 'var(--u-shadow-sm)' }}>
                  {pipelines.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setSelectedPipeline(p); setPipelineOpen(false) }}
                      className="flex h-[30px] w-full items-center justify-center text-[14px] hover:bg-brand-hover"
                      style={{ fontWeight: 800 }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-[42px] flex items-center justify-center gap-[14px]">
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-[8px] text-[18px]"
              style={{
                width: 160,
                height: 46,
                fontWeight: 900,
                backgroundColor: 'var(--u-bg-hover)',
                color: 'var(--u-text-primary)',
                letterSpacing: '-0.5px',
              }}
              disabled={isSaving}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center justify-center rounded-[8px] text-[18px]"
              style={{
                width: 160,
                height: 46,
                fontWeight: 900,
                backgroundColor: 'var(--u-text-primary)',
                color: 'var(--u-bg-panel)',
                letterSpacing: '-0.5px',
              }}
              disabled={isSaving}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Header ---------- */

export default function Header({
  searchQuery,
  onSearchChange,
}: {
  searchQuery: string
  onSearchChange: (q: string) => void
}) {
  const { data: session, update } = useSession()
  const { theme, setTheme } = useTheme()
  const [showSettings, setShowSettings] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLButtonElement>(null)
  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!showUserMenu) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) return
      if (!userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  async function handleAccountUpdated(name: string) {
    await update({ name })
  }

  async function handleSignOut() {
    // Clear all draft sessionStorage before signing out
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('draft_')) {
        sessionStorage.removeItem(key)
      }
    })
    await signOut({ redirect: false })
    window.location.href = '/'
  }

  const hasValue = searchQuery.length > 0
  // border color: focused/hasValue → green, hovered → green, default → var(--u-border)
  const borderColor = isFocused || hasValue ? 'var(--color-brand)' : isHovered ? 'var(--color-brand)' : 'var(--u-border)'
  // icon/placeholder opacity: focused/hasValue → 1 : 0.2
  const iconOpacity = isFocused || hasValue ? 1 : 0.2

  return (
    <header
      className="relative flex h-[71px] shrink-0 items-center font-alibaba"
    >
      {/* bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border-default" />

      {/* left: logo + title + theme toggle + settings */}
      <div className="flex items-center" style={{ marginLeft: 33.5 }}>
        <Image src="/logo.png" alt="logo" width={26} height={26} className="shrink-0" />
        {/* logo text - inline SVG to support theme switch */}
        <svg className="ml-[16px] shrink-0" width={88} height={24} viewBox="0 0 88 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {theme === 'dark' ? (
            <g fillRule="evenodd">
              <path d="M13.2,5.76 L9.88,5.76 L8.08,14.74 C7.78,16.22 7.12,17.18 5.76,17.18 C4.76,17.18 4.34,16.5 4.34,15.7 C4.34,15.44 4.38,15.14 4.42,14.9 L6.26,5.76 L2.94,5.76 L1.14,14.72 C1.08,15 1.02,15.6 1.02,15.96 C1.02,18.38 2.84,20.12 5.56,20.12 C8.1,20.12 10.6,18.74 11.34,15.02 L13.2,5.76 Z" fill="#FFFFFF" fillRule="nonzero"/>
              <polygon points="19.14 12.64 12.9 12.64 12.32 15.56 18.56 15.56" fill="#FFFFFF" fillRule="nonzero"/>
              <path d="M30.94,9.72 C30.94,7.24 29.3,5.76 27,5.76 L21.82,5.76 L18.96,20 L22.28,20 L23.34,14.72 L25.54,14.72 C29.1,14.72 30.94,12.18 30.94,9.72 Z M27.6,10.02 C27.6,10.54 27.18,11.78 25.68,11.78 L23.94,11.78 L24.56,8.7 L26.42,8.7 C27.28,8.7 27.6,9.28 27.6,10.02 Z" fill="#FFFFFF" fillRule="nonzero"/>
              <path d="M35.54,5.76 L32.42,5.76 L30.26,16.62 C30.2,16.92 30.18,17.18 30.18,17.5 C30.18,18.9 31.2,20 32.98,20 L34.52,20 L35.06,17.36 L33.92,17.36 C33.54,17.36 33.34,17.2 33.34,16.9 C33.34,16.78 33.36,16.72 33.38,16.6 L35.54,5.76 Z" fill="#FFFFFF" fillRule="nonzero"/>
              <path d="M46,9.24 L42.88,9.24 L41.58,15.74 C41.34,16.94 40.64,17.3 39.92,17.3 C39.52,17.3 39.02,17 39.02,16.28 C39.02,16.12 39.04,15.92 39.08,15.74 L40.38,9.24 L37.26,9.24 L35.92,15.92 C35.84,16.28 35.78,16.72 35.78,17.16 C35.78,19.4 37.36,20.12 38.42,20.12 C39.36,20.12 40.38,19.74 41.06,19.06 L40.88,20 L43.86,20 L46,9.24 Z" fill="#FFFFFF" fillRule="nonzero"/>
              <path d="M54.58,10.52 C53.62,9.48 52.5,9.12 50.92,9.12 C49.4,9.12 48.08,9.54 47.24,10.38 C46.48,11.14 46.1,12.12 46.1,13.2 C46.1,14.28 46.84,15.36 48.64,15.68 L50,15.92 C50.46,16 50.74,16.18 50.74,16.56 C50.74,17 50.16,17.44 49.06,17.44 C47.96,17.44 47.28,17.04 46.84,16.52 L44.62,18.48 C45.58,19.52 46.86,20.12 48.86,20.12 C50.22,20.12 51.74,19.8 52.64,18.94 C53.32,18.3 53.84,17.42 53.84,16.2 C53.84,14.78 53.16,13.66 51.24,13.32 L49.88,13.08 C49.42,13 49.22,12.8 49.22,12.5 C49.22,12.06 49.64,11.68 50.66,11.68 C51.24,11.68 52.08,11.92 52.46,12.4 L54.58,10.52 Z" fill="#FFFFFF" fillRule="nonzero"/>
              <polygon points="66.88 17.08 61.1 17.08 63.36 5.76 60.04 5.76 57.18 20 66.3 20" fill="#ADADAD" fillRule="nonzero"/>
              <path d="M73.06,6.78 C73.06,5.74 72.2,4.88 71.16,4.88 C70.12,4.88 69.26,5.74 69.26,6.78 C69.26,7.82 70.12,8.68 71.16,8.68 C72.2,8.68 73.06,7.82 73.06,6.78 Z M72.22,9.66 L69.1,9.66 L67.04,20 L70.16,20 L72.22,9.66 Z" fill="#ADADAD" fillRule="nonzero"/>
              <path d="M78.52,9.66 L76.92,9.66 L77.54,6.58 L74.42,6.58 L73.8,9.66 L72.86,9.66 L72.38,12.08 L73.32,12.08 L72.42,16.62 C72.38,16.82 72.34,17.1 72.34,17.5 C72.34,18.9 73.36,20 75.14,20 L76.6,20 L77.12,17.38 L76.14,17.38 C75.76,17.38 75.52,17.24 75.52,16.88 C75.52,16.86 75.52,16.72 75.54,16.64 L76.44,12.08 L78.04,12.08 L78.52,9.66 Z" fill="#ADADAD" fillRule="nonzero"/>
              <path d="M87.46,13.04 C87.46,10.56 85.72,9.12 83.44,9.12 C79.8,9.12 77.9,12.48 77.9,16.3 C77.9,19.32 80.32,20.12 82.06,20.12 C83.64,20.12 85.22,19.58 86.3,18.54 L84.74,16.5 C84.08,17.14 83.34,17.5 82.44,17.5 C81.38,17.5 80.86,16.92 80.86,16.06 C80.86,15.92 80.88,15.82 80.9,15.62 L87.1,15.62 C87.3,14.78 87.46,13.86 87.46,13.04 Z M84.5,13.04 C84.5,13.16 84.48,13.4 84.44,13.56 L81.3,13.56 C81.7,12.18 82.44,11.68 83.26,11.68 C84.08,11.68 84.5,12.22 84.5,13.04 Z" fill="#ADADAD" fillRule="nonzero"/>
            </g>
          ) : (
            <g fillRule="evenodd">
              <path d="M13.2,5.76 L9.88,5.76 L8.08,14.74 C7.78,16.22 7.12,17.18 5.76,17.18 C4.76,17.18 4.34,16.5 4.34,15.7 C4.34,15.44 4.38,15.14 4.42,14.9 L6.26,5.76 L2.94,5.76 L1.14,14.72 C1.08,15 1.02,15.6 1.02,15.96 C1.02,18.38 2.84,20.12 5.56,20.12 C8.1,20.12 10.6,18.74 11.34,15.02 L13.2,5.76 Z" fill="#000000" fillRule="nonzero"/>
              <polygon points="19.14 12.64 12.9 12.64 12.32 15.56 18.56 15.56" fill="#000000" fillRule="nonzero"/>
              <path d="M30.94,9.72 C30.94,7.24 29.3,5.76 27,5.76 L21.82,5.76 L18.96,20 L22.28,20 L23.34,14.72 L25.54,14.72 C29.1,14.72 30.94,12.18 30.94,9.72 Z M27.6,10.02 C27.6,10.54 27.18,11.78 25.68,11.78 L23.94,11.78 L24.56,8.7 L26.42,8.7 C27.28,8.7 27.6,9.28 27.6,10.02 Z" fill="#000000" fillRule="nonzero"/>
              <path d="M35.54,5.76 L32.42,5.76 L30.26,16.62 C30.2,16.92 30.18,17.18 30.18,17.5 C30.18,18.9 31.2,20 32.98,20 L34.52,20 L35.06,17.36 L33.92,17.36 C33.54,17.36 33.34,17.2 33.34,16.9 C33.34,16.78 33.36,16.72 33.38,16.6 L35.54,5.76 Z" fill="#000000" fillRule="nonzero"/>
              <path d="M46,9.24 L42.88,9.24 L41.58,15.74 C41.34,16.94 40.64,17.3 39.92,17.3 C39.52,17.3 39.02,17 39.02,16.28 C39.02,16.12 39.04,15.92 39.08,15.74 L40.38,9.24 L37.26,9.24 L35.92,15.92 C35.84,16.28 35.78,16.72 35.78,17.16 C35.78,19.4 37.36,20.12 38.42,20.12 C39.36,20.12 40.38,19.74 41.06,19.06 L40.88,20 L43.86,20 L46,9.24 Z" fill="#000000" fillRule="nonzero"/>
              <path d="M54.58,10.52 C53.62,9.48 52.5,9.12 50.92,9.12 C49.4,9.12 48.08,9.54 47.24,10.38 C46.48,11.14 46.1,12.12 46.1,13.2 C46.1,14.28 46.84,15.36 48.64,15.68 L50,15.92 C50.46,16 50.74,16.18 50.74,16.56 C50.74,17 50.16,17.44 49.06,17.44 C47.96,17.44 47.28,17.04 46.84,16.52 L44.62,18.48 C45.58,19.52 46.86,20.12 48.86,20.12 C50.22,20.12 51.74,19.8 52.64,18.94 C53.32,18.3 53.84,17.42 53.84,16.2 C53.84,14.78 53.16,13.66 51.24,13.32 L49.88,13.08 C49.42,13 49.22,12.8 49.22,12.5 C49.22,12.06 49.64,11.68 50.66,11.68 C51.24,11.68 52.08,11.92 52.46,12.4 L54.58,10.52 Z" fill="#000000" fillRule="nonzero"/>
              <polygon points="66.88 17.08 61.1 17.08 63.36 5.76 60.04 5.76 57.18 20 66.3 20" fill="#ADADAD" fillRule="nonzero"/>
              <path d="M73.06,6.78 C73.06,5.74 72.2,4.88 71.16,4.88 C70.12,4.88 69.26,5.74 69.26,6.78 C69.26,7.82 70.12,8.68 71.16,8.68 C72.2,8.68 73.06,7.82 73.06,6.78 Z M72.22,9.66 L69.1,9.66 L67.04,20 L70.16,20 L72.22,9.66 Z" fill="#ADADAD" fillRule="nonzero"/>
              <path d="M78.52,9.66 L76.92,9.66 L77.54,6.58 L74.42,6.58 L73.8,9.66 L72.86,9.66 L72.38,12.08 L73.32,12.08 L72.42,16.62 C72.38,16.82 72.34,17.1 72.34,17.5 C72.34,18.9 73.36,20 75.14,20 L76.6,20 L77.12,17.38 L76.14,17.38 C75.76,17.38 75.52,17.24 75.52,16.88 C75.52,16.86 75.52,16.72 75.54,16.64 L76.44,12.08 L78.04,12.08 L78.52,9.66 Z" fill="#ADADAD" fillRule="nonzero"/>
              <path d="M87.46,13.04 C87.46,10.56 85.72,9.12 83.44,9.12 C79.8,9.12 77.9,12.48 77.9,16.3 C77.9,19.32 80.32,20.12 82.06,20.12 C83.64,20.12 85.22,19.58 86.3,18.54 L84.74,16.5 C84.08,17.14 83.34,17.5 82.44,17.5 C81.38,17.5 80.86,16.92 80.86,16.06 C80.86,15.92 80.88,15.82 80.9,15.62 L87.1,15.62 C87.3,14.78 87.46,13.86 87.46,13.04 Z M84.5,13.04 C84.5,13.16 84.48,13.4 84.44,13.56 L81.3,13.56 C81.7,12.18 82.44,11.68 83.26,11.68 C84.08,11.68 84.5,12.22 84.5,13.04 Z" fill="#ADADAD" fillRule="nonzero"/>
            </g>
          )}
        </svg>
        {/* theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="ml-[16px] flex h-6 w-6 shrink-0 items-center justify-center"
            aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--u-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sun-icon lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--u-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-moon-icon lucide-moon"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
            )}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setShowSettings(true)}
            className="ml-[16px] flex h-6 w-6 shrink-0 items-center justify-center"
            aria-label="设置"
          >
            <IconSetting />
          </button>
        )}
        {process.env.NODE_ENV === 'development' && (
          <span className="ml-[12px] flex shrink-0 items-center rounded-[4px] bg-brand-light px-[3px]" style={{ height: 18 }}>
            <span className="text-[12px]" style={{ fontFamily: 'monospace', color: 'var(--color-brand-dark)' }}>
              dev {process.env.NEXT_PUBLIC_APP_VERSION}-{process.env.NEXT_PUBLIC_GIT_COMMIT}
            </span>
          </span>
        )}
      </div>

      {/* center: search box */}
      <div className="absolute left-1/2 top-[15px] -translate-x-1/2">
        <div
          className="relative flex h-[42px] w-[459px] items-center rounded-[8px] bg-bg-panel"
          style={{ border: `1px solid ${borderColor}`, transition: 'border-color 0.15s' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* left search icon */}
          <span className="absolute left-[12px] top-[12px]" style={{ opacity: iconOpacity, transition: 'opacity 0.15s' }}>
            <IconSearch />
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="搜你想搜"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="h-full w-full bg-transparent pl-[38px] pr-[40px] text-[16px] leading-[22px] text-text-primary outline-none placeholder:text-text-primary/20 font-alibaba"
            style={{ fontWeight: 900, letterSpacing: '-1px' }}
          />
          {/* right clear icon (input state only) */}
          {hasValue && (
            <button
              className="absolute right-[9px] top-[12px] flex h-[18px] w-[18px] items-center justify-center"
              onClick={() => { onSearchChange(''); inputRef.current?.focus() }}
              aria-label="清除"
            >
              <IconClear />
            </button>
          )}
        </div>
      </div>

      {/* right: user */}
      <div className="ml-auto" style={{ marginRight: 24 }}>
        <button
          className="inline-flex items-center"
          onClick={() => setShowUserMenu((v) => !v)}
          aria-label="用户菜单"
          ref={userMenuRef}
        >
          <span
            className="text-[16px] leading-[22px]"
            style={{ fontWeight: 800, letterSpacing: '-1px', textAlign: 'right', color: 'var(--u-text-muted)' }}
          >
            Hi, {session?.user?.name}
          </span>
          <span className="ml-[8px]">
            <IconUser />
          </span>
        </button>

        {showUserMenu && (
          <div className="absolute right-6 top-[58px] z-40 w-[140px] rounded-[10px] border border-border-default bg-bg-panel py-1" style={{ boxShadow: 'var(--u-shadow-panel)' }}>
            <button
              className="block h-10 w-full px-4 text-left text-sm font-bold hover:bg-bg-hover"
              style={{ color: 'var(--u-text-primary)' }}
              onClick={() => {
                setShowUserMenu(false)
                setShowAccountSettings(true)
              }}
            >
              账户设置
            </button>
            <button
              className="block h-10 w-full px-4 text-left text-sm font-bold hover:bg-bg-hover"
              style={{ color: 'var(--u-text-primary)' }}
              onClick={handleSignOut}
            >
              退出
            </button>
          </div>
        )}
      </div>

      {showSettings && <AdminSettingsModal onClose={() => setShowSettings(false)} />}
      {showAccountSettings && (
        <AccountSettingsModal
          initialName={session?.user?.name || ''}
          onClose={() => setShowAccountSettings(false)}
          onUpdated={handleAccountUpdated}
        />
      )}
    </header>
  )
}

'use client'
import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import AdminSettingsModal from './AdminSettingsModal'

/* ---------- inline SVG icons (from Sketch export, display-p3 → standard) ---------- */

function IconSetting() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="translate(2,2)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="8.27" x2="5" y2="1.34" />
        <line x1="9" y1="11.73" x2="5" y2="18.66" />
        <line x1="10" y1="20" x2="10" y2="18" />
        <line x1="10" y1="0" x2="10" y2="2" />
        <line x1="12" y1="10" x2="20" y2="10" />
        <line x1="15" y1="18.66" x2="14" y2="16.93" />
        <line x1="15" y1="1.34" x2="14" y2="3.07" />
        <line x1="0" y1="10" x2="2" y2="10" />
        <line x1="18.66" y1="15" x2="16.93" y2="14" />
        <line x1="18.66" y1="5" x2="16.93" y2="6" />
        <line x1="1.34" y1="15" x2="3.07" y2="14" />
        <line x1="1.34" y1="5" x2="3.07" y2="6" />
        <circle cx="10" cy="10" r="2" />
        <circle cx="10" cy="10" r="8" />
      </g>
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
              <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>姓名</div>
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
              <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>当前密码</div>
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
              <div className="mb-[6px] pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>新密码</div>
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
                <div className="pl-[11px] text-[14px] leading-[20px] text-black" style={{ fontWeight: 500 }}>主要管线</div>
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
                <div className="absolute z-20 overflow-hidden rounded-[8px] bg-bg-panel shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ width: 144, right: 0, border: '1px solid var(--color-brand)', marginTop: 4 }}>
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
  const userMenuRef = useRef<HTMLDivElement>(null)
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

      {/* left: logo + title + settings */}
      <div className="flex items-center" style={{ marginLeft: 33.5 }}>
        <Image src="/logo.png" alt="logo" width={26} height={26} className="shrink-0" />
        <img src="/U-Plus Lite.svg" alt="U-Plus Lite" className="ml-[6px] shrink-0" style={{ height: 24 }} />
        {isAdmin && (
          <button
            onClick={() => setShowSettings(true)}
            className="ml-[17px] flex h-6 w-6 shrink-0 items-center justify-center"
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

      {/* theme toggle */}
      {mounted && (
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="ml-auto mr-4 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-bg-hover"
          aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
        >
          {theme === 'dark' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      )}

      {/* right: user */}
      <div className="ml-auto" style={{ marginRight: 24 }} ref={userMenuRef}>
        <button
          className="flex items-center"
          onClick={() => setShowUserMenu((v) => !v)}
          aria-label="用户菜单"
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
          <div className="absolute right-6 top-[58px] z-40 w-[140px] rounded-[10px] border border-border-default bg-bg-panel py-1 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
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

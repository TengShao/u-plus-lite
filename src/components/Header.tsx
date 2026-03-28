'use client'
import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import AdminSettingsModal from './AdminSettingsModal'

/* ---------- inline SVG icons (from Sketch export, display-p3 → standard) ---------- */

function IconSetting() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="translate(2,2)" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <g transform="translate(2.25,2.25)" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="13.5" y1="13.5" x2="10.245" y2="10.245" />
        <circle cx="6" cy="6" r="6" />
      </g>
    </svg>
  )
}

function IconClear() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="#C8C8C8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
      <g stroke="#999" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.925,20.056 C17.461,17.143 14.949,14.999 11.999,14.999 C9.049,14.999 6.537,17.144 6.074,20.057" />
        <circle cx="12" cy="11" r="4" />
        <circle cx="12" cy="12" r="10" />
      </g>
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
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-[420px] rounded-[12px] bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[18px] font-black text-black">账户设置</h3>
        <div className="mt-4 space-y-4">
          <label className="block">
            <div className="mb-1 text-sm font-bold text-[#666]">姓名</div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-[8px] border border-[#E5E5E5] px-3 text-sm outline-none focus:border-[#8ECA2E]"
              placeholder="请输入姓名"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-bold text-[#666]">当前密码</div>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10 w-full rounded-[8px] border border-[#E5E5E5] px-3 text-sm outline-none focus:border-[#8ECA2E]"
              placeholder="如需修改密码请填写"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-bold text-[#666]">新密码</div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 w-full rounded-[8px] border border-[#E5E5E5] px-3 text-sm outline-none focus:border-[#8ECA2E]"
              placeholder="不少于8位"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-bold text-[#666]">确认新密码</div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 w-full rounded-[8px] border border-[#E5E5E5] px-3 text-sm outline-none focus:border-[#8ECA2E]"
              placeholder="再次输入新密码"
            />
          </label>

          <p className="text-xs text-[#999]">修改姓名会影响你的登录名。</p>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-[#2D9F45]">{success}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-[8px] px-4 text-sm text-[#666] hover:bg-[#F5F5F5]"
            disabled={isSaving}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="h-9 rounded-[8px] bg-black px-4 text-sm font-bold text-white hover:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
            disabled={isSaving}
          >
            保存
          </button>
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
  const [showSettings, setShowSettings] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const isAdmin = session?.user?.role === 'ADMIN'

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
    await signOut({ callbackUrl: '/login' })
  }

  const hasValue = searchQuery.length > 0
  // border color: focused/hasValue → green, hovered → green, default → #F3F3F3
  const borderColor = isFocused || hasValue ? '#8ECA2E' : isHovered ? '#8ECA2E' : '#F3F3F3'
  // icon/placeholder opacity: focused/hasValue → 1 : 0.2
  const iconOpacity = isFocused || hasValue ? 1 : 0.2

  return (
    <header
      className="relative flex h-[71px] shrink-0 items-center"
      style={{ fontFamily: 'Alibaba PuHuiTi 2.0' }}
    >
      {/* bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[#0000000B]" />

      {/* left: logo + title + settings */}
      <div className="flex items-center" style={{ marginLeft: 33.5 }}>
        <Image src="/logo.png" alt="logo" width={26} height={26} className="shrink-0" />
        <span
          className="ml-[6.5px] text-[20px] leading-[28px] text-black"
          style={{ fontWeight: 900, letterSpacing: '-1.3px' }}
        >
          结了吗你
        </span>
        {isAdmin && (
          <button
            onClick={() => setShowSettings(true)}
            className="ml-[17px] flex h-6 w-6 shrink-0 items-center justify-center"
            aria-label="设置"
          >
            <IconSetting />
          </button>
        )}
      </div>

      {/* center: search box */}
      <div className="absolute left-1/2 top-[15px] -translate-x-1/2">
        <div
          className="relative flex h-[42px] w-[459px] items-center rounded-[8px] bg-white"
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
            className="h-full w-full bg-transparent pl-[38px] pr-[40px] text-[16px] leading-[22px] text-black outline-none placeholder:text-black/20"
            style={{ fontFamily: 'Alibaba PuHuiTi 2.0', fontWeight: 900, letterSpacing: '-1px' }}
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
      <div className="ml-auto" style={{ marginRight: 24 }} ref={userMenuRef}>
        <button
          className="flex items-center"
          onClick={() => setShowUserMenu((v) => !v)}
          aria-label="用户菜单"
        >
          <span
            className="text-[16px] leading-[22px] text-[#999999]"
            style={{ fontWeight: 800, letterSpacing: '-1px', textAlign: 'right' }}
          >
            Hi, {session?.user?.name}
          </span>
          <span className="ml-[8px]">
            <IconUser />
          </span>
        </button>

        {showUserMenu && (
          <div className="absolute right-6 top-[58px] z-40 w-[140px] rounded-[10px] border border-[#ECECEC] bg-white py-1 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
            <button
              className="block h-10 w-full px-4 text-left text-sm font-bold text-black hover:bg-[#F5F5F5]"
              onClick={() => {
                setShowUserMenu(false)
                setShowAccountSettings(true)
              }}
            >
              账户设置
            </button>
            <button
              className="block h-10 w-full px-4 text-left text-sm font-bold text-black hover:bg-[#F5F5F5]"
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

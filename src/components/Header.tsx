'use client'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import AdminSettingsModal from './AdminSettingsModal'

export default function Header({
  searchQuery,
  onSearchChange,
}: {
  searchQuery: string
  onSearchChange: (q: string) => void
}) {
  const { data: session } = useSession()
  const [showSettings, setShowSettings] = useState(false)
  const isAdmin = session?.user?.role === 'ADMIN'

  return (
    <header className="flex h-[71px] shrink-0 items-center border-b bg-white px-4">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold">结了吗你</span>
        {isAdmin && (
          <button
            onClick={() => setShowSettings(true)}
            className="ml-2 rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            设置
          </button>
        )}
      </div>
      <div className="mx-auto w-80">
        <input
          type="text"
          placeholder="搜索需求组、设计师..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-600">{session?.user?.name}</span>
        <button onClick={() => signOut()} className="text-gray-400 hover:text-gray-600">
          退出
        </button>
      </div>
      {showSettings && <AdminSettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  )
}

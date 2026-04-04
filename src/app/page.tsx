'use client'
import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback, useRef } from 'react'
import AuthModal from '@/components/AuthModal'
import Header from '@/components/Header'
import CycleSidebar from '@/components/CycleSidebar'
import RequirementPanel from '@/components/RequirementPanel'

export default function Home() {
  const { data: session, status } = useSession()
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isClient, setIsClient] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const previousUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Clear all draft sessionStorage when user changes (login/logout/switch)
  useEffect(() => {
    if (status !== 'authenticated') return
    const currentUserId = session?.user?.id
    const previousUserId = previousUserIdRef.current
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      // User changed — clear all draft sessionStorage
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('draft_')) {
          sessionStorage.removeItem(key)
        }
      })
    }
    previousUserIdRef.current = currentUserId
  }, [session?.user?.id, status])

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

  function handleAuthSuccess() {
    // Session will update automatically via NextAuth
    // page will re-render and show main content
  }

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // During SSR, show nothing
  if (!isClient) {
    return null
  }

  // Show loading only on client while session is being fetched
  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-gray-400">加载中...</div>
  }

  // If no session after loading, show auth modal
  if (!session) {
    return (
      <AuthModal
        mode={authMode}
        onSwitch={setAuthMode}
        onSuccess={handleAuthSuccess}
      />
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--u-bg-page)] text-[var(--u-text-primary)]">
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <main className="flex min-h-0 flex-1 overflow-hidden">
          <CycleSidebar
            selectedCycleId={selectedCycleId}
            onSelectCycle={setSelectedCycleId}
            onCycleCreated={refresh}
            refreshKey={refreshKey}
            hasDraft={hasDraft}
          />
          <RequirementPanel
            cycleId={selectedCycleId}
            searchQuery={searchQuery}
            refreshKey={refreshKey}
            onRefresh={refresh}
            onDraftChange={setHasDraft}
          />
      </main>
    </div>
  )
}

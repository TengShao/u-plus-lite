'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Header from '@/components/Header'
import CycleSidebar from '@/components/CycleSidebar'
import RequirementPanel from '@/components/RequirementPanel'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isClient, setIsClient] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    // Redirect if unauthenticated after session is determined
    if (isClient && status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router, isClient])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // During SSR, show nothing
  if (!isClient) {
    return null
  }

  // Show loading only on client while session is being fetched
  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-gray-400">加载中...</div>
  }

  // If no session after loading, don't render (redirect will happen)
  if (!session) {
    return null
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
            userPrimaryPipeline={session.user.primaryPipeline}
          />
      </main>
    </div>
  )
}

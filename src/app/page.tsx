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

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center">加载中...</div>
  }
  if (!session) return null

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <div className="flex flex-1 overflow-hidden">
        <CycleSidebar
          selectedCycleId={selectedCycleId}
          onSelectCycle={setSelectedCycleId}
          onCycleCreated={refresh}
          refreshKey={refreshKey}
        />
        <RequirementPanel
          cycleId={selectedCycleId}
          searchQuery={searchQuery}
          refreshKey={refreshKey}
          onRefresh={refresh}
        />
      </div>
    </div>
  )
}

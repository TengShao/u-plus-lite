'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import FilterBar from './FilterBar'
import RequirementCardCollapsed from './RequirementCardCollapsed'
import RequirementCardExpanded from './RequirementCardExpanded'
import ConfirmDialog from './ConfirmDialog'

export type PipelineSettingData = {
  id: number; name: string; budgetItems: { id: number; name: string }[]
}

type WorkloadEntry = {
  id: number; userId: number; userName: string; userLevel: string | null; manDays: number; convertedManDays: number
}
export type RequirementData = {
  id: number; name: string; status: string; rating: string | null; module: string | null
  pipeline: string | null; types: string[]; budgetItem: string | null; canClose: boolean
  isBuilt: boolean; funcPoints: number | null; pageCount: number | null; version: number
  createdInCycleId: number; createdBy: number; lastSubmittedAt: string | null
  totalManDays: number; totalConvertedManDays: number; participantCount: number
  inputRatio: number; healthStatus: string | null; recommendedRating: string
  funcPointsRecommended: number; cycleWorkloads: WorkloadEntry[]
  creator: { id: number; name: string }
}

export default function RequirementPanel({
  cycleId,
  searchQuery,
  refreshKey,
  onRefresh,
}: {
  cycleId: number | null
  searchQuery: string
  refreshKey: number
  onRefresh: () => void
}) {
  const { data: session } = useSession()
  const [requirements, setRequirements] = useState<RequirementData[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [pendingExpandId, setPendingExpandId] = useState<number | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showCloseCycleConfirm, setShowCloseCycleConfirm] = useState(false)
  const [showDraftExistsConfirm, setShowDraftExistsConfirm] = useState(false)
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null)
  const [cycle, setCycle] = useState<{ id: number; status: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [isScrolled, setIsScrolled] = useState(false)
  const [isScrollbarVisible, setIsScrollbarVisible] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollbarTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [pipelineSettings, setPipelineSettings] = useState<PipelineSettingData[]>([])
  const [fadeInKey, setFadeInKey] = useState(0)
  const isAdmin = session?.user?.role === 'ADMIN'

  // Trigger staggered fade-in animation when new cycle's requirements load
  useEffect(() => {
    if (requirements.length > 0) {
      setFadeInKey((k) => k + 1)
    }
  }, [cycleId]) // only fire on actual cycle switch (not refresh)

  useEffect(() => {
    if (!cycleId) return
    fetch(`/api/cycles/${cycleId}/requirements`)
      .then((r) => r.json())
      .then(setRequirements)
    fetch('/api/cycles')
      .then((r) => r.json())
      .then((cycles: any[]) => {
        const c = cycles.find((c) => c.id === cycleId)
        if (c) setCycle(c)
      })
  }, [cycleId, refreshKey])

  // Reset scroll position when cycleId changes
  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollTop = 0
    }
  }, [cycleId])

  // Track scroll position to show/hide shadow on operation area and scrollbar
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      console.log('RequirementPanel: scrollContainerRef is null')
      return
    }

    console.log('RequirementPanel: attaching scroll listener, height:', container.clientHeight, 'scrollHeight:', container.scrollHeight)

    const handleScroll = () => {
      setIsScrolled(container.scrollTop > 0)
      setIsScrollbarVisible(true)

      if (scrollbarTimeoutRef.current) {
        clearTimeout(scrollbarTimeoutRef.current)
      }

      scrollbarTimeoutRef.current = setTimeout(() => {
        setIsScrollbarVisible(false)
      }, 1000)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollbarTimeoutRef.current) {
        clearTimeout(scrollbarTimeoutRef.current)
      }
    }
  }, [requirements]) // Re-attach when requirements change (when content updates)

  // Frontend search filter
  const filtered = useMemo(() => {
    let result = requirements
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cycleWorkloads.some((w) => w.userName.toLowerCase().includes(q))
      )
    }
    // Apply dropdown filters
    if (filters.pipeline?.length) {
      result = result.filter((r) => r.pipeline && filters.pipeline.includes(r.pipeline))
    }
    if (filters.rating?.length) {
      result = result.filter((r) => r.rating && filters.rating.includes(r.rating))
    }
    if (filters.health?.length) {
      result = result.filter((r) => r.healthStatus && filters.health.includes(r.healthStatus))
    }
    if (filters.designer?.length) {
      const ids = filters.designer.map(Number)
      result = result.filter((r) => r.cycleWorkloads.some((w) => ids.includes(w.userId)))
    }
    if (filters.canClose?.length) {
      const val = filters.canClose[0]
      if (val === 'true') result = result.filter((r) => r.canClose)
      if (val === 'false') result = result.filter((r) => !r.canClose)
    }
    if (filters.status?.length) {
      const val = filters.status[0]
      if (val === 'INCOMPLETE') result = result.filter((r) => r.status === 'INCOMPLETE')
      if (val === 'COMPLETE') result = result.filter((r) => r.status === 'COMPLETE')
    }
    // Sort: INCOMPLETE first, COMPLETE last
    result = [...result].sort((a, b) => {
      if (a.status === b.status) return 0
      return a.status === 'INCOMPLETE' ? -1 : 1
    })
    return result
  }, [requirements, searchQuery, filters])

  function handleExpand(id: number) {
    if (expandedId && hasUnsaved) {
      setPendingExpandId(id)
      setShowDiscardConfirm(true)
      return
    }
    setExpandedId(id)
    setHasUnsaved(false)
    // Only scroll if expanded card won't be fully visible
    setTimeout(() => {
      const container = scrollContainerRef.current
      if (!container) return
      const card = container.querySelector(`[data-req-id="${id}"]`) as HTMLElement
      if (!card) return
      const containerRect = container.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      // Check if card is not fully visible (top cut off or bottom cut off)
      if (cardRect.top < containerRect.top || cardRect.bottom > containerRect.bottom) {
        const scrollTop = container.scrollTop
        const targetScroll = scrollTop + cardRect.top - containerRect.top - 30
        container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
      }
    }, 0)
  }

  function handleCollapse() {
    setExpandedId(null)
    setHasUnsaved(false)
  }

  async function handleToggleCycle() {
    if (!cycle) return
    if (cycle.status === 'OPEN') {
      setShowCloseCycleConfirm(true)
      return
    }
    await doToggleCycle()
  }

  async function doToggleCycle() {
    if (!cycle) return
    const newStatus = cycle.status === 'OPEN' ? 'CLOSED' : 'OPEN'
    await fetch(`/api/cycles/${cycle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    onRefresh()
  }

  async function handleCreateRequirement() {
    if (!cycleId) return

    if (activeDraftId) {
      setShowDraftExistsConfirm(true)
      return
    }

    const res = await fetch('/api/requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId }),
    })
    if (res.ok) {
      const rg = await res.json()
      onRefresh()
      setExpandedId(rg.id)
      setActiveDraftId(rg.id)
      // Scroll to top to show the new requirement
      setTimeout(() => {
        const container = scrollContainerRef.current
        if (container) container.scrollTop = 0
      }, 0)
    }
  }

  function handleViewDraft() {
    if (!activeDraftId) {
      setShowDraftExistsConfirm(false)
      return
    }
    setExpandedId(activeDraftId)
    setHasUnsaved(false)
    setTimeout(() => {
      const container = scrollContainerRef.current
      if (!container) return
      const card = container.querySelector(`[data-req-id="${activeDraftId}"]`) as HTMLElement
      if (!card) return
      const containerRect = container.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      const scrollTop = container.scrollTop
      const targetScroll = scrollTop + cardRect.top - containerRect.top - 30
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
    }, 0)
    setShowDraftExistsConfirm(false)
  }

  function handleDraftResolved(id: number) {
    if (activeDraftId === id) setActiveDraftId(null)
  }

  // All designers in current cycle for filter
  const designers = useMemo(() => {
    const map = new Map<number, string>()
    requirements.forEach((r) =>
      r.cycleWorkloads.forEach((w) => map.set(w.userId, w.userName))
    )
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [requirements])

  if (!cycleId) {
    return (
      <div className="flex flex-1 items-center justify-center" style={{ color: '#C3C3C3' }}>
        请选择或新建一个月结周期
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`relative h-[60px] bg-[#F9F9F9] z-20 ${isScrolled ? ''/* 'after:content-[""] after:absolute after:-bottom-[12px] after:left-0 after:right-0 after:h-[12px] after:bg-gradient-to-b after:from-[rgba(0,0,0,0.08)] after:to-transparent' */ : ''}`}>
        <div className="h-full px-[20px]">
          <div className="mx-auto h-full w-full min-w-[1200px] max-w-[1200px] flex items-center" style={{ fontFamily: 'Alibaba PuHuiTi 2.0' }}>
          <div className="flex items-center">
            <FilterBar
              designers={designers}
              currentUserId={session?.user?.id ? parseInt(session.user.id) : 0}
              onFilterChange={setFilters}
              pipelineNames={pipelineSettings.map((p) => p.name)}
            />
          </div>
          <div className="ml-auto flex gap-[10px]">
            {isAdmin && cycle?.status === 'OPEN' && (
              <button
                onClick={handleToggleCycle}
                className="h-[46px] w-[159px] rounded-[12px] bg-[#F2F2F2] text-[18px] leading-[25px] text-black transition-shadow hover:shadow-[0_0_8px_0_rgba(0,0,0,0.25)] active:bg-[#D7D7D7] disabled:bg-[#B6B6B6] disabled:text-white/50"
                style={{ fontWeight: 900 }}
              >
                关闭月结
              </button>
            )}
            {isAdmin && cycle?.status === 'CLOSED' && (
              <button
                onClick={handleToggleCycle}
                className="h-[46px] w-[159px] rounded-[12px] bg-[#F2F2F2] text-[18px] leading-[25px] text-black transition-shadow hover:shadow-[0_0_8px_0_rgba(0,0,0,0.25)] active:bg-[#D7D7D7]"
                style={{ fontWeight: 900 }}
              >
                开启月结
              </button>
            )}
            <button
              onClick={handleCreateRequirement}
              disabled={!cycleId || cycle?.status === 'CLOSED'}
              className="flex h-[46px] w-[159px] items-center justify-center rounded-[12px] bg-[#000000] text-[18px] leading-[25px] text-white transition-shadow hover:shadow-[0_0_8px_0_rgba(0,0,0,0.25)] active:bg-[#3A3A3A] disabled:bg-[#B6B6B6] disabled:text-white/50"
              style={{ fontWeight: 900 }}
            >
              <span className="inline-flex items-center gap-[10px]" style={!cycleId || cycle?.status === 'CLOSED' ? { opacity: 0.5 } : undefined}>
                新建
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="2" width="8" height="4" rx="1" />
                    <path d="M16,4 L18,4 C19.1,4 20,4.9 20,6 L20,20 C20,21.1 19.1,22 18,22 L6,22 C4.9,22 4,21.1 4,20 L4,6 C4,4.9 4.9,4 6,4 L8,4" />
                    <polyline points="9 14 11 16 15 12" />
                  </g>
                </svg>
              </span>
            </button>
          </div>
        </div>
        </div>
      </div>
      <div ref={scrollContainerRef} className={`auto-hide-scrollbar min-h-0 flex-1 overflow-y-auto px-[20px] py-[16px] ${isScrollbarVisible ? 'scrollbar-visible' : 'scrollbar-hidden'}`}>
        {filtered.length === 0 ? (
          <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-center" style={{ color: '#C3C3C3' }}>暂无需求组</div>
        ) : (
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[20px]">
            {filtered.map((rg, i) =>
              <div
                key={`${fadeInKey}-${rg.id}`}
                style={{
                  animation: `reqFadeIn 100ms ease-out forwards`,
                  animationDelay: `${i * 50}ms`,
                  opacity: 0,
                }}
              >
              {expandedId === rg.id ? (
                <RequirementCardExpanded
                  data={rg}
                  cycleId={cycleId}
                  cycleStatus={cycle?.status || 'OPEN'}
                  onCollapse={handleCollapse}
                  onRefresh={onRefresh}
                  onDirtyChange={setHasUnsaved}
                  allRequirements={requirements}
                  onExpandById={(id) => { setHasUnsaved(false); setExpandedId(id) }}
                  onDraftResolved={handleDraftResolved}
                  pipelineSettings={pipelineSettings}
                />
              ) : (
                <RequirementCardCollapsed
                  data={rg}
                  cycleStatus={cycle?.status || 'OPEN'}
                  onExpand={() => handleExpand(rg.id)}
                  onRefresh={onRefresh}
                />
              )}
              </div>
            )}
          </div>
        )}
      </div>
      {showDiscardConfirm && (
        <ConfirmDialog
          title="未保存的修改"
          message="有未保存的修改，是否放弃？"
          onConfirm={() => {
            setShowDiscardConfirm(false)
            setExpandedId(pendingExpandId)
            setHasUnsaved(false)
          }}
          onCancel={() => {
            setShowDiscardConfirm(false)
            setPendingExpandId(null)
          }}
        />
      )}
      {showDraftExistsConfirm && (
        <ConfirmDialog
          title="已有新建需求组"
          message="已有新建需求组，是否继续操作？"
          onConfirm={handleViewDraft}
          onCancel={() => setShowDraftExistsConfirm(false)}
          confirmText="查看"
          cancelText="取消"
          confirmClassName="bg-black text-white hover:bg-[#3A3A3A]"
        />
      )}
      {showCloseCycleConfirm && (
        <ConfirmDialog
          title="关闭月结"
          message="确定关闭当前月结周期？关闭后普通成员将无法编辑数据。"
          onConfirm={() => { setShowCloseCycleConfirm(false); doToggleCycle() }}
          onCancel={() => setShowCloseCycleConfirm(false)}
        />
      )}
    </div>
  )
}

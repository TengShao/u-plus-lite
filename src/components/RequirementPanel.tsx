'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import FilterBar from './FilterBar'
import RequirementCardCollapsed from './RequirementCardCollapsed'
import RequirementCardExpanded from './RequirementCardExpanded'
import ConfirmDialog from './ConfirmDialog'
import { useTips } from './Tips'

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
  onDraftChange,
  userPrimaryPipeline,
}: {
  cycleId: number | null
  searchQuery: string
  refreshKey: number
  onRefresh: () => void
  onDraftChange?: (hasDraft: boolean) => void
  userPrimaryPipeline?: string | null
}) {
  const { data: session } = useSession()
  const { showTips } = useTips()
  const [requirements, setRequirements] = useState<RequirementData[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [pendingExpandId, setPendingExpandId] = useState<number | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showDraftExistsConfirm, setShowDraftExistsConfirm] = useState(false)
  const [showSwitchCycleConfirm, setShowSwitchCycleConfirm] = useState(false)
  const [pendingCycleId, setPendingCycleId] = useState<number | null>(null)
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [pendingDiscardId, setPendingDiscardId] = useState<number | null>(null)
  const [pendingDuplicateId, setPendingDuplicateId] = useState<number | null>(null)
  const [pendingDuplicateName, setPendingDuplicateName] = useState<string>('')
  const [pendingCompleteId, setPendingCompleteId] = useState<number | null>(null)
  const [pendingReopenId, setPendingReopenId] = useState<number | null>(null)
  const [cycle, setCycle] = useState<{ id: number; status: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [isScrolled, setIsScrolled] = useState(false)
  const [isScrollbarVisible, setIsScrollbarVisible] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollbarTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const activeDraftIdRef = useRef<number | null>(null)
  const previousCycleIdRef = useRef<number | null>(null)
  // Track if we're in the process of deleting a draft (to prevent race conditions)
  const draftToDeleteRef = useRef<number | null>(null)

  // Persist activeDraftId in sessionStorage
  useEffect(() => {
    if (activeDraftId !== null && cycleId) {
      // Normal case: set the draft id
      sessionStorage.setItem(`draft_${cycleId}`, String(activeDraftId))
      draftToDeleteRef.current = null // Clear any pending deletion
    } else if (cycleId && draftToDeleteRef.current === null) {
      // activeDraftId is null - check if this is a page refresh (sessionStorage has a draft)
      // or a deliberate clear
      const saved = sessionStorage.getItem(`draft_${cycleId}`)
      if (saved) {
        // There's a saved draft but activeDraftId is null - this looks like a page refresh
        // Mark it for deletion instead of just clearing
        draftToDeleteRef.current = parseInt(saved)
        // Don't clear sessionStorage yet - let loadRequirements handle the deletion
      } else {
        sessionStorage.removeItem(`draft_${cycleId}`)
      }
    }
    activeDraftIdRef.current = activeDraftId
  }, [activeDraftId, cycleId])

  // Restore activeDraftId from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(`draft_${cycleId}`)
    if (!saved) return

    const draftId = parseInt(saved)
    // Delay check until requirements are loaded
    const checkInterval = setInterval(() => {
      setRequirements((prevReqs) => {
        if (prevReqs.length > 0) {
          clearInterval(checkInterval)
          const draft = prevReqs.find((r) => r.id === draftId)
          if (draft) {
            // If the draft was never submitted (lastSubmittedAt is null), delete it and remove from list
            if (draft.lastSubmittedAt === null) {
              fetch(`/api/requirements/${draftId}`, { method: 'DELETE' })
              sessionStorage.removeItem(`draft_${cycleId}`)
              // Remove from local state immediately
              return prevReqs.filter((r) => r.id !== draftId)
            } else {
              setActiveDraftId(draftId)
            }
          } else {
            sessionStorage.removeItem(`draft_${cycleId}`)
          }
        }
        return prevReqs
      })
    }, 100)

    return () => clearInterval(checkInterval)
  }, [cycleId])
  const [pipelineSettings, setPipelineSettings] = useState<PipelineSettingData[]>([])
  const [fadeInKey, setFadeInKey] = useState(0)
  const isAdmin = session?.user?.role === 'ADMIN'

  // Trigger staggered fade-in animation when new cycle's requirements load
  useEffect(() => {
    if (requirements.length > 0) {
      setFadeInKey((k) => k + 1)
    }
    // Only delete draft when actually SWITCHING cycles (not on initial mount)
    if (previousCycleIdRef.current !== null && previousCycleIdRef.current !== cycleId) {
      const draftIdToDelete = activeDraftIdRef.current
      if (draftIdToDelete !== null) {
        fetch(`/api/requirements/${draftIdToDelete}`, { method: 'DELETE' }).then(() => onRefresh())
        sessionStorage.removeItem(`draft_${previousCycleIdRef.current}`)
      }
      setActiveDraftId(null)
      setExpandedId(null)
    }
    previousCycleIdRef.current = cycleId
  }, [cycleId]) // only fire on actual cycle switch (not refresh)

  useEffect(() => {
    if (!cycleId) return

    async function loadRequirements() {
      try {
        const res = await fetch(`/api/cycles/${cycleId}/requirements`)
        const data = await res.json()

        // Check if there's an unsubmitted draft in sessionStorage
        // If activeDraftIdRef.current is not null, it means a draft was just created (handleCreateRequirement was called)
        // In that case, don't delete it - just restore activeDraftId from sessionStorage
        const saved = sessionStorage.getItem(`draft_${cycleId}`)
        if (saved && activeDraftIdRef.current === null) {
          const draftId = parseInt(saved)
          const draft = data.find((r: RequirementData) => r.id === draftId)
          if (draft && draft.lastSubmittedAt === null) {
            // Found an unsubmitted draft from a previous session
            // Mark it for deletion so persist effect knows not to clear sessionStorage prematurely
            draftToDeleteRef.current = draftId
            // Update local state to remove the draft immediately
            setActiveDraftId(null)
            setRequirements(data.filter((r: RequirementData) => r.id !== draftId))
            // DELETE request to clean up server-side
            fetch(`/api/requirements/${draftId}`, { method: 'DELETE' })
              .then(() => {
                draftToDeleteRef.current = null
                sessionStorage.removeItem(`draft_${cycleId}`)
              })
            return
          }
        }

        // If draftToDeleteRef is set, we're deleting a draft - skip it from the list
        if (draftToDeleteRef.current !== null) {
          const filteredData = data.filter((r: RequirementData) => r.id !== draftToDeleteRef.current)
          setRequirements(filteredData)
          return
        }

        setRequirements(data)
        // Restore activeDraftId from sessionStorage if exists
        if (activeDraftId === null) {
          const saved = sessionStorage.getItem(`draft_${cycleId}`)
          if (saved) {
            const draftId = parseInt(saved)
            if (data.some((r: RequirementData) => r.id === draftId)) {
              setActiveDraftId(draftId)
            } else {
              sessionStorage.removeItem(`draft_${cycleId}`)
            }
          }
        } else {
          // Clear activeDraftId if it's no longer in the list
          if (!data.some((r: RequirementData) => r.id === activeDraftId)) {
            setActiveDraftId(null)
          }
        }
      } catch (err) {
        console.error('Failed to load requirements:', err)
      }
    }

    loadRequirements()

    fetch('/api/cycles')
      .then((r) => r.json())
      .then((cycles: any[]) => {
        const c = cycles.find((c) => c.id === cycleId)
        if (c) setCycle(c)
      })
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setPipelineSettings)
  }, [cycleId, refreshKey])

  // Notify parent when draft status changes
  useEffect(() => {
    onDraftChange?.(activeDraftId !== null)
    activeDraftIdRef.current = activeDraftId
  }, [activeDraftId, onDraftChange])

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
    // If clicking on a different card that has an unsubmitted draft, show confirmation
    if (expandedId && id !== expandedId && (hasUnsaved || expandedId === activeDraftId)) {
      setPendingExpandId(id)
      setShowDiscardConfirm(true)
      return
    }
    // If clicking on a collapsed card while a draft exists (different from the one being clicked), show confirmation
    if (activeDraftId && id !== activeDraftId) {
      const savedDraft = sessionStorage.getItem(`draft_${cycleId}`)
      if (savedDraft === String(activeDraftId)) {
        setPendingExpandId(id)
        setShowDiscardConfirm(true)
        return
      }
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

  async function handleCreateRequirement() {
    if (!cycleId) return
    if (cycle?.status === 'CLOSED') {
      showTips('negative', '当前月结已关闭，无法新建需求组')
      return
    }

    // If there's an unsubmitted draft (in sessionStorage), show confirmation instead of deleting
    const savedDraft = sessionStorage.getItem(`draft_${cycleId}`)
    if (activeDraftId && savedDraft === String(activeDraftId)) {
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
      // Update activeDraftIdRef BEFORE calling onRefresh to prevent loadRequirements from deleting the draft
      activeDraftIdRef.current = rg.id
      setExpandedId(rg.id)
      setActiveDraftId(rg.id)
      // Now call onRefresh - loadRequirements will see activeDraftIdRef.current is non-null and won't delete
      onRefresh()
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
    if (activeDraftId === id) {
      setActiveDraftId(null)
      sessionStorage.removeItem(`draft_${cycleId}`)
    }
  }

  // All designers in current cycle for filter
  const designers = useMemo(() => {
    const map = new Map<number, string>()
    requirements.forEach((r) =>
      r.cycleWorkloads.forEach((w) => map.set(w.userId, w.userName))
    )
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [requirements])

  // Filter counts
  const filterCounts = useMemo(() => {
    const pipeline: Record<string, number> = {}
    const rating: Record<string, number> = {}
    const health: Record<string, number> = {}
    const designer: Record<string, number> = {}
    const canClose: Record<string, number> = {}
    const status: Record<string, number> = {}

    requirements.forEach((r) => {
      if (r.pipeline) pipeline[r.pipeline] = (pipeline[r.pipeline] || 0) + 1
      if (r.rating) rating[r.rating] = (rating[r.rating] || 0) + 1
      if (r.healthStatus) health[r.healthStatus] = (health[r.healthStatus] || 0) + 1
      r.cycleWorkloads.forEach((w) => {
        const key = String(w.userId)
        designer[key] = (designer[key] || 0) + 1
      })
      canClose[r.canClose ? 'true' : 'false'] = (canClose[r.canClose ? 'true' : 'false'] || 0) + 1
      status[r.status] = (status[r.status] || 0) + 1
    })

    return { pipeline, rating, health, designer, canClose, status }
  }, [requirements])

  async function handleDeleteRequest(id: number) {
    await fetch(`/api/requirements/${id}`, { method: 'DELETE' })
    setPendingDeleteId(null)
    onRefresh()
    setExpandedId(null)
  }

  async function handleDiscardRequest(id: number) {
    setPendingDiscardId(null)
    setExpandedId(null)
    setHasUnsaved(false)
    if (activeDraftId === id) {
      await fetch(`/api/requirements/${id}`, { method: 'DELETE' })
      setActiveDraftId(null)
      onRefresh()
    }
  }

  async function handleCompleteRequest(id: number) {
    setPendingCompleteId(id)
  }

  async function doCompleteRequest() {
    if (pendingCompleteId === null) return
    await fetch(`/api/requirements/${pendingCompleteId}/complete`, { method: 'PATCH' })
    setPendingCompleteId(null)
    onRefresh()
    setExpandedId(null)
  }

  async function handleReopenRequest(id: number) {
    setPendingReopenId(id)
  }

  async function doReopenRequest() {
    if (pendingReopenId === null) return
    await fetch(`/api/requirements/${pendingReopenId}/reopen`, { method: 'PATCH' })
    setPendingReopenId(null)
    onRefresh()
    setExpandedId(null)
  }

  async function handleViewDuplicate() {
    // Delete the draft before viewing the duplicate
    const savedDraft = sessionStorage.getItem(`draft_${cycleId}`)
    if (activeDraftId !== null && savedDraft === String(activeDraftId)) {
      await fetch(`/api/requirements/${activeDraftId}`, { method: 'DELETE' })
      setActiveDraftId(null)
      sessionStorage.removeItem(`draft_${cycleId}`)
    }
    if (pendingDuplicateId !== null) {
      setHasUnsaved(false)
      setExpandedId(pendingDuplicateId)
    }
    setPendingDuplicateId(null)
    setPendingDuplicateName('')
    onRefresh()
  }

  async function handleCancelDuplicate() {
    // Delete the draft when canceling
    const savedDraft = sessionStorage.getItem(`draft_${cycleId}`)
    if (activeDraftId !== null && savedDraft === String(activeDraftId)) {
      await fetch(`/api/requirements/${activeDraftId}`, { method: 'DELETE' })
      setActiveDraftId(null)
      sessionStorage.removeItem(`draft_${cycleId}`)
      onRefresh()
    }
    setPendingDuplicateId(null)
    setPendingDuplicateName('')
  }

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
          <div className="mx-auto h-full w-full min-w-[1100px] max-w-[1100px] flex items-center font-alibaba">
          <div className="flex items-center">
            <FilterBar
              designers={designers}
              currentUserId={session?.user?.id ? parseInt(session.user.id) : 0}
              onFilterChange={setFilters}
              pipelineNames={pipelineSettings.map((p) => p.name)}
              counts={filterCounts}
            />
          </div>
          <div className="ml-auto flex gap-[10px]">
            <button
              onClick={handleCreateRequirement}
              className={`flex h-[46px] w-[159px] items-center justify-center rounded-[12px] text-[18px] leading-[25px] text-white transition-transform ${
                !cycleId || cycle?.status === 'CLOSED'
                  ? 'bg-[#B6B6B6] cursor-not-allowed'
                  : 'bg-[#000000] active:bg-[#3A3A3A]'
              }`}
              style={{ fontWeight: 900, transform: 'scale(1)', transition: 'transform 0.15s' }}
              onMouseEnter={(e) => { if (!cycleId || cycle?.status === 'CLOSED') return; e.currentTarget.style.transform = 'scale(1.03)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              onMouseDown={(e) => { if (!cycleId || cycle?.status === 'CLOSED') return; e.currentTarget.style.transform = 'scale(1)' }}
              onMouseUp={(e) => { if (!cycleId || cycle?.status === 'CLOSED') return; e.currentTarget.style.transform = 'scale(1.03)' }}
            >
              <span className="inline-flex items-center gap-[10px]">
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
          <div className="mx-auto flex h-full w-full min-w-[1100px] max-w-[1100px] items-center justify-center" style={{ color: '#C3C3C3' }}>暂无需求组</div>
        ) : (
          <div className="mx-auto flex w-full min-w-[1100px] max-w-[1100px] flex-col gap-[20px]">
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
                  onDeleteRequest={(id) => setPendingDeleteId(id)}
                  onDiscardRequest={(id) => setPendingDiscardId(id)}
                  onDuplicateRequest={(id, name) => { setPendingDuplicateId(id); setPendingDuplicateName(name) }}
                  onCompleteRequest={handleCompleteRequest}
                  onReopenRequest={handleReopenRequest}
                  isDraft={rg.id === activeDraftId}
                  defaultPipeline={rg.id === activeDraftId ? userPrimaryPipeline : undefined}
                />
              ) : (
                <RequirementCardCollapsed
                  data={rg}
                  cycleStatus={cycle?.status || 'OPEN'}
                  onExpand={() => handleExpand(rg.id)}
                  onRefresh={onRefresh}
                  onDeleteRequest={(id) => setPendingDeleteId(id)}
                  onCompleteRequest={handleCompleteRequest}
                  onReopenRequest={handleReopenRequest}
                />
              )}
              </div>
            )}
          </div>
        )}
      </div>
      {showDiscardConfirm && (
        <ConfirmDialog
          title="放弃修改"
          message="有未保存的修改，是否放弃？"
          onConfirm={() => {
            const draftToDelete = expandedId === activeDraftId ? expandedId : null
            setShowDiscardConfirm(false)
            if (draftToDelete !== null) {
              fetch(`/api/requirements/${draftToDelete}`, { method: 'DELETE' }).then(() => onRefresh())
              setActiveDraftId(null)
            }
            setExpandedId(pendingExpandId ?? null)
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
        />
      )}
      {pendingDeleteId !== null && (
        <ConfirmDialog
          title="删除需求组"
          message="确定删除该需求组？此操作不可撤销。"
          onConfirm={() => handleDeleteRequest(pendingDeleteId)}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
      {pendingDiscardId !== null && (
        <ConfirmDialog
          title="放弃修改"
          message="有未保存的修改，是否放弃？"
          onConfirm={() => handleDiscardRequest(pendingDiscardId)}
          onCancel={() => setPendingDiscardId(null)}
        />
      )}
      {pendingDuplicateId !== null && (
        <ConfirmDialog
          title="同名需求组已存在"
          message={`同名需求组 "${pendingDuplicateName}" 已存在，点击查看`}
          onConfirm={handleViewDuplicate}
          onCancel={handleCancelDuplicate}
          confirmText="查看"
          cancelText="取消"
        />
      )}
      {pendingCompleteId !== null && (
        <ConfirmDialog
          title="完成需求组"
          message="确定标记该需求组为完成？"
          onConfirm={doCompleteRequest}
          onCancel={() => setPendingCompleteId(null)}
        />
      )}
      {pendingReopenId !== null && (
        <ConfirmDialog
          title="重启需求组"
          message="确定要重启该需求组吗？重启后该需求组将恢复为未完成状态。"
          onConfirm={doReopenRequest}
          onCancel={() => setPendingReopenId(null)}
          confirmText="重启"
        />
      )}
    </div>
  )
}

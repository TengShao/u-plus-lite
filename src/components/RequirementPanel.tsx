'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { RATINGS } from '@/lib/constants'
import FilterBar from './FilterBar'
import RequirementCardCollapsed from './RequirementCardCollapsed'
import RequirementCardExpanded from './RequirementCardExpanded'
import ConfirmDialog from './ConfirmDialog'
import ImportModal from './ImportModal'
import { useTips } from './Tips'
import { ActionIconButton } from './icons'

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
  lastSubmitterName?: string
  totalManDays: number; totalConvertedManDays: number; participantCount: number
  inputRatio: number; healthStatus: string | null; recommendedRating: string
  funcPointsRecommended: number; cycleWorkloads: WorkloadEntry[]
  creator: { id: number; name: string }
  isDraft: boolean
}

export default function RequirementPanel({
  cycleId,
  searchQuery,
  refreshKey,
  onRefresh,
  onDraftChange,
}: {
  cycleId: number | null
  searchQuery: string
  refreshKey: number
  onRefresh: () => void
  onDraftChange?: (hasDraft: boolean) => void
}) {
  const { data: session } = useSession()
  const { showTips } = useTips()
  const [requirements, setRequirements] = useState<RequirementData[]>([])
  const [expandedIds, setExpandedIds] = useState<number[]>([])
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [pendingExpandId, setPendingExpandId] = useState<number | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
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
  const [cyclePipelineMemory, setCyclePipelineMemory] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isScrollbarVisible, setIsScrollbarVisible] = useState(false)
  const [lastSubmittedId, setLastSubmittedId] = useState<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollbarTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const activeDraftIdRef = useRef<number | null>(null)
  const previousCycleIdRef = useRef<number | null>(null)
  // Track if we're in the process of deleting a draft (to prevent race conditions)
  const draftToDeleteRef = useRef<number | null>(null)

  // Restore last submitted requirement from localStorage
  useEffect(() => {
    if (!session?.user?.id) return
    const stored = localStorage.getItem(`lastSubmittedRequirement_${session.user.id}`)
    if (stored) setLastSubmittedId(parseInt(stored))
  }, [session?.user?.id])

  // Build user-scoped draft key to prevent cross-user sessionStorage collision
  const draftKey = session?.user?.id ? `draft_${session.user.id}_${cycleId}` : null
  // Key for persisting expanded draft IDs
  const draftExpansionKey = session?.user?.id ? `draftExpanded_${session.user.id}_${cycleId}` : null

  // Persist activeDraftId in sessionStorage
  useEffect(() => {
    if (activeDraftId !== null && cycleId && draftKey) {
      // Normal case: set the draft id
      sessionStorage.setItem(draftKey, String(activeDraftId))
      draftToDeleteRef.current = null // Clear any pending deletion
    } else if (cycleId && draftToDeleteRef.current === null && draftKey) {
      // activeDraftId is null - check if this is a page refresh (sessionStorage has a draft)
      // or a deliberate clear
      const saved = sessionStorage.getItem(draftKey)
      if (saved) {
        // There's a saved draft but activeDraftId is null - this looks like a page refresh
        // Mark it for deletion instead of just clearing
        draftToDeleteRef.current = parseInt(saved)
        // Don't clear sessionStorage yet - let loadRequirements handle the deletion
      } else {
        sessionStorage.removeItem(draftKey)
      }
    }
    activeDraftIdRef.current = activeDraftId
  }, [activeDraftId, cycleId, draftKey])

  // Restore activeDraftId from sessionStorage on mount
  useEffect(() => {
    if (!draftKey) return
    const saved = sessionStorage.getItem(draftKey)
    if (!saved) return

    const draftId = parseInt(saved)
    // Delay check until requirements are loaded
    const checkInterval = setInterval(() => {
      setRequirements((prevReqs) => {
        if (prevReqs.length > 0) {
          clearInterval(checkInterval)
          const draft = prevReqs.find((r) => r.id === draftId)
          if (draft) {
            // If it's not an LLM draft and was never submitted, it's a stale old draft - delete it
            if (draft.isDraft !== true && draft.lastSubmittedAt === null) {
              fetch(`/api/requirements/${draftId}`, { method: 'DELETE' })
              if (draftKey) sessionStorage.removeItem(draftKey)
              // Remove from local state immediately
              return prevReqs.filter((r) => r.id !== draftId)
            } else {
              setActiveDraftId(draftId)
            }
          } else {
            if (draftKey) sessionStorage.removeItem(draftKey)
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
        // Remove with the old user's key
        if (session?.user?.id) sessionStorage.removeItem(`draft_${session.user.id}_${previousCycleIdRef.current}`)
      }
      setActiveDraftId(null)
      setExpandedIds([])
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
        const saved = draftKey ? sessionStorage.getItem(draftKey) : null
        if (saved && activeDraftIdRef.current === null) {
          const draftId = parseInt(saved)
          const draft = data.find((r: RequirementData) => r.id === draftId)
          if (draft && (draft.name === '' || (draft.isDraft !== true && draft.lastSubmittedAt === null && draft.rating === null))) {
            // Found an unsubmitted draft from a previous session OR empty name draft
            // Mark it for deletion so persist effect knows not to clear sessionStorage prematurely
            draftToDeleteRef.current = draftId
            // Update local state to remove the draft immediately
            setActiveDraftId(null)
            setRequirements(data.filter((r: RequirementData) => r.id !== draftId))
            // DELETE request to clean up server-side
            fetch(`/api/requirements/${draftId}`, { method: 'DELETE' })
              .then(() => {
                draftToDeleteRef.current = null
                if (draftKey) sessionStorage.removeItem(draftKey)
              })
            return
          }
        }

        // If draftToDeleteRef is set, we're deleting a draft - skip it from the list
        // BUT first check if it's actually a valid draft that should be restored
        if (draftToDeleteRef.current !== null) {
          const draftId = draftToDeleteRef.current
          const draft = data.find((r: RequirementData) => r.id === draftId)
          if (draft && draft.isDraft === true) {
            // This is a valid draft - clear the delete flag and restore it
            draftToDeleteRef.current = null
            setActiveDraftId(draftId)
            setRequirements(data)
            // Restore expanded IDs
            if (draftExpansionKey) {
              const savedExpanded = sessionStorage.getItem(draftExpansionKey)
              if (savedExpanded) {
                try {
                  const draftExpandedIds: number[] = JSON.parse(savedExpanded)
                  const validDraftExpanded = draftExpandedIds.filter((id) =>
                    data.some((r: RequirementData) => r.id === id && r.isDraft)
                  )
                  if (validDraftExpanded.length > 0) {
                    setExpandedIds(validDraftExpanded)
                  }
                } catch {
                  sessionStorage.removeItem(draftExpansionKey)
                }
              }
            }
            return
          }
          // Not a valid draft (was deleted or something) - filter it out
          const filteredData = data.filter((r: RequirementData) => r.id !== draftToDeleteRef.current)
          setRequirements(filteredData)
          draftToDeleteRef.current = null
          return
        }

        setRequirements(data)
        // Restore activeDraftId from sessionStorage if exists
        if (activeDraftId === null) {
          const saved = draftKey ? sessionStorage.getItem(draftKey) : null
          if (saved) {
            const draftId = parseInt(saved)
            if (data.some((r: RequirementData) => r.id === draftId)) {
              setActiveDraftId(draftId)
            } else if (draftKey) {
              sessionStorage.removeItem(draftKey)
            }
          }
        } else {
          // Clear activeDraftId if it's no longer in the list
          if (!data.some((r: RequirementData) => r.id === activeDraftId)) {
            setActiveDraftId(null)
          }
        }
        // Restore draft expansion IDs from sessionStorage
        if (draftExpansionKey) {
          const savedExpanded = sessionStorage.getItem(draftExpansionKey)
          if (savedExpanded) {
            try {
              const draftExpandedIds: number[] = JSON.parse(savedExpanded)
              // Only restore IDs that are actually drafts and still exist
              const validDraftExpanded = draftExpandedIds.filter((id) =>
                data.some((r: RequirementData) => r.id === id && r.isDraft)
              )
              if (validDraftExpanded.length > 0) {
                setExpandedIds(validDraftExpanded)
                // Sync save to sessionStorage (effect won't trigger because expandedIds is still [] in this cycle)
                sessionStorage.setItem(draftExpansionKey, JSON.stringify(validDraftExpanded))
              } else {
                sessionStorage.removeItem(draftExpansionKey)
              }
            } catch {
              sessionStorage.removeItem(draftExpansionKey)
            }
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
    // Fetch per-cycle pipeline memory
    if (cycleId) {
      fetch(`/api/users/cycle-pipeline?cycleId=${cycleId}`)
        .then((r) => r.json())
        .then((data) => setCyclePipelineMemory(data.pipeline ?? null))
    }
  }, [cycleId, refreshKey])

  // Notify parent when draft status changes
  useEffect(() => {
    onDraftChange?.(activeDraftId !== null)
    activeDraftIdRef.current = activeDraftId
  }, [activeDraftId, onDraftChange])

  // Persist expanded draft IDs to sessionStorage
  useEffect(() => {
    if (!draftExpansionKey) return
    const draftExpanded = expandedIds.filter((id) => {
      const rg = requirements.find((r) => r.id === id)
      return rg?.isDraft
    })
    if (draftExpanded.length > 0) {
      sessionStorage.setItem(draftExpansionKey, JSON.stringify(draftExpanded))
    } else {
      sessionStorage.removeItem(draftExpansionKey)
    }
  }, [expandedIds, requirements, draftExpansionKey])

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
      result = result.filter((r) => {
        const statusSet = new Set(filters.status)
        if (statusSet.has('UNSUBMITTED') && (r.isDraft || r.lastSubmittedAt === null)) return true
        if (statusSet.has('INCOMPLETE') && r.status === 'INCOMPLETE') return true
        if (statusSet.has('COMPLETE') && r.status === 'COMPLETE') return true
        return false
      })
    }
    // Sort: INCOMPLETE first, COMPLETE last
    result = [...result].sort((a, b) => {
      if (a.status === b.status) return 0
      return a.status === 'INCOMPLETE' ? -1 : 1
    })
    return result
  }, [requirements, searchQuery, filters])

  function handleExpand(id: number) {
    const rg = requirements.find((r) => r.id === id)
    if (!rg) return
    const isDraftRg = rg.isDraft

    // If expanding a draft, just add to expandedIds (drafts can have multiple expanded)
    if (isDraftRg) {
      if (!expandedIds.includes(id)) {
        setExpandedIds([...expandedIds, id])
      }
      setHasUnsaved(false)
      scrollToCard(id)
      return
    }

    // For non-drafts: check if there's an expanded non-draft with unsaved changes
    const expandedNonDraft = expandedIds.find((eid) => {
      const r = requirements.find((req) => req.id === eid)
      return r && !r.isDraft && r.id !== id
    })
    if (expandedNonDraft && hasUnsaved) {
      setPendingExpandId(id)
      setShowDiscardConfirm(true)
      return
    }

    // For non-drafts, replace expandedIds with just this one
    setExpandedIds([id])
    setHasUnsaved(false)
    scrollToCard(id)
  }

  function handleCollapse(id: number) {
    setExpandedIds(expandedIds.filter((eid) => eid !== id))
    setHasUnsaved(false)
  }

  function scrollToCard(id: number) {
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

  async function handleCreateRequirement() {
    if (!cycleId) return
    if (cycle?.status === 'CLOSED') {
      showTips('negative', '当前月结已关闭，无法新建需求组')
      return
    }

    // If there's an unsubmitted draft (in sessionStorage), show confirmation instead of deleting
    const savedDraft = draftKey ? sessionStorage.getItem(draftKey) : null
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
      setExpandedIds([rg.id])
      setActiveDraftId(rg.id)
      // Immediately persist draftExpansionKey to sessionStorage so first refresh shows the draft expanded
      if (draftExpansionKey) {
        sessionStorage.setItem(draftExpansionKey, JSON.stringify([rg.id]))
      }
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
    setExpandedIds([activeDraftId])
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
      if (draftKey) sessionStorage.removeItem(draftKey)
    }
  }

  function handleLastSubmitChange(id: number) {
    if (!session?.user?.id) return
    setLastSubmittedId(id)
    localStorage.setItem(`lastSubmittedRequirement_${session.user.id}`, String(id))
  }

  function handleDraftsImported(draftIds: number[]) {
    // Persist to sessionStorage so they survive the onRefresh() reload
    if (draftExpansionKey && draftIds.length > 0) {
      sessionStorage.setItem(draftExpansionKey, JSON.stringify(draftIds))
    }
    // Expand all imported drafts and set the first one as activeDraftId
    if (draftIds.length > 0) {
      setActiveDraftId(draftIds[0])
      activeDraftIdRef.current = draftIds[0]
      // Add all drafts to expandedIds
      setExpandedIds([...expandedIds, ...draftIds])
      // Scroll to first draft
      setTimeout(() => {
        scrollToCard(draftIds[0])
      }, 100)
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
    const pipeline: Record<string, number> = Object.fromEntries(pipelineSettings.map((p) => [p.name, 0]))
    const rating: Record<string, number> = Object.fromEntries(RATINGS.map((r) => [r, 0]))
    const health: Record<string, number> = { '适合': 0, '欠饱和': 0, '过饱和': 0 }
    const designer: Record<string, number> = {}
    const canClose: Record<string, number> = { true: 0, false: 0 }
    const status: Record<string, number> = { INCOMPLETE: 0, COMPLETE: 0, UNSUBMITTED: 0 }

    requirements.forEach((r) => {
      if (r.pipeline) pipeline[r.pipeline] = (pipeline[r.pipeline] || 0) + 1
      if (r.rating) rating[r.rating] = (rating[r.rating] || 0) + 1
      if (r.healthStatus) health[r.healthStatus] = (health[r.healthStatus] || 0) + 1
      r.cycleWorkloads.forEach((w) => {
        const key = String(w.userId)
        designer[key] = (designer[key] || 0) + 1
      })
      canClose[r.canClose ? 'true' : 'false']++
      status[r.status]++
      if (r.isDraft || r.lastSubmittedAt === null) {
        status['UNSUBMITTED']++
      }
    })

    return { pipeline, rating, health, designer, canClose, status }
  }, [requirements, pipelineSettings])

  async function handleDeleteClick(id: number) {
    // 非管理员且非创建者：直接弹tips，不走确认流程
    if (!isAdmin) {
      const rg = requirements.find((r) => r.id === id)
      if (rg && rg.createdBy !== parseInt(session!.user.id)) {
        showTips('negative', `仅创建者可删除此需求组，联系:${rg.creator.name}或管理员`)
        return
      }
    }
    setPendingDeleteId(id)
  }

  async function handleDeleteRequest(id: number) {
    const res = await fetch(`/api/requirements/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      if (data?.creatorName) {
        showTips('negative', `仅创建者可删除此需求组，联系:${data.creatorName}或管理员`)
      } else if (data?.error) {
        showTips('negative', data.error)
      } else {
        showTips('negative', '删除失败')
      }
      setPendingDeleteId(null)
      return
    }
    setPendingDeleteId(null)
    onRefresh()
    setExpandedIds(expandedIds.filter((eid) => eid !== id))
  }

  async function handleDiscardRequest(id: number) {
    setPendingDiscardId(null)
    setExpandedIds(expandedIds.filter((eid) => eid !== id))
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
    const idToCollapse = pendingCompleteId
    await fetch(`/api/requirements/${idToCollapse}/complete`, { method: 'PATCH' })
    setPendingCompleteId(null)
    onRefresh()
    setExpandedIds(expandedIds.filter((eid) => eid !== idToCollapse))
  }

  async function handleReopenRequest(id: number) {
    setPendingReopenId(id)
  }

  async function doReopenRequest() {
    if (pendingReopenId === null) return
    const idToCollapse = pendingReopenId
    await fetch(`/api/requirements/${idToCollapse}/reopen`, { method: 'PATCH' })
    setPendingReopenId(null)
    onRefresh()
    setExpandedIds(expandedIds.filter((eid) => eid !== idToCollapse))
  }

  async function handleViewDuplicate() {
    // Delete the draft before viewing the duplicate
    const savedDraft = draftKey ? sessionStorage.getItem(draftKey) : null
    if (activeDraftId !== null && savedDraft === String(activeDraftId)) {
      await fetch(`/api/requirements/${activeDraftId}`, { method: 'DELETE' })
      setActiveDraftId(null)
      if (draftKey) sessionStorage.removeItem(draftKey)
    }
    if (pendingDuplicateId !== null) {
      setHasUnsaved(false)
      setExpandedIds([pendingDuplicateId])
    }
    setPendingDuplicateId(null)
    setPendingDuplicateName('')
    onRefresh()
  }

  async function handleCancelDuplicate() {
    // Delete the draft when canceling
    const savedDraft = draftKey ? sessionStorage.getItem(draftKey) : null
    if (activeDraftId !== null && savedDraft === String(activeDraftId)) {
      await fetch(`/api/requirements/${activeDraftId}`, { method: 'DELETE' })
      setActiveDraftId(null)
      if (draftKey) sessionStorage.removeItem(draftKey)
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
      <div className={`relative h-[60px] bg-[var(--u-bg-page)] z-20 ${isScrolled ? ''/* 'after:content-[""] after:absolute after:-bottom-[12px] after:left-0 after:right-0 after:h-[12px] after:bg-gradient-to-b after:from-[rgba(0,0,0,0.08)] after:to-transparent' */ : ''}`}>
        <div className="h-full px-[20px]">
          <div className="mx-auto h-full w-full min-w-[1080px] max-w-[1100px] flex items-center font-alibaba">
          <div className="flex items-center">
            <FilterBar
              designers={designers}
              currentUserId={session?.user?.id ? parseInt(session.user.id) : 0}
              onFilterChange={setFilters}
              pipelineNames={pipelineSettings.map((p) => p.name)}
              counts={filterCounts}
            />
          </div>
          <div className="ml-auto flex items-center gap-[12px]">
            <ActionIconButton
              type="upload-dark"
              disabled={!cycleId || cycle?.status === 'CLOSED'}
              onClick={() => setShowImportModal(true)}
            />
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
                新需求组
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
          <div className="mx-auto flex h-full w-full min-w-[1080px] max-w-[1100px] items-center justify-center" style={{ color: '#C3C3C3' }}>暂无需求组</div>
        ) : (
          <div className="mx-auto flex w-full min-w-[1080px] max-w-[1100px] flex-col gap-[20px]">
            {filtered.map((rg, i) =>
              <div
                key={`${fadeInKey}-${rg.id}`}
                style={{
                  animation: `reqFadeIn 100ms ease-out forwards`,
                  animationDelay: `${i * 50}ms`,
                  opacity: 0,
                }}
              >
              {expandedIds.includes(rg.id) ? (
                <RequirementCardExpanded
                  key={`expanded-${rg.id}`}
                  data={rg}
                  cycleId={cycleId}
                  cycleStatus={cycle?.status || 'OPEN'}
                  onCollapse={() => handleCollapse(rg.id)}
                  onRefresh={onRefresh}
                  onDirtyChange={setHasUnsaved}
                  allRequirements={requirements}
                  onExpandById={(id) => { setHasUnsaved(false); setExpandedIds([id]) }}
                  onDraftResolved={handleDraftResolved}
                  pipelineSettings={pipelineSettings}
                  onDeleteRequest={handleDeleteClick}
                  onDiscardRequest={(id) => setPendingDiscardId(id)}
                  onDuplicateRequest={(id, name) => { setPendingDuplicateId(id); setPendingDuplicateName(name) }}
                  onCompleteRequest={handleCompleteRequest}
                  onReopenRequest={handleReopenRequest}
                  isDraft={rg.id === activeDraftId}
                  defaultPipeline={rg.id === activeDraftId ? (cyclePipelineMemory || undefined) : undefined}
                  onLastSubmitRequest={handleLastSubmitChange}
                  draftExpansionKey={draftExpansionKey}
                />
              ) : (
                <RequirementCardCollapsed
                  data={rg}
                  cycleStatus={cycle?.status || 'OPEN'}
                  onExpand={() => handleExpand(rg.id)}
                  onRefresh={onRefresh}
                  onDeleteRequest={handleDeleteClick}
                  onCompleteRequest={handleCompleteRequest}
                  onReopenRequest={handleReopenRequest}
                  isLastSubmitted={lastSubmittedId === rg.id}
                />
              )}
              </div>
            )}
          </div>
        )}
      </div>
      {showImportModal && cycleId && (
          <ImportModal
            cycleId={cycleId}
            onClose={() => setShowImportModal(false)}
            onImportComplete={onRefresh}
            onDraftsImported={handleDraftsImported}
          />
        )}
        {showDiscardConfirm && (
        <ConfirmDialog
          title="放弃修改"
          message="有未保存的修改，是否放弃？"
          onConfirm={() => {
            const draftToDelete = activeDraftId !== null && expandedIds.includes(activeDraftId) ? activeDraftId : null
            setShowDiscardConfirm(false)
            if (draftToDelete !== null) {
              fetch(`/api/requirements/${draftToDelete}`, { method: 'DELETE' }).then(() => onRefresh())
              setActiveDraftId(null)
            }
            setExpandedIds(pendingExpandId !== null ? [pendingExpandId] : [])
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

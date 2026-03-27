'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import FilterBar from './FilterBar'
import RequirementCardCollapsed from './RequirementCardCollapsed'
import RequirementCardExpanded from './RequirementCardExpanded'
import ConfirmDialog from './ConfirmDialog'

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
  const [cycle, setCycle] = useState<{ id: number; status: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const isAdmin = session?.user?.role === 'ADMIN'

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
    const res = await fetch('/api/requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId }),
    })
    if (res.ok) {
      const rg = await res.json()
      onRefresh()
      setExpandedId(rg.id)
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

  if (!cycleId) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        请选择或新建一个月结周期
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-white px-4 py-2">
        <FilterBar
          designers={designers}
          currentUserId={session?.user?.id ? parseInt(session.user.id) : 0}
          onFilterChange={setFilters}
        />
        <div className="ml-auto flex gap-2">
          {isAdmin && (
            <button
              onClick={handleToggleCycle}
              className={`rounded px-3 py-1.5 text-sm ${
                cycle?.status === 'OPEN'
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {cycle?.status === 'OPEN' ? '关闭月结' : '开启月结'}
            </button>
          )}
          <button
            onClick={handleCreateRequirement}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            新建需求组
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">暂无需求组</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((rg) =>
              expandedId === rg.id ? (
                <RequirementCardExpanded
                  key={rg.id}
                  data={rg}
                  cycleId={cycleId}
                  cycleStatus={cycle?.status || 'OPEN'}
                  onCollapse={handleCollapse}
                  onRefresh={onRefresh}
                  onDirtyChange={setHasUnsaved}
                  allRequirements={requirements}
                  onExpandById={(id) => { setHasUnsaved(false); setExpandedId(id) }}
                />
              ) : (
                <RequirementCardCollapsed
                  key={rg.id}
                  data={rg}
                  onExpand={() => handleExpand(rg.id)}
                  onRefresh={onRefresh}
                />
              )
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

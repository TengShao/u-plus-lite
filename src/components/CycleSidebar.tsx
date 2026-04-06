'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import ConfirmDialog from './ConfirmDialog'
import CycleCard from './CycleCard'

type Cycle = {
  id: number; label: string; startDate: string; endDate: string; status: string
}

export default function CycleSidebar({
  selectedCycleId,
  onSelectCycle,
  onCycleCreated,
  refreshKey,
  hasDraft,
}: {
  selectedCycleId: number | null
  onSelectCycle: (id: number) => void
  onCycleCreated: () => void
  refreshKey: number
  hasDraft?: boolean
}) {
  const [pendingSwitchId, setPendingSwitchId] = useState<number | null>(null)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false)
  const { data: session } = useSession()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [isScrollbarVisible, setIsScrollbarVisible] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollbarTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    fetch('/api/cycles')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCycles(data)
          if (data.length > 0 && !selectedCycleId) {
            onSelectCycle(data[0].id)
          }
        }
      })
  }, [refreshKey])

  // Scrollbar auto-hide
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      setIsScrollbarVisible(true)

      if (scrollbarTimeoutRef.current) {
        clearTimeout(scrollbarTimeoutRef.current)
      }

      scrollbarTimeoutRef.current = setTimeout(() => {
        setIsScrollbarVisible(false)
      }, 1000)
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollbarTimeoutRef.current) {
        clearTimeout(scrollbarTimeoutRef.current)
      }
    }
  }, [])

  const grouped = cycles.reduce<Record<string, Cycle[]>>((acc, c) => {
    const year = new Date(c.endDate).getFullYear().toString()
    ;(acc[year] ||= []).push(c)
    return acc
  }, {})

  const [duplicateCycle, setDuplicateCycle] = useState<Cycle | null>(null)

  function getCurrentCycleLabel() {
    const now = new Date()
    const day = now.getDate()
    if (day <= 25) return `${now.getMonth() + 1}月`
    return `${now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2}月`
  }

  async function createCycle() {
    const label = getCurrentCycleLabel()
    const existing = cycles.find((c) => c.label === label)
    if (existing) {
      setDuplicateCycle(existing)
      return
    }
    const res = await fetch('/api/cycles', { method: 'POST' })
    if (res.ok) {
      const cycle = await res.json()
      onSelectCycle(cycle.id)
      onCycleCreated()
    }
  }

  // Toggle cycle
  const [showToggleConfirm, setShowToggleConfirm] = useState(false)
  const [pendingToggleId, setPendingToggleId] = useState<number | null>(null)
  const [pendingToggleStatus, setPendingToggleStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED')

  async function doToggleCycle(cycleId: number, newStatus: 'OPEN' | 'CLOSED') {
    await fetch(`/api/cycles/${cycleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    onCycleCreated()
  }

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col">
      <div ref={scrollContainerRef} className={`auto-hide-scrollbar flex-1 overflow-y-auto p-[18px] pb-0 ${isScrollbarVisible ? 'scrollbar-visible' : 'scrollbar-hidden'}`}>
        {Object.entries(grouped)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, items], gi) => (
            <div key={year}>
              {gi > 0 && (
                <div className="mx-[16px] my-[4px] flex h-[34px] w-[252px] items-center font-alibaba">
                  <span className="text-[14px] leading-[20px] text-[#C8C8C8]" style={{ fontWeight: 500, letterSpacing: '-0.91px' }}>{year}</span>
                  <span className="ml-[9px] h-px flex-1 bg-[#E9E9E9]" />
                </div>
              )}
              <div className="flex flex-col gap-[4px]">
                {items.map((c) => {
                  const isSelected = selectedCycleId === c.id
                  const isOpen = c.status === 'OPEN'
                  return (
                    <CycleCard
                      key={c.id}
                      cycle={c}
                      isSelected={isSelected}
                      onSelect={() => {
                        if (hasDraft && c.id !== selectedCycleId) {
                          setPendingSwitchId(c.id)
                          setShowSwitchConfirm(true)
                        } else {
                          onSelectCycle(c.id)
                        }
                      }}
                      onToggle={() => {
                        setPendingToggleId(c.id)
                        setPendingToggleStatus(c.status === 'OPEN' ? 'CLOSED' : 'OPEN')
                        setShowToggleConfirm(true)
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
      </div>
      {isAdmin && (
        <div className="p-[18px]">
          <button
            onClick={createCycle}
            className="relative mx-auto block h-[60px] w-[284px] rounded-[12px] bg-[#000000] text-[18px] leading-[25px] text-white transition-transform active:bg-[#3A3A3A] disabled:bg-[#B6B6B6] font-alibaba"
            style={{ fontWeight: 900, transform: 'scale(1)', transition: 'transform 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
          >
            <span>新建月结</span>
            <span className="pointer-events-none absolute right-[18px] top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12H19" />
                  <path d="M12 5V19" />
                </g>
              </svg>
            </span>
          </button>
        </div>
      )}
      {duplicateCycle && (
        <ConfirmDialog
          title="当前周期已存在"
          message="当前周期已存在，点击查看"
          onConfirm={() => { onSelectCycle(duplicateCycle.id); setDuplicateCycle(null) }}
          onCancel={() => setDuplicateCycle(null)}
          confirmText="查看"
          cancelText="取消"
        />
      )}
      {showSwitchConfirm && pendingSwitchId !== null && (
        <ConfirmDialog
          title="放弃修改"
          message="有未保存的修改，是否放弃？"
          onConfirm={() => { onSelectCycle(pendingSwitchId); setShowSwitchConfirm(false); setPendingSwitchId(null) }}
          onCancel={() => { setShowSwitchConfirm(false); setPendingSwitchId(null) }}
        />
      )}
      {showToggleConfirm && pendingToggleId !== null && (
        <ConfirmDialog
          title={pendingToggleStatus === 'CLOSED' ? '关闭月结' : '开启月结'}
          message={pendingToggleStatus === 'CLOSED' ? '确定关闭当前月结周期？关闭后普通成员将无法编辑数据。' : '确定开启当前月结周期？开启后普通成员可以编辑数据。'}
          onConfirm={() => { doToggleCycle(pendingToggleId, pendingToggleStatus); setShowToggleConfirm(false); setPendingToggleId(null) }}
          onCancel={() => { setShowToggleConfirm(false); setPendingToggleId(null) }}
        />
      )}
    </div>
  )
}

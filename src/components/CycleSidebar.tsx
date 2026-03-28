'use client'
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'

type Cycle = {
  id: number; label: string; startDate: string; endDate: string; status: string
}

export default function CycleSidebar({
  selectedCycleId,
  onSelectCycle,
  onCycleCreated,
  refreshKey,
}: {
  selectedCycleId: number | null
  onSelectCycle: (id: number) => void
  onCycleCreated: () => void
  refreshKey: number
}) {
  const { data: session } = useSession()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [isScrollbarVisible, setIsScrollbarVisible] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollbarTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    fetch('/api/cycles')
      .then((r) => r.json())
      .then((data: Cycle[]) => {
        setCycles(data)
        if (data.length > 0 && !selectedCycleId) {
          onSelectCycle(data[0].id)
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
    const year = new Date(c.startDate).getFullYear().toString()
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

  function formatDate(d: string) {
    const date = new Date(d)
    return `${date.getMonth() + 1}.${date.getDate()}`
  }

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col">
      <div ref={scrollContainerRef} className={`auto-hide-scrollbar flex-1 overflow-y-auto p-[18px] pb-0 ${isScrollbarVisible ? 'scrollbar-visible' : 'scrollbar-hidden'}`}>
        {Object.entries(grouped)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, items], gi) => (
            <div key={year}>
              {gi > 0 && (
                <div className="mx-[16px] my-[4px] flex h-[34px] w-[252px] items-center" style={{ fontFamily: 'Alibaba PuHuiTi 2.0' }}>
                  <span className="text-[14px] leading-[20px] text-[#C8C8C8]" style={{ fontWeight: 500, letterSpacing: '-0.91px' }}>{year}</span>
                  <span className="ml-[9px] h-px flex-1 bg-[#E9E9E9]" />
                </div>
              )}
              <div className="flex flex-col gap-[4px]">
                {items.map((c) => {
                  const isSelected = selectedCycleId === c.id
                  const isOpen = c.status === 'OPEN'
                  return (
                    <button
                      key={c.id}
                      onClick={() => onSelectCycle(c.id)}
                      className={`flex h-[78px] w-[284px] items-center justify-between rounded-[12px] px-[18px] text-left transition-shadow ${
                        isSelected
                          ? 'bg-white shadow-[0_0_8px_0_rgba(0,0,0,0.10)]'
                          : 'bg-transparent hover:shadow-[0_0_6px_0_rgba(0,0,0,0.15)]'
                      }`}
                      style={{ fontFamily: 'Alibaba PuHuiTi 2.0' }}
                    >
                      <div className="flex items-end gap-[6px]">
                        <span className="text-[16px] leading-[22px] text-black" style={{ fontWeight: 800 }}>
                          {c.label}
                        </span>
                        <span className="text-[16px] leading-[22px] text-black opacity-[0.21]" style={{ fontWeight: 500 }}>
                          {formatDate(c.startDate)} ~ {formatDate(c.endDate)}
                        </span>
                      </div>
                      <span className={`flex shrink-0 h-5 items-center justify-end gap-2 text-[14px] leading-5 ${isOpen ? 'text-[#8ECA2E]' : 'text-[#B6B6B6]'}`} style={{ fontWeight: 700 }}>
                        {isOpen ? 'OPEN' : 'CLOSE'}
                        <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-[#8ECA2E]' : 'bg-[#B6B6B6]'}`} />
                      </span>
                    </button>
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
            className="relative mx-auto block h-[60px] w-[284px] rounded-[12px] bg-[#000000] text-[18px] leading-[25px] text-white transition-shadow hover:shadow-[0_0_8px_0_rgba(0,0,0,0.25)] active:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
            style={{ fontFamily: 'Alibaba PuHuiTi 2.0', fontWeight: 900 }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-2 font-bold">当前周期已存在</h3>
            <p className="mb-4 text-sm text-gray-600">当前周期已存在，点击查看</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDuplicateCycle(null)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">取消</button>
              <button onClick={() => { onSelectCycle(duplicateCycle.id); setDuplicateCycle(null) }}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">查看</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

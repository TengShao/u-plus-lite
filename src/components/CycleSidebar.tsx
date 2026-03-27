'use client'
import { useEffect, useState } from 'react'
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
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="flex w-[320px] shrink-0 flex-col border-r bg-white">
      <div className="flex-1 overflow-auto p-3">
        {Object.entries(grouped)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, items]) => (
            <div key={year} className="mb-3">
              <div className="mb-1 text-xs font-medium text-gray-400">{year}年</div>
              <div className="space-y-1.5">
                {items.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCycle(c.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                      selectedCycleId === c.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{c.label}</div>
                      <div className="text-xs text-gray-400">
                        {formatDate(c.startDate)} - {formatDate(c.endDate)}
                      </div>
                    </div>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        c.status === 'OPEN'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.status === 'OPEN' ? '开启' : '关闭'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
      {isAdmin && (
        <div className="border-t p-3">
          <button
            onClick={createCycle}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500"
          >
            + 新建月结
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

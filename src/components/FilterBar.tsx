'use client'
import { useState } from 'react'
import { PIPELINES, RATINGS } from '@/lib/constants'

const HEALTH_OPTIONS = ['适合', '欠饱和', '过饱和']

export default function FilterBar({
  designers,
  currentUserId,
  onFilterChange,
}: {
  designers: { id: number; name: string }[]
  currentUserId: number
  onFilterChange: (filters: Record<string, string[]>) => void
}) {
  const [filters, setFilters] = useState<Record<string, string[]>>({})

  function toggle(key: string, value: string) {
    setFilters((prev) => {
      const current = prev[key] || []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      const updated = { ...prev, [key]: next }
      onFilterChange(updated)
      return updated
    })
  }

  function clear(key: string) {
    setFilters((prev) => {
      const updated = { ...prev, [key]: [] }
      onFilterChange(updated)
      return updated
    })
  }

  // Sort designers: current user first, then alphabetical
  const sortedDesigners = [...designers].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  return (
    <div className="flex flex-wrap gap-2">
      <Dropdown
        label="管线"
        options={PIPELINES as unknown as string[]}
        selected={filters.pipeline || []}
        onToggle={(v) => toggle('pipeline', v)}
        onClear={() => clear('pipeline')}
      />
      <Dropdown
        label="评级"
        options={RATINGS as unknown as string[]}
        selected={filters.rating || []}
        onToggle={(v) => toggle('rating', v)}
        onClear={() => clear('rating')}
      />
      <Dropdown
        label="健康度"
        options={HEALTH_OPTIONS}
        selected={filters.health || []}
        onToggle={(v) => toggle('health', v)}
        onClear={() => clear('health')}
      />
      <Dropdown
        label="设计师"
        options={sortedDesigners.map((d) => String(d.id))}
        optionLabels={sortedDesigners.map((d) =>
          d.id === currentUserId ? '我' : d.name
        )}
        selected={filters.designer || []}
        onToggle={(v) => toggle('designer', v)}
        onClear={() => clear('designer')}
      />
      <SingleDropdown
        label="可关闭"
        options={['true', 'false']}
        optionLabels={['是', '否']}
        selected={filters.canClose?.[0] || ''}
        onSelect={(v) => {
          const updated = { ...filters, canClose: v ? [v] : [] }
          setFilters(updated)
          onFilterChange(updated)
        }}
      />
      <SingleDropdown
        label="状态"
        options={['INCOMPLETE', 'COMPLETE']}
        optionLabels={['未完成', '已完成']}
        selected={filters.status?.[0] || ''}
        onSelect={(v) => {
          const updated = { ...filters, status: v ? [v] : [] }
          setFilters(updated)
          onFilterChange(updated)
        }}
      />
    </div>
  )
}

function Dropdown({
  label, options, optionLabels, selected, onToggle, onClear,
}: {
  label: string; options: string[]; optionLabels?: string[]
  selected: string[]; onToggle: (v: string) => void; onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const display = selected.length === 0 ? '全部' : `${selected.length}项`

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50"
      >
        <span className="text-gray-500">{label}:</span>
        <span>{display}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[120px] rounded border bg-white py-1 shadow-lg">
            <button
              onClick={() => { onClear(); setOpen(false) }}
              className={`w-full px-3 py-1 text-left text-xs hover:bg-gray-50 ${selected.length === 0 ? 'font-bold text-blue-600' : ''}`}
            >
              全部
            </button>
            {options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => onToggle(opt)}
                className={`w-full px-3 py-1 text-left text-xs hover:bg-gray-50 ${selected.includes(opt) ? 'font-bold text-blue-600' : ''}`}
              >
                {optionLabels ? optionLabels[i] : opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SingleDropdown({
  label, options, optionLabels, selected, onSelect,
}: {
  label: string; options: string[]; optionLabels: string[]
  selected: string; onSelect: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const idx = options.indexOf(selected)
  const display = idx >= 0 ? optionLabels[idx] : '全部'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50"
      >
        <span className="text-gray-500">{label}:</span>
        <span>{display}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[100px] rounded border bg-white py-1 shadow-lg">
            <button
              onClick={() => { onSelect(''); setOpen(false) }}
              className={`w-full px-3 py-1 text-left text-xs hover:bg-gray-50 ${!selected ? 'font-bold text-blue-600' : ''}`}
            >
              全部
            </button>
            {options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => { onSelect(opt); setOpen(false) }}
                className={`w-full px-3 py-1 text-left text-xs hover:bg-gray-50 ${selected === opt ? 'font-bold text-blue-600' : ''}`}
              >
                {optionLabels[i]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

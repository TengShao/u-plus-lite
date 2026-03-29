'use client'
import { useState, useRef, useEffect } from 'react'
import { RATINGS } from '@/lib/constants'

const HEALTH_OPTIONS = ['适合', '欠饱和', '过饱和']

const FONT = { fontFamily: 'Alibaba PuHuiTi 2.0' }

/* ---------- Arrow icon (7x5 triangle) ---------- */
function ArrowIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      width="7" height="5" viewBox="0 0 7 5" fill="#000" xmlns="http://www.w3.org/2000/svg"
      className="opacity-20" style={flipped ? { transform: 'scaleY(-1)' } : undefined}
      aria-hidden="true"
    >
      <path d="M0.5 0.5 L3.5 4.5 L6.5 0.5 Z" rx="0.5" />
    </svg>
  )
}

/* ---------- Checkbox icon (12x12) ---------- */
function CheckboxIcon({ checked }: { checked: boolean }) {
  if (!checked) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="0.5" y="0.5" width="11" height="11" rx="2" stroke="#C8C8C8" />
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="12" height="12" rx="2" fill="#8ECA2E" />
      <path d="M3 6L5.5 8.5L9 3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ---------- FilterBar ---------- */
export default function FilterBar({
  designers,
  currentUserId,
  onFilterChange,
  pipelineNames,
  counts,
}: {
  designers: { id: number; name: string }[]
  currentUserId: number
  onFilterChange: (filters: Record<string, string[]>) => void
  pipelineNames: string[]
  counts?: { pipeline?: Record<string, number>; rating?: Record<string, number>; health?: Record<string, number>; designer?: Record<string, number>; canClose?: Record<string, number>; status?: Record<string, number> }
}) {
  const [filters, setFilters] = useState<Record<string, string[]>>({})

  function toggle(key: string, value: string, allOptions: string[]) {
    setFilters((prev) => {
      const current = prev[key] || []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      const updated = { ...prev, [key]: next }
      // If all selected, pass empty to filter (= no filter)
      onFilterChange({ ...updated, [key]: next.length === allOptions.length ? [] : next })
      return updated
    })
  }

  function selectSingle(key: string, value: string) {
    setFilters((prev) => {
      const updated = { ...prev, [key]: value ? [value] : [] }
      onFilterChange(updated)
      return updated
    })
  }

  function selectAll(key: string, allOptions: string[]) {
    setFilters((prev) => {
      const updated = { ...prev, [key]: [...allOptions] }
      onFilterChange({ ...updated, [key]: [] })
      return updated
    })
  }

  function exclusive(key: string, value: string) {
    setFilters((prev) => {
      const updated = { ...prev, [key]: [value] }
      onFilterChange(updated)
      return updated
    })
  }

  const sortedDesigners = [...designers].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  return (
    <div className="flex gap-[8px]">
      <MultiDropdown label="管线" options={pipelineNames} selected={filters.pipeline || []} onToggle={(v) => toggle('pipeline', v, pipelineNames)} onSelectAll={() => selectAll('pipeline', pipelineNames)} onExclusive={(v) => exclusive('pipeline', v)} counts={counts?.pipeline} />
      <MultiDropdown label="评级" options={RATINGS as unknown as string[]} selected={filters.rating || []} onToggle={(v) => toggle('rating', v, RATINGS as unknown as string[])} onSelectAll={() => selectAll('rating', RATINGS as unknown as string[])} onExclusive={(v) => exclusive('rating', v)} counts={counts?.rating} />
      <MultiDropdown label="健康度" options={HEALTH_OPTIONS} selected={filters.health || []} onToggle={(v) => toggle('health', v, HEALTH_OPTIONS)} onSelectAll={() => selectAll('health', HEALTH_OPTIONS)} onExclusive={(v) => exclusive('health', v)} counts={counts?.health} />
      <MultiDropdown
        label="设计师"
        options={sortedDesigners.map((d) => String(d.id))}
        optionLabels={sortedDesigners.map((d) => d.id === currentUserId ? '我' : d.name)}
        selected={filters.designer || []}
        onToggle={(v) => toggle('designer', v, sortedDesigners.map((d) => String(d.id)))}
        onSelectAll={() => selectAll('designer', sortedDesigners.map((d) => String(d.id)))}
        onExclusive={(v) => exclusive('designer', v)}
        counts={counts?.designer}
      />
      <SingleDropdown label="可关闭" options={['true', 'false']} optionLabels={['是', '否']} selected={filters.canClose?.[0] || ''} onSelect={(v) => selectSingle('canClose', v)} counts={counts?.canClose} />
      <SingleDropdown label="状态" options={['INCOMPLETE', 'COMPLETE']} optionLabels={['未完成', '已完成']} selected={filters.status?.[0] || ''} onSelect={(v) => selectSingle('status', v)} counts={counts?.status} />
    </div>
  )
}

/* ---------- Shared dropdown trigger ---------- */
function DropdownTrigger({
  label, display, open, isHovered, onClick, onMouseEnter, onMouseLeave,
}: {
  label: string; display: string; open: boolean
  isHovered: boolean; onClick: () => void
  onMouseEnter: () => void; onMouseLeave: () => void
}) {
  const showBorder = open || isHovered
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex h-[36px] min-w-[120px] items-center rounded-[8px] bg-white shadow-[0_0_3px_0_rgba(0,0,0,0.10)]"
      style={{
        ...FONT,
        border: showBorder ? '1px solid #8ECA2E' : '1px solid transparent',
        transition: 'border-color 0.15s',
      }}
    >
      <div className="flex items-center pl-[8px]">
        <span className="shrink-0 text-[12px] leading-[17px] text-black/30" style={{ fontWeight: 800 }}>{label}</span>
        <span className="mx-[6px] h-[14px] w-px shrink-0 bg-black/10" />
      </div>
      <span className="min-w-0 flex-1 truncate px-[6px] text-center text-[12px] leading-[17px] text-black" style={{ fontWeight: 800 }}>{display}</span>
      <span className="shrink-0 pr-[8px]">
        <ArrowIcon flipped={open} />
      </span>
    </button>
  )
}

/* ---------- Multi-select dropdown ---------- */
function MultiDropdown({
  label, options, optionLabels, selected, onToggle, onSelectAll, onExclusive, counts,
}: {
  label: string; options: string[]; optionLabels?: string[]
  selected: string[]; onToggle: (v: string) => void; onSelectAll: () => void; onExclusive: (v: string) => void
  counts?: Record<string, number>
}) {
  const totalCount = counts ? Object.values(counts).reduce((sum, c) => sum + c, 0) : undefined
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const allSelected = selected.length === 0 || selected.length === options.length
  const display = allSelected
    ? 'ALL'
    : selected.length === 1
      ? (optionLabels ? optionLabels[options.indexOf(selected[0])] : selected[0])
      : `${selected.length}个${label}`

  return (
    <div className="relative" ref={ref}>
      <DropdownTrigger
        label={label} display={display} open={open}
        isHovered={hovered}
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {open && (
        <div
          className="absolute left-0 top-0 z-20 min-w-[120px] rounded-[8px] bg-white shadow-[0_0_3px_0_rgba(0,0,0,0.10)]"
          style={{ border: '1px solid #8ECA2E', ...FONT }}
        >
          {/* header — same as trigger */}
          <div className="flex h-[36px] items-center">
            <div className="flex items-center pl-[8px]">
              <span className="shrink-0 text-[12px] leading-[17px] text-black/30" style={{ fontWeight: 800 }}>{label}</span>
              <span className="mx-[6px] h-[14px] w-px shrink-0 bg-black/10" />
            </div>
            <span className="min-w-0 flex-1 truncate px-[6px] text-center text-[12px] leading-[17px] text-black" style={{ fontWeight: 800 }}>{display}</span>
            <span className="shrink-0 pr-[8px]">
              <ArrowIcon flipped />
            </span>
          </div>
          <div className="h-px bg-[#0000000B] mx-px" />
          {/* items */}
          <div>
            <DropdownItem
              label={`全部`}
              count={totalCount}
              selected={allSelected}
              checkbox
              onClick={() => { onSelectAll(); setOpen(false) }}
            />
            {options.map((opt, i) => (
              <DropdownItem
                key={opt}
                label={optionLabels ? optionLabels[i] : opt}
                count={counts?.[opt]}
                selected={selected.includes(opt)}
                checkbox
                onClick={() => allSelected ? onExclusive(opt) : onToggle(opt)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Single-select dropdown ---------- */
function SingleDropdown({
  label, options, optionLabels, selected, onSelect, counts,
}: {
  label: string; options: string[]; optionLabels: string[]
  selected: string; onSelect: (v: string) => void
  counts?: Record<string, number>
}) {
  const totalCount = counts ? Object.values(counts).reduce((sum, c) => sum + c, 0) : undefined
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const idx = options.indexOf(selected)
  const display = idx >= 0 ? optionLabels[idx] : `ALL`

  return (
    <div className="relative" ref={ref}>
      <DropdownTrigger
        label={label} display={display} open={open}
        isHovered={hovered}
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {open && (
        <div
          className="absolute left-0 top-0 z-20 min-w-[120px] rounded-[8px] bg-white shadow-[0_0_3px_0_rgba(0,0,0,0.10)]"
          style={{ border: '1px solid #8ECA2E', ...FONT }}
        >
          <div className="flex h-[36px] items-center">
            <div className="flex items-center pl-[8px]">
              <span className="shrink-0 text-[12px] leading-[17px] text-black/30" style={{ fontWeight: 800 }}>{label}</span>
              <span className="mx-[6px] h-[14px] w-px shrink-0 bg-black/10" />
            </div>
            <span className="min-w-0 flex-1 truncate px-[6px] text-center text-[12px] leading-[17px] text-black" style={{ fontWeight: 800 }}>{display}</span>
            <span className="shrink-0 pr-[8px]">
              <ArrowIcon flipped />
            </span>
          </div>
          <div className="h-px bg-[#0000000B] mx-px" />
          <div>
            <DropdownItem
              label={`全部`}
              count={totalCount}
              selected={!selected}
              onClick={() => { onSelect(''); setOpen(false) }}
            />
            {options.map((opt, i) => (
              <DropdownItem
                key={opt}
                label={optionLabels[i]}
                count={counts?.[opt]}
                selected={selected === opt}
                onClick={() => { onSelect(opt); setOpen(false) }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Dropdown item ---------- */
function DropdownItem({
  label, count, selected, checkbox, onClick,
}: {
  label: string; count?: number; selected: boolean; checkbox?: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const bg = selected || hovered ? '#8ECA2E27' : 'transparent'
  return (
    <button
      className="relative flex h-[30px] w-full items-center"
      style={{ background: bg, transition: 'background 0.1s', paddingLeft: checkbox ? 28 : 8, paddingRight: 8 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {checkbox && (
        <span className="absolute left-[8px]">
          <CheckboxIcon checked={selected} />
        </span>
      )}
      <span
        className="flex-1 truncate text-left text-[12px] leading-[17px] text-black"
        style={{ fontWeight: 800, ...FONT }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="ml-2 text-[12px] text-black/40" style={{ fontWeight: 800 }}>
          {count}
        </span>
      )}
    </button>
  )
}

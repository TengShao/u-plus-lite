'use client'
import { useState } from 'react'

type Cycle = {
  id: number
  label: string
  startDate: string
  endDate: string
  status: string
  currentUserTotalManDays: number
}

function formatDate(d: string) {
  const date = new Date(d)
  return `${date.getMonth() + 1}.${date.getDate()}`
}

export default function CycleCard({
  cycle,
  isSelected,
  onSelect,
  onToggle,
}: {
  cycle: Cycle
  isSelected: boolean
  onSelect: () => void
  onToggle?: () => void
}) {
  const isOpen = cycle.status === 'OPEN'
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`relative flex h-[78px] w-[300px] items-center justify-between rounded-[12px] px-[18px] font-alibaba ${
        isSelected ? 'bg-bg-panel' : 'bg-transparent'
      }`}
      style={{ boxShadow: (isSelected || hovered) ? 'var(--u-shadow-md)' : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onSelect}
        className="flex h-full flex-1 items-center gap-[8px] text-left"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: isOpen ? 'var(--color-brand)' : 'var(--u-text-muted)' }}
        />
        <div className="flex h-full items-center" style={{ gap: '6px' }}>
          <span
            className="text-[16px] leading-[22px] text-text-primary"
            style={{ fontWeight: 800, letterSpacing: '-0.91px' }}
          >
            {cycle.label}
          </span>
          <span
            className="text-[16px] leading-[22px]"
            style={{
              fontWeight: 500,
              color: 'var(--u-text-muted)',
              letterSpacing: '-1.04px',
            }}
          >
            {formatDate(cycle.startDate)} ~ {formatDate(cycle.endDate)}
          </span>
          {isSelected && (
            <span className="ml-[6px] flex items-center gap-[12px]">
              <span className="mx-0 inline-block h-[10px] w-px shrink-0" style={{ backgroundColor: 'var(--u-border)', marginTop: 4 }} />
              <span className="shrink-0 text-[12px] leading-[17px] text-text-muted" style={{ fontWeight: 400 }}>
                总人天:{cycle.currentUserTotalManDays}
              </span>
            </span>
          )}
        </div>
      </button>
      {isSelected && onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="flex h-[24px] w-[24px] shrink-0 items-center"
          onMouseEnter={(e) => {
            const svg = e.currentTarget.querySelector('svg') as SVGElement | null
            if (svg) {
              svg.style.opacity = '1'
              svg.style.color = isOpen ? '#E91B1B' : '#8ECA2E'
            }
          }}
          onMouseLeave={(e) => {
            const svg = e.currentTarget.querySelector('svg') as SVGElement | null
            if (svg) {
              svg.style.opacity = '0.3'
              svg.style.color = 'currentColor'
            }
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }} aria-hidden="true">
            <line x1="12" y1="2" x2="12" y2="12" />
            <path d="M18.4,6.6 C21.9,10.1 21.9,15.8 18.4,19.3 C14.9,22.8 9.2,22.8 5.6,19.3 C2.1,15.8 2.1,10.1 5.6,6.6" />
          </svg>
        </button>
      )}
    </div>
  )
}

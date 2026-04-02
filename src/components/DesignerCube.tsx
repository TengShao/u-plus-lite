import { useEffect, useMemo, useRef, useState } from 'react'
import { DesignerChip } from './Cube'

const MIN_WIDTH = 80
const MAX_WIDTH = 390
const GAP = 8

function estimateChipWidth(name: string, days: number | string): number {
  const nameChars = name.split('').reduce((sum, ch) => {
    return sum + (/[\u4e00-\u9fa5]/.test(ch) ? 14 : 8)
  }, 0)
  const daysStr = String(days)
  const daysChars = daysStr.split('').reduce((sum, ch) => {
    return sum + (/[\u4e00-\u9fa5]/.test(ch) ? 14 : 8)
  }, 0)
  // Chip = name + separator (6px) + days + padding (16px)
  return nameChars + 6 + daysChars + 16
}

interface Workload {
  userId: number
  userName: string
  manDays: number
}

interface DesignerCubeProps {
  label?: string
  workloads: Workload[]
  myUserId?: number
  disabled?: boolean
  isEmpty?: boolean
  value?: string
}

export function DesignerCube({
  label = '参与设计师',
  workloads,
  myUserId,
  disabled,
  isEmpty,
  value,
}: DesignerCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chipsContainerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(workloads?.length ?? 0)
  const [containerWidth, setContainerWidth] = useState(0)

  // Measure actual container width and detect overflow
  useEffect(() => {
    if (!containerRef.current || !chipsContainerRef.current) return

    const updateMeasurement = () => {
      if (!containerRef.current || !chipsContainerRef.current) return
      const containerW = containerRef.current.getBoundingClientRect().width
      setContainerWidth(containerW)

      // Get all chips in the container
      const chips = chipsContainerRef.current.children
      let totalWidth = 0
      let visible = 0

      for (let i = 0; i < chips.length; i++) {
        const chipWidth = (chips[i] as HTMLElement).getBoundingClientRect().width
        const neededWidth = totalWidth === 0 ? chipWidth : totalWidth + GAP + chipWidth

        if (neededWidth <= Math.min(containerW, MAX_WIDTH)) {
          totalWidth = neededWidth
          visible = i + 1
        } else {
          break
        }
      }

      setVisibleCount(visible)
    }

    // Initial measurement after a paint
    const rafId = requestAnimationFrame(updateMeasurement)

    // Also set up resize observer for updates
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateMeasurement)
    })
    observer.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [workloads])

  // Sort workloads: mine first, then by userId
  const sortedWorkloads = useMemo(() => {
    if (!workloads || workloads.length === 0) return []
    return [...workloads].sort((a, b) => {
      const aIsMine = a.userId === myUserId ? 1 : 0
      const bIsMine = b.userId === myUserId ? 1 : 0
      if (aIsMine !== bIsMine) return bIsMine - aIsMine
      return a.userId - b.userId
    })
  }, [workloads, myUserId])

  // Calculate overflow
  const { visibleWorkloads, overflow } = useMemo(() => {
    if (sortedWorkloads.length === 0) {
      return { visibleWorkloads: [], overflow: null }
    }

    if (visibleCount >= sortedWorkloads.length) {
      // All fit, no overflow
      return { visibleWorkloads: sortedWorkloads, overflow: null }
    }

    // Some don't fit - create overflow chip
    const visible = sortedWorkloads.slice(0, visibleCount)
    const remaining = sortedWorkloads.slice(visibleCount)
    const overflow = {
      count: remaining.length,
      manDays: remaining.reduce((sum, w) => sum + w.manDays, 0),
    }

    return { visibleWorkloads: visible, overflow }
  }, [sortedWorkloads, visibleCount])

  const hasContent = visibleWorkloads.length > 0 || overflow

  return (
    <div
      ref={containerRef}
      className="relative flex h-[80px] shrink-0 flex-col items-center rounded-[12px] border border-[#EEEEEE] bg-[#FDFDFD] px-[8px] font-alibaba"
      style={{
        width: 'auto',
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
      }}
    >
      <span className="mt-[12px] text-[13px] leading-[20px]" style={{ fontWeight: 400, color: '#8C8C8C' }}>
        {label}
      </span>
      {disabled || isEmpty || workloads.length === 0 ? (
        <span className="mt-[12px] text-[16px] leading-[22px] text-black" style={{ fontWeight: 600 }}>
          {value ?? '-'}
        </span>
      ) : !hasContent ? (
        <span className="mt-[12px] text-[16px] leading-[22px] text-black" style={{ fontWeight: 600 }}>
          {value ?? '-'}
        </span>
      ) : (
        <div ref={chipsContainerRef} className="relative mt-[5px] flex shrink-0 items-center gap-[8px]">
          {visibleWorkloads.map((w) => {
            const isMe = w.userId === myUserId
            return (
              <DesignerChip
                key={w.userId}
                name={isMe ? '你' : w.userName}
                days={String(w.manDays)}
                mine={isMe}
                nameWeight={isMe ? 600 : undefined}
              />
            )
          })}
          {overflow && (
            <DesignerChip
              name={`其他${overflow.count}人`}
              days={String(overflow.manDays)}
            />
          )}
        </div>
      )}
    </div>
  )
}

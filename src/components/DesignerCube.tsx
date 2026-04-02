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
  const [containerWidth, setContainerWidth] = useState(0)

  // Measure available width from parent after mount
  useEffect(() => {
    if (!containerRef.current) return
    // Get initial available width from parent's content rect
    const initialWidth = containerRef.current.parentElement?.getBoundingClientRect().width ?? MAX_WIDTH
    setContainerWidth(initialWidth)

    // Also observe parent for resize
    const parent = containerRef.current.parentElement
    if (!parent) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  const effectiveWidth = Math.max(MIN_WIDTH, Math.min(containerWidth, MAX_WIDTH))

  const { visibleChips, overflowChip, contentWidth } = useMemo(() => {
    if (!workloads || workloads.length === 0) {
      return { visibleChips: [], overflowChip: null, contentWidth: 0 }
    }

    // Sort: current user first, then by userId
    const sorted = [...workloads].sort((a, b) => {
      const aIsMine = a.userId === myUserId ? 1 : 0
      const bIsMine = b.userId === myUserId ? 1 : 0
      if (aIsMine !== bIsMine) return bIsMine - aIsMine
      return a.userId - b.userId
    })

    let currentWidth = 0
    const visibleChips: Array<{ workload: Workload; isMine: boolean }> = []
    let overflowChip: { count: number; manDays: number } | null = null

    for (let i = 0; i < sorted.length; i++) {
      const workload = sorted[i]
      const chipWidth = estimateChipWidth(workload.userName, workload.manDays)
      const neededWidth = currentWidth === 0 ? chipWidth : currentWidth + GAP + chipWidth

      if (neededWidth <= effectiveWidth) {
        visibleChips.push({ workload, isMine: workload.userId === myUserId })
        currentWidth = neededWidth
      } else {
        // Calculate overflow
        const remaining = sorted.slice(i)
        overflowChip = {
          count: remaining.length,
          manDays: remaining.reduce((sum, w) => sum + w.manDays, 0),
        }
        break
      }
    }

    // Calculate content width of visible chips + overflow
    let cw = 0
    for (let i = 0; i < visibleChips.length; i++) {
      const chip = visibleChips[i]
      const chipW = estimateChipWidth(
        chip.isMine ? '你' : chip.workload.userName,
        chip.workload.manDays
      )
      cw += chipW + (i > 0 ? GAP : 0)
    }
    if (overflowChip) {
      const overflowW = estimateChipWidth(`其他${overflowChip.count}人`, overflowChip.manDays)
      cw += GAP + overflowW
    }

    return { visibleChips, overflowChip, contentWidth: cw }
  }, [workloads, myUserId, effectiveWidth])

  return (
    <div
      ref={containerRef}
      className="relative flex h-[80px] shrink-0 flex-col items-center rounded-[12px] border border-[#EEEEEE] bg-[#FDFDFD] px-[8px] font-alibaba"
      style={{
        width: Math.max(MIN_WIDTH, contentWidth),
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
      ) : (
        <div className="relative mt-[5px] flex shrink-0 items-center gap-[8px]">
          {visibleChips.map(({ workload, isMine }) => (
            <DesignerChip
              key={workload.userId}
              name={isMine ? '你' : workload.userName}
              days={String(workload.manDays)}
              mine={isMine}
              nameWeight={isMine ? 600 : undefined}
            />
          ))}
          {overflowChip && (
            <DesignerChip
              name={`其他${overflowChip.count}人`}
              days={String(overflowChip.manDays)}
            />
          )}
        </div>
      )}
    </div>
  )
}

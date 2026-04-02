import { useMemo } from 'react'
import { DesignerChip } from './Cube'

const MIN_WIDTH = 80
const MAX_WIDTH = 390
const GAP = 8
const CHIP_PADDING = 16 // 8px on each side
const SEPARATOR_WIDTH = 6 // mx-[6px]
const FIXED_NAME_WIDTH = 56 // max width for name part (4 Chinese chars × 14px)
const DAYS_WIDTH = 32 // max width for days part (4 chars like "12.5")
const CHIP_MAX_WIDTH = FIXED_NAME_WIDTH + SEPARATOR_WIDTH + DAYS_WIDTH + CHIP_PADDING

function truncateName(name: string, maxChars: number = 4): string {
  if (name.length <= maxChars) return name
  const half = Math.floor(maxChars / 2)
  return name.slice(0, half) + '..' + name.slice(name.length - half)
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
  const { visibleWorkloads, overflow } = useMemo(() => {
    if (!workloads || workloads.length === 0) {
      return { visibleWorkloads: [], overflow: null }
    }

    // Sort: mine first, then by manDays descending
    const sorted = [...workloads].sort((a, b) => {
      if (a.userId === myUserId) return -1
      if (b.userId === myUserId) return 1
      return b.manDays - a.manDays
    })

    // Calculate how many chips fit
    const availableWidth = MAX_WIDTH - CHIP_PADDING // account for container padding
    let currentWidth = 0
    let fitCount = 0

    for (let i = 0; i < sorted.length; i++) {
      const chipWidth = CHIP_MAX_WIDTH
      const neededWidth = currentWidth === 0 ? chipWidth : currentWidth + GAP + chipWidth

      if (neededWidth <= availableWidth) {
        fitCount = i + 1
        currentWidth = neededWidth
      } else {
        break
      }
    }

    const visible = sorted.slice(0, fitCount)
    const remaining = sorted.slice(fitCount)

    if (remaining.length === 0) {
      return { visibleWorkloads: sorted, overflow: null }
    }

    return {
      visibleWorkloads: visible,
      overflow: {
        count: remaining.length,
        manDays: remaining.reduce((sum, w) => sum + w.manDays, 0),
      },
    }
  }, [workloads, myUserId])

  const hasContent = visibleWorkloads.length > 0 || overflow

  return (
    <div
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
        <div className="relative mt-[5px] flex shrink-0 items-center gap-[8px]">
          {visibleWorkloads.map((w) => {
            const isMe = w.userId === myUserId
            return (
              <DesignerChip
                key={w.userId}
                name={truncateName(isMe ? '你' : w.userName)}
                days={Number(w.manDays).toFixed(1)}
                mine={isMe}
                nameWeight={isMe ? 600 : undefined}
              />
            )
          })}
          {overflow && (
            <DesignerChip
              name={`其他${overflow.count}人`}
              days={Number(overflow.manDays).toFixed(1)}
            />
          )}
        </div>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { type RequirementData } from './RequirementPanel'

const FONT = { fontFamily: 'Alibaba PuHuiTi 2.0' }

const HEALTH_COLORS: Record<string, string> = {
  '适合': '#8ECA2E',
  '欠饱和': '#E9B931',
  '过饱和': '#E96631',
}

function IconDelete() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
        <path d="M19,6 L19,20 C19,21.1 18.1,22 17,22 L7,22 C5.9,22 5,21.1 5,20 L5,6" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M8,6 L8,4 C8,2.9 8.9,2 10,2 L14,2 C15.1,2 16,2.9 16,4 L16,6" />
      </g>
    </svg>
  )
}

function IconConfirm() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Divider() {
  return <span className="mx-0 inline-block h-[10px] w-px shrink-0 bg-[#00000013]" style={{ marginTop: 4 }} />
}

export default function RequirementCardCollapsed({
  data,
  cycleStatus,
  onExpand,
  onRefresh,
  onDeleteRequest,
  onCompleteRequest,
}: {
  data: RequirementData
  cycleStatus: string
  onExpand: () => void
  onRefresh: () => void
  onDeleteRequest: (id: number) => void
  onCompleteRequest?: (id: number) => void
}) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [deleteHover, setDeleteHover] = useState(false)
  const [confirmHover, setConfirmHover] = useState(false)
  const [deleteActive, setDeleteActive] = useState(false)
  const [confirmActive, setConfirmActive] = useState(false)
  const isComplete = data.status === 'COMPLETE'
  const isClosed = cycleStatus === 'CLOSED'
  const buttonsDisabled = isComplete || isClosed

  // Display up to 5 designers, or first 4 + "其他x人" if more than 5
  const displayCount = data.cycleWorkloads.length > 5 ? 4 : Math.min(5, data.cycleWorkloads.length)
  const displayWorkloads = data.cycleWorkloads.slice(0, displayCount)
  const extraCount = data.cycleWorkloads.length > 5 ? data.cycleWorkloads.length - 4 : 0

  const healthColor = data.healthStatus ? HEALTH_COLORS[data.healthStatus] : null

  // Info tags: pipeline, module, types
  const tags: string[] = []
  if (data.pipeline) tags.push(data.pipeline)
  if (data.module) tags.push(data.module)
  const typesStr = data.types?.length ? data.types.join(' / ') : null

  return (
    <div
      data-req-id={String(data.id)}
      onClick={onExpand}
      className="animate-card-collapse relative cursor-pointer rounded-[24px] bg-white transition-shadow hover:shadow-[0_0_8px_0_rgba(0,0,0,0.15)] min-w-[1200px]"
      style={{ ...FONT, height: 152, opacity: isComplete ? 0.6 : 1 }}
    >
      {/* Name + info tags — top-left */}
      <div className="absolute left-[25px] top-[18px] flex items-center gap-[12px]" style={{ right: 200 }}>
        <span className="shrink-0 text-[16px] leading-[22px] text-black" style={{ fontWeight: 900 }}>
          {data.name || '未命名需求组'}
        </span>
        {tags.length > 0 && (
          <>
            <Divider />
            {tags.map((t, i) => (
              <span key={t} className="flex items-center gap-[12px]">
                {i > 0 && <Divider />}
                <span className="shrink-0 text-[12px] leading-[17px] text-[#AFAFAF]" style={{ fontWeight: 500, letterSpacing: '-0.75px' }}>{t}</span>
              </span>
            ))}
          </>
        )}
        {typesStr && (
          <>
            <Divider />
            <span className="truncate text-[12px] leading-[17px] text-[#AFAFAF]" style={{ fontWeight: 500, letterSpacing: '-0.75px' }}>{typesStr}</span>
          </>
        )}
      </div>

      {/* Health badge — top-right */}
      {healthColor && (
        <div className="absolute right-[18px] top-[18px] flex items-center gap-[6px]">
          <span className="text-[14px] leading-[20px]" style={{ fontWeight: 800, letterSpacing: '-0.91px', color: healthColor }}>{data.healthStatus}</span>
          <span className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: healthColor }} />
        </div>
      )}

      {/* Info cubes + designer area — bottom-left */}
      <div className="absolute bottom-[20px] left-[20px] flex items-start gap-[8px]">
        <InfoCube label="评级" value={data.rating || '-'} />
        <InfoCube label="推荐评级" value={data.recommendedRating} labelColor="#40C7F6" />
        <InfoCube label="本月可关闭" value={data.canClose ? '是' : '否'} />
        <InfoCube label="总投入人天" value={String(data.totalManDays)} />
        <InfoCube label="投入比" value={data.rating ? `${data.inputRatio}%` : '-'} />
        <InfoCube label="参与人数" value={String(data.participantCount)} />
        <div className="flex h-[80px] min-w-[110px] shrink-0 flex-col rounded-[12px] border border-[#EEEEEE] bg-[#FDFDFD] w-fit">
          <span className="mt-[14px] text-center text-[12px] leading-[17px] text-[#A8A8A8]" style={{ fontWeight: 800 }}>参与设计师</span>
          <div className="flex flex-1 items-center justify-center overflow-hidden px-[10px]">
            {data.cycleWorkloads.length === 0 ? (
              <span className="text-[14px] text-black/30" style={{ fontWeight: 800, fontFamily: 'Alibaba PuHuiTi 2.0' }}>
                暂无
              </span>
            ) : (
              <div className="flex items-center gap-[8px]">
                {displayWorkloads.map((w) => (
                  <DesignerChip key={w.userId} name={w.userName} days={String(w.manDays)} />
                ))}
                {extraCount > 0 && (
                  <DesignerChip name={`其他${extraCount}人`} days={String(data.cycleWorkloads.slice(4).reduce((s, w) => s + w.manDays, 0))} muted />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons — right side, vertically centered with cubes row (y=66 in 152h card) */}
      <div className="absolute right-[22px] top-[66px] flex items-center" onClick={(e) => e.stopPropagation()}>
        {isAdmin && (
          <button
            onClick={() => !buttonsDisabled && onCompleteRequest?.(data.id)}
            onMouseEnter={() => setConfirmHover(true)}
            onMouseLeave={() => { setConfirmHover(false); setConfirmActive(false) }}
            onMouseDown={() => setConfirmActive(true)}
            onMouseUp={() => setConfirmActive(false)}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
            style={{
              background: !buttonsDisabled && (confirmHover || confirmActive) ? '#8ECA2E2F' : 'transparent',
              color: '#8ECA2E',
            }}
          >
            <span style={{ opacity: buttonsDisabled ? 0.08 : confirmActive ? 0.4 : 1 }}>
              <IconConfirm />
            </span>
          </button>
        )}
        <button
          onClick={() => !buttonsDisabled && onDeleteRequest(data.id)}
          onMouseEnter={() => setDeleteHover(true)}
          onMouseLeave={() => { setDeleteHover(false); setDeleteActive(false) }}
          onMouseDown={() => setDeleteActive(true)}
          onMouseUp={() => setDeleteActive(false)}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
          style={{
            background: !buttonsDisabled && (deleteHover || deleteActive) ? '#FF000017' : 'transparent',
            color: deleteHover || deleteActive ? '#E91B1B' : '#000000',
          }}
        >
          <span style={{ opacity: buttonsDisabled ? 0.08 : deleteActive ? 0.4 : deleteHover ? 1 : 0.3 }}>
            <IconDelete />
          </span>
        </button>
      </div>

    </div>
  )
}

function InfoCube({ label, value, labelColor }: { label: string; value: string; labelColor?: string }) {
  return (
    <div className="flex h-[80px] w-[80px] shrink-0 flex-col items-center rounded-[12px] border border-[#EEEEEE] bg-[#FDFDFD]" style={FONT}>
      <span className="mt-[14px] text-[12px] leading-[17px]" style={{ fontWeight: 800, color: labelColor || '#A8A8A8' }}>{label}</span>
      <div className="flex flex-1 items-center justify-center">
        <span className="text-[16px] leading-[22px] text-black" style={{ fontWeight: 600 }}>{value}</span>
      </div>
    </div>
  )
}

function DesignerChip({ name, days, muted }: { name: string; days: string; muted?: boolean }) {
  return (
    <div className="flex h-[33px] shrink-0 items-center rounded-[8px] border border-[#EEEEEE] bg-white px-[8px]" style={FONT}>
      <span className="text-[12px] leading-[17px]" style={{ fontWeight: 800, color: muted ? '#D4D4D4' : '#D4D4D4' }}>{name}</span>
      <span className="mx-[6px] h-[10px] w-px bg-[#00000013]" />
      <span className="text-[12px] leading-[17px] text-black" style={{ fontWeight: 800 }}>{days}</span>
    </div>
  )
}

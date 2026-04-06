'use client'
import { useSession } from 'next-auth/react'
import { type RequirementData } from './RequirementPanel'
import { ActionIconButton } from './icons'
import { Cube } from './Cube'
import { DesignerCube } from './DesignerCube'
import RequirementTags from './RequirementTags'

const HEALTH_COLORS: Record<string, string> = {
  '适合': '#8ECA2E',
  '欠饱和': '#F8CF33',
  '过饱和': '#E96631',
}

export default function RequirementCardCollapsed({
  data,
  cycleStatus,
  onExpand,
  onRefresh,
  onDeleteRequest,
  onCompleteRequest,
  onReopenRequest,
  isLastSubmitted,
}: {
  data: RequirementData
  cycleStatus: string
  onExpand: () => void
  onRefresh: () => void
  onDeleteRequest: (id: number) => void
  onCompleteRequest?: (id: number) => void
  onReopenRequest?: (id: number) => void
  isLastSubmitted?: boolean
}) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const myUserId = session?.user?.id ? parseInt(session.user.id) : 0
  const isComplete = data.status === 'COMPLETE'
  const isClosed = cycleStatus === 'CLOSED'
  const buttonsDisabled = isClosed
  const completeDisabled = isComplete || isClosed

  const healthColor = data.healthStatus ? HEALTH_COLORS[data.healthStatus] : null

  return (
    <div
      data-req-id={String(data.id)}
      onClick={onExpand}
      className="animate-card-collapse mx-auto min-w-[1080px] max-w-full relative cursor-pointer rounded-[24px] bg-white transition-shadow hover:shadow-[0_0_8px_0_rgba(0,0,0,0.15)] font-alibaba"
      style={{ height: 152 }}
    >
      {/* Disabled overlay */}
      {isComplete && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-[24px] bg-black/5" />
      )}
      {/* Name + info tags — top-left */}
      <div className="absolute left-[25px] top-[18px] flex items-center gap-[12px]" style={{ right: 200 }}>
        <span className="shrink-0 text-[16px] leading-[22px] text-black" style={{ fontWeight: 900 }}>
          {data.name || '未命名需求组'}
        </span>
        <RequirementTags
          pipeline={data.pipeline}
          module={data.module}
          types={data.types}
          isLastSubmitted={isLastSubmitted}
        />
      </div>

      {/* Health badge — top-right */}
      {healthColor && (
        <div className="absolute right-[18px] top-[18px] flex items-center gap-[6px]">
          <span className="text-[14px] leading-[20px]" style={{ fontWeight: 600, letterSpacing: '-0.91px', color: healthColor }}>{data.healthStatus}</span>
          <span className="h-[8px] w-[8px] rounded-full" style={{ backgroundColor: healthColor }} />
        </div>
      )}

      {/* Info cubes + designer area — bottom-left */}
      <div className="absolute bottom-[20px] left-[20px] flex items-start gap-[8px]">
        <Cube label="评级" value={data.rating || '-'} />
        <Cube label="本月完成" value={data.canClose ? '是' : '否'} />
        <Cube label="总人天" value={String(data.totalManDays)} />
        <Cube label="投入比" value={data.rating ? `${data.inputRatio}%` : '-'} />
        <Cube label="参与人数" value={String(data.participantCount)} />
        <DesignerCube
          label="参与设计师"
          workloads={data.cycleWorkloads.map(w => ({ userId: w.userId, userName: w.userName, manDays: w.manDays }))}
          myUserId={myUserId}
          value="暂无"
        />
      </div>

      {/* Action buttons — right side, vertically centered with cubes row (y=66 in 152h card) */}
      <div className="absolute right-[22px] top-[66px] flex items-center" onClick={(e) => e.stopPropagation()}>
        {isAdmin && !isComplete && (
          <ActionIconButton type="complete" disabled={completeDisabled} onClick={() => onCompleteRequest?.(data.id)} />
        )}
        <ActionIconButton type="delete" disabled={buttonsDisabled} onClick={() => onDeleteRequest(data.id)} />
      </div>

    </div>
  )
}

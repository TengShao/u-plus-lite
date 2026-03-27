'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { type RequirementData } from './RequirementPanel'
import ConfirmDialog from './ConfirmDialog'

const HEALTH_COLORS: Record<string, string> = {
  '适合': 'bg-green-100 text-green-700',
  '过饱和': 'bg-red-100 text-red-700',
  '欠饱和': 'bg-yellow-100 text-yellow-700',
}

export default function RequirementCardCollapsed({
  data,
  onExpand,
  onRefresh,
}: {
  data: RequirementData
  onExpand: () => void
  onRefresh: () => void
}) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const [confirmAction, setConfirmAction] = useState<'delete' | 'complete' | null>(null)
  const isComplete = data.status === 'COMPLETE'

  async function handleDelete() {
    await fetch(`/api/requirements/${data.id}`, { method: 'DELETE' })
    setConfirmAction(null)
    onRefresh()
  }

  async function handleComplete() {
    await fetch(`/api/requirements/${data.id}/complete`, { method: 'PATCH' })
    setConfirmAction(null)
    onRefresh()
  }

  const displayWorkloads = data.cycleWorkloads.slice(0, 4)
  const extraCount = data.cycleWorkloads.length - 4

  return (
    <div
      onClick={onExpand}
      className={`cursor-pointer rounded-lg border bg-white p-4 transition hover:shadow ${isComplete ? 'opacity-60' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{data.name || '未命名需求组'}</span>
          {data.module && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">{data.module}</span>}
          {data.pipeline && <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600">{data.pipeline}</span>}
          {data.types?.map((t) => (
            <span key={t} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{t}</span>
          ))}
          {data.healthStatus && (
            <span className={`rounded px-1.5 py-0.5 text-xs ${HEALTH_COLORS[data.healthStatus] || ''}`}>
              {data.healthStatus}
            </span>
          )}
          {isComplete && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">已完成</span>}
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {isAdmin && !isComplete && (
            <button
              onClick={() => setConfirmAction('complete')}
              className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50"
            >
              完成
            </button>
          )}
          <button
            onClick={() => setConfirmAction('delete')}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          >
            删除
          </button>
        </div>
      </div>
      <div className="mb-2 flex gap-3 text-xs">
        <InfoBlock label="拟定评级" value={data.rating || '-'} />
        <InfoBlock label="推荐评级" value={data.recommendedRating} />
        <InfoBlock label="可关闭" value={data.canClose ? '是' : '否'} />
        <InfoBlock label="总投入人天" value={String(data.totalManDays)} />
        <InfoBlock label="投入比" value={data.rating ? `${data.inputRatio}%` : '-'} />
        <InfoBlock label="参与人数" value={String(data.participantCount)} />
      </div>
      {displayWorkloads.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {displayWorkloads.map((w) => (
            <span key={w.userId} className="rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
              {w.userName}: {w.manDays}天
            </span>
          ))}
          {extraCount > 0 && (
            <span className="rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-400">
              其他{extraCount}人
            </span>
          )}
        </div>
      )}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction === 'delete' ? '删除需求组' : '完成需求组'}
          message={confirmAction === 'delete' ? '确定删除该需求组？此操作不可撤销。' : '确定标记该需求组为完成？'}
          onConfirm={confirmAction === 'delete' ? handleDelete : handleComplete}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-gray-50 px-2 py-1">
      <div className="text-gray-400">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { type RequirementData } from './RequirementPanel'
import { MODULES, PIPELINES, RATINGS, TYPES, BUDGET_ITEMS } from '@/lib/constants'
import ConfirmDialog from './ConfirmDialog'

export default function RequirementCardExpanded({
  data,
  cycleId,
  cycleStatus,
  onCollapse,
  onRefresh,
  onDirtyChange,
  allRequirements,
  onExpandById,
}: {
  data: RequirementData
  cycleId: number
  cycleStatus: string
  onCollapse: () => void
  onRefresh: () => void
  onDirtyChange: (dirty: boolean) => void
  allRequirements: RequirementData[]
  onExpandById: (id: number) => void
}) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const userId = session?.user?.id ? parseInt(session.user.id) : 0

  const [name, setName] = useState(data.name)
  const [rating, setRating] = useState(data.rating || '')
  const [module, setModule] = useState(data.module || '')
  const [pipeline, setPipeline] = useState(data.pipeline || '')
  const [types, setTypes] = useState<string[]>(data.types || [])
  const [budgetItem, setBudgetItem] = useState(data.budgetItem || '')
  const [canClose, setCanClose] = useState(data.canClose)
  const [funcPoints, setFuncPoints] = useState(data.funcPoints ?? data.funcPointsRecommended)
  const [pageCount, setPageCount] = useState(data.pageCount ?? 0)

  const myWorkload = data.cycleWorkloads.find((w) => w.userId === userId)
  const [manDays, setManDays] = useState(myWorkload?.manDays ?? 0)

  const [confirmAction, setConfirmAction] = useState<'cancel' | 'delete' | 'complete' | null>(null)
  const [duplicateId, setDuplicateId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])

  function markDirty() { if (!dirty) { setDirty(true) } }

  const budgetOptions = pipeline ? (BUDGET_ITEMS[pipeline] || []) : Object.values(BUDGET_ITEMS).flat()

  function adjustManDays(delta: number) {
    setManDays((v) => Math.max(0, Math.round((v + delta) * 10) / 10))
    markDirty()
  }

  async function handleSubmit() {
    setError('')
    if (!name.trim()) { setError('请输入需求组名称'); return }
    if (!rating) { setError('请选择拟定评级'); return }
    if (!module) { setError('请选择设计模块'); return }
    if (!pipeline) { setError('请选择管线'); return }
    if (!budgetItem) { setError('请选择预算挂载项'); return }

    // Check duplicate name
    const dup = allRequirements.find((r) => r.id !== data.id && r.name.trim() === name.trim())
    if (dup) {
      setDuplicateId(dup.id)
      return
    }

    // Save requirement fields
    const res = await fetch(`/api/requirements/${data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), rating, module, pipeline, types, budgetItem,
        canClose, funcPoints, pageCount, version: data.version,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      setError(err.error || '保存失败')
      return
    }

    // Save workload
    await fetch(`/api/requirements/${data.id}/workload`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingCycleId: cycleId, manDays }),
    })

    onRefresh()
    onCollapse()
  }

  async function handleDelete() {
    await fetch(`/api/requirements/${data.id}`, { method: 'DELETE' })
    setConfirmAction(null)
    onRefresh()
    onCollapse()
  }

  async function handleComplete() {
    await fetch(`/api/requirements/${data.id}/complete`, { method: 'PATCH' })
    setConfirmAction(null)
    onRefresh()
    onCollapse()
  }

  function toggleType(t: string) {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
    markDirty()
  }

  const readOnly = cycleStatus === 'CLOSED' && !isAdmin

  return (
    <div className="rounded-lg border-2 border-blue-300 bg-white p-4">
      {/* Header: name input + dynamic info */}
      <div className="mb-3 flex items-center gap-4">
        <div className="relative flex-1">
          <input
            value={name} disabled={readOnly}
            onChange={(e) => { setName(e.target.value); markDirty() }}
            placeholder="需求组名称"
            className="w-full rounded border px-3 py-1.5 pr-8 text-sm outline-none focus:border-blue-400"
          />
          {name && !readOnly && (
            <button onClick={() => { setName(''); markDirty() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-gray-500">总投入: <b>{data.totalManDays}</b>天</span>
          <span className="text-gray-500">参与: <b>{data.participantCount}</b>人</span>
          <span className="text-gray-500">投入比: <b>{data.rating ? `${data.inputRatio}%` : '-'}</b></span>
          {data.healthStatus && <span className="text-gray-500">健康度: <b>{data.healthStatus}</b></span>}
        </div>
      </div>

      {/* Edit fields */}
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Field label="拟定评级" required>
          <select value={rating} disabled={readOnly} onChange={(e) => { setRating(e.target.value); markDirty() }}
            className="w-full rounded border px-2 py-1 text-sm">
            <option value="">请选择</option>
            {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="本月可关闭" required>
          <select value={canClose ? 'true' : 'false'} disabled={readOnly}
            onChange={(e) => { setCanClose(e.target.value === 'true'); markDirty() }}
            className="w-full rounded border px-2 py-1 text-sm">
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </Field>
        <Field label="设计模块" required>
          <select value={module} disabled={readOnly} onChange={(e) => { setModule(e.target.value); markDirty() }}
            className="w-full rounded border px-2 py-1 text-sm">
            <option value="">请选择</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="管线" required>
          <select value={pipeline} disabled={readOnly}
            onChange={(e) => { setPipeline(e.target.value); setBudgetItem(''); markDirty() }}
            className="w-full rounded border px-2 py-1 text-sm">
            <option value="">请选择</option>
            {PIPELINES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="类型（多选）">
          <div className="flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <button key={t} disabled={readOnly} onClick={() => toggleType(t)}
                className={`rounded px-2 py-0.5 text-xs ${types.includes(t) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="预算挂载项" required>
          <select value={budgetItem} disabled={readOnly} onChange={(e) => { setBudgetItem(e.target.value); markDirty() }}
            className="w-full rounded border px-2 py-1 text-sm">
            <option value="">请选择</option>
            {budgetOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
      </div>

      {/* Designers list */}
      {data.cycleWorkloads.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs text-gray-500">参与设计师</div>
          <div className="flex flex-wrap gap-2">
            {data.cycleWorkloads.map((w) => (
              <span key={w.userId} className="rounded bg-gray-50 px-2 py-1 text-xs">
                {w.userId === userId ? <b>你</b> : w.userName}: {w.manDays}天
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ManDays stepper */}
      <div className="mb-3">
        <div className="mb-1 text-xs text-gray-500">我的投入人天</div>
        <div className="flex items-center gap-2">
          <button onClick={() => adjustManDays(-0.1)} disabled={readOnly}
            className="rounded border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50">🦴</button>
          <input
            type="number" step="0.1" min="0" value={manDays} disabled={readOnly}
            onChange={(e) => { setManDays(parseFloat(e.target.value) || 0); markDirty() }}
            className="w-20 rounded border px-2 py-1 text-center text-sm outline-none"
          />
          <button onClick={() => adjustManDays(0.1)} disabled={readOnly}
            className="rounded border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50">🍗</button>
        </div>
      </div>

      {/* Error */}
      {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

      {/* Last submitted */}
      {data.lastSubmittedAt && (
        <div className="mb-2 text-xs text-gray-400">
          最后提交: {new Date(data.lastSubmittedAt).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isAdmin && data.status !== 'COMPLETE' && (
          <button onClick={() => setConfirmAction('complete')}
            className="rounded bg-green-500 px-3 py-1.5 text-sm text-white hover:bg-green-600">完成</button>
        )}
        <button onClick={() => setConfirmAction('delete')}
          className="rounded bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600">删除</button>
        <div className="flex-1" />
        <button onClick={() => dirty ? setConfirmAction('cancel') : onCollapse()}
          className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">取消</button>
        {!readOnly && (
          <button onClick={handleSubmit}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">提交</button>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction === 'delete' ? '删除需求组' : confirmAction === 'complete' ? '完成需求组' : '放弃修改'}
          message={
            confirmAction === 'delete' ? '确定删除该需求组？此操作不可撤销。'
            : confirmAction === 'complete' ? '确定标记该需求组为完成？'
            : '有未保存的修改，确定放弃？'
          }
          onConfirm={
            confirmAction === 'delete' ? handleDelete
            : confirmAction === 'complete' ? handleComplete
            : () => { setConfirmAction(null); onCollapse() }
          }
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {duplicateId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-2 font-bold">同名需求组已存在</h3>
            <p className="mb-4 text-sm text-gray-600">同名需求组已存在，点击查看</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDuplicateId(null)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">取消</button>
              <button onClick={() => { setDuplicateId(null); onExpandById(duplicateId) }}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">查看</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-gray-500">
        {label}{required && <span className="text-red-400">*</span>}
      </div>
      {children}
    </div>
  )
}

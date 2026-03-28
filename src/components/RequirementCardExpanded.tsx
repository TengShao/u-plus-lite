'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { type RequirementData } from './RequirementPanel'
import type { PipelineSettingData } from './RequirementPanel'
import { MODULES, RATINGS, TYPES } from '@/lib/constants'
import ConfirmDialog from './ConfirmDialog'

const FONT = { fontFamily: 'Alibaba PuHuiTi 2.0' }
const GREEN = '#8ECA2E'

const HEALTH_COLORS: Record<string, string> = {
  '适合': '#8ECA2E',
  '欠饱和': '#E9B931',
  '过饱和': '#E96631',
}

/* ---------- Arrow icon (reused from FilterBar) ---------- */
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

type SingleKey = 'rating' | 'canClose' | 'module' | 'pipeline' | 'budgetItem'
type OpenMenu = SingleKey | 'types' | null

export default function RequirementCardExpanded({
  data,
  cycleId,
  cycleStatus,
  onCollapse,
  onRefresh,
  onDirtyChange,
  allRequirements,
  onExpandById,
  pipelineSettings,
}: {
  data: RequirementData
  cycleId: number
  cycleStatus: string
  onCollapse: () => void
  onRefresh: () => void
  onDirtyChange: (dirty: boolean) => void
  allRequirements: RequirementData[]
  onExpandById: (id: number) => void
  pipelineSettings: PipelineSettingData[]
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
  const [dirty, setDirty] = useState(false)
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [nameFocused, setNameFocused] = useState(false)
  const [decreaseAnim, setDecreaseAnim] = useState<number | null>(null)
  const [increaseAnim, setIncreaseAnim] = useState<number | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-dropdown-root="true"]')) return
      setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function triggerDecreaseAnim() {
    const id = Date.now()
    setDecreaseAnim(id)
    setTimeout(() => setDecreaseAnim(null), 1000)
  }

  function triggerIncreaseAnim() {
    const id = Date.now()
    setIncreaseAnim(id)
    setTimeout(() => setIncreaseAnim(null), 1000)
  }

  const readOnly = cycleStatus === 'CLOSED' && !isAdmin
  const pipelineNames = pipelineSettings.map((p) => p.name)
  const pipelineOptions = pipeline && !pipelineNames.includes(pipeline) ? [...pipelineNames, pipeline] : pipelineNames
  const budgetMap: Record<string, string[]> = Object.fromEntries(pipelineSettings.map((p) => [p.name, p.budgetItems.map((b) => b.name)]))
  const rawBudgetOptions = pipeline ? (budgetMap[pipeline] || []) : Object.values(budgetMap).flat()
  const budgetOptions = budgetItem && !rawBudgetOptions.includes(budgetItem) ? [...rawBudgetOptions, budgetItem] : rawBudgetOptions
  const userEditable = !readOnly

  const nameInvalid = triedSubmit && !name.trim()
  const ratingInvalid = triedSubmit && !rating
  const moduleInvalid = triedSubmit && !module
  const pipelineInvalid = triedSubmit && !pipeline
  const budgetInvalid = triedSubmit && !budgetItem

  function markDirty() {
    if (!dirty) setDirty(true)
  }

  async function handleSubmit() {
    setTriedSubmit(true)
    if (!name.trim() || !rating || !module || !pipeline || !budgetItem) return

    const dup = allRequirements.find((r) => r.id !== data.id && r.name.trim() === name.trim())
    if (dup) {
      setDuplicateId(dup.id)
      return
    }

    const res = await fetch(`/api/requirements/${data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), rating, module, pipeline, types, budgetItem,
        canClose, funcPoints, pageCount, version: data.version,
      }),
    })

    if (!res.ok) return

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

  const readonlyCubes = useMemo(() => [
    { label: '总投入人天', value: String(data.totalManDays), color: '#000000' },
    { label: '参与人数', value: String(data.participantCount), color: '#000000' },
    { label: '投入比', value: data.rating ? `${data.inputRatio}%` : '-', color: '#000000' },
    { label: '健康度', value: data.healthStatus || '-', color: data.healthStatus ? HEALTH_COLORS[data.healthStatus] : '#000000' },
  ], [data])

  return (
    <div data-req-id={String(data.id)} ref={cardRef} className="mx-auto max-w-[1200px] min-w-[1200px] rounded-[24px] bg-white px-[20px] pb-[30px] pt-[20px] shadow-[0_0_8px_0_rgba(0,0,0,0.15)]" style={FONT}>
      {/* 需求名称区域: 标题+输入框+信息方块 一行布局 */}
      <div className="flex items-center gap-[10px]">
        <SectionTitle icon="name" text="需求名称" weight={800} />
        <div className="flex w-full max-w-[600px] min-w-[240px] items-center">
          <div className={`relative h-[42px] w-full rounded-[8px] border ${nameInvalid ? 'bg-[rgba(255,0,0,0.08)] shadow-[0_0_3px_rgba(0,0,0,0.06)]' : 'bg-white'}`} style={{ borderColor: nameInvalid ? '#FF7D7D' : nameFocused ? GREEN : '#F3F3F3' }}>
            <input
              value={name}
              disabled={!userEditable}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              onChange={(e) => { setName(e.target.value); markDirty() }}
              placeholder="请输入需求组名称"
              className="h-full w-full bg-transparent px-[10px] pr-[40px] text-[16px] leading-[22px] text-black placeholder:text-black/20 outline-none"
              style={{ fontWeight: 900, letterSpacing: '-1px' }}
            />
            <span className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#C8C8C8]">◌</span>
          </div>
          <span className="ml-[8px] text-[12px] text-[#FF0000]">*</span>
        </div>
        <div className="ml-auto flex gap-[8px]">
          {readonlyCubes.map((c) => (
            <ReadonlyCube key={c.label} label={c.label} value={c.value} valueColor={c.color} />
          ))}
        </div>
      </div>

      <div className="mt-[20px] h-px w-full bg-[#0000000A]" />

      <div className="mt-[20px]">
        <SectionTitle icon="info" text="需求信息" weight={800} />
      </div>

      <div className="mt-[10px] flex gap-[8px]">
        <EditableCube label="评级" required invalid={ratingInvalid} isOpen={openMenu === 'rating'} isEmpty={!rating} width={120}>
          <SelectTrigger
            width={104}
            value={rating}
            placeholder="请选择"
            isOpen={openMenu === 'rating'}
            onToggle={() => userEditable && setOpenMenu(openMenu === 'rating' ? null : 'rating')}
            invalid={ratingInvalid}
          />
          {openMenu === 'rating' && userEditable && (
            <MenuSingle width={104} value={rating} options={RATINGS as readonly string[]} selected={rating} onPick={(v) => { setRating(v); setOpenMenu(null); markDirty() }} />
          )}
        </EditableCube>

        <EditableCube label="本月可关闭" required isOpen={openMenu === 'canClose'} isEmpty={false} width={120}>
          <SelectTrigger width={104} value={canClose ? '是' : '否'} isOpen={openMenu === 'canClose'} onToggle={() => userEditable && setOpenMenu(openMenu === 'canClose' ? null : 'canClose')} />
          {openMenu === 'canClose' && userEditable && (
            <MenuSingle width={104} value={canClose ? '是' : '否'} options={['是', '否']} selected={canClose ? '是' : '否'} onPick={(v) => { setCanClose(v === '是'); setOpenMenu(null); markDirty() }} />
          )}
        </EditableCube>

        <EditableCube label="设计模块" required invalid={moduleInvalid} isOpen={openMenu === 'module'} isEmpty={!module} width={200}>
          <SelectTrigger width={184} value={module} isOpen={openMenu === 'module'} onToggle={() => userEditable && setOpenMenu(openMenu === 'module' ? null : 'module')} invalid={moduleInvalid} />
          {openMenu === 'module' && userEditable && (
            <MenuSingle width={184} value={module} options={MODULES as readonly string[]} selected={module} onPick={(v) => { setModule(v); setOpenMenu(null); markDirty() }} />
          )}
        </EditableCube>

        <EditableCube label="管线" required invalid={pipelineInvalid} isOpen={openMenu === 'pipeline'} isEmpty={!pipeline} width={200}>
          <SelectTrigger width={184} value={pipeline} isOpen={openMenu === 'pipeline'} onToggle={() => userEditable && setOpenMenu(openMenu === 'pipeline' ? null : 'pipeline')} invalid={pipelineInvalid} />
          {openMenu === 'pipeline' && userEditable && (
            <MenuSingle width={184} value={pipeline} options={pipelineOptions as readonly string[]} selected={pipeline} onPick={(v) => { setPipeline(v); setBudgetItem(''); setOpenMenu(null); markDirty() }} />
          )}
        </EditableCube>

        <EditableCube label="类型" isOpen={openMenu === 'types'} isEmpty={types.length === 0} width={240}>
          <SelectTrigger width={224} value={types.join(' / ')} isOpen={openMenu === 'types'} onToggle={() => userEditable && setOpenMenu(openMenu === 'types' ? null : 'types')} />
          {openMenu === 'types' && userEditable && (
            <MenuMulti width={224} value={types.join(' / ')} options={TYPES as readonly string[]} selected={types} onToggle={(v) => toggleType(v)} />
          )}
        </EditableCube>

        <EditableCube label="预算项" required invalid={budgetInvalid} isOpen={openMenu === 'budgetItem'} isEmpty={!budgetItem} width={240}>
          <SelectTrigger width={224} value={budgetItem} isOpen={openMenu === 'budgetItem'} onToggle={() => userEditable && setOpenMenu(openMenu === 'budgetItem' ? null : 'budgetItem')} invalid={budgetInvalid} truncate />
          {openMenu === 'budgetItem' && userEditable && (
            <MenuSingle width={224} value={budgetItem} options={budgetOptions} selected={budgetItem} onPick={(v) => { setBudgetItem(v); setOpenMenu(null); markDirty() }} />
          )}
        </EditableCube>
      </div>

      <div className="mt-[20px] h-px w-full bg-[#0000000A]" />

      <div className="mt-[20px]">
        <SectionTitle icon="designers" text="参与设计师" weight={800} />
      </div>
      <div className="mt-[12px] min-h-[40px]">
        {data.cycleWorkloads.length === 0 ? (
          <div className="flex w-full items-center justify-center py-[8px] text-[14px]" style={{ fontWeight: 800, fontFamily: 'Alibaba PuHuiTi 2.0', color: '#C3C3C3' }}>
            暂无设计师参与，怎么回事
          </div>
        ) : (
          <div className="flex flex-wrap gap-[8px]">
            {data.cycleWorkloads.map((w) => (
              <DesignerChip key={w.userId} name={w.userId === userId ? '你' : w.userName} days={String(w.manDays)} mine={w.userId === userId} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-[20px] h-px w-full bg-[#0000000A]" />

      <div className="mt-[20px]">
        <SectionTitle icon="mine" text="你的投入" weight={900} />
      </div>

      <div className="mt-[12px] flex items-end justify-between">
        <div className="relative flex h-[60px] w-[176px] items-center rounded-[8px] bg-white px-[12px] shadow-[0_0_5px_0_rgba(0,0,0,0.1)]">
          {/* Decrease button with animation */}
          <div className="relative">
            <StepButton onClick={() => { setManDays((v) => Math.max(0, round1(v - 0.1))); markDirty(); triggerDecreaseAnim() }} disabled={!userEditable}>🦴</StepButton>
            {decreaseAnim && (
              <span
                key={decreaseAnim}
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-[4px] text-[16px] animate-fade-out"
                style={{ fontWeight: 800, color: '#E96631' }}
              >
                🦴
              </span>
            )}
          </div>

          {/* Input */}
          <input
            type="number"
            step="0.1"
            min="0"
            value={manDays}
            disabled={!userEditable}
            onChange={(e) => { setManDays(parseFloat(e.target.value) || 0); markDirty() }}
            className="no-spin mx-[8px] h-[36px] w-[64px] rounded-[8px] border border-[#F3F3F3] text-center text-[20px] leading-[36px] outline-none"
            style={{ fontWeight: 800 }}
          />

          {/* Increase button with animation */}
          <div className="relative">
            <StepButton onClick={() => { setManDays((v) => round1(v + 0.1)); markDirty(); triggerIncreaseAnim() }} disabled={!userEditable}>🍗</StepButton>
            {increaseAnim && (
              <span
                key={increaseAnim}
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-[4px] text-[16px] animate-fade-out"
                style={{ fontWeight: 800, color: '#8ECA2E' }}
              >
                🍗
              </span>
            )}
          </div>
        </div>

        <div className="flex items-end gap-[8px]">
          {isAdmin && data.status !== 'COMPLETE' && (
            <ActionIconButton type="confirm" disabled={!userEditable} onClick={() => setConfirmAction('complete')} />
          )}
          <ActionIconButton type="delete" disabled={!userEditable} onClick={() => setConfirmAction('delete')} />

          <button
            onClick={() => (dirty ? setConfirmAction('cancel') : onCollapse())}
            className="h-[60px] w-[159px] rounded-[12px] bg-[#F2F2F2] text-[18px] leading-[25px] text-black hover:shadow-[0_0_8px_0_rgba(0,0,0,0.25)] active:bg-[#E5E5E5]"
            style={{ fontWeight: 900 }}
          >
            取消
          </button>

          <div className="flex flex-col items-center gap-[8px]">
            {data.lastSubmittedAt && (
              <div className="flex items-center text-[12px] text-black/30" style={{ fontWeight: 500, letterSpacing: '-0.75px' }}>
                <span className="mr-[4px]"><ClockIcon /></span>
                {new Date(data.lastSubmittedAt).toLocaleString('zh-CN', {
                  year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </div>
            )}
            <button
              disabled={!userEditable}
              onClick={handleSubmit}
              className="flex h-[60px] w-[159px] items-center justify-center rounded-[12px] bg-black text-[18px] leading-[25px] text-white hover:shadow-[0_0_8px_0_rgba(0,0,0,0.25)] active:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
              style={{ fontWeight: 900 }}
            >
              <span className="inline-flex items-center gap-[10px]">
                提交
                <SubmitIcon />
              </span>
            </button>
          </div>
        </div>
      </div>


      {confirmAction && (
        <ConfirmDialog
          title={confirmAction === 'delete' ? '删除需求组' : confirmAction === 'complete' ? '完成需求组' : '放弃修改'}
          message={confirmAction === 'delete' ? '确定删除该需求组？此操作不可撤销。' : confirmAction === 'complete' ? '确定标记该需求组为完成？' : '有未保存的修改，确定放弃？'}
          onConfirm={confirmAction === 'delete' ? handleDelete : confirmAction === 'complete' ? handleComplete : () => { setConfirmAction(null); onCollapse() }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {duplicateId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-2 font-bold">同名需求组已存在</h3>
            <p className="mb-4 text-sm text-gray-600">同名需求组已存在，点击查看</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDuplicateId(null)} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">取消</button>
              <button onClick={() => { setDuplicateId(null); onExpandById(duplicateId) }} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">查看</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ icon, text, weight }: { icon: 'name' | 'info' | 'designers' | 'mine'; text: string; weight: number }) {
  return (
    <div className="flex items-center gap-[2px]">
      {icon === 'name' && <TitleNameIcon />}
      {icon === 'info' && <TitleInfoIcon />}
      {icon === 'designers' && <TitleDesignersIcon />}
      {icon === 'mine' && <TitleMineIcon />}
      <span className="text-[12px] leading-[17px] text-[#8ECA2E]" style={{ fontWeight: weight }}>{text}</span>
    </div>
  )
}

function ReadonlyCube({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div className="h-[80px] w-[80px] shrink-0 rounded-[12px] border border-[#EEEEEE] bg-[#FDFDFD] px-[8px] pt-[14px] text-center shadow-[0_0_3px_rgba(0,0,0,0.1)]">
      <div className="text-[12px] leading-[17px] text-[#A8A8A8]" style={{ fontWeight: 800 }}>{label}</div>
      <div className="mt-[5px] text-[16px] leading-[22px]" style={{ fontWeight: 800, color: valueColor }}>{value}</div>
    </div>
  )
}

function EditableCube({ label, width, required, invalid, isOpen, isEmpty, children }: { label: string; width: number; required?: boolean; invalid?: boolean; isOpen?: boolean; isEmpty?: boolean; children: React.ReactNode }) {
  // Border: always show, color based on state (invalid only affects inner input, not outer cube)
  const borderColor = isOpen ? '#8ECA2E' : !isEmpty ? '#EEEEEE' : 'transparent'
  const shadow = isOpen ? '0 0 3px rgba(0,0,0,0.1)' : !isEmpty ? '0 0 3px rgba(0,0,0,0.1)' : 'none'
  return (
    <div
      className="relative h-[80px] rounded-[12px] bg-[#FDFDFD] px-[8px] pt-[14px]"
      style={{
        width,
        borderColor,
        boxShadow: shadow,
      }}
    >
      <div className="text-center text-[12px] leading-[17px] text-[#A8A8A8]" style={{ fontWeight: 800 }}>{label}</div>
      {required && <span className="absolute right-[10px] top-[14px] text-[12px] text-[#FF0000]">*</span>}
      <div className="relative mt-[5px]">{children}</div>
    </div>
  )
}

function SelectTrigger({ width, value, placeholder = '请选择', isOpen, onToggle, invalid, truncate }: { width: number; value: string; placeholder?: string; isOpen: boolean; onToggle: () => void; invalid?: boolean; truncate?: boolean }) {
  const borderColor = invalid ? '#FF7D7D' : isOpen ? 'transparent' : '#EEEEEE'
  const boxShadow = invalid ? '0 0 3px rgba(0,0,0,0.06)' : isOpen ? 'none' : '0 0 3px rgba(0,0,0,0.1)'
  return (
    <button
      type="button"
      data-dropdown-root="true"
      onClick={onToggle}
      className={`relative z-10 flex h-[36px] items-center rounded-[8px] border bg-white px-[10px] text-[16px] leading-[22px] hover:border-[#8ECA2E] hover:shadow-none ${truncate ? 'overflow-hidden' : ''}`}
      style={{ width, borderColor, boxShadow, backgroundColor: invalid ? 'rgba(255,0,0,0.08)' : '#FFFFFF', fontWeight: 800 }}
    >
      <span className={`flex-1 text-center ${truncate ? 'truncate' : ''}`} style={{ color: value ? undefined : '#C3C3C3' }}>{value || placeholder}</span>
      <span className="ml-[8px]"><ArrowIcon flipped={isOpen} /></span>
    </button>
  )
}

function MenuSingle({ width, value, options, selected, onPick }: { width: number; value: string; options: readonly string[]; selected: string; onPick: (v: string) => void }) {
  return (
    <div data-dropdown-root="true" className="absolute left-0 top-0 z-20 min-w-[104px] overflow-hidden rounded-[8px] bg-white shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ border: '1px solid #8ECA2E', width }}>
      {/* Trigger clone (arrow flipped) */}
      <div className="flex h-[36px] items-center px-[10px]">
        <span className="flex-1 text-center text-[16px] leading-[22px]" style={{ fontWeight: 800 }}>{value}</span>
        <span className="ml-[8px]"><ArrowIcon flipped /></span>
      </div>
      <div className="h-px bg-[#0000000B] mx-px" />
      {/* Options */}
      <div>
        {options.map((opt) => (
          <button key={opt} onClick={() => onPick(opt)} className={`flex h-[30px] w-full items-center justify-center text-[12px] ${selected === opt ? 'bg-[rgba(142,202,46,0.15)]' : 'hover:bg-[rgba(142,202,46,0.15)]'}`} style={{ fontWeight: 800 }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function MenuMulti({ width, value, options, selected, onToggle }: { width: number; value: string; options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div data-dropdown-root="true" className="absolute left-0 top-0 z-20 min-w-[224px] overflow-hidden rounded-[8px] bg-white shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ border: '1px solid #8ECA2E', width }}>
      {/* Trigger clone (arrow flipped) */}
      <div className="flex h-[36px] items-center px-[10px]">
        <span className="flex-1 text-center text-[16px] leading-[22px] truncate" style={{ fontWeight: 800 }}>{value}</span>
        <span className="ml-[8px] shrink-0"><ArrowIcon flipped /></span>
      </div>
      <div className="h-px bg-[#0000000B] mx-px" />
      {/* Options */}
      <div>
        {options.map((opt) => {
          const checked = selected.includes(opt)
          return (
            <button key={opt} onClick={() => onToggle(opt)} className={`flex h-[30px] w-full items-center px-[8px] text-[12px] ${checked ? 'bg-[rgba(142,202,46,0.15)]' : 'hover:bg-[rgba(142,202,46,0.15)]'}`}>
              <span className="mr-[8px] flex h-[12px] w-[12px] items-center justify-center rounded-[4px] border border-[#EEEEEE] bg-[#FDFDFD]">
                {checked && <span className="h-[6px] w-[6px] rounded-[1px] bg-[#8ECA2E]" />}
              </span>
              <span className="mx-auto truncate" style={{ fontWeight: 800 }}>{opt}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DesignerChip({ name, days, mine }: { name: string; days: string; mine?: boolean }) {
  return (
    <div className="flex h-[33px] items-center rounded-[8px] border border-[#EEEEEE] bg-white px-[8px]">
      <span className="text-[12px] leading-[17px]" style={{ fontWeight: 800, color: mine ? GREEN : '#9F9F9F' }}>{name}</span>
      <span className="mx-[6px] h-[10px] w-px bg-[#00000013]" />
      <span className="text-[12px] leading-[17px] text-black" style={{ fontWeight: 800 }}>{days}</span>
    </div>
  )
}

function ActionIconButton({ type, disabled, onClick }: { type: 'confirm' | 'delete'; disabled: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const isDelete = type === 'delete'
  const showTint = !disabled && (hover || active)
  const color = isDelete ? (hover || active ? '#E91B1B' : '#000000') : '#8ECA2E'
  const iconOpacity = disabled ? 0.08 : isDelete ? (active ? 0.4 : hover ? 1 : 0.3) : (active ? 0.4 : 1)
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false) }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
      style={{ background: showTint ? (isDelete ? '#FF000017' : '#8ECA2E2F') : 'transparent', color }}
    >
      <span style={{ opacity: iconOpacity }}>
        {type === 'confirm' ? <ConfirmIcon /> : <DeleteIcon />}
      </span>
    </button>
  )
}

function StepButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-[36px] w-[36px] items-center justify-center text-[24px] leading-none text-black/80 disabled:text-black/20 transition-transform duration-100 hover:scale-[1.05] active:scale-[0.95]"
      style={{ fontWeight: 300 }}
    >
      {children}
    </button>
  )
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}

function TitleNameIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="1" width="4" height="2" rx="0.5" stroke={GREEN} /><path d="M8 2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h1" stroke={GREEN} /><path d="M4.5 7 5.5 8 7.5 6" stroke={GREEN} /></svg> }
function TitleInfoIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke={GREEN} /><path d="M6 8V6" stroke={GREEN} /><path d="M6 4h.005" stroke={GREEN} /></svg> }
function TitleDesignersIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 10.5C9 8.29 7.21 6.5 5 6.5S1 8.29 1 10.5" stroke={GREEN} /><circle cx="5" cy="4" r="2.5" stroke={GREEN} /><path d="M11 10c0-1.685-1-3.25-2-4" stroke={GREEN} /></svg> }
function TitleMineIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6.2 6.5C6.67 5.42 7.84 4.81 9 5.05 10.17 5.29 11 6.31 11 7.5 11 9.43 9 11 6.5 11 4.46 11 2.42 10.59 1.31 9.77c-.21-.16-.31-.42-.31-.68C1.06 6.36 1.31 1 5 1a1.5 1.5 0 1 1 0 3c-.55 0-.82-.22-1-0.5" stroke={GREEN} /><path d="M7.5 7c-.61-.46-1.4-.61-2.14-.42-.74.2-1.35.72-1.65 1.42" stroke={GREEN} /><path d="M4.98 3.41C4.01 3.99 4.75 6.5 4 7.5" stroke={GREEN} /></svg> }
function DeleteIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></g></svg> }
function ConfirmIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function SubmitIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="22" x2="12" y2="12" />
        <polyline points="16 17 18 19 22 15" />
        <path d="M21 11.127V8C20.9993 7.2862 20.6182 6.6269 20 6.27L13 2.27C12.3812 1.91273 11.6188 1.91273 11 2.27L4 6.27C3.38183 6.6269 3.00073 7.2862 3 8V16C3.00109 16.7134 3.38214 17.3723 4 17.729L11 21.729C11.6186 22.0866 12.381 22.087 13 21.73L14.32 20.977" />
        <polyline points="3.29 7 12 12 20.71 7" />
        <line x1="7.5" y1="4.27" x2="16.497" y2="9.418" />
      </g>
    </svg>
  )
}
function ClockIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" opacity="0.3"><g stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 7 8 8.1 8.8 8.6" /><path d="M8 2h1a1 1 0 0 1 1 1v.4" /><path d="M4 2H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1" /><circle cx="8" cy="8" r="3" /><rect x="4" y="1" width="4" height="2" rx=".5" /></g></svg> }

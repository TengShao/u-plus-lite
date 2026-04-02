'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { type RequirementData } from './RequirementPanel'
import type { PipelineSettingData } from './RequirementPanel'
import { LEVEL_COEFFICIENTS, MODULES, RATINGS, RATING_STANDARDS, TYPES } from '@/lib/constants'
import { getHealthStatus, getSuitableRating } from '@/lib/compute'
import { useTips } from './Tips'
import { DeleteIcon, ConfirmIcon, SubmitIcon, ClockIcon, ActionIconButton } from './icons'
import { Cube, DesignerChip } from './Cube'
import { RequiredDot } from './RequiredDot'
import ManDayStepper from './ManDayStepper'

const GREEN = '#8ECA2E'

const HEALTH_COLORS: Record<string, string> = {
  '适合': '#8ECA2E',
  '欠饱和': '#F8CF33',
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
  onDraftResolved,
  pipelineSettings,
  onDeleteRequest,
  onDiscardRequest,
  onDuplicateRequest,
  onCompleteRequest,
  onReopenRequest,
  defaultPipeline,
  isDraft,
}: {
  data: RequirementData
  cycleId: number
  cycleStatus: string
  onCollapse: () => void
  onRefresh: () => void
  onDirtyChange: (dirty: boolean) => void
  allRequirements: RequirementData[]
  onExpandById: (id: number) => void
  onDraftResolved: (id: number) => void
  pipelineSettings: PipelineSettingData[]
  onDeleteRequest: (id: number) => void
  onDiscardRequest: (id: number) => void
  onDuplicateRequest?: (id: number, name: string) => void
  onCompleteRequest?: (id: number) => void
  isDraft?: boolean
  defaultPipeline?: string | null
  onReopenRequest?: (id: number) => void
}) {
  const { data: session } = useSession()
  const { showTips } = useTips()
  const isAdmin = session?.user?.role === 'ADMIN'
  const userId = session?.user?.id ? parseInt(session.user.id) : 0
  const isComplete = data.status === 'COMPLETE'

  const [name, setName] = useState(data.name)
  const [rating, setRating] = useState(data.rating || '')
  const [module, setModule] = useState(data.module || '')
  const [pipeline, setPipeline] = useState(data.pipeline || defaultPipeline || '')
  const [types, setTypes] = useState<string[]>(data.types || [])
  const [budgetItem, setBudgetItem] = useState(data.budgetItem || '')
  const [canClose, setCanClose] = useState(data.canClose)
  const [funcPoints, setFuncPoints] = useState(data.funcPoints ?? data.funcPointsRecommended)
  const [pageCount, setPageCount] = useState(data.pageCount ?? 0)
  const myWorkload = data.cycleWorkloads.find((w) => w.userId === userId)
  const [manDays, setManDays] = useState(myWorkload?.manDays ?? 0)

  // Real-time computed values based on local manDays
  const computedTotalManDays = data.totalManDays - (myWorkload?.manDays ?? 0) + manDays
  const computedFuncPointsRecommended = Math.round(computedTotalManDays * 6.2)

  // Real-time recommended rating based on total man-days
  const computedRecommendedRating = getSuitableRating(computedTotalManDays, rating)

  // Real-time participant count
  const computedParticipantCount = data.participantCount
    - ((myWorkload?.manDays ?? 0) > 0 ? 1 : 0)
    + (manDays > 0 ? 1 : 0)

  // Real-time input ratio (approximation using raw man-days instead of converted)
  const ratingStandard = rating ? (RATING_STANDARDS[rating] ?? 1) : 0
  const computedInputRatio = rating ? Math.round((computedTotalManDays / ratingStandard) * 100) : 0
  const computedHealthStatus = rating ? getHealthStatus(computedInputRatio) : null

  const hasRatingTip = !isComplete && computedRecommendedRating && computedRecommendedRating !== rating
  const hasFuncPointsTip = !isComplete && computedTotalManDays > 0 && funcPoints !== computedFuncPointsRecommended
  const hasPageCountTip = !isComplete && computedTotalManDays > 0 && pageCount !== Math.round(computedTotalManDays * 1.75)
  const hasAnyTip = hasRatingTip || hasFuncPointsTip || hasPageCountTip

  const [dirty, setDirty] = useState(false)
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [nameFocused, setNameFocused] = useState(false)
  const [nameHovered, setNameHovered] = useState(false)
  const [triggerHovered, setTriggerHovered] = useState<string | null>(null)
  const [isCollapsing, setIsCollapsing] = useState(false)
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

  const readOnly = (cycleStatus === 'CLOSED' && !isAdmin) || isComplete
  const pipelineNames = pipelineSettings.map((p) => p.name)
  const pipelineOptions = pipeline && !pipelineNames.includes(pipeline) ? [...pipelineNames, pipeline] : pipelineNames
  const budgetMap: Record<string, string[]> = Object.fromEntries(pipelineSettings.map((p) => [p.name, p.budgetItems.map((b) => b.name)]))
  const rawBudgetOptions = pipeline ? (budgetMap[pipeline] || []) : Object.values(budgetMap).flat()
  const budgetOptions = budgetItem && !rawBudgetOptions.includes(budgetItem) ? [...rawBudgetOptions, budgetItem] : rawBudgetOptions
  const userEditable = !readOnly
  const deleteDisabled = cycleStatus === 'CLOSED' && !isAdmin

  const nameInvalid = triedSubmit && !name.trim()
  const ratingInvalid = triedSubmit && !rating
  const moduleInvalid = triedSubmit && !module
  const pipelineInvalid = triedSubmit && !pipeline
  const budgetInvalid = triedSubmit && !budgetItem
  const funcPointsInvalid = triedSubmit && !funcPoints
  const pageCountInvalid = triedSubmit && !pageCount

  function markDirty() {
    if (!dirty) setDirty(true)
  }

  function collapseWithAnimation(after?: () => void) {
    if (isCollapsing) return
    setIsCollapsing(true)
    setTimeout(() => {
      after?.()
      onCollapse()
    }, 100)
  }

  async function handleSubmit() {
    setTriedSubmit(true)

    // Check for duplicate name first
    if (name.trim()) {
      const dup = allRequirements.find((r) => r.id !== data.id && r.name.trim() === name.trim())
      if (dup) {
        if (onDuplicateRequest) {
          onDuplicateRequest(dup.id, dup.name)
        }
        return
      }
    }

    if (!name.trim() || !rating || !module || !pipeline || !budgetItem || !funcPoints || !pageCount) return

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

    showTips('positive')
    console.log('[RequirementCardExpanded] showTips called')
    onRefresh()
    onDraftResolved(data.id)
    collapseWithAnimation()
  }

  async function handleDelete() {
    await fetch(`/api/requirements/${data.id}`, { method: 'DELETE' })
    onRefresh()
    onDraftResolved(data.id)
    collapseWithAnimation()
  }

  function toggleType(t: string) {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
    markDirty()
  }

  const readonlyCubes = useMemo(() => [
    { label: '总人天', value: computedTotalManDays.toFixed(1), color: '#000000' },
    { label: '参与人数', value: String(computedParticipantCount), color: '#000000' },
    { label: '投入比', value: rating ? `${computedInputRatio}%` : '-', color: '#000000' },
    { label: '健康度', value: computedHealthStatus || '-', color: computedHealthStatus ? HEALTH_COLORS[computedHealthStatus] : '#000000' },
  ], [computedTotalManDays, computedParticipantCount, computedInputRatio, computedHealthStatus, rating])

  return (
    <div data-req-id={String(data.id)} ref={cardRef} className={`${isCollapsing ? 'animate-card-fold-up' : 'animate-card-expand'} mx-auto min-w-[1080px] max-w-full rounded-[24px] bg-white px-[20px] pb-[20px] pt-[20px] shadow-[0_0_8px_0_rgba(0,0,0,0.15)] font-alibaba`}>
      {/* 需求名称区域: 标题+输入框+信息方块 一行布局 */}
      <div className="flex items-start">
        <div className="w-[600px]">
            <SectionTitle icon="name" text="需求名称" weight={600} />
          <div className="relative mt-[10px] flex items-center">
            <div className="relative w-[600px]">
              <div
                className={`relative h-[42px] rounded-[8px] border ${nameInvalid ? 'bg-[rgba(255,0,0,0.08)] shadow-[0_0_3px_rgba(0,0,0,0.06)]' : 'bg-white'}`}
                style={{ borderColor: nameInvalid ? '#FF7D7D' : isComplete ? 'transparent' : nameFocused ? GREEN : nameHovered ? GREEN : '#EEEEEE', transition: 'border-color 0.15s' }}
                onMouseEnter={() => setNameHovered(true)}
                onMouseLeave={() => setNameHovered(false)}
              >
                <input
                  value={nameFocused && !name ? '' : name}
                  disabled={!userEditable || isComplete}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  onChange={(e) => { setName(e.target.value); markDirty() }}
                  placeholder="请输入需求组名称"
                  autoFocus={isDraft}
                  className="h-full w-full bg-transparent px-[10px] pr-[40px] text-[16px] leading-[22px] text-black placeholder:text-[#C3C3C3] outline-none"
                  style={{ fontWeight: 600 }}
                />
                {userEditable && name.length > 0 && (
                  <button
                    type="button"
                    aria-label="清空需求组名称"
                    onClick={() => { setName(''); markDirty() }}
                    className="absolute right-[10px] top-1/2 -translate-y-1/2"
                  >
                    <img src="/clear-input-icon.svg" alt="" aria-hidden="true" className="h-[18px] w-[18px]" />
                  </button>
                )}
              </div>
              {!readOnly && !name.trim() && <RequiredDot className="left-[604px] top-[19px]" />}
            </div>
          </div>
        </div>
        <div className="ml-auto flex gap-[9px]">
          {readonlyCubes.map((c) => (
            <Cube key={c.label} label={c.label} value={c.value} valueColor={c.color} />
          ))}
        </div>
      </div>

      {/* <CardDivider mt={20} /> */}

      <div className="mt-[20px]">
        <div>
          <SectionTitle icon="info" text="需求信息" weight={600} />
        </div>
      </div>

      <div className="mt-[10px] flex gap-[8px]">
        <Cube label="管线" required isEmpty={!pipeline} width={160} disabled={isComplete} value={pipeline}>
          <SelectTrigger width={144} value={pipeline} isOpen={openMenu === 'pipeline'} onToggle={() => userEditable && setOpenMenu(openMenu === 'pipeline' ? null : 'pipeline')} invalid={pipelineInvalid} isHovered={triggerHovered === 'pipeline'} onMouseEnter={() => setTriggerHovered('pipeline')} onMouseLeave={() => setTriggerHovered(null)} />
          {openMenu === 'pipeline' && userEditable && (
            <MenuSingle width={144} value={pipeline} options={pipelineOptions as readonly string[]} selected={pipeline} onPick={(v) => { setPipeline(v); setBudgetItem(''); setOpenMenu(null); markDirty() }} />
          )}
        </Cube>

        <div className="relative">
          <Cube label="评级" required isEmpty={!rating} width={120} disabled={isComplete} value={rating}>
            <SelectTrigger
              width={104}
              value={rating}
              placeholder="请选择"
              isOpen={openMenu === 'rating'}
              onToggle={() => userEditable && setOpenMenu(openMenu === 'rating' ? null : 'rating')}
              invalid={ratingInvalid}
              isHovered={triggerHovered === 'rating'}
              onMouseEnter={() => setTriggerHovered('rating')}
              onMouseLeave={() => setTriggerHovered(null)}
            />
            {openMenu === 'rating' && userEditable && (
              <MenuSingle width={104} value={rating} options={RATINGS as readonly string[]} selected={rating} onPick={(v) => { setRating(v); setOpenMenu(null); markDirty() }} />
            )}
          </Cube>
          {!isComplete && computedRecommendedRating && computedRecommendedRating !== rating && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[2px] whitespace-nowrap">
              <TipsBadge
                label="推荐"
                value={computedRecommendedRating}
                onClick={() => { setRating(computedRecommendedRating); markDirty() }}
              />
            </div>
          )}
        </div>

        <Cube label="设计模块" required isEmpty={!module} width={160} disabled={isComplete} value={module}>
          <SelectTrigger width={144} value={module} isOpen={openMenu === 'module'} onToggle={() => userEditable && setOpenMenu(openMenu === 'module' ? null : 'module')} invalid={moduleInvalid} isHovered={triggerHovered === 'module'} onMouseEnter={() => setTriggerHovered('module')} onMouseLeave={() => setTriggerHovered(null)} />
          {openMenu === 'module' && userEditable && (
            <MenuSingle width={144} value={module} options={MODULES as readonly string[]} selected={module} onPick={(v) => { setModule(v); setOpenMenu(null); markDirty() }} />
          )}
        </Cube>

        <Cube label="类型" isEmpty={types.length === 0} width={160} disabled={isComplete} value={types.join(' / ')}>
          <SelectTrigger width={144} value={types.join(' / ')} isOpen={openMenu === 'types'} onToggle={() => userEditable && setOpenMenu(openMenu === 'types' ? null : 'types')} isHovered={triggerHovered === 'types'} onMouseEnter={() => setTriggerHovered('types')} onMouseLeave={() => setTriggerHovered(null)} />
          {openMenu === 'types' && userEditable && (
            <MenuMulti width={144} value={types.join(' / ')} options={TYPES as readonly string[]} selected={types} onToggle={(v) => toggleType(v)} />
          )}
        </Cube>

        <Cube label="预算项" required isEmpty={!budgetItem} width={280} disabled={isComplete} value={budgetItem}>
          <SelectTrigger width={264} value={budgetItem} isOpen={openMenu === 'budgetItem'} onToggle={() => userEditable && setOpenMenu(openMenu === 'budgetItem' ? null : 'budgetItem')} invalid={budgetInvalid} truncate isHovered={triggerHovered === 'budgetItem'} onMouseEnter={() => setTriggerHovered('budgetItem')} onMouseLeave={() => setTriggerHovered(null)} />
          {openMenu === 'budgetItem' && userEditable && (
            <MenuSingle width={264} value={budgetItem} options={budgetOptions} selected={budgetItem} onPick={(v) => { setBudgetItem(v); setOpenMenu(null); markDirty() }} />
          )}
        </Cube>

        <Cube label="本月完成" required isEmpty={false} width={120} disabled={isComplete} value={canClose ? '是' : '否'}>
          <SelectTrigger width={104} value={canClose ? '是' : '否'} isOpen={openMenu === 'canClose'} onToggle={() => userEditable && setOpenMenu(openMenu === 'canClose' ? null : 'canClose')} isHovered={triggerHovered === 'canClose'} onMouseEnter={() => setTriggerHovered('canClose')} onMouseLeave={() => setTriggerHovered(null)} />
          {openMenu === 'canClose' && userEditable && (
            <MenuSingle width={104} value={canClose ? '是' : '否'} options={['是', '否']} selected={canClose ? '是' : '否'} onPick={(v) => { setCanClose(v === '是'); setOpenMenu(null); markDirty() }} />
          )}
        </Cube>
      </div>

      <div className={`${isComplete || !hasRatingTip ? 'mt-[20px]' : 'mt-[40px]'} flex items-center gap-[8px]`}>
        <div>
          <SectionTitle icon="info" text="其他信息" weight={600} />
        </div>
      </div>

      <div className="mt-[10px] flex gap-[8px]">
        <div className="relative">
          <Cube label="功能点数" required isEmpty={!funcPoints} width={120} disabled={isComplete} value={String(funcPoints)}>
            <CubeInput
              width={104}
              value={funcPoints}
              onChange={(v) => { setFuncPoints(parseInt(v) || 0); markDirty() }}
              placeholder="请输入"
              disabled={!userEditable}
              invalid={funcPointsInvalid}
            />
          </Cube>
          {!isComplete && computedTotalManDays > 0 && funcPoints !== computedFuncPointsRecommended && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[2px] whitespace-nowrap">
              <TipsBadge
                label="推荐"
                value={computedFuncPointsRecommended}
                onClick={() => { setFuncPoints(computedFuncPointsRecommended); markDirty() }}
              />
            </div>
          )}
        </div>

        <div className="relative">
          <Cube label="界面数" required isEmpty={!pageCount} width={120} disabled={isComplete} value={String(pageCount)}>
            <CubeInput
              width={104}
              value={pageCount}
              onChange={(v) => { setPageCount(parseInt(v) || 0); markDirty() }}
              placeholder="请输入"
              disabled={!userEditable}
              invalid={pageCountInvalid}
            />
          </Cube>
          {!isComplete && computedTotalManDays > 0 && pageCount !== Math.round(computedTotalManDays * 1.75) && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[2px] whitespace-nowrap">
              <TipsBadge
                label="推荐"
                value={Math.round(computedTotalManDays * 1.75)}
                onClick={() => { setPageCount(Math.round(computedTotalManDays * 1.75)); markDirty() }}
              />
            </div>
          )}
        </div>
      </div>

      {/*
        分割线逻辑：TipsBadge 出现在"其他信息"行时，下方内容需要向下位移避让。
        - 有分割线时：CardDivider 动态 margin 控制"参与设计师"位移（mt=40 时 TipsBadge 不遮挡）
        - 无分割线时："参与设计师" 自己动态 margin 替代分割线的作用
      */}
      {/* <CardDivider mt={isComplete ? 20 : (hasFuncPointsTip || hasPageCountTip ? 40 : 20)} /> */}

      <div className={`${isComplete || (!hasFuncPointsTip && !hasPageCountTip) ? 'mt-[20px]' : 'mt-[40px]'}`}>
        <div>
          <SectionTitle icon="designers" text="参与设计师" weight={600} />
        </div>
      </div>
      <div className="mt-[10px] min-h-[33px]">
        {data.cycleWorkloads.length === 0 && manDays === 0 ? (
          <div className="flex h-[33px] w-full items-center justify-center text-[14px] font-alibaba" style={{ fontWeight: 800, color: '#EEEEEE' }}>
            暂无设计师参与，怎么回事
          </div>
        ) : (
          <div className="flex h-[33px] flex-wrap items-center gap-[8px]">
            {data.cycleWorkloads.map((w) => (
              <DesignerChip key={w.userId} name={w.userId === userId ? '你' : w.userName} days={String(w.userId === userId ? manDays : w.manDays)} mine={w.userId === userId} nameWeight={w.userId === userId ? 600 : undefined} />
            ))}
            {manDays > 0 && !data.cycleWorkloads.some((w) => w.userId === userId) && (
              <DesignerChip name="你" days={String(manDays)} mine nameWeight={600} />
            )}
          </div>
        )}
      </div>

      <CardDivider mt={20} />

      <div className="mt-[20px]">
        <div>
          <SectionTitle icon="mine" text="你的投入" weight={600} />
        </div>
      </div>

      <div className="mt-[10px] flex items-end justify-between">
        <div className="flex items-center gap-[12px]">
          <ManDayStepper
            value={manDays}
            onChange={(v) => setManDays(v)}
            onDirty={markDirty}
            disabled={!userEditable}
            isComplete={isComplete}
          />

          <ActionIconButton type="upload" disabled={!userEditable} onClick={() => {}} />
        </div>

        <div className="flex items-end gap-[12px]">
          <div className="flex h-[60px] items-center gap-0">
            {isAdmin && data.status !== 'COMPLETE' && (
              <ActionIconButton type="complete" disabled={!userEditable} onClick={() => onCompleteRequest?.(data.id)} />
            )}
            <ActionIconButton type="delete" disabled={deleteDisabled} onClick={() => onDeleteRequest(data.id)} />
          </div>

          <ActionButton
            variant="cancel"
            onClick={() => (dirty || isDraft ? onDiscardRequest(data.id) : collapseWithAnimation(() => onDraftResolved(data.id)))}
            completeText={dirty || isDraft ? '取消' : '收起'}
          />

          <ActionButton
            variant="submit"
            disabled={!userEditable && !isComplete}
            lastSubmittedAt={data.lastSubmittedAt}
            onClick={isComplete ? () => onReopenRequest?.(data.id) : handleSubmit}
            completeText={isComplete ? '重启' : undefined}
            hideIcon={isComplete}
          />
        </div>
      </div>


    </div>
  )
}

function CardDivider({ mt = 20 }: { mt?: number }) {
  return <div className={`mt-[${mt}px] h-px w-full bg-[#0000000A]`} />
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

function fitDropdownTextSize(text: string, width: number) {
  const available = Math.max(width - 48, 40)
  const units = text.split('').reduce((sum, ch) => sum + (/^[\x20-\x7E]$/.test(ch) ? 0.55 : 1), 0)
  const size = Math.floor(available / Math.max(units, 1))
  return Math.max(10, Math.min(16, size))
}

function SelectTrigger({ width, value, placeholder = '请选择', isOpen, onToggle, invalid, truncate, isHovered, onMouseEnter, onMouseLeave }: { width: number; value: string; placeholder?: string; isOpen: boolean; onToggle: () => void; invalid?: boolean; truncate?: boolean; isHovered?: boolean; onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  const borderColor = invalid ? '#FF7D7D' : isOpen ? 'transparent' : isHovered ? GREEN : '#EEEEEE'
  const boxShadow = invalid ? '0 0 3px rgba(0,0,0,0.06)' : 'none'
  const displayText = value || placeholder
  const fontSize = fitDropdownTextSize(displayText, width)
  return (
    <button
      type="button"
      data-dropdown-root="true"
      onClick={onToggle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative z-10 h-[36px] rounded-[8px] border bg-white px-[10px] ${truncate ? 'overflow-hidden' : ''}`}
      style={{ width, borderColor, boxShadow, backgroundColor: invalid ? 'rgba(255,0,0,0.08)' : '#FFFFFF', fontWeight: 800, transition: 'border-color 0.15s' }}
    >
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center leading-[22px]"
        style={{ color: value ? undefined : '#C3C3C3', fontSize, fontWeight: value ? 800 : 600 }}
      >
        {displayText}
      </span>
      <span className="absolute right-[10px] top-1/2 -translate-y-1/2"><ArrowIcon flipped={isOpen} /></span>
    </button>
  )
}

function MenuSingle({ width, value, options, selected, onPick }: { width: number; value: string; options: readonly string[]; selected: string; onPick: (v: string) => void }) {
  return (
    <div data-dropdown-root="true" className="absolute left-0 top-0 z-20 min-w-[104px] overflow-hidden rounded-[8px] bg-white shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ border: '1px solid #8ECA2E', width }}>
      {/* Trigger clone (arrow flipped) */}
      <div className="relative h-[36px] px-[10px]">
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center text-[16px] leading-[22px]"
          style={{ fontWeight: 800 }}
        >
          {value}
        </span>
        <span className="absolute right-[10px] top-1/2 -translate-y-1/2"><ArrowIcon flipped /></span>
      </div>
      <div className="h-px bg-[#0000000B] mx-px" />
      {/* Options */}
      <div className="overflow-y-auto" style={{ maxHeight: 260, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.2) transparent' }}>
        {options.map((opt) => (
          <button key={opt} onClick={() => onPick(opt)} className={`flex h-[30px] w-full items-center justify-center text-[14px] ${selected === opt ? 'bg-[rgba(142,202,46,0.15)]' : 'hover:bg-[rgba(142,202,46,0.15)]'}`} style={{ fontWeight: 800 }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function MenuMulti({ width, value, options, selected, onToggle }: { width: number; value: string; options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div data-dropdown-root="true" className="absolute left-0 top-0 z-20 overflow-hidden rounded-[8px] bg-white shadow-[0_0_3px_rgba(0,0,0,0.1)]" style={{ border: '1px solid #8ECA2E', width }}>
      {/* Trigger clone (arrow flipped) */}
      <div className="relative h-[36px] px-[10px]">
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 block max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-center text-[16px] leading-[22px]"
          style={{ fontWeight: 800 }}
        >
          {value}
        </span>
        <span className="absolute right-[10px] top-1/2 -translate-y-1/2 shrink-0"><ArrowIcon flipped /></span>
      </div>
      <div className="h-px bg-[#0000000B] mx-px" />
      {/* Options */}
      <div className="overflow-y-auto" style={{ maxHeight: 260, scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.2) transparent' }}>
        {options.map((opt) => {
          const checked = selected.includes(opt)
          return (
            <button key={opt} onClick={() => onToggle(opt)} className={`flex h-[30px] w-full items-center px-[8px] text-[14px] ${checked ? 'bg-[rgba(142,202,46,0.15)]' : 'hover:bg-[rgba(142,202,46,0.15)]'}`}>
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

function CubeInput({ width, value, onChange, placeholder = '请输入', disabled, invalid }: { width: number; value: string | number; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; invalid?: boolean }) {
  const [focused, setFocused] = useState(false)
  const borderColor = invalid ? '#FF7D7D' : focused ? GREEN : '#EEEEEE'
  const bgColor = invalid && !focused ? 'rgba(255,0,0,0.08)' : '#FFFFFF'
  return (
    <input
      type="text"
      value={focused ? (value || '') : (value === 0 ? '' : value || '')}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-[36px] rounded-[8px] border border-transparent bg-white px-[10px] text-center text-[16px] leading-[22px] text-black placeholder:text-[#C3C3C3] outline-none"
      style={{ width, fontWeight: 600, borderColor, transition: 'border-color 0.15s, background-color 0.15s', backgroundColor: bgColor }}
    />
  )
}

function ActionButton({ variant, disabled, lastSubmittedAt, onClick, completeText, hideIcon }: { variant: 'cancel' | 'submit'; disabled?: boolean; lastSubmittedAt?: string | null; onClick: () => void; completeText?: string; hideIcon?: boolean }) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const isCancel = variant === 'cancel'

  if (!isCancel) {
    return (
      <div className="relative flex h-[60px] w-[159px] items-center justify-center">
        {lastSubmittedAt && !hideIcon && (
          <div className="absolute bottom-[68px] left-1/2 flex -translate-x-1/2 items-center whitespace-nowrap text-[12px] text-black/30" style={{ fontWeight: 400 }}>
            <span className="mr-[4px]"><ClockIcon /></span>
            {new Date(lastSubmittedAt).toLocaleString('zh-CN', {
              year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}
        <button
          disabled={disabled}
          onClick={onClick}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => { setHover(false); setActive(false) }}
          onMouseDown={() => setActive(true)}
          onMouseUp={() => setActive(false)}
          className="flex h-[60px] w-[159px] items-center justify-center rounded-[12px] bg-black text-[18px] leading-[25px] text-white transition-transform active:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
          style={{ fontWeight: 900, transform: active ? 'scale(1)' : hover ? 'scale(1.03)' : 'scale(1)', transition: 'transform 0.15s' }}
        >
          <span className="inline-flex items-center gap-[10px]">
            {completeText || '提交'}
            {!hideIcon && <SubmitIcon />}
          </span>
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false) }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      className="h-[60px] w-[159px] rounded-[12px] bg-[#F2F2F2] text-[18px] leading-[25px] text-black transition-transform active:bg-[#E5E5E5]"
      style={{ fontWeight: 900, transform: active ? 'scale(1)' : hover ? 'scale(1.03)' : 'scale(1)', transition: 'transform 0.15s' }}
    >
      {completeText || '取消'}
    </button>
  )
}

function TitleNameIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="1" width="4" height="2" rx="0.5" stroke={GREEN} /><path d="M8 2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h1" stroke={GREEN} /><path d="M4.5 7 5.5 8 7.5 6" stroke={GREEN} /></svg> }
function TitleInfoIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke={GREEN} /><path d="M6 8V6" stroke={GREEN} /><path d="M6 4h.005" stroke={GREEN} /></svg> }
function TitleDesignersIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 10.5C9 8.29 7.21 6.5 5 6.5S1 8.29 1 10.5" stroke={GREEN} /><circle cx="5" cy="4" r="2.5" stroke={GREEN} /><path d="M11 10c0-1.685-1-3.25-2-4" stroke={GREEN} /></svg> }
function TitleMineIcon() { return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6.2 6.5C6.67 5.42 7.84 4.81 9 5.05 10.17 5.29 11 6.31 11 7.5 11 9.43 9 11 6.5 11 4.46 11 2.42 10.59 1.31 9.77c-.21-.16-.31-.42-.31-.68C1.06 6.36 1.31 1 5 1a1.5 1.5 0 1 1 0 3c-.55 0-.82-.22-1-0.5" stroke={GREEN} /><path d="M7.5 7c-.61-.46-1.4-.61-2.14-.42-.74.2-1.35.72-1.65 1.42" stroke={GREEN} /><path d="M4.98 3.41C4.01 3.99 4.75 6.5 4 7.5" stroke={GREEN} /></svg> }
function TipsBadge({ label, value, onClick }: { label: string; value: string | number; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  const color = (hovered || active) && onClick ? '#8ECA2E' : '#8C8C8C'
  return (
    <span
      className={`text-[12px] leading-[17px] underline ${onClick ? 'cursor-pointer' : ''}`}
      style={{ fontWeight: 400, color }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setActive(false) }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
    >
      {label} <span style={{ fontWeight: 800 }}>{value}</span>
    </span>
  )
}

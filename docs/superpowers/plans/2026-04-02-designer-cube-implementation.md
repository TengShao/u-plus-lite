# DesignerCube Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone `DesignerCube` component for "参与设计师" with independent width-adaptive rules (min 80px, max 390px) and overflow handling.

**Architecture:** The `DesignerCube` component encapsulates the full overflow logic internally. It receives raw workload data, calculates chip widths, determines which chips fit within 390px, and renders either full chips or a "其他x人|y人天" chip. Uses existing `DesignerChip` without modification.

**Tech Stack:** React (useState, useMemo, useRef, useEffect), Tailwind CSS, TypeScript

---

## File Structure

- **Create:** `src/components/DesignerCube.tsx` — New component
- **Modify:** `src/components/Cube.tsx` — Export `DesignerChip` separately
- **Modify:** `src/components/RequirementCardCollapsed.tsx` — Use `DesignerCube`
- **Modify:** `src/components/RequirementCardExpanded.tsx` — Wrap "参与设计师" with `DesignerCube`

---

## Task 1: Export DesignerChip from Cube.tsx

**Files:**
- Modify: `src/components/Cube.tsx:1-13`

- [ ] **Step 1: Check current exports**

Read `src/components/Cube.tsx` lines 1-13 to confirm `DesignerChip` is a named export.

- [ ] **Step 2: Ensure DesignerChip is exported**

The existing `DesignerChip` is already a named export (`export function DesignerChip`). No changes needed to Cube.tsx for this task.

- [ ] **Step 3: Commit**

```bash
git add src/components/Cube.tsx
git commit -m "chore: confirm DesignerChip is exported from Cube.tsx"
```

---

## Task 2: Create DesignerCube Component

**Files:**
- Create: `src/components/DesignerCube.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'
import { useMemo, useRef, useEffect, useState } from 'react'
import { DesignerChip } from './Cube'

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

const MIN_WIDTH = 80
const MAX_WIDTH = 390
const GAP = 8
const CHIP_PADDING = 16 // px-[8px] on each side = 16 total

// Estimate chip width based on content
// Chinese chars ~14px, ASCII/numbers ~8px
function estimateChipWidth(name: string, days: number | string): number {
  const nameChars = name.split('').reduce((sum, ch) => {
    return sum + (/[\u4e00-\u9fa0]/.test(ch) ? 14 : 8)
  }, 0)
  const daysStr = String(days)
  const daysChars = daysStr.split('').reduce((sum, ch) => {
    return sum + (/[\u4e00-\u9fa0]/.test(ch) ? 14 : 8)
  }, 0)
  // Chip = name + separator (6px) + days + padding (16px)
  return nameChars + 6 + daysChars + CHIP_PADDING
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
  const [containerWidth, setContainerWidth] = useState(MAX_WIDTH)

  // Measure actual container width after mount
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Calculate chips to display and overflow chip
  const { displayChips, overflowChip } = useMemo(() => {
    if (workloads.length === 0) {
      return { displayChips: [], overflowChip: null }
    }

    const targetWidth = Math.min(Math.max(containerWidth, MIN_WIDTH), MAX_WIDTH)

    // Sort workloads: mine first, then by userId
    const sorted = [...workloads].sort((a, b) => {
      if (a.userId === myUserId) return -1
      if (b.userId === myUserId) return 1
      return a.userId - b.userId
    })

    // Build chip data
    const chips = sorted.map((w) => ({
      userId: w.userId,
      userName: w.userId === myUserId ? '你' : w.userName,
      manDays: w.manDays,
      isMe: w.userId === myUserId,
      estimatedWidth: estimateChipWidth(
        w.userId === myUserId ? '你' : w.userName,
        w.manDays
      ),
    }))

    // Calculate how many chips fit
    let accumulatedWidth = 0
    let fitCount = 0

    for (let i = 0; i < chips.length; i++) {
      const chipWidth = chips[i].estimatedWidth
      const wouldBeLast = i === chips.length - 1
      const nextWidth = wouldBeLast ? 0 : chips[i + 1].estimatedWidth

      if (accumulatedWidth + chipWidth + (fitCount > 0 ? GAP : 0) <= targetWidth) {
        fitCount = i + 1
        accumulatedWidth += chipWidth + (i > 0 ? GAP : 0)
      } else {
        break
      }
    }

    // If not all chips fit, create overflow chip
    if (fitCount < chips.length) {
      const overflowChips = chips.slice(fitCount)
      const overflowDays = overflowChips.reduce((sum, c) => sum + c.manDays, 0)
      const overflowChipData = {
        userId: -1,
        userName: `其他${overflowChips.length}人`,
        manDays: overflowDays,
        isMe: false,
        estimatedWidth: estimateChipWidth(`其他${overflowChips.length}人`, overflowDays),
      }
      return {
        displayChips: chips.slice(0, fitCount),
        overflowChip: overflowChipData,
      }
    }

    return { displayChips: chips, overflowChip: null }
  }, [workloads, myUserId, containerWidth])

  const hasContent = displayChips.length > 0 || overflowChip

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
      <span
        className="mt-[12px] text-[13px] leading-[20px]"
        style={{ fontWeight: 400, color: '#8C8C8C' }}
      >
        {label}
      </span>

      {!disabled && hasContent ? (
        <div className="relative mt-[5px] flex items-center gap-[8px]">
          {displayChips.map((chip) => (
            <DesignerChip
              key={chip.userId}
              name={chip.userName}
              days={String(chip.manDays)}
              mine={chip.isMe}
              nameWeight={chip.isMe ? 600 : undefined}
            />
          ))}
          {overflowChip && (
            <DesignerChip
              name={overflowChip.userName}
              days={String(overflowChip.manDays)}
            />
          )}
        </div>
      ) : (
        <span
          className="mt-[12px] text-[16px] leading-[22px] text-black"
          style={{ fontWeight: 600 }}
        >
          {value}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify file was created**

```bash
ls -la src/components/DesignerCube.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DesignerCube.tsx
git commit -m "feat: add DesignerCube component with overflow handling"
```

---

## Task 3: Update RequirementCardCollapsed to Use DesignerCube

**Files:**
- Modify: `src/components/RequirementCardCollapsed.tsx:108-124`

- [ ] **Step 1: Read current collapsed card implementation**

Read `src/components/RequirementCardCollapsed.tsx` to see current "参与设计师" Cube usage around line 108.

- [ ] **Step 2: Import DesignerCube**

Add to imports (line 5):
```tsx
import { Cube, DesignerChip } from './Cube'
// becomes:
import { Cube } from './Cube'
import { DesignerCube } from './DesignerCube'
```

- [ ] **Step 3: Replace the Cube with DesignerCube**

Find the section around lines 108-124 that currently has:
```tsx
<Cube label="参与设计师" width={designerCubeWidth}>
  <div className="shrink-0 flex items-center gap-[8px]" style={{ width: 'max-content' }}>
    {data.cycleWorkloads.length === 0 ? (
      <span className="text-[14px] text-black/30 font-alibaba" style={{ fontWeight: 800 }}>暂无</span>
    ) : (
      <>
        {displayWorkloads.map((w) => {
          const isMe = w.userId === myUserId
          return <DesignerChip key={w.userId} name={isMe ? '你' : w.userName} days={String(w.manDays)} mine={isMe} nameWeight={isMe ? 600 : undefined} />
        })}
        {extraCount > 0 && (
          <DesignerChip name={`其他${extraCount}人`} days={String(data.cycleWorkloads.slice(4).reduce((s, w) => s + w.manDays, 0))} />
        )}
      </>
    )}
  </div>
</Cube>
```

Replace with:
```tsx
<DesignerCube
  label="参与设计师"
  workloads={data.cycleWorkloads.map(w => ({ userId: w.userId, userName: w.userName, manDays: w.manDays }))}
  myUserId={myUserId}
  value="暂无"
/>
```

Also remove the old `displayCount`, `displayWorkloads`, `extraCount`, and `designerCubeWidth` calculations (lines 42-48) since those are now handled by DesignerCube.

- [ ] **Step 4: Verify the change**

Read the modified section to confirm it compiles.

- [ ] **Step 5: Commit**

```bash
git add src/components/RequirementCardCollapsed.tsx
git commit -m "feat: use DesignerCube in collapsed card"
```

---

## Task 4: Update RequirementCardExpanded to Wrap "参与设计师" with DesignerCube

**Files:**
- Modify: `src/components/RequirementCardExpanded.tsx:409-424`

- [ ] **Step 1: Read expanded card "参与设计师" section**

Read `src/components/RequirementCardExpanded.tsx` lines 404-424 to see the current "参与设计师" section.

- [ ] **Step 2: Import DesignerCube**

Add to imports (line 10):
```tsx
import { Cube, DesignerChip } from './Cube'
// becomes:
import { Cube } from './Cube'
import { DesignerCube } from './DesignerCube'
```

- [ ] **Step 3: Wrap the section with DesignerCube**

Current code (lines 409-424):
```tsx
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
```

Replace with:
```tsx
<div className="mt-[10px]">
  <DesignerCube
    label="参与设计师"
    workloads={[
      ...data.cycleWorkloads.map(w => ({ userId: w.userId, userName: w.userName, manDays: w.manDays })),
      ...(manDays > 0 && !data.cycleWorkloads.some((w) => w.userId === userId)
        ? [{ userId: userId, userName: '你', manDays: manDays }]
        : [])
    ]}
    myUserId={userId}
    value={data.cycleWorkloads.length === 0 && manDays === 0 ? '暂无设计师参与，怎么回事' : undefined}
  />
</div>
```

- [ ] **Step 4: Verify the change**

Read the modified section.

- [ ] **Step 5: Commit**

```bash
git add src/components/RequirementCardExpanded.tsx
git commit -m "feat: wrap expanded card designers section with DesignerCube"
```

---

## Verification

- [ ] **Run dev server** and verify both collapsed and expanded cards render DesignerCube correctly

```bash
npm run dev
```

- [ ] **Test overflow:** Add 6+ designers to a requirement group and verify "其他x人" appears at the correct position

- [ ] **Test empty state:** Verify "暂无" and "暂无设计师参与，怎么回事" display correctly

---

## Spec Coverage Check

| Spec Requirement | Task |
|------------------|------|
| DesignerCube layout matches existing Cube | Task 2, 3, 4 |
| min-width 80px, max-width 390px | Task 2 |
| Overflow replaces nth chip with "其他x人\|y人天" | Task 2 |
| DesignerChip structure unchanged | Task 2 (reuses existing component) |
| Both collapsed and expanded cards updated | Task 3, 4 |

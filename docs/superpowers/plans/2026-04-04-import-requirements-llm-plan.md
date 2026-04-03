# LLM 导入需求组 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户通过 ImportModal 上传纯文本/CSV，LLM 自动解析 + 匹配合需求组，最终确认导入。

**Architecture:** 前端 ImportModal 两个状态（输入态/预览态），两个 API Route 分别处理 LLM 解析和批量导入，LLM Service 封装 MiniMax 调用。

**Tech Stack:** Next.js App Router, Tailwind CSS, MiniMax API

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/lib/llm.ts` | MiniMax LLM 调用封装，buildParsePrompt / callLLM |
| `src/app/api/import/parse/route.ts` | POST /api/import/parse — LLM 解析 + 匹配 |
| `src/app/api/import/confirm/route.ts` | POST /api/import/confirm — 批量创建/追加 |
| `src/components/ImportModal.tsx` | 导入 Modal（输入态 + 预览态） |
| `src/components/RequirementPanel.tsx` | 接入上传按钮 |
| `.env.example` | 新增 MINIMAX_API_KEY |

---

## Task 1: LLM Service — `src/lib/llm.ts`

**Files:**
- Create: `src/lib/llm.ts`

- [ ] **Step 1: 创建 `src/lib/llm.ts`**

```typescript
// src/lib/llm.ts

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface ParsedItem {
  originalText: string
  manDays: number
  designers: string[]
}

export interface ParsedGroup {
  name: string
  action: 'MATCH' | 'CREATE_NEW'
  matchedGroup: { id: number; name: string } | null
  matchReason: string
  items: ParsedItem[]
}

export interface ParseResult {
  groups: ParsedGroup[]
}

// MiniMax API compatible with OpenAI format
async function callLLM(content: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set')

  const res = await fetch('https://api.minimax.chat/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7-highspeed',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LLM API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export function buildParsePrompt(
  rawContent: string,
  existingGroups: { id: number; name: string }[],
  systemUsers: string[]
): string {
  const groupsList = existingGroups.map(g => `- id:${g.id} name:"${g.name}"`).join('\n')
  const usersList = systemUsers.join(', ')

  return `你是一个设计师工作日志解析助手。你的任务是将用户输入的原始文本解析成结构化的需求组列表。

## 输入格式（每条记录结构）
avatarUI | 设计师姓名
calendar日期
项目/模块名称
sun总人天
#需求ID 【mm.dd】需求名称
工作类型 (数字人天)

## 解析规则
1. 每组 avatarUI... 到下一个 avatarUI 之前的内容视为一条完整记录
2. 从需求相关行中提取需求名称（灵活识别：可能包含 #需求ID、【日期】等前缀后缀，需去掉无关前缀后缀，保留核心需求名称）
3. "工作类型 (数字人天)" 中的数字为投入人天，归归属于前一条需求名称
4. 设计师名称为 avatarUI | 后面的姓名
5. 以下字段忽略：calendar日期、项目/模块名称（如"U5国内版"）、sun总人天

## 匹配逻辑
将每条记录的需求名称与以下已有需求组列表进行语义匹配：
- 如果语义高度相关 → action: "MATCH"，返回 matchedGroup（只需返回 id 和 name）
- 如果无相关已有需求组 → action: "CREATE_NEW"

已有需求组列表：
${groupsList || '(无已有需求组)'}

系统用户账号：${usersList}

## 输出要求
必须输出有效的 JSON，格式如下：
{
  "groups": [
    {
      "name": "需求组名称",
      "action": "MATCH | CREATE_NEW",
      "matchedGroup": { "id": 42, "name": "设计统筹" },
      "matchReason": "描述匹配理由",
      "items": [
        {
          "originalText": "设计 (4人天)",
          "manDays": 4,
          "designers": ["邵腾"]
        }
      ]
    }
  ]
}

## 注意事项
- manDays 必须是数字类型，支持小数（如 0.6）
- designers 填入实际的设计师名称字符串列表
- 输出只包含 JSON，不要有其他文字
- 无法解析的行请忽略`
}

export async function parseWorkload(
  rawContent: string,
  existingGroups: { id: number; name: string }[],
  systemUsers: string[]
): Promise<ParseResult> {
  const prompt = buildParsePrompt(rawContent, existingGroups, systemUsers)
  const response = await callLLM(rawContent, prompt)
  // Strip markdown code blocks if present
  const jsonStr = response.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(jsonStr) as ParseResult
}
```

- [ ] **Step 2: 验证文件创建成功**

Run: `ls src/lib/llm.ts`
Expected: `src/lib/llm.ts` 文件存在

- [ ] **Step 3: 提交**

```bash
git add src/lib/llm.ts
git commit -m "feat: add LLM service with MiniMax provider"
```

---

## Task 2: `POST /api/import/parse` API

**Files:**
- Create: `src/app/api/import/parse/route.ts`

- [ ] **Step 1: 创建 API Route `src/app/api/import/parse/route.ts`**

```typescript
// src/app/api/import/parse/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'
import { parseWorkload } from '@/lib/llm'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { content, cycleId } = await req.json()

  if (!content?.trim() || !cycleId) {
    return NextResponse.json({ error: 'content and cycleId are required' }, { status: 400 })
  }

  // 获取当前周期已有需求组
  const existingGroups = await prisma.requirementGroup.findMany({
    where: { createdInCycleId: parseInt(String(cycleId)) },
    select: { id: true, name: true },
  })

  // 获取系统用户账号列表
  const systemUsers = await prisma.user.findMany({
    select: { name: true },
  })
  const userNames = systemUsers.map(u => u.name)

  try {
    const result = await parseWorkload(content, existingGroups, userNames)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: 验证文件创建成功**

Run: `ls src/app/api/import/parse/route.ts`
Expected: `src/app/api/import/parse/route.ts` 文件存在

- [ ] **Step 3: 提交**

```bash
git add src/app/api/import/parse/route.ts
git commit -m "feat: add POST /api/import/parse LLM parse endpoint"
```

---

## Task 3: `POST /api/import/confirm` API

**Files:**
- Create: `src/app/api/import/confirm/route.ts`

- [ ] **Step 1: 创建 API Route `src/app/api/import/confirm/route.ts`**

```typescript
// src/app/api/import/import/confirm/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorized } from '@/lib/api-utils'

interface ImportItem {
  manDays: number
  designers: string[]
  originalText: string
}

interface Decision {
  name: string
  action: 'MERGE' | 'CREATE'
  targetGroupId: number | null
  items: ImportItem[]
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { cycleId, decisions } = await req.json()

  if (!cycleId || !decisions?.length) {
    return NextResponse.json({ error: 'cycleId and decisions are required' }, { status: 400 })
  }

  const results: { groupId: number; importedCount: number }[] = []

  for (const decision of decisions) {
    const typedDecision = decision as Decision

    if (typedDecision.action === 'MERGE' && typedDecision.targetGroupId) {
      // 追加 Workload 到已有需求组
      for (const item of typedDecision.items) {
        // 匹配设计师账号
        const user = await prisma.user.findFirst({
          where: { name: { in: item.designers } },
        })
        if (user) {
          await prisma.workload.create({
            data: {
              userId: user.id,
              requirementGroupId: typedDecision.targetGroupId,
              billingCycleId: parseInt(String(cycleId)),
              manDays: item.manDays,
            },
          })
        }
        // 匹配失败则跳过该 item
      }
      results.push({ groupId: typedDecision.targetGroupId, importedCount: typedDecision.items.length })
    } else if (typedDecision.action === 'CREATE') {
      // 创建新需求组 + Workload
      const newGroup = await prisma.requirementGroup.create({
        data: {
          name: typedDecision.name,
          createdInCycleId: parseInt(String(cycleId)),
          createdBy: parseInt(session.user.id),
        },
      })
      for (const item of typedDecision.items) {
        const user = await prisma.user.findFirst({
          where: { name: { in: item.designers } },
        })
        if (user) {
          await prisma.workload.create({
            data: {
              userId: user.id,
              requirementGroupId: newGroup.id,
              billingCycleId: parseInt(String(cycleId)),
              manDays: item.manDays,
            },
          })
        }
      }
      results.push({ groupId: newGroup.id, importedCount: typedDecision.items.length })
    }
  }

  return NextResponse.json({ results })
}
```

- [ ] **Step 2: 验证文件创建成功**

Run: `ls src/app/api/import/confirm/route.ts`
Expected: `src/app/api/import/confirm/route.ts` 文件存在

- [ ] **Step 3: 提交**

```bash
git add src/app/api/import/confirm/route.ts
git commit -m "feat: add POST /api/import/confirm batch import endpoint"
```

---

## Task 4: ImportModal 组件

**Files:**
- Create: `src/components/ImportModal.tsx`

- [ ] **Step 1: 创建 `src/components/ImportModal.tsx`**

主要结构：

```tsx
// src/components/ImportModal.tsx

'use client'
import { useState, useRef } from 'react'

interface ParsedItem {
  originalText: string
  manDays: number
  designers: string[]
}

interface ParsedGroup {
  name: string
  action: 'MATCH' | 'CREATE_NEW'
  matchedGroup: { id: number; name: string } | null
  matchReason: string
  items: ParsedItem[]
}

interface Props {
  cycleId: number
  onClose: () => void
  onImportComplete: () => void
}

export default function ImportModal({ cycleId, onClose, onImportComplete }: Props) {
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [rawContent, setRawContent] = useState('')
  const [groups, setGroups] = useState<ParsedGroup[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState<number | null>(null)
  const [editedName, setEditedName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理 CSV 文件上传
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setRawContent(ev.target?.result as string ?? '')
    }
    reader.readAsText(file)
  }

  // 调用解析 API
  async function handleParse() {
    if (!rawContent.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: rawContent, cycleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '解析失败')
      setGroups(data.groups)
      setStep('preview')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 删除单个条目
  function handleDeleteItem(groupIdx: number, itemIdx: number) {
    setGroups(prev => {
      const next = [...prev]
      next[groupIdx] = { ...next[groupIdx] }
      next[groupIdx].items = next[groupIdx].items.filter((_, i) => i !== itemIdx)
      return next
    })
  }

  // 删除整组
  function handleDeleteGroup(groupIdx: number) {
    setGroups(prev => prev.filter((_, i) => i !== groupIdx))
  }

  // 编辑组名
  function handleStartEditName(groupIdx: number, currentName: string) {
    setEditingGroupName(groupIdx)
    setEditedName(currentName)
  }

  function handleSaveEditName(groupIdx: number) {
    setGroups(prev => {
      const next = [...prev]
      next[groupIdx] = { ...next[groupIdx], name: editedName }
      return next
    })
    setEditingGroupName(null)
  }

  // 多选切换
  function handleToggleSelect(groupIdx: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(groupIdx)) next.delete(groupIdx)
      else next.add(groupIdx)
      return next
    })
  }

  // 合并选中组
  function handleMergeSelected() {
    if (selectedIds.size < 2) return
    const selectedGroups = groups.filter((_, i) => selectedIds.has(i))
    const mergedItems = selectedGroups.flatMap(g => g.items)
    const newGroup: ParsedGroup = {
      name: '新合并需求组',
      action: 'CREATE_NEW',
      matchedGroup: null,
      matchReason: '',
      items: mergedItems,
    }
    // 删除原组，新增合并组
    const remaining = groups.filter((_, i) => !selectedIds.has(i))
    setGroups([...remaining, newGroup])
    setSelectedIds(new Set())
  }

  // 确认导入
  async function handleConfirm() {
    const decisions = groups.map(g => ({
      name: g.name,
      action: g.action === 'MATCH' ? 'MERGE' : 'CREATE',
      targetGroupId: g.matchedGroup?.id ?? null,
      items: g.items,
    }))
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId, decisions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '导入失败')
      onImportComplete()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 font-alibaba" onClick={onClose}>
      <div className="flex flex-col rounded-[24px] bg-[#F9F9F9]" style={{ width: 680, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/10">
          <span className="text-[18px] font-bold text-black">导入需求组</span>
          <button onClick={onClose} className="text-black/40 hover:text-black">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'input' ? (
            <div className="flex flex-col gap-4">
              <textarea
                className="w-full h-48 p-3 rounded-lg border border-[#EEEEEE] text-[14px] text-black placeholder:text-[#C3C3C3] outline-none hover:border-[#8ECA2E] focus:border-[#8ECA2E] resize-none"
                style={{ fontFamily: 'inherit' }}
                placeholder="粘贴纯文本或 CSV 内容..."
                value={rawContent}
                onChange={e => setRawContent(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 h-10 px-4 rounded-[8px] border border-[#EEEEEE] bg-white text-[14px] text-black hover:border-[#8ECA2E]"
                >
                  📎 上传 CSV
                </button>
                {fileInputRef.current?.files?.[0] && (
                  <span className="text-[14px] text-[#8ECA2E]">{fileInputRef.current.files[0].name}</span>
                )}
              </div>
              {error && <div className="text-[14px] text-red-500">{error}</div>}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.length === 0 ? (
                <div className="text-center py-8 text-[#C3C3C3]">未解析出任何需求组</div>
              ) : (
                groups.map((group, gi) => (
                  <div key={gi} className="rounded-[12px] border border-[#EEEEEE] bg-white p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(gi)}
                        onChange={() => handleToggleSelect(gi)}
                        className="w-4 h-4"
                      />
                      {editingGroupName === gi ? (
                        <input
                          className="flex-1 h-8 px-2 rounded border border-[#8ECA2E] text-[14px] text-black outline-none"
                          value={editedName}
                          onChange={e => setEditedName(e.target.value)}
                          onBlur={() => handleSaveEditName(gi)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveEditName(gi)}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="flex-1 text-[16px] font-bold text-black cursor-pointer hover:text-[#8ECA2E]"
                          onClick={() => handleStartEditName(gi, group.name)}
                        >
                          {group.name}
                        </span>
                      )}
                      <span className={`text-[12px] px-2 py-0.5 rounded-full ${group.action === 'MATCH' ? 'bg-[rgba(142,202,46,0.15)] text-[#8ECA2E]' : 'bg-[rgba(0,0,0,0.05)] text-[#999]'}`}>
                        {group.action === 'MATCH' ? `已有「${group.matchedGroup?.name}」` : '新建'}
                      </span>
                      <button onClick={() => handleDeleteGroup(gi)} className="text-[#E96631] text-[14px] hover:underline">删除</button>
                    </div>
                    <div className="flex flex-col gap-1 pl-7">
                      {group.items.map((item, ii) => (
                        <div key={ii} className="flex items-center justify-between text-[13px]">
                          <span className="text-[#666]">{item.originalText}</span>
                          <span className="text-black font-bold">{item.manDays} 人天</span>
                          <button onClick={() => handleDeleteItem(gi, ii)} className="text-[#E96631] hover:underline">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {selectedIds.size >= 2 && (
                <button
                  onClick={handleMergeSelected}
                  className="self-center px-4 py-2 rounded-[8px] border border-[#8ECA2E] text-[14px] text-[#8ECA2E] hover:bg-[rgba(142,202,46,0.1)]"
                >
                  合并选中的 {selectedIds.size} 个组
                </button>
              )}
              {error && <div className="text-[14px] text-red-500">{error}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10">
          <button
            onClick={step === 'input' ? onClose : () => setStep('input')}
            className="h-10 w-28 rounded-[8px] bg-[#F2F2F2] text-[16px] font-bold text-black"
          >
            {step === 'input' ? '取消' : '上一步'}
          </button>
          {step === 'input' ? (
            <button
              onClick={handleParse}
              disabled={!rawContent.trim() || isLoading}
              className="h-10 w-28 rounded-[8px] bg-black text-[16px] font-bold text-white disabled:bg-[#B6B6B6]"
            >
              {isLoading ? '解析中...' : '解析'}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={groups.length === 0 || isLoading}
              className="h-10 w-28 rounded-[8px] bg-[#8ECA2E] text-[16px] font-bold text-white disabled:bg-[#B6B6B6]"
            >
              {isLoading ? '导入中...' : '确认导入'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证文件创建成功**

Run: `ls src/components/ImportModal.tsx`
Expected: `src/components/ImportModal.tsx` 文件存在

- [ ] **Step 3: 提交**

```bash
git add src/components/ImportModal.tsx
git commit -m "feat: add ImportModal component with input and preview states"
```

---

## Task 5: 在 RequirementPanel 中接入上传按钮

**Files:**
- Modify: `src/components/RequirementPanel.tsx`

- [ ] **Step 1: 修改 `src/components/RequirementPanel.tsx`**

在顶部工具栏区域找到这行（约 line 562）：
```tsx
<ActionIconButton type="upload-dark" disabled={false} onClick={() => {}} />
```

替换为：
```tsx
<ActionIconButton
  type="upload-dark"
  disabled={!cycleId || cycle?.status === 'CLOSED'}
  onClick={() => setShowImportModal(true)}
/>
```

在 state 区域添加：
```tsx
const [showImportModal, setShowImportModal] = useState(false)
```

在文件顶部 import 区域添加：
```tsx
import ImportModal from './ImportModal'
```

在组件 return 的 JSX 中，在 `{showSwitchCycleConfirm && ...}` 等 ConfirmDialog 之后添加：
```tsx
{showImportModal && cycleId && (
  <ImportModal
    cycleId={cycleId}
    onClose={() => setShowImportModal(false)}
    onImportComplete={onRefresh}
  />
)}
```

- [ ] **Step 2: 验证修改正确**

Run: `grep -n "ImportModal" src/components/RequirementPanel.tsx`
Expected: 能看到 import 语句和使用处

- [ ] **Step 3: 提交**

```bash
git add src/components/RequirementPanel.tsx
git commit -m "feat: wire upload button to ImportModal in RequirementPanel"
```

---

## Task 6: 环境变量配置

**Files:**
- Modify: `.env.example`（如果不存在则创建）

- [ ] **Step 1: 添加 `MINIMAX_API_KEY` 到 `.env.example`**

```bash
# 如果 .env.example 不存在
touch .env.example

# 添加内容
echo -e "\n# LLM Provider (Minimax)\nMINIMAX_API_KEY=your_api_key_here" >> .env.example
```

- [ ] **Step 2: 确认添加成功**

Run: `grep MINIMAX .env.example`
Expected: `MINIMAX_API_KEY=your_api_key_here`

- [ ] **Step 3: 提交**

```bash
git add .env.example
git commit -m "chore: add MINIMAX_API_KEY to .env.example"
```

---

## 自检清单

1. **Spec 覆盖**：所有 spec 中的功能（输入态、预览态、修改组名、多选合并、删除）都在 Task 4 中实现
2. **占位符检查**：无 TBD/TODO，所有步骤都有实际代码
3. **类型一致性**：
   - `parseWorkload` 的输入 `existingGroups: { id: number; name: string }[]` 与 Prisma 查询结果匹配
   - `ParsedGroup.action` 使用 `'MATCH' | 'CREATE_NEW'` 与 LLM prompt 输出匹配
   - `Decision.action` 使用 `'MERGE' | 'CREATE'` 与前端状态转换匹配
4. **API 路径**：`/api/import/parse` 和 `/api/import/confirm` 正确
5. **设计师匹配**：在 confirm API 中通过 `prisma.user.findFirst` 匹配账号名

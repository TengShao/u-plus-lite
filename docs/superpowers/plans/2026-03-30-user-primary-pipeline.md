# 用户主要负责管线功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增用户"主要负责管线"字段，注册时选择，管理员可修改，新建需求组时自动选中对应管线。

**Architecture:**
- 在 User 模型添加 `primaryPipeline` 字段 (可选字符串)
- NextAuth session 中增加 `primaryPipeline` 字段传递
- 注册页面和用户管理 API 支持该字段的读写
- 创建需求组时根据当前用户的 primaryPipeline 预设管线下拉框

**Tech Stack:** Next.js 14, Prisma, NextAuth.js, SQLite, Tailwind CSS

---

## 文件变更概览

| 文件 | 变更类型 | 职责 |
|------|----------|------|
| `prisma/schema.prisma` | 修改 | User 模型增加 primaryPipeline 字段 |
| `src/lib/auth.ts` | 修改 | NextAuth callbacks 增加 primaryPipeline 传递 |
| `src/app/api/auth/register/route.ts` | 修改 | 注册 API 接受 primaryPipeline 参数 |
| `src/app/register/page.tsx` | 修改 | 注册表单增加管线选择下拉框 |
| `src/app/api/users/route.ts` | 修改 | PATCH 支持更新 primaryPipeline，GET 返回该字段 |
| `src/app/page.tsx` | 修改 | 传递 session 数据给 RequirementPanel |
| `src/components/RequirementPanel.tsx` | 修改 | 传递用户 primaryPipeline 给展开卡片 |
| `src/components/RequirementCardExpanded.tsx` | 修改 | 根据 isDraft 和用户 primaryPipeline 预设管线值 |

---

## Task 1: 数据库迁移 - 添加 primaryPipeline 字段

**Files:**
- Modify: `prisma/schema.prisma:10-22`

- [ ] **Step 1: 修改 Prisma schema**

```prisma
model User {
  id              Int      @id @default(autoincrement())
  name            String   @unique
  password        String
  role            String   @default("MEMBER")
  level           String?
  primaryPipeline String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  createdCycles       BillingCycle[]      @relation("CycleCreator")
  createdRequirements RequirementGroup[]  @relation("RequirementCreator")
  workloads           Workload[]
}
```

- [ ] **Step 2: 运行数据库迁移**

Run: `npx prisma migrate dev --name add_user_primary_pipeline`
Expected: Migration created and applied successfully

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add primaryPipeline field to User model"
```

---

## Task 2: NextAuth Session 传递 primaryPipeline

**Files:**
- Modify: `src/lib/auth.ts:20`, `src/lib/auth.ts:30`, `src/lib/auth.ts:42`

- [ ] **Step 1: 修改 authorize 函数返回 primaryPipeline**

```typescript
return { id: String(user.id), name: user.name, role: user.role, level: user.level, primaryPipeline: user.primaryPipeline }
```

- [ ] **Step 2: 修改 jwt callback 添加 primaryPipeline**

```typescript
if (user) {
  token.id = user.id
  token.role = user.role
  token.level = user.level
  token.name = user.name
  token.primaryPipeline = user.primaryPipeline
}
```

- [ ] **Step 3: 修改 session callback 返回 primaryPipeline**

```typescript
session.user.primaryPipeline = token.primaryPipeline as string | null
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: pass primaryPipeline through NextAuth session"
```

---

## Task 3: 注册 API 支持 primaryPipeline

**Files:**
- Modify: `src/app/api/auth/register/route.ts:6`, `src/app/api/auth/register/route.ts:24-30`, `src/app/api/auth/register/route.ts:33`

- [ ] **Step 1: 修改 API 接收 primaryPipeline**

```typescript
const { name, password, confirmPassword, role, level, primaryPipeline } = await req.json()
```

- [ ] **Step 2: 修改 user.create 添加 primaryPipeline**

```typescript
const user = await prisma.user.create({
  data: {
    name,
    password: hashedPassword,
    role: role || 'MEMBER',
    level: level || null,
    primaryPipeline: primaryPipeline || null,
  },
})
```

- [ ] **Step 3: 修改返回数据包含 primaryPipeline**

```typescript
return NextResponse.json({ id: user.id, name: user.name, role: user.role, level: user.level, primaryPipeline: user.primaryPipeline })
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat: register API accepts primaryPipeline field"
```

---

## Task 4: 注册页面增加管线选择下拉框

**Files:**
- Modify: `src/app/register/page.tsx`

- [ ] **Step 1: 添加 state 和 API 调用**

```typescript
const [primaryPipeline, setPrimaryPipeline] = useState('')
const [pipelines, setPipelines] = useState<string[]>([])

useEffect(() => {
  fetch('/api/settings')
    .then(r => r.json())
    .then(data => {
      const names = data.map((p: any) => p.name)
      setPipelines(names)
    })
}, [])
```

- [ ] **Step 2: 修改 handleSubmit 包含 primaryPipeline**

```typescript
body: JSON.stringify({ name, password, confirmPassword, primaryPipeline }),
```

- [ ] **Step 3: 在密码确认输入框后添加管线选择下拉框**

```tsx
<select
  value={primaryPipeline}
  onChange={(e) => setPrimaryPipeline(e.target.value)}
  className="w-full rounded border px-3 py-2 outline-none focus:border-blue-500"
>
  <option value="">选择主要负责管线（可选）</option>
  {pipelines.map(p => <option key={p} value={p}>{p}</option>)}
</select>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/register/page.tsx
git commit -m "feat: register page adds pipeline selector"
```

---

## Task 5: 用户管理 API 支持 primaryPipeline

**Files:**
- Modify: `src/app/api/users/route.ts`

- [ ] **Step 1: GET 返回中包含 primaryPipeline**

```typescript
const users = await prisma.user.findMany({
  select: { id: true, name: true, role: true, level: true, primaryPipeline: true },
  orderBy: { name: 'asc' },
})
```

- [ ] **Step 2: PATCH 支持更新 primaryPipeline**

```typescript
const { userId, role, level, name, primaryPipeline } = await req.json()
const data: Record<string, string> = {}
if (role) data.role = role
if (level !== undefined) data.level = level
if (name !== undefined) data.name = name
if (primaryPipeline !== undefined) data.primaryPipeline = primaryPipeline

const user = await prisma.user.update({
  where: { id: userId },
  data,
  select: { id: true, name: true, role: true, level: true, primaryPipeline: true },
})
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/users/route.ts
git commit -m "feat: users API supports primaryPipeline field"
```

---

## Task 6: 传递用户 primaryPipeline 到 RequirementCardExpanded

**Files:**
- Modify: `src/app/page.tsx:50-63`, `src/components/RequirementPanel.tsx:28-38`, `src/components/RequirementPanel.tsx:614`

- [ ] **Step 1: page.tsx 传递 session 给 RequirementPanel**

```tsx
<RequirementPanel
  cycleId={selectedCycleId}
  searchQuery={searchQuery}
  refreshKey={refreshKey}
  onRefresh={refresh}
  onDraftChange={setHasDraft}
  userPrimaryPipeline={session.user.primaryPipeline}
/>
```

- [ ] **Step 2: RequirementPanel 接收 userPrimaryPipeline prop**

```typescript
export default function RequirementPanel({
  cycleId,
  searchQuery,
  refreshKey,
  onRefresh,
  onDraftChange,
  userPrimaryPipeline,
}: {
  cycleId: number | null
  searchQuery: string
  refreshKey: number
  onRefresh: () => void
  onDraftChange?: (hasDraft: boolean) => void
  userPrimaryPipeline?: string | null
})
```

- [ ] **Step 3: 传递 userPrimaryPipeline 给 RequirementCardExpanded**

```tsx
<RequirementCardExpanded
  data={rg}
  cycleId={cycleId}
  cycleStatus={cycle?.status || 'OPEN'}
  onCollapse={handleCollapse}
  onRefresh={onRefresh}
  onDirtyChange={setHasUnsaved}
  allRequirements={requirements}
  onExpandById={(id) => { setHasUnsaved(false); setExpandedId(id) }}
  onDraftResolved={handleDraftResolved}
  pipelineSettings={pipelineSettings}
  onDeleteRequest={(id) => setPendingDeleteId(id)}
  onDiscardRequest={(id) => setPendingDiscardId(id)}
  onDuplicateRequest={(id, name) => { setPendingDuplicateId(id); setPendingDuplicateName(name) }}
  onCompleteRequest={handleCompleteRequest}
  isDraft={rg.id === activeDraftId}
  defaultPipeline={rg.id === activeDraftId ? userPrimaryPipeline : undefined}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/RequirementPanel.tsx
git commit -m "feat: pass userPrimaryPipeline to RequirementCardExpanded"
```

---

## Task 7: RequirementCardExpanded 根据 defaultPipeline 预设管线

**Files:**
- Modify: `src/components/RequirementCardExpanded.tsx:49`, `src/components/RequirementCardExpanded.tsx:63`, `src/components/RequirementCardExpanded.tsx:74`

- [ ] **Step 1: 添加 defaultPipeline prop**

```typescript
onDuplicateRequest?: (id: number, name: string) => void
onCompleteRequest?: (id: number) => void
defaultPipeline?: string | null
isDraft?: boolean
```

- [ ] **Step 2: 修改 pipeline state 初始化逻辑**

```typescript
const [pipeline, setPipeline] = useState(data.pipeline || defaultPipeline || '')
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RequirementCardExpanded.tsx
git commit -m "feat: RequirementCardExpanded defaults pipeline from user primaryPipeline"
```

---

## Task 8: 测试完整流程

- [ ] **Step 1: 测试注册新用户选择管线**
  - 访问 /register
  - 填写信息并选择管线
  - 注册成功后验证用户数据

- [ ] **Step 2: 测试创建需求组自动选中管线**
  - 以有 primaryPipeline 的用户登录
  - 新建需求组
  - 验证管线下拉框自动选中用户的 primaryPipeline

- [ ] **Step 3: 测试管理员修改用户管线**
  - 以管理员身份登录
  - 找到用户管理入口（如有）或直接调用 API 修改
  - 验证修改生效

---

## 验证清单

- [ ] 注册页面显示管线选择下拉框
- [ ] 注册时可选择管线并保存
- [ ] 用户登录后 session 包含 primaryPipeline
- [ ] 新建需求组时管线自动选中用户的 primaryPipeline
- [ ] 用户管理 API 可以查询和修改 primaryPipeline
- [ ] 所有数据库迁移正常运行

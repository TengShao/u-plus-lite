# 管线管理 Tab 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在设置页面新增「管线管理」Tab，实现管线的增删改功能，删除时级联清除关联的预算项和需求组的管线字段

**Architecture:**
- 将现有的管线增删改功能从"预算项管理" Tab 拆分到独立的"管线管理" Tab
- DELETE API 修改为删除前先将关联数据迁移到"其他"管线，再执行删除
- PATCH API 修改为同步更新 RequirementGroup.pipeline 字段
- 前端通过共享的 `pipelines` state 实现跨 Tab 同步

**Tech Stack:** Next.js 14 App Router, Prisma, SQLite, React (useState/useEffect)

---

## 文件变更概览

| 文件 | 变更 |
|------|------|
| `src/app/api/settings/pipelines/[id]/route.ts` | 修改 PATCH/DELETE 实现级联更新 |
| `src/components/AdminSettingsModal.tsx` | 新增 Tab、拆分管线管理 UI |

---

## Task 1: 修改 PATCH API（管线重命名时同步更新 RequirementGroup）

**Files:**
- Modify: `src/app/api/settings/pipelines/[id]/route.ts`

- [ ] **Step 1: 查看当前 PATCH 实现**

```ts
// 当前代码（需修改）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  // ... 验证逻辑 ...
  const { name } = await req.json()
  // 只更新了 PipelineSetting.name，没有更新 RequirementGroup
  const pipeline = await prisma.pipelineSetting.update({ ... })
  return NextResponse.json(pipeline)
}
```

- [ ] **Step 2: 修改 PATCH 实现**

将以下代码替换到 `src/app/api/settings/pipelines/[id]/route.ts` 的 PATCH 函数中：

```ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })

  // 先获取旧名称
  const oldPipeline = await prisma.pipelineSetting.findUnique({
    where: { id: parseInt(params.id) },
  })
  if (!oldPipeline) return NextResponse.json({ error: '管线不存在' }, { status: 404 })

  const oldName = oldPipeline.name
  const newName = name.trim()

  // 如果名称未变，直接返回
  if (oldName === newName) return NextResponse.json(oldPipeline)

  // 事务：更新管线名称 + 同步更新 RequirementGroup
  await prisma.$transaction([
    prisma.pipelineSetting.update({
      where: { id: parseInt(params.id) },
      data: { name: newName },
    }),
    prisma.requirementGroup.updateMany({
      where: { pipeline: oldName },
      data: { pipeline: newName },
    }),
  ])

  return NextResponse.json({ ...oldPipeline, name: newName })
}
```

- [ ] **Step 3: 验证语法和逻辑**

确认文件导入完整（需要 `RequirementGroup` 模型）

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/pipelines/[id]/route.ts
git commit -m "feat: cascade pipeline name update to RequirementGroup.table"
```

---

## Task 2: 修改 DELETE API（删除管线时级联迁移数据）

**Files:**
- Modify: `src/app/api/settings/pipelines/[id]/route.ts`

- [ ] **Step 1: 查看当前 DELETE 实现**

```ts
// 当前代码（需修改）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  // ... 验证逻辑 ...
  // 直接删除，没有迁移关联数据
  await prisma.pipelineSetting.delete({ where: { id: parseInt(params.id) } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: 修改 DELETE 实现**

将以下代码追加/替换到 `src/app/api/settings/pipelines/[id]/route.ts` 的 DELETE 函数中：

```ts
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const pipelineId = parseInt(params.id)

  // 获取待删除管线信息
  const pipelineToDelete = await prisma.pipelineSetting.findUnique({
    where: { id: pipelineId },
  })
  if (!pipelineToDelete) return NextResponse.json({ error: '管线不存在' }, { status: 404 })

  // 不能删除"其他"管线
  if (pipelineToDelete.name === '其他') {
    return NextResponse.json({ error: '不能删除"其他"管线' }, { status: 400 })
  }

  // 查找或创建"其他"管线
  let otherPipeline = await prisma.pipelineSetting.findUnique({
    where: { name: '其他' },
  })
  if (!otherPipeline) {
    otherPipeline = await prisma.pipelineSetting.create({
      data: { name: '其他' },
    })
  }

  // 事务：迁移数据 + 删除管线
  await prisma.$transaction([
    // 1. 将 BudgetItemSetting 的 pipelineId 指向"其他"
    prisma.budgetItemSetting.updateMany({
      where: { pipelineId },
      data: { pipelineId: otherPipeline.id },
    }),
    // 2. 将 RequirementGroup.pipeline 改为"其他"
    prisma.requirementGroup.updateMany({
      where: { pipeline: pipelineToDelete.name },
      data: { pipeline: '其他' },
    }),
    // 3. 删除管线
    prisma.pipelineSetting.delete({
      where: { id: pipelineId },
    }),
  ])

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: 验证语法**

确认 Prisma 模型引用正确（`prisma.pipelineSetting`, `prisma.budgetItemSetting`, `prisma.requirementGroup`）

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/pipelines/[id]/route.ts
git commit -m "feat: cascade delete pipeline - migrate budget items and requirement groups to '其他'"
```

---

## Task 3: 修改前端 - 新增 Tab 类型和状态

**Files:**
- Modify: `src/components/AdminSettingsModal.tsx`

- [ ] **Step 1: 添加 PipelineTab 类型和状态**

在 `type Tab = 'members' | 'budget'` 后面添加 `'pipelines'`，变成：
```ts
type Tab = 'members' | 'pipelines' | 'budget'
```

- [ ] **Step 2: 添加管线管理相关状态**

在现有状态声明区域添加（注意：pipeline 编辑状态复用 `editingBudgetItem` 的模式会被拆分，所以需要新增 `editingPipeline`）：

```ts
// 在现有状态附近添加
type EditingPipeline = { id: number; name: string }

const [editingPipeline, setEditingPipeline] = useState<EditingPipeline | null>(null)
const [deletingPipelineId, setDeletingPipelineId] = useState<number | null>(null)
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminSettingsModal.tsx
git commit -m "feat: add pipeline tab type and editing state"
```

---

## Task 4: 修改前端 - Tab Header 添加「管线管理」按钮

**Files:**
- Modify: `src/components/AdminSettingsModal.tsx`

- [ ] **Step 1: 在 Tab header 中添加管线管理按钮**

在 `activeTab === 'budget'` 判断后面添加：

```tsx
<button
  onClick={() => setActiveTab('pipelines')}
  className={`text-lg font-bold ${activeTab === 'pipelines' ? 'text-black' : 'text-gray-400'}`}
>
  管线管理
</button>
```

Tab 顺序为：成员管理 → 管线管理 → 预算项管理

- [ ] **Step 2: Commit**

```bash
git add src/components/AdminSettingsModal.tsx
git commit -m "feat: add pipeline management tab button"
```

---

## Task 5: 实现管线管理 Tab 内容

**Files:**
- Modify: `src/components/AdminSettingsModal.tsx`

- [ ] **Step 1: 在 `activeTab === 'members'` 分支后添加管线管理 Tab 内容**

在 `activeTab === 'members' ? (...) : (...)` 的 else 分支中，找到 `{activeTab === 'members' ? (` 结束位置，添加管线管理 Tab：

```tsx
{activeTab === 'pipelines' ? (
  <>
    <div className="mb-4 flex justify-end">
      <button
        onClick={startAddPipeline}
        disabled={isAddingPipeline}
        className="px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800 disabled:bg-gray-400"
      >
        新增管线
      </button>
    </div>

    {/* 管线列表 */}
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="pb-2">管线名称</th>
          <th className="pb-2">操作</th>
        </tr>
      </thead>
      <tbody>
        {isAddingPipeline && (
          <tr className="border-b bg-gray-50">
            <td className="py-2">
              <input
                type="text"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                className="w-48 rounded border px-2 py-1 text-sm"
                placeholder="管线名称"
                autoFocus
              />
            </td>
            <td className="py-2">
              <div className="flex gap-2">
                <button onClick={confirmAddPipeline} className="text-green-600 hover:text-green-700 text-sm">确认</button>
                <button onClick={cancelAddPipeline} className="text-gray-500 hover:text-gray-700 text-sm">取消</button>
              </div>
            </td>
          </tr>
        )}
        {pipelines
          .slice()
          .sort((a, b) => {
            if (a.name === '其他') return 1
            if (b.name === '其他') return -1
            return a.name.localeCompare(b.name, 'zh-CN')
          })
          .map((pl) => (
            <tr key={pl.id} className={`border-b ${editingPipeline?.id === pl.id ? 'bg-gray-50' : ''}`}>
              {editingPipeline?.id === pl.id ? (
                <>
                  <td className="py-2">
                    <input
                      type="text"
                      value={editingPipeline.name}
                      onChange={(e) => setEditingPipeline({ ...editingPipeline, name: e.target.value })}
                      className="w-48 rounded border px-2 py-1 text-sm"
                      autoFocus
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button onClick={confirmEditPipeline} className="text-green-600 hover:text-green-700 text-sm">确认</button>
                      <button onClick={cancelEditPipeline} className="text-gray-500 hover:text-gray-700 text-sm">取消</button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="py-2 font-medium">{pl.name}</td>
                  <td className="py-2">
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEditPipeline(pl)}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                        disabled={pl.name === '其他'}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => confirmDeletePipeline(pl)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        disabled={pl.name === '其他'}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
      </tbody>
    </table>
  </>
) : activeTab === 'budget' ? (...) : (...)}
```

- [ ] **Step 2: 添加 startEditPipeline, confirmEditPipeline, cancelEditPipeline 函数**

在 `startAddPipeline` 函数附近添加：

```ts
function startEditPipeline(pipeline: Pipeline) {
  setEditingPipeline({ id: pipeline.id, name: pipeline.name })
}

function cancelEditPipeline() {
  setEditingPipeline(null)
}

async function confirmEditPipeline() {
  if (!editingPipeline) return
  if (!editingPipeline.name.trim()) {
    alert('管线名称不能为空')
    return
  }
  const res = await fetch(`/api/settings/pipelines/${editingPipeline.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: editingPipeline.name.trim() }),
  })
  if (res.ok) {
    setEditingPipeline(null)
    fetchSettings() // 刷新管线列表，也会更新预算项管理 Tab
  } else {
    const err = await res.json()
    alert(err.error || '更新失败')
  }
}

async function confirmDeletePipeline(pipeline: Pipeline) {
  if (!confirm(`确定删除管线「${pipeline.name}」？\n删除后，该管线关联的预算项将移至"其他"管线，需求组中的管线信息也将更新。`)) {
    return
  }
  const res = await fetch(`/api/settings/pipelines/${pipeline.id}`, { method: 'DELETE' })
  if (res.ok) {
    fetchSettings() // 刷新管线列表
  } else {
    const err = await res.json()
    alert(err.error || '删除失败')
  }
}
```

- [ ] **Step 3: 确认预算项管理 Tab 内容保持不变**

确保现有的 `activeTab === 'budget'` 分支完整保留，预算项管理功能不变。

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminSettingsModal.tsx
git commit -m "feat: add pipeline management tab with edit/delete functionality"
```

---

## Task 6: 从预算项管理 Tab 移除管线操作按钮

**Files:**
- Modify: `src/components/AdminSettingsModal.tsx`

- [ ] **Step 1: 移除预算项管理 Tab 中的「+ 新增管线」按钮**

在预算项管理 Tab 中，删除以下按钮（位于预算项管理 Tab 开头）：

```tsx
<button
  onClick={startAddPipeline}
  className="px-4 py-2 bg-black text-white rounded text-sm whitespace-nowrap"
>
  + 新增管线
</button>
```

- [ ] **Step 2: 移除新增管线的输入框**

删除 `isAddingPipeline && (...)` 代码块（在预算项管理 Tab 区域内的）

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminSettingsModal.tsx
git commit -m "refactor: remove pipeline CRUD from budget management tab"
```

---

## Task 7: 验证和测试

- [ ] **Step 1: 本地运行验证**

```bash
npm run dev
```

打开 http://localhost:3000 → 登录 → 点击设置 → 检查三个 Tab 是否正确显示

- [ ] **Step 2: 测试管线重命名**

在管线管理 Tab 编辑某管线名称 → 确认 API 返回成功 → 确认列表更新 → 切换到预算项管理 Tab 确认管线名称同步更新

- [ ] **Step 3: 测试管线删除**

删除某管线 → 确认弹出确认框 → 确认删除后预算项移至"其他"管线 → 确认预算项管理 Tab 中显示正确

- [ ] **Step 4: Commit 最终验证**

```bash
git add -A
git commit -m "feat: complete pipeline management tab feature"
```

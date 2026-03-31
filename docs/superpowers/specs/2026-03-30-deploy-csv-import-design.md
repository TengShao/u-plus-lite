# U-Plus-Lite CSV 导入导出与部署流程改造

## 背景

U-Plus-Lite 的管线（Pipeline）和预算项（BudgetItem）数据目前硬编码在 `prisma/seed.ts` 中，随部署脚本自动注入。这导致：
1. 其他团队部署时带有无关的预设数据
2. 无法灵活导入自定义的管线和预算项
3. Web 端缺少管线创建入口

本次改造实现：部署时可选导入 CSV 数据，支持管理员在 Web 端从零开始管理。

## 数据关系

```
RequirementGroup.pipeline   ← 自由字符串（不做外键约束）
RequirementGroup.budgetItem ← 自由字符串（不做外键约束）

PipelineSetting    ← Lookup：管线可选列表
BudgetItemSetting  ← Lookup：预算项可选列表（关联到某个管线）
```

## 设计概要

### 产出物

1. **导出工具** `prisma/export.ts` — 从数据库导出当前管线和预算项为 CSV
2. **导入工具** `prisma/import.ts` — 从 CSV 导入管线和预算项到数据库
3. **部署脚本改造** — 移除自动注入，提供可选 CSV 导入步骤
4. **Web 端改造** — AdminSettingsModal 支持创建管线，预算项关联管线可选

---

## 详细设计

### 1. CSV 导出工具

**文件：** `prisma/export.ts`

**命令：** `npx ts-node prisma/export.ts`

**输出目录：** `prisma/exports/`

**输出文件：**

`pipelines.csv`：
```csv
name
UGC研发
UGC运营
玩法
系统
IP
海外
```

`budget_items.csv`：
```csv
pipeline,name,category
UGC研发,UGC商业化功能,
UGC研发,编辑器WEB端功能开发,
玩法,新S级玩法设计与落地Q1,
```

（第三列 `category` 为保留扩展字段，导出为空，导入时忽略）

**导出顺序：** 管线按 `id` 升序（与创建顺序一致）；预算项按 `pipelineId` 升序排列。

---

### 2. CSV 导入工具

**文件：** `prisma/import.ts`

**命令：**
```bash
# 指定文件路径
npx ts-node prisma/import.ts --pipelines=/path/to/pipelines.csv --budget-items=/path/to/budget_items.csv

# 粘贴内容（交互式）
npx ts-node prisma/import.ts --pipelines=- --budget-items=-
# 脚本提示后直接粘贴 CSV 内容，Ctrl+D 结束

# 单独导入管线
npx ts-node prisma/import.ts --pipelines=/path/to/pipelines.csv

# 单独导入预算项
npx ts-node prisma/import.ts --budget-items=/path/to/budget_items.csv
```

**参数说明：**
- `--pipelines` — pipelines.csv 路径，`-` 表示从标准输入读取
- `--budget-items` — budget_items.csv 路径，`-` 表示从标准输入读取
- 两个参数均可省略（表示跳过该文件）

**导入流程：**

1. **管线导入**（若指定了 --pipelines）：
   - 按行读取 `pipelines.csv`（跳过 header）
   - 按顺序 upsert：`where: { name }` → 不存在则 create
   - 输出：已存在管线跳过数量、新创建管线数量

2. **确保"其他"管线存在**：
   - 查询 `PipelineSetting` 中是否存在 `name = '其他'` 的记录
   - 不存在则自动创建

3. **预算项导入**（若指定了 --budget-items）：
   - 按行读取 `budget_items.csv`（跳过 header）
   - 对每一行：
     - `pipeline` 列有值：查询对应管线，不存在则自动创建
     - `pipeline` 列为空：归属到"其他"管线（pipelineId = '其他' 的 id）
     - 按 `pipelineId + name` upsert 预算项（唯一约束）
   - 输出：已存在预算项跳过数量、新创建预算项数量

**格式校验：**
- header 必须是 `name`（pipelines）或 `pipeline,name`（budget_items）
- 空行自动跳过
- 缺少必填列时报错退出

**输出示例：**
```
管线导入完成：跳过 2，已创建 4
预算项导入完成：跳过 10，已创建 75
```

---

### 3. 部署脚本改造

**文件：** `scripts/deploy.sh`、`scripts/deploy.ps1`

**改动点：**

#### 3.1 seed.ts 管线/预算项部分移除

部署脚本中覆盖 `seed.ts` 时，移除 BUDGET_ITEMS 相关代码，仅保留用户创建逻辑：

```typescript
// seed.ts 只创建管理员账号，不创建管线/预算项
async function main() {
  // ... admin user creation only
  console.log('Seed complete: admin user created')
}
```

#### 3.2 部署完成后新增 Step 8

在 Step 7（PM2 启动完成）之后，新增交互步骤：

```
[8/8] 是否导入预算项和管线数据？

  方式一：指定 CSV 文件路径
  方式二：直接粘贴 CSV 内容
  方式三：跳过（稍后通过 Web 端手动添加）

  请选择 [3/s/p]:
    1 - 指定文件路径
    2 - 粘贴内容
    3 - 跳过（推荐）

  您选择: 3
  跳过导入，管理员可在 Web 端手动添加管线/预算项。
```

选 1：提示输入文件路径（支持同时指定管线 CSV 和预算项 CSV）
选 2：提示粘贴 pipelines.csv 内容，然后提示粘贴 budget_items.csv
选 3：继续，跳过后管理员在 Web 端手动添加

#### 3.3 部署脚本引入导入工具

将 `prisma/import.ts` 纳入项目（通过 curl/wget 从 GitHub 获取，或直接内联在脚本中）。

---

### 4. Web 端管线创建入口

**文件：** `src/components/AdminSettingsModal.tsx`

**改动点：**

#### 4.1 管线创建入口

在"预算项管理"标签页顶部左侧，新增"新增管线"按钮：

```tsx
<div className="mb-4 flex justify-between">
  <button onClick={startAddPipeline} className="px-4 py-2 bg-black text-white rounded text-sm">
    + 新增管线
  </button>
  {/* 搜索框 ... */}
</div>
```

点击后出现内联输入框：

```tsx
{isAddingPipeline && (
  <div className="flex gap-2 mb-2">
    <input
      type="text"
      value={newPipelineName}
      onChange={(e) => setNewPipelineName(e.target.value)}
      placeholder="管线名称"
      className="border rounded px-2 py-1 text-sm"
      autoFocus
    />
    <button onClick={confirmAddPipeline} className="text-green-600 text-sm">确认</button>
    <button onClick={cancelAddPipeline} className="text-gray-500 text-sm">取消</button>
  </div>
)}
```

#### 4.2 预算项创建时管线可选

创建预算项的管线下拉，改为可选（空值允许）：

```tsx
<select value={newItemPipelineId ?? ''} onChange={...}>
  <option value="">不关联管线</option>
  {pipelines.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
</select>
```

API `POST /api/settings/budget-items` 接收 `pipelineId` 可选。

#### 4.3 预算项按管线分组展示

在预算项管理列表中，未关联管线的预算项显示在"其他"分组：

```tsx
// '其他' 分组排在最后
const sortedPipelines = [...pipelines].sort((a, b) => {
  if (a.name === '其他') return 1
  if (b.name === '其他') return -1
  return a.id - b.id
})
```

---

### 5. Schema 改动

**文件：** `prisma/schema.prisma`

`BudgetItemSetting.pipelineId` 改为可选：

```prisma
model BudgetItemSetting {
  id         Int             @id @default(autoincrement())
  name       String
  pipelineId Int?            # ← 改为可选
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  pipeline PipelineSetting? @relation(fields: [pipelineId], references: [id], onDelete: Cascade)

  @@unique([pipelineId, name])  # SQLite 中 NULL 值不参与唯一约束，行为符合预期
}
```

**迁移文件：** `prisma/migrations/<timestamp>_make_pipeline_id_optional/migration.sql`

```sql
-- SQLite 不支持 DROP NOT NULL，需要重建表
-- Prisma Migrate 会生成正确的迁移逻辑
```

---

### 6. API 改动

**文件：** `src/app/api/settings/budget-items/route.ts`

`POST` 处理 `pipelineId` 可选：

```typescript
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return unauthorized()
  if (session.user.role !== 'ADMIN') return forbidden()

  const { name, pipelineId } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '名称不能为空' }, { status: 400 })

  // pipelineId 可选，为 null 或不传时表示不关联管线
  const item = await prisma.budgetItemSetting.create({
    data: {
      name: name.trim(),
      pipelineId: pipelineId || null,
    },
  })
  return NextResponse.json(item)
}
```

---

## 实现顺序

1. **prisma/export.ts** — 独立工具，先实现便于导出当前数据
2. **Schema 迁移** — `pipelineId` 改为可选
3. **prisma/import.ts** — 导入工具，支持自动创建"其他"管线
4. **Web 端改动** — AdminSettingsModal 管线创建入口 + 管线可选
5. **API 改动** — budget-items POST 支持 pipelineId 可选
6. **部署脚本改造** — 移除 BUDGET_ITEMS，新增 Step 8
7. **文档更新** — `docs/deploy-guide.md` 更新部署流程说明

---

## 风险与注意事项

- **Schema 迁移**：SQLite 修改 NOT NULL 约束需要重建表，迁移时数据库文件较大的情况需关注
- **"其他"管线**：作为保留名称，导入工具和 Web 端都需确保其存在
- **pipelines.csv 顺序**：按文件顺序导入，与 RequirementGroup.pipeline 的自由字符串特性一致，顺序仅影响下拉框展示顺序

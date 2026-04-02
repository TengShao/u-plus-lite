# 周期管线记忆功能设计

## 背景

用户反馈：每次新建需求组时，都需要重新选择管线。希望系统能记住上一次成功提交需求组时选择的管线，在新建时自动选中。

原 `lastUsedPipeline` 实现存在两个问题：
1. NextAuth JWT session 不会自动同步服务器更新，导致客户端拿到的值是旧的
2. `lastUsedPipeline` 是跨周期的，不符合"新月结周期时重置"的需求

## 目标

- 记住当前用户在当前月结周期内最后一次成功提交需求组时选择的管线
- 新建需求组时自动预填该记忆值
- 新月结周期开始时自动重置，回到用户注册信息中的主要负责管线（`pipelines[0]`）

## 方案

### 1. 新增 Prisma 模型

```prisma
model UserCyclePipeline {
  userId    Int
  cycleId   Int
  pipeline  String

  @@id([userId, cycleId])
}
```

- `userId` — 用户 ID
- `cycleId` — 月结周期 ID
- `pipeline` — 该用户在该周期最后提交的管线值
- 复合主键 `[userId, cycleId]`，确保一个用户一个周期只有一条记录

### 2. API 改动

#### `POST /api/requirements`（新建需求组草稿）

新建草稿时**不写入** `UserCyclePipeline`，因为此时还没有选择管线。

#### `PATCH /api/requirements/[id]`（提交表单）

提交成功后，upsert `UserCyclePipeline` 记录：

```ts
await prisma.userCyclePipeline.upsert({
  where: { userId_cycleId: { userId: parseInt(session.user.id), cycleId: data.cycleId } },
  update: { pipeline: data.pipeline },
  create: { userId: parseInt(session.user.id), cycleId: data.cycleId, pipeline: data.pipeline },
})
```

#### `DELETE /api/requirements/[id]`（删除需求组）

删除需求组时**不删除** `UserCyclePipeline`，因为删除草稿不代表要清除记忆。

#### GET `UserCyclePipeline`（新建草稿时读取记忆值）

在 `RequirementPanel` 中，`cycleId` 切换时请求：

```
GET /api/users/cycle-pipeline?cycleId={cycleId}
```

返回当前用户在当前周期的记忆管线值，无记录时返回 `null`。

### 3. 新增 API 路由

#### `GET /api/users/cycle-pipeline?cycleId={cycleId}`

- 查询参数：`cycleId`（必填）
- 返回：`{ pipeline: string | null }`
- 逻辑：查询 `UserCyclePipeline`，无记录返回 `null`

### 4. 前端改动

#### `RequirementPanel`

- 新增 state：`cyclePipelineMemory: string | null`
- `cycleId` 切换时，GET `/api/users/cycle-pipeline?cycleId={cycleId}` 更新 `cyclePipelineMemory`
- 将 `cyclePipelineMemory` 作为 `defaultPipeline` 传给 `RequirementCardExpanded`
- 优先级：`cyclePipelineMemory` > `pipelines[0]`（用户注册主管线）

#### `RequirementCardExpanded`

- 移除所有 `lastUsedPipeline` 相关逻辑
- `defaultPipeline` 来源改为 `cyclePipelineMemory || pipelines[0]`
- 提交成功后不需要主动更新 `cyclePipelineMemory`，因为下一次新建草稿时会重新从服务器拉

#### `page.tsx`

- 移除 `userPrimaryPipeline` prop 传递逻辑（`session.user.lastUsedPipeline` 相关）
- `RequirementPanel` 不再接收 `userPrimaryPipeline` prop

### 5. 数据库迁移

```bash
npx prisma migrate dev --name add_user_cycle_pipeline
```

### 6. 废弃/清理

#### 删除字段

- `User.lastUsedPipeline` 字段从 `schema.prisma` 移除
- `User` 模型中移除 `lastUsedPipeline String?`

#### 清理代码

- `src/types/index.ts` — 移除 `lastUsedPipeline` 类型定义
- `src/lib/auth.ts` — 移除 JWT callback 中的 `lastUsedPipeline` 同步
- `src/app/api/account/route.ts` — 移除 `lastUsedPipeline` 相关更新逻辑
- `src/app/api/users/route.ts` — 移除 `lastUsedPipeline` 相关更新逻辑
- `src/components/Header.tsx` — 移除 `lastUsedPipeline` 下拉选择相关逻辑
- `src/components/AdminSettingsModal.tsx` — 移除 `lastUsedPipeline` 显示和编辑
- `src/app/page.tsx` — 移除 `userPrimaryPipeline` 相关计算

### 7. 行为总结

| 操作 | 行为 |
|------|------|
| 用户登录，进入某周期 | 无记忆值 → 默认用 `pipelines[0]` |
| 新建需求组草稿 | 预填 `cyclePipelineMemory` 或 `pipelines[0]` |
| 提交需求组表单 | upsert `UserCyclePipeline` |
| 切换到新周期 | `UserCyclePipeline` 无记录 → 默认用 `pipelines[0]` |
| 管理员查看/编辑用户 | 不再显示 `lastUsedPipeline` |

## 影响范围

- 新增 1 个 Prisma model：`UserCyclePipeline`
- 新增 1 个 API 路由：`GET /api/users/cycle-pipeline`
- 修改 2 个 API 路由：POST 和 PATCH 的 `requirements` 相关
- 删除 `User.lastUsedPipeline` 字段及相关所有引用
- 修改 3 个前端组件：`RequirementPanel`、`RequirementCardExpanded`、`page.tsx`
- 删除 2 个前端组件的 `lastUsedPipeline` 相关逻辑：`Header`、`AdminSettingsModal`

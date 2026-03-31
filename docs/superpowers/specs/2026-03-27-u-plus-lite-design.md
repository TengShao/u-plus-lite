# U-Plus-Lite 设计规格文档

> 团队月结工作量记录工具，Web 端应用。

## 1. 技术架构

- **前端**：Next.js 14+ (App Router) + React + Tailwind CSS
- **后端**：Next.js Route Handlers (`/api/*`)
- **ORM**：Prisma
- **数据库**：SQLite (WAL 模式)
- **认证**：NextAuth.js (Credentials Provider, JWT 策略)
- **部署**：先本地 `npm run build && npm start`，后续迁移至公司内部服务器

## 2. 数据模型

### User (用户)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int (PK, auto) | |
| name | String (unique) | 真实姓名，也是「设计师」名称 |
| password | String | bcrypt 哈希 |
| role | Enum: ADMIN, MEMBER | 默认 MEMBER |
| level | Enum: P5, P4, P3, INTERN, OUTSOURCE | 可为空，由管理员分配 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### BillingCycle (月结周期)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int (PK, auto) | |
| label | String | 显示名称，如 "3月" |
| startDate | DateTime | 周期开始日，如 2026-02-26 |
| endDate | DateTime | 周期结束日，如 2026-03-25 |
| status | Enum: OPEN, CLOSED | 默认 OPEN |
| createdBy | Int (FK → User) | 创建者（管理员） |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### RequirementGroup (需求组)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int (PK, auto) | |
| name | String | 需求组名称 |
| status | Enum: INCOMPLETE, COMPLETE | 默认 INCOMPLETE，仅管理员可标记为 COMPLETE |
| rating | Enum: S, A, B, C, D | 拟定评级 |
| module | Enum: 活动, 核心体验, 社交, 常规, 评估诊断 | 设计模块 |
| pipeline | Enum: 系统, 玩法, IP, UGC研发, UGC运营, 海外 | 管线 |
| types | String (JSON) | 类型，多选，如 `["自主","复用"]` |
| budgetItem | String | 预算挂载项 |
| canClose | Boolean | 本月可关闭，默认 true |
| isBuilt | Boolean | 是否已建，默认 false |
| funcPoints | Int | 功能点数（可为空） |
| pageCount | Int | 界面数（可为空） |
| version | Int | 乐观锁版本号，默认 1 |
| createdInCycleId | Int (FK → BillingCycle) | 创建时所属的月结周期 |
| createdBy | Int (FK → User) | 创建者 |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| lastSubmittedAt | DateTime | 最后提交时间（可为空） |

### Workload (投入人天)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int (PK, auto) | |
| userId | Int (FK → User) | |
| requirementGroupId | Int (FK → RequirementGroup) | |
| billingCycleId | Int (FK → BillingCycle) | |
| manDays | Float | 投入人天，保留一位小数 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**约束**：`UNIQUE(userId, requirementGroupId, billingCycleId)`

### 计算字段（不存数据库，API 返回时动态计算）

| 字段 | 公式 |
|------|------|
| 人天系数 | P3=1, P4=1.3, P5=2, 外包=1, 实习=0.2 |
| 换算人天 | 投入人天 × 人天系数 |
| 总投入人天 | 该需求组当前周期所有 Workload.manDays 之和 |
| 总换算人天 | 状态为「未完成」的需求组，在所有月结周期内，所有用户的换算人天累计 |
| 评级标准人天 | S=20, A=10, B=5, C=2, D=0.5 |
| 投入比 | 总换算人天 / 评级标准人天 × 100% |
| 健康度 | 投入比 (70%,110%) → 适合；≥110% → 过饱和；≤70% → 欠饱和 |
| 推荐评级 | 总换算人天 ≤0.5→D, (0.5,2]→C, (2,5]→B, (5,10]→A, >10→S |
| 功能点数推荐值 | 总投入人天 × 0.62 |

## 3. 页面与路由

```
/login     — 登录页
/register  — 注册页
/          — 主页面（需登录）
```

### 主页面布局 (1560×1080 设计稿基准)

- **顶部 (head, 71px)**：左侧 logo + 标题「U-Plus-Lite」+ 设置按钮（仅管理员可见）；居中搜索框；右侧用户信息
- **左侧 (left, 320px)**：月结周期列表（按年份分组，时间倒序）+ 底部固定「新建月结」按钮（仅管理员可见）
- **右侧 (right, 剩余宽度)**：筛选器 + 操作按钮（关闭/开启月结仅管理员可见、新建需求组）+ 需求组模块列表

### 组件拆分

- `Header` — 顶部栏
- `CycleSidebar` — 左侧月结周期列表
  - `CycleCard` — 单个周期卡片（常态/hover/选中态，显示 OPEN/CLOSE 标签）
- `RequirementPanel` — 右侧主面板
  - `FilterBar` — 筛选器
  - `ActionBar` — 操作按钮
  - `RequirementList` — 需求组列表
    - `RequirementCardCollapsed` — 折叠态
    - `RequirementCardExpanded` — 展开态（编辑态）

## 4. API 设计

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（name, password, confirmPassword） |
| POST | `/api/auth/[...nextauth]` | NextAuth 登录/登出/session |

### 月结周期

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cycles` | 获取所有月结周期（时间倒序） |
| POST | `/api/cycles` | 新建月结周期（仅管理员） |
| PATCH | `/api/cycles/:id` | 开启/关闭月结周期（仅管理员） |

### 需求组

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cycles/:cycleId/requirements` | 获取某周期的需求组列表（含计算字段，支持筛选） |
| POST | `/api/requirements` | 新建需求组 |
| PATCH | `/api/requirements/:id` | 更新需求组公共字段（带 version 乐观锁） |
| PATCH | `/api/requirements/:id/complete` | 标记需求组为完成（仅管理员） |
| DELETE | `/api/requirements/:id` | 删除需求组 |

### 投入人天

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/api/requirements/:id/workload` | 提交当前用户的投入人天（body: { billingCycleId, manDays }） |

### 搜索

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/search?q=xxx` | 搜索需求组名称、设计师名称 |

### 筛选参数 (`GET /api/cycles/:cycleId/requirements`)

- `pipeline` — 管线（多选，逗号分隔）
- `rating` — 拟定评级（多选）
- `health` — 健康度（多选）
- `designer` — 设计师 userId（多选）
- `canClose` — 是否可关闭（true/false）
- `q` — 搜索关键词

## 5. 权限控制

| 操作 | ADMIN | MEMBER |
|------|-------|--------|
| 新建/开启/关闭月结周期 | ✅ | ❌ |
| 新建需求组 | ✅ | ✅ |
| 编辑需求组公共字段 | ✅ | ✅（月结 OPEN 时） |
| 提交自己的投入人天 | ✅ | ✅（月结 OPEN 时） |
| 删除需求组 | ✅ | ✅（月结 OPEN 时） |
| 完成需求组 | ✅ | ❌ |
| 月结 CLOSED 时编辑 | ✅ | ❌ |
| 查看设置（管理成员职级/角色） | ✅ | ❌ |

## 6. 认证与注册

- **登录页**：输入姓名 + 密码 → NextAuth 校验 → 成功跳转主页
- **注册页**：输入姓名、密码（≥8位）、确认密码 → 后端校验姓名不重复 → 注册成功自动登录
- **注册时不选职级**，由管理员在设置中分配
- **管理员初始账号**：通过数据库 seed 创建，姓名「邵腾」，密码「88888888」，角色 ADMIN
- **Session**：JWT 策略，包含 userId、name、role、level

## 7. 核心交互

### 需求组生命周期

- 需求组跨月结周期持续存在
- 每个设计师在每个月结周期中分别填写当月投入人天
- 总换算人天 = 状态为「未完成」的需求组在所有周期的累计
- 管理员可标记需求组为「完成」，完成后不再在新周期中出现（历史周期仍可查看）

### 需求组在周期中的显示

- 选中某月结周期时，显示：该周期内有 Workload 记录的所有需求组 + 状态为「未完成」且在该周期之前（含）创建的需求组
- 排序：未完成的在前，已完成的在后

### 折叠态 → 展开态

- 点击折叠态任意处（删除/完成按钮除外）→ 展开
- 同一时间只有一个需求组展开，展开新的会折叠旧的
- 旧的有未保存修改 → 提示「有未保存的修改，是否放弃？」

### 折叠态内容

- 需求组名称 + 设计模块/管线/类型标签
- 健康度标签（合适/过饱和/欠饱和）
- 信息方块：拟定评级、推荐评级、本月可关闭、总投入人天、投入比、参与人数
- 设计师投入列表（最多显示 4 人 + "其他N人"）
- 完成按钮（仅管理员可见）→ 二次确认
- 删除按钮 → 二次确认

### 展开态内容

- 需求名称输入框（带一键清空）
- 动态信息：总投入人天、参与人数、投入比、健康度
- 编辑区：拟定评级、本月可关闭、设计模块、管线、类型（多选）、预算挂载项（联动管线筛选）
- 参与设计师列表（只读，当前用户标记为「你」）
- 投入人天输入区：🦴减少 / 输入框 / 🍗增加，步进 0.1
- 完成按钮（仅管理员可见）→ 二次确认
- 删除按钮 → 二次确认
- 取消按钮 → 二次确认 → 丢弃修改 → 折叠
- 提交按钮 → 校验必填字段 → 保存（乐观锁）→ 折叠
- 必填字段：需求组名称、拟定评级、本月可关闭、设计模块、管线、预算挂载项
- 提交按钮上方显示最后提交时间（YYYY/MM/DD HH:MM）

### 筛选器

- 多选下拉：管线、评级、健康度、设计师
- 单选下拉：是否可关闭
- 「全部」与其他选项互斥
- 设计师列表：「全部」排首位，当前用户排第二位显示为「我」，其余按首字母排序
- 筛选为前端过滤

### 搜索

- 顶部搜索框，前端实时过滤当前周期的需求组列表
- 匹配需求组名称和设计师名称

### 管理员设置

- 设置按钮（仅管理员可见）→ 弹窗
- 管理成员列表：设置职级、设置角色

## 8. 并发控制

- **投入人天**：每用户每需求组每周期一条记录，联合唯一索引，天然无冲突
- **公共字段**：乐观锁（version 字段），提交时 `WHERE id = ? AND version = ?`，不匹配则提示「数据已被其他人修改，请刷新后重试」

## 9. 预算项

预算项为静态数据，按管线分组，存储在前端常量或数据库 seed 中。共 6 条管线，约 80+ 预算项。选择管线后，预算挂载项下拉只显示该管线的预算项。

完整预算项列表见 PRD 文档。

## 10. 数据库初始化 (Seed)

- 创建管理员账号：邵腾 / 88888888 / ADMIN
- 导入预算项数据（如使用数据库存储）

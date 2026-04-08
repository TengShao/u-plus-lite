# 需求组删除所有权校验

## 背景

当前任何 MEMBER 用户都可以删除任意需求组（只要月结周期为 OPEN），无需是创建者。`createdBy` 字段已存在于数据模型中且在创建时被记录，但 DELETE 接口从未校验所有权。需要限制为：非管理员只能删除自己创建的需求组。

## 改动范围

2 个文件，无需数据库迁移。

### 1. API — `src/app/api/requirements/[id]/route.ts`

DELETE handler 的非 ADMIN 分支：

- 查询需求组时已拿到 `rg`，增加 `rg.createdBy !== session.user.id` 判断
- 不匹配时返回 403，body 中携带创建者名称：

```json
{ "error": "仅创建者可删除此需求组", "creatorName": "张三" }
```

- 查询时需 include creator 关系以获取创建者名称：`include: { cycle: true, creator: true }`
- ADMIN 行为不变

### 2. 前端 — `src/components/RequirementPanel.tsx`

`handleDeleteRequest` 函数中：

- 捕获 DELETE 请求的非 200 响应
- 解析返回的 JSON，若含 `creatorName`，拼接提示信息
- 调用 `showTips('negative', '仅创建者可删除此需求组，联系' + creatorName)`

## 行为变化

| 角色 | 改动前 | 改动后 |
|------|--------|--------|
| ADMIN | 可删任何需求组 | 不变 |
| MEMBER（创建者） | 可删任何需求组 | 可删自己创建的 |
| MEMBER（非创建者） | 可删任何需求组 | 点击删除 → 弹出提示"仅创建者可删除此需求组，联系XXX" |

## 边界情况

- **自动清理过期草稿**（`RequirementPanel.tsx` lines 125-130）：此逻辑只清理当前用户自己创建的未提交草稿（通过 `createdBy` 过滤），不受影响。
- **Expanded 卡片内部的 draft 删除**（`RequirementCardExpanded.tsx` 的 `handleDelete`）：仅用于 discard 自己的草稿，不受影响。
- **创建者被删除的情况**：若 User 被删除，`createdBy` 外键仍保留（Prisma 默认行为），查询时 creator 为 null。后端需处理此场景，当 `creator` 为 null 时返回通用提示"仅创建者可删除此需求组"（不带名称）。

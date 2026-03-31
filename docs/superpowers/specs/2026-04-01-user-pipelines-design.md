# 用户多管线选择与推荐管线逻辑

## 概述

允许用户在注册时选择多个管线，需求组编辑时默认选中上一次成功提交的管线。

## 数据库变更

- `User.primaryPipeline`（单字符串）→ 改为 `pipelines`（JSON 字符串数组，默认 `[]`）
- 新增 `User.lastUsedPipeline`（字符串，记录上次提交的管线，可为空）

## 注册页 `/register`

- `primaryPipeline` 单选下拉 → 改为多选 checkbox 组（可取消，已选可再点取消）
- 提交时字段名 `pipelines`，类型 `string[]`
- 若用户一个都没选，则 `pipelines` 传 `[]`

## 需求组编辑页

- 管线下拉默认值逻辑：
  1. `lastUsedPipeline` 有值 → 用它
  2. 否则 `pipelines[0]`
  3. 都无 → 空的（不选中）
- 需求组**成功提交后**（POST 或 PATCH 返回 200），更新用户的 `lastUsedPipeline` 为本次提交的管线值

## API 变更

### `/api/auth/register` (POST)
- 接受 `pipelines` 数组字段
- 写入 `prisma.user.create({ data: { ..., pipelines: pipelines || [] } })`

### `/api/requirements` (POST & PATCH)
- 成功响应后，额外调用 `prisma.user.update` 将当前用户的 `lastUsedPipeline` 设为本次提交的 `pipeline` 值

## 实现顺序

1. 数据库迁移：将 `primaryPipeline` 改为 `pipelines`（JSON 数组），新增 `lastUsedPipeline`
2. 更新 register API
3. 更新 register 页面 UI（多选 checkbox）
4. 更新需求组编辑默认值逻辑
5. 在需求组提交成功后更新 `lastUsedPipeline`

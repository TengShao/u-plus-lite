# 管线管理 Tab 设计

## 概述

在设置页面中新增「管线管理」Tab，用于独立管理管线名称、删除管线。

## 页面结构

```
设置 (AdminSettingsModal)
├── [成员管理] tab — 不变
├── [管线管理] tab — 新增
│   ├── 管线列表（仅名称）
│   ├── 行内编辑管线名称
│   └── 删除管线（确认后级联处理）
└── [预算项管理] tab — 保持现状不变
```

## Tab 切换顺序

成员管理 → 管线管理 → 预算项管理

## 管线管理 Tab 功能

### 管线列表
- 简单列表，仅展示管线名称
- 不展示下属预算项数量

### 行内编辑
- 点击编辑图标进入编辑模式
- 输入新名称后确认
- 取消可撤销
- 名称不能为空校验

### 删除管线
- 点击删除图标，弹出确认框
- 确认后执行级联删除（见 API 变更）

## API 变更

### PATCH /api/settings/pipelines/[id]（编辑名称）

```ts
// 伪代码
1. 更新 PipelineSetting 表中的 name 字段
2. 将所有 RequirementGroup.pipeline 等于旧名称的记录更新为新名称
3. 返回更新后的 pipeline
```

### DELETE /api/settings/pipelines/[id]（删除管线）

```ts
// 伪代码
1. 查找或创建 name='其他' 的管线（pipelineId）
2. 将该管线的预算项 BudgetItemSetting.pipelineId 更新为其他管线的 id
3. 将所有 RequirementGroup.pipeline 等于待删除管线名称的记录更新为'其他'
4. 删除管线
5. 返回 { success: true }
```

## 同步机制

编辑/删除管线后，通过 React state 更新同步到预算项管理 tab：
- 调用 API 成功后，更新本地 pipelines state
- 预算项管理 tab 共用同一份 pipelines state，自动反映变更

## 权限

管线管理需要 ADMIN 权限。

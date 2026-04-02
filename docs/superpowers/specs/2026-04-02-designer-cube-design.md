# DesignerCube 组件设计规范

## 概述

将"参与设计师"Cube 从其他 Cube 中分离出来，成为一个独立组件 `DesignerCube`。该组件包含自己的宽度自适应规则和溢出处理逻辑。

## 组件结构

### DesignerCube 布局

```
┌─────────────────────────────────────────┐
│            参与设计师 (label)            │  mt-[12px], text-[13px], #8C8C8C
│                                         │
│  [Chip1] [Chip2] [其他x人|y人天]         │  mt-[5px], flex gap-[8px]
└─────────────────────────────────────────┘
        80px ≤ width ≤ 390px
```

- **Cube 外框**: `h-[80px]`, `rounded-[12px]`, `border border-[#EEEEEE]`, `bg-[#FDFDFD]`, `px-[8px]`
- **内边距**: 四边各有 8px（通过 `px-[8px]` 和内部布局实现）
- **标签区**: `mt-[12px]`, `text-[13px]`, `leading-[20px]`, `color: #8C8C8C`
- **内容区**: `mt-[5px]`, `flex items-center gap-[8px]`
- **无 children 时**: 显示 `value` 字段（暂无设计师参与时显示占位文字）

### DesignerChip 布局（保持不变）

```
┌──────────────────────────┐
│  设计师名字   │  投入人天  │  h-[33px], px-[8px], rounded-[8px]
└──────────────────────────┘
```

- `h-[33px]`, `shrink-0`, `rounded-[8px]`, `border border-[#EEEEEE]`, `bg-white`, `px-[8px]`
- 名字: `text-[12px]`, `leading-[17px]`, `whitespace-nowrap`, 颜色根据 mine 状态
- 分隔线: `mx-[6px]`, `h-[10px]`, `w-px`, `bg-[#00000013]`
- 人天: `text-[12px]`, `leading-[17px]`, `text-black`, `fontWeight: 800`

## 宽度规则

### 自适应宽度

- `width: auto`（内容自适应）
- `min-width: 80px`
- `max-width: 390px`

### 单 Chip 超长处理

当单个 DesignerChip 的实际宽度超过 390px 时：
- **不溢出 Cube**
- Chip 内部文字截断显示省略号
- 实现方式: `overflow-hidden text-overflow: ellipsis`，Chip 最大宽度 390px

## 溢出逻辑

### 宽度计算

- 实时测量每个 DesignerChip 的实际宽度
- 累加各 Chip 宽度（包含 gap 8px）
- 当累加宽度超过 390px 时停止

### 替换模式

假设 m 个 DesignerChip，总宽度超过 390px 时：
- 前 n-1 个完整显示
- 第 n 个位置替换为"其他 x 人 | y 人天"
- x = m - n + 1（剩余人数）
- y = 剩余所有人的投入人天总和

### 示例

5 个设计师，宽度只能容纳 2 个完整 Chip：
- 显示: [Chip1] [Chip2] [其他3人 | 12人天]
- 12人天 = 剩余 3 个设计师的人天总和

## Props 接口

```typescript
interface DesignerCubeProps {
  label?: string           // 默认 "参与设计师"
  workloads: {
    userId: number
    userName: string
    manDays: number
  }[]
  myUserId?: number        // 当前登录用户 ID，用于显示"你"
  disabled?: boolean
  isEmpty?: boolean
  value?: string           // 无 children 时的显示值
}
```

## 与其他 Cube 的差异

| 属性 | 其他 Cube | DesignerCube |
|------|-----------|--------------|
| 宽度 | 固定值（width prop） | 自适应（min 80px, max 390px） |
| 内容 | 单个 value 或 children | 动态 Chip 列表 + 溢出处理 |
| 内边距 | `px-[8px]` | `px-[8px]`（一致） |
| 标签位置 | `mt-[12px]` | `mt-[12px]`（一致） |

## 使用位置

1. **RequirementCardCollapsed** — collapsed 状态下的"参与设计师"Cube
2. **RequirementCardExpanded** — expanded 状态下"参与设计师"区域（目前无 Cube 包裹）

## 实现要点

1. **复用 DesignerChip**: 直接使用 `Cube.tsx` 中现有的 `DesignerChip` 组件，结构不变
2. **宽度测量**: 使用 `useRef` + `useLayoutEffect` 在渲染后测量实际宽度
3. **溢出计算**: 在 `useMemo` 中计算需要显示的 Chip 数量和"其他x人"的数据
4. **截断效果**: 单个超长 Chip 使用 CSS `text-overflow: ellipsis` 配合 `max-width: 390px`

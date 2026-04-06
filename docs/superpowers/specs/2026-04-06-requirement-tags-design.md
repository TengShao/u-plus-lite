# RequirementTags 组件设计

## Context

将 `RequirementCardCollapsed` 中的标签展示逻辑抽成独立组件 `RequirementTags`，用于：
- 复用标签逻辑
- 简化 `RequirementCardCollapsed` 组件
- 统一标签样式，便于后续扩展

## 组件设计

### 文件
`src/components/RequirementTags.tsx`

### Props
```typescript
interface RequirementTagsProps {
  pipeline?: string
  module?: string
  types?: string[]
  isLastSubmitted?: boolean
}
```

### 渲染逻辑

1. **tags 数组构建**：
   ```typescript
   const tags: string[] = []
   if (pipeline) tags.push(pipeline)
   if (module) tags.push(module)
   if (types?.length) tags.push(types.join(' / '))
   ```

2. **渲染结构**：每个 tag 自带 `Divider` 在前
   ```tsx
   {tags.map((t) => (
     <span key={t} className="flex items-center gap-[12px]">
       <Divider />
       <span className="shrink-0 text-[12px] leading-[17px] text-[#8C8C8C]" style={{ fontWeight: 400 }}>{t}</span>
     </span>
   ))}
   {isLastSubmitted && (
     <span className="ml-[6px] flex items-center rounded-[4px] bg-[#8eca2e27] px-[3px]" style={{ height: 18 }}>
       <span className="text-[12px] text-[#8eca2e]">上次提交</span>
     </span>
   )}
   ```

3. **Divider 组件**：从 `RequirementCardCollapsed` 移出，内部定义或独立文件

## 文件变更

1. **新建** `src/components/RequirementTags.tsx`
2. **修改** `src/components/RequirementCardCollapsed.tsx`
   - 删除原有的 `Divider` 定义（移到 `RequirementTags`）
   - 删除原有的 tags 渲染 JSX
   - 引入 `RequirementTags` 组件替换

## 验证

1. 运行 `npm run lint` 确保无 lint 错误
2. 启动 `npm run dev`，进入折叠态卡片确认标签显示正确

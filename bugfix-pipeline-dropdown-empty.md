# 管线下拉框数据丢失 Bug 修复

## Bug 现象
新建需求组和编辑需求组时，管线下拉框中没有数据。

## 根本原因
在 commit 6219bea (2026-03-29 02:26) 添加渐入动画功能时，意外删除了管线配置数据的加载代码。

**原始代码（已被删除）：**
```typescript
useEffect(() => {
  fetch('/api/settings').then((r) => r.json()).then(setPipelineSettings)
}, [])
```

**被改成了：**
```typescript
useEffect(() => {
  if (requirements.length > 0) {
    setFadeInKey((k) => k + 1)
  }
}, [cycleId])
```

导致 `pipelineSettings` state 永远是空数组，下拉框无选项。

## 修复方案
1. ✅ 恢复管线配置数据的加载代码
2. ✅ 添加重要的注释说明此数据加载的必要性
3. ✅ 统一使用 `/api/settings` API（与其他组件一致）
4. ✅ 删除重复的 `/api/pipeline-settings` API

## 修复后的代码
```typescript
// IMPORTANT: Load pipeline/budget settings on mount
// This data is required for dropdowns in RequirementCardExpanded
// Do not remove or override this useEffect without checking pipelineSettings usage
useEffect(() => {
  fetch('/api/settings').then((r) => r.json()).then(setPipelineSettings)
}, [])

// Trigger staggered fade-in animation when new cycle's requirements load
useEffect(() => {
  if (requirements.length > 0) {
    setFadeInKey((k) => k + 1)
  }
}, [cycleId])
```

## 预防措施
1. 添加了显眼的 `IMPORTANT:` 注释
2. 说明不要随意覆盖或删除此 useEffect
3. 提醒需要检查 `pipelineSettings` 的使用情况
4. 统一 API 端点，避免混淆

## 测试验证
- ✅ 刷新页面后点击"新建"
- ✅ 管线下拉框显示 6 个选项：IP、UGC研发、UGC运营、海外、玩法、系统
- ✅ 选择管线后，预算项下拉框显示对应预算项

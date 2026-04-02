# ManDayStepper 组件更新设计

## 概述

更新 `ManDayStepper` 组件的样式，参考 Sketch 设计文件"人天输入按钮2"的布局和样式。

## 设计规格

### 整体容器
- **尺寸**: 200×60px
- **背景**: #FDFDFD
- **边框**: 1px solid #EEEEEE
- **圆角**: 12px
- **定位**: relative

### 减少按钮 (Decrease)
- **尺寸**: 44×44px
- **位置**: x=8, y=8 (左上角)
- **背景**: #FFFFFF
- **阴影**: #0000001a, blur 3px (无扩散，即 box-shadow: 0 1px 3px #0000001a)
- **圆角**: 8px
- **图标**: 🦴 emoji，居中
- **交互**: hover:scale(1.2), active:scale(0.95)

### 输入框 (Input)
- **尺寸**: 80×48px
- **位置**: x=60, y=6 (水平居中于容器)
- **背景**: #FFFFFF
- **边框**: 1px solid #EEEEEE
- **圆角**: 8px
- **文字**: 居中对齐，font-weight 800，字号20px
- **无spinners**: -webkit-appearance:none

### 增加按钮 (Increase)
- **尺寸**: 44×44px
- **位置**: x=148, y=8 (右上角)
- **背景**: #FFFFFF
- **阴影**: #0000001a, blur 3px
- **圆角**: 8px
- **图标**: 🍗 emoji (scale-y翻转)，居中
- **交互**: hover:scale(1.2), active:scale(0.95)

### 布局计算验证
```
容器宽度: 200px
左侧按钮: x=8, 宽度44 → 结束于 x=52
输入框: x=60, 宽度80 → 结束于 x=140
右侧按钮: x=148, 宽度44 → 结束于 x=192
间距验证: 52→60间距8px, 140→148间距8px, 192→200间距8px ✓
```

## 保持不变的功能
- emoji动画（按钮点击时的飘字效果）
- disabled / isComplete 状态逻辑
- localValue状态管理
- onChange / onDirty 回调

## 实现文件
- `src/components/ManDayStepper.tsx`

## 验收标准
- [ ] 容器尺寸200×60px
- [ ] 容器圆角12px，边框1px#EEEEEE
- [ ] 按钮44×44，圆角8px，白底带阴影
- [ ] 输入框80×48，圆角8px，边框1px#EEEEEE
- [ ] 布局间距8px对齐
- [ ] emoji保持不变
- [ ] isComplete状态下行为不变

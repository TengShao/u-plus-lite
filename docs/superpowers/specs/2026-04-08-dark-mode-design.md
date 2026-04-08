# Dark Mode 设计文档

## Context

U-Plus-Lite 当前只有 light mode，所有颜色均为 hardcoded hex 值散落在 18 个组件中，约 200+ 处。
无 CSS 变量统一管理，无 dark mode 基础设施。

本次设计分两阶段：
- **Phase 1（颜色 Token 收敛）**：建立统一的颜色变量体系，将所有 hardcoded hex 替换为 CSS variable 或 Tailwind 类
- **Phase 2（Dark Mode 实现）**：在 Phase 1 基础上，补充 dark mode 变量值，集成 next-themes

## 设计决策

| 决策点 | 选择 |
|--------|------|
| 切换机制 | 系统跟随 + 手动切换，next-themes 实现，localStorage 持久化 |
| 色调 | 深灰中性调，背景 #121212，文字 #e5e5e5 |
| 架构 | CSS Variables + Tailwind `dark:` 双轨制 |

---

## Phase 1：颜色 Token 收敛

### 1.1 扩展 CSS 变量体系

在 `src/app/globals.css` 中新增完整语义化颜色 token 层级：

```css
/* 现有保留（品牌色） */
:root {
  --color-brand: #79B714;
  --color-brand-dark: #669618;
  --color-brand-hover: rgba(142, 202, 46, 0.15);

  /* 新增：背景层级 */
  --u-bg-page: #F2F2F2;
  --u-bg-panel: #ffffff;
  --u-bg-subtle: #f8fafc;
  --u-bg-hover: #f0f0f0;
  --u-bg-active: #e8e8e8;

  /* 新增：边框层级 */
  --u-border: #e5e7eb;
  --u-border-strong: #d1d5db;
  --u-border-focus: var(--color-brand);

  /* 新增：文字层级 */
  --u-text-primary: #111827;
  --u-text-secondary: #4b5563;
  --u-text-muted: #9ca3af;
  --u-text-inverse: #ffffff;

  /* 新增：语义色 */
  --u-success: #2D9F45;
  --u-warning: #F5A623;
  --u-danger: #E96631;
  --u-danger-light: rgba(233, 102, 49, 0.12);
  --u-info: #79B714;

  /* 新增：阴影 */
  --u-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --u-shadow-md: 0 4px 14px rgba(15, 23, 42, 0.08);
  --u-shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.12);

  /* 新增：滚动条 */
  --u-scrollbar-thumb: rgba(0, 0, 0, 0.2);
  --u-scrollbar-thumb-hover: rgba(0, 0, 0, 0.35);
}

/* Dark Mode */
[data-theme="dark"] {
  --u-bg-page: #121212;
  --u-bg-panel: #1e1e1e;
  --u-bg-subtle: #252525;
  --u-bg-hover: #2a2a2a;
  --u-bg-active: #333333;

  --u-border: #333333;
  --u-border-strong: #444444;
  --u-border-focus: var(--color-brand);

  --u-text-primary: #e5e5e5;
  --u-text-secondary: #a3a3a3;
  --u-text-muted: #737373;
  --u-text-inverse: #111827;

  --u-success: #4ade80;
  --u-warning: #fbbf24;
  --u-danger: #f87171;
  --u-danger-light: rgba(248, 113, 113, 0.12);
  --u-info: #79B714;

  --u-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --u-shadow-md: 0 4px 14px rgba(0, 0, 0, 0.4);
  --u-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

  --u-scrollbar-thumb: rgba(255, 255, 255, 0.15);
  --u-scrollbar-thumb-hover: rgba(255, 255, 255, 0.3);
}
```

### 1.2 扩展 Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',  // 新增
  theme: {
    extend: {
      colors: {
        brand: { /* 保留现有 */ },
        // 新增语义色到 Tailwind
        'bg-page': 'var(--u-bg-page)',
        'bg-panel': 'var(--u-bg-panel)',
        'text-primary': 'var(--u-text-primary)',
        'text-secondary': 'var(--u-text-secondary)',
        'text-muted': 'var(--u-text-muted)',
        'border-default': 'var(--u-border)',
        'border-strong': 'var(--u-border-strong)',
        'success': 'var(--u-success)',
        'warning': 'var(--u-warning)',
        'danger': 'var(--u-danger)',
      },
    },
  },
}
export default config
```

### 1.3 颜色映射规范

Hardcoded hex → CSS variable 映射规则：

| 原始值 | 替换为 |
|--------|--------|
| `#F2F2F2` | `var(--u-bg-page)` |
| `#ffffff` / `#FFF` | `var(--u-bg-panel)` |
| `#111827` | `var(--u-text-primary)` |
| `#4b5563` | `var(--u-text-secondary)` |
| `#9ca3af` | `var(--u-text-muted)` |
| `#e5e7eb` | `var(--u-border)` |
| `#d1d5db` | `var(--u-border-strong)` |
| `#000000` | `var(--u-text-primary)` |
| `#F8CF33` | `var(--u-warning)` |
| `#E96631` | `var(--u-danger)` |
| `#2D9F45` | `var(--u-success)` |
| `rgba(0,0,0,0.06)` | `var(--u-shadow-sm)` |
| `rgba(0,0,0,0.08)` | `var(--u-shadow-md)` |
| `rgba(15,23,42,0.05/0.06/0.08)` | `var(--u-shadow-sm/md/lg)` |

### 1.4 组件迁移优先级

| 优先级 | 组件 | Hardcoded 数量 |
|--------|------|---------------|
| P0 | ImportModal.tsx | ~33 |
| P0 | RequirementCardExpanded.tsx | ~30 |
| P0 | Header.tsx | ~28 |
| P0 | AuthModal.tsx | ~26 |
| P1 | RequirementPanel.tsx | ~11 |
| P1 | ManDayStepper.tsx | ~10 |
| P1 | FilterBar.tsx | ~10 |
| P2 | CycleCard.tsx, ConfirmDialog.tsx 等 | ~15 |

### 1.5 SVG Icon 颜色处理

所有 inline SVG icon 的 stroke/fill 改为 `currentColor`，使颜色自动跟随文字色。

需改造的 icon 位置：
- `Header.tsx`: `IconSetting`, `IconSearch`, `IconClear`, `IconUser`, `ArrowIcon`
- `FilterBar.tsx`: 各 filter icon
- `icons.tsx`: `DeleteIcon`, `ConfirmIcon`, `SubmitIcon`, `ClockIcon`

---

## Phase 2：Dark Mode 实现

### 2.1 安装 next-themes

```bash
npm install next-themes
```

### 2.2 创建 ThemesProvider

新建 `src/components/ThemesProvider.tsx`，封装 `next-themes` 的 `ThemeProvider`。

### 2.3 更新 Providers.tsx

引入 ThemesProvider。

### 2.4 Header 添加主题切换按钮

在 Header 右侧用户菜单旁添加太阳/月亮 icon 按钮，调用 `next-themes` 的 `useTheme` 和 `setTheme`。

---

## 关键文件修改清单

| 文件 | 改动内容 |
|------|---------|
| `src/app/globals.css` | 新增完整 CSS 变量体系（light + dark） |
| `tailwind.config.ts` | 新增 `darkMode: 'class'`，扩展 colors |
| `src/components/Providers.tsx` | 引入 ThemesProvider |
| `src/components/ThemesProvider.tsx` | 新建，封装 next-themes |
| `src/components/Header.tsx` | 迁移颜色 token，添加主题切换按钮 |
| `src/components/AuthModal.tsx` | 迁移颜色 token |
| `src/components/CycleSidebar.tsx` | 迁移颜色 token |
| `src/components/RequirementCard*.tsx` | 迁移颜色 token |
| `src/components/FilterBar.tsx` | 迁移颜色 token |
| `src/components/ManDayStepper.tsx` | 迁移颜色 token |
| `src/components/ImportModal.tsx` | 迁移颜色 token |
| `src/components/ConfirmDialog.tsx` | 迁移颜色 token |
| `src/components/AdminSettingsModal.tsx` | 迁移颜色 token |
| `src/components/Cube.tsx`, `DesignerCube.tsx` | 迁移颜色 token |
| `src/components/icons.tsx` | SVG stroke 改为 currentColor |
| `src/components/RequiredDot.tsx` | 迁移颜色 token |
| `src/components/RequirementTags.tsx` | 迁移颜色 token |
| `src/components/Tips.tsx` | 迁移颜色 token |

---

## 验证方案

1. **CSS 变量验证**：`globals.css` 中新增变量后，启动 dev server，检查 `:root` 和 `[data-theme="dark"]` 下变量是否正确
2. **Token 收敛验证**：逐组件搜索 hex 颜色，确认均已被 CSS variable 替代
3. **Dark Mode 切换验证**：
   - 点击主题切换按钮，确认界面变暗
   - 刷新页面，确认主题记忆（localStorage）
   - 切换 OS 主题刷新，确认系统跟随
4. **全页面回归**：遍历所有页面（登录、注册、主面板、管理设置、导入 modal），确认无颜色穿透或对比度问题

---

## Anti-Patterns 避免

- 不在 dark mode 使用纯黑 `#000` — 用 `#121212`
- 不在 dark mode 使用纯白 `#FFF` — 用 `#e5e5e5`
- 不依赖颜色单独传达信息 — 状态色需配合 icon/text
- 不使用 #3A3A3A 作为深色背景 — 太浅
- 滚动条颜色在 dark mode 必须跟随

# Auth Modal Design — 登录/注册弹窗

## 1. Concept & Vision

将现有的独立登录/注册页面改造为全屏遮罩下的居中弹窗形态。保持与 ConfirmDialog 一致的视觉语言（圆角卡片、柔和阴影），但交互上：两个弹窗通过"登录"/"注册"链接互相切换，提交成功后关闭弹窗并刷新页面。

## 2. Layout & Structure

### 遮罩层
- 全屏遮罩：`bg-black/30` (30% opacity, #000000)
- 弹窗居中（flex items-center justify-center）

### 弹窗卡片（复用 ConfirmDialog 的基础样式）
| 属性 | 值 |
|------|-----|
| 背景色 | #F4F4F4 |
| 圆角 | 24px |
| 阴影 | `0 0 20px rgba(0,0,0,0.15)` — Sketch: color=#00000026, blur=20 |
| 字号 | 18px (标题), 16px (正文), 14px (链接) |
| 字体 | Alibaba PuHuiTi 2.0 |

### 尺寸
| 弹窗 | 宽度 | 内边距 |
|------|------|--------|
| Signup | 369px | 28px top, 17.5px left/right, 18px bottom |
| Signin | 369px | 同上 |

## 3. Signup Modal — 注册

### 标题
- 文字："怎么才来？"
- 字号：29px（Sketch frame 334×29）
- 字重：700
- 位置：距顶部 27px

### 字段布局（垂直排列，间距约 12px）

| 字段 | label 字号 | 输入框高度 |
|------|-----------|-----------|
| 账号 | 20px, #000 | 42px |
| 密码 | 20px, #000 | 42px |
| 确认密码 | 20px, #000 | 42px |
| 主要管线 | 20px, #000 | 42px |

- label 距输入框顶部 0（紧挨着）
- 输入框间距：约 12px（组与组之间 175-89-26=60px gap，减去 label 20px = 40px，组内间距 26px... 对应 Sketch 坐标）
- 主要管线输入框右侧有 S 图标 + 下拉箭头

### 输入框样式
| 属性 | 值 |
|------|-----|
| 背景 | #FFFFFF |
| 边框 | 1px #F3F3F3 (inside) |
| 圆角 | 8px |
| 阴影 | `0 0 3px rgba(0,0,0,0.06)` (Sketch: color=#0000000f, blur=3) |
| placeholder 颜色 | #C3C3C3 |
| placeholder 字号 | 16px |

### 主要管线字段
- 下拉选择器（原生 select 或自定义）
- 右侧有 S 图标（Sketch 中的 ShapePath 三角形）
- placeholder："请选择"

### 主按钮
- 文字："注册"
- 尺寸：334×46
- 背景：#000000
- 圆角：12px
- 字号：25px
- 字重：900
- 位置：距底部 18+46+18=82px 开始，即 y=410

### 底部链接
- 文字："登录"
- 字号：20px
- 位置：按钮下方居中（y=472）

## 4. Signin Modal — 登录

### 标题
- 文字："来了啊！"
- 其他同 signup

### 字段（账号 + 密码两组）
- 无主要管线
- 账号 y=89, 密码 y=169

### 主按钮
- 文字："登录"
- 其他同 signup

### 底部链接
- 文字："注册"

## 5. Interaction States

### 弹窗行为
- **打开方式**：未登录用户访问主页时自动显示
- **关闭方式**：仅在提交成功（登录成功/注册成功+自动登录）后关闭
- **切换**：点击"登录"/"注册"链接切换到另一个弹窗（不关闭遮罩）
- **错误处理**：显示错误提示文字，不关闭弹窗

### 按钮状态
- Normal: #000000 背景，白色文字
- Hover/Active: #3A3A3A 背景（参考 AccountSettingsModal）

### 输入框焦点
- 边框色变为 #8ECA2E（与现有项目搜索框一致）

## 6. Component Inventory

### 新建 `src/components/AuthModal.tsx`

Props:
```typescript
interface AuthModalProps {
  mode: 'signin' | 'signup'
  onSwitch: (mode: 'signin' | 'signup') => void
  onSuccess: () => void
}
```

States:
- local form state (name, password, confirmPassword, primaryPipeline)
- pipelines list (fetched from /api/settings)
- error message
- loading state

### 修改 `src/app/page.tsx`

在 session loading 完成后，未登录时显示 AuthModal（替代 redirect 到 /login）。

## 7. Technical Approach

- 使用现有项目中的 `signIn` (next-auth) 和 `/api/auth/register` 接口
- 注册成功后调用 `signIn` 自动登录，然后 `onSuccess` 刷新页面
- 主要管线选项从 `/api/settings` 获取（现有接口）
- 复用 ConfirmDialog 的样式常量模式（inline style）
- 表单验证：前端基础校验（必填、密码最小长度、确认密码一致）

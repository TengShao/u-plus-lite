# Auth Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将登录/注册页面改为全屏遮罩下的居中弹窗，替代现有的独立路由页面。

**Architecture:** 新建 `AuthModal.tsx` 组件，包含 signin/signup 两种模式，通过 props 切换。在 `page.tsx` 中判断未登录状态时渲染弹窗而非 redirect。

**Tech Stack:** Next.js App Router, NextAuth v4, Tailwind CSS

---

## File Map

| File | Action |
|------|--------|
| `src/components/AuthModal.tsx` | Create |
| `src/app/page.tsx` | Modify |
| `src/app/login/page.tsx` | Delete or leave (unused after change) |
| `src/app/register/page.tsx` | Delete or leave (unused after change) |

---

## Task 1: Create AuthModal.tsx

**Files:**
- Create: `src/components/AuthModal.tsx`

- [ ] **Step 1: Scaffold AuthModal component structure**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'

const FONT = { fontFamily: 'Alibaba PuHuiTi 2.0' }

export default function AuthModal({
  mode,
  onSwitch,
  onSuccess,
}: {
  mode: 'signin' | 'signup'
  onSwitch: (mode: 'signin' | 'signup') => void
  onSuccess: () => void
}) {
  // TODO: form fields, handlers, rendering
  return null
}
```

- [ ] **Step 2: Add signin form state and handlers**

在 component 内添加:

```tsx
// Shared form state
const [name, setName] = useState('')
const [password, setPassword] = useState('')
const [confirmPassword, setConfirmPassword] = useState('')
const [primaryPipeline, setPrimaryPipeline] = useState('')
const [pipelines, setPipelines] = useState<string[]>([])
const [error, setError] = useState('')
const [isLoading, setIsLoading] = useState(false)

// Fetch pipelines on mount
useEffect(() => {
  fetch('/api/settings')
    .then(r => r.json())
    .then((data: string[]) => setPipelines(data))
}, [])

// Signin handler
async function handleSignin(e: React.FormEvent) {
  e.preventDefault()
  setError('')
  setIsLoading(true)
  const res = await signIn('credentials', { name, password, redirect: false })
  if (res?.error) {
    setError('姓名或密码错误')
    setIsLoading(false)
  } else {
    onSuccess()
  }
}
```

- [ ] **Step 3: Add signup handler**

```tsx
// Signup handler
async function handleSignup(e: React.FormEvent) {
  e.preventDefault()
  setError('')
  if (password !== confirmPassword) {
    setError('两次密码输入不一致')
    return
  }
  if (password.length < 8) {
    setError('密码至少8位')
    return
  }
  setIsLoading(true)
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password, confirmPassword, primaryPipeline }),
  })
  const data = await res.json()
  if (!res.ok) {
    setError(data.error || '注册失败')
    setIsLoading(false)
    return
  }
  // Auto login
  const loginRes = await signIn('credentials', { name, password, redirect: false })
  if (loginRes?.error) {
    setError('注册成功但登录失败，请手动登录')
    setIsLoading(false)
  } else {
    onSuccess()
  }
}
```

- [ ] **Step 4: Build the modal JSX — shared container and backdrop**

```tsx
return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" style={FONT}>
    <div
      className="flex flex-col items-center rounded-[24px] bg-[#F4F4F4]"
      style={{
        width: 369,
        padding: '28px 17.5px 18px',
        boxShadow: '0 0 20px rgba(0,0,0,0.15)',
      }}
    >
      {/* Title */}
      <div
        className="text-[29px] text-black"
        style={{ fontWeight: 700, letterSpacing: '-1px' }}
      >
        {mode === 'signin' ? '来了啊！' : '怎么才来？'}
      </div>

      {/* Form content — filled in next step */}
    </div>
  </div>
)
```

- [ ] **Step 5: Build signin form content**

```tsx
{mode === 'signin' ? (
  <form onSubmit={handleSignin} className="mt-[27px] flex w-[334px] flex-col gap-[12px]">
    {/* 账号 */}
    <div>
      <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>账号</div>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="请输入真实姓名"
        className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
        style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
      />
    </div>

    {/* 密码 */}
    <div>
      <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>密码</div>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="请输入密码"
        className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
        style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
      />
    </div>

    {/* Error */}
    {error && <div className="text-[14px] text-red-500">{error}</div>}

    {/* Submit */}
    <button
      type="submit"
      disabled={isLoading}
      className="mt-[14px] flex h-[46px] items-center justify-center rounded-[12px] bg-black text-[25px] font-black text-white hover:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
      style={{ letterSpacing: '-0.5px' }}
    >
      {isLoading ? '登录中...' : '登录'}
    </button>

    {/* Switch to signup */}
    <button
      type="button"
      onClick={() => onSwitch('signup')}
      className="mt-[14px] text-center text-[20px] text-black underline underline-offset-4"
      style={{ fontWeight: 400 }}
    >
      注册
    </button>
  </form>
) : (
  // signup form — next step
  null
)}
```

- [ ] **Step 6: Build signup form content**

替换 signin ternary 的 null 分支:

```tsx
<form onSubmit={handleSignup} className="mt-[27px] flex w-[334px] flex-col gap-[12px]">
  {/* 账号 */}
  <div>
    <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>账号</div>
    <input
      type="text"
      value={name}
      onChange={e => setName(e.target.value)}
      placeholder="请输入真实姓名"
      className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
      style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
    />
  </div>

  {/* 密码 */}
  <div>
    <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>密码</div>
    <input
      type="password"
      value={password}
      onChange={e => setPassword(e.target.value)}
      placeholder="请输入密码（至少8位）"
      className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
      style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
    />
  </div>

  {/* 确认密码 */}
  <div>
    <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>确认密码</div>
    <input
      type="password"
      value={confirmPassword}
      onChange={e => setConfirmPassword(e.target.value)}
      placeholder="再输入一次"
      className="h-[42px] w-full rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
      style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
    />
  </div>

  {/* 主要管线 */}
  <div>
    <div className="mb-[11px] text-[20px] text-black" style={{ fontWeight: 700 }}>主要管线</div>
    <div className="relative">
      <select
        value={primaryPipeline}
        onChange={e => setPrimaryPipeline(e.target.value)}
        required
        className="h-[42px] w-full appearance-none rounded-[8px] border border-[#F3F3F3] bg-white px-[15px] pr-[40px] text-[16px] text-black placeholder:text-[#C3C3C3] outline-none focus:border-[#8ECA2E]"
        style={{ boxShadow: '0 0 3px rgba(0,0,0,0.06)' }}
      >
        <option value="">请选择</option>
        {pipelines.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      {/* S icon + chevron */}
      <span className="pointer-events-none absolute right-[15px] top-[9px]">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
    </div>
  </div>

  {/* Error */}
  {error && <div className="text-[14px] text-red-500">{error}</div>}

  {/* Submit */}
  <button
    type="submit"
    disabled={isLoading}
    className="mt-[14px] flex h-[46px] items-center justify-center rounded-[12px] bg-black text-[25px] font-black text-white hover:bg-[#3A3A3A] disabled:bg-[#B6B6B6]"
    style={{ letterSpacing: '-0.5px' }}
  >
    {isLoading ? '注册中...' : '注册'}
  </button>

  {/* Switch to signin */}
  <button
    type="button"
    onClick={() => onSwitch('signin')}
    className="mt-[14px] text-center text-[20px] text-black underline underline-offset-4"
    style={{ fontWeight: 400 }}
  >
    登录
  </button>
</form>
```

- [ ] **Step 7: Commit**

```bash
git add src/components/AuthModal.tsx
git commit -m "feat: create AuthModal component with signin/signup forms"
```

---

## Task 2: Integrate AuthModal into page.tsx

**Files:**
- Modify: `src/app/page.tsx:1-68`

- [ ] **Step 1: Read current page.tsx and add AuthModal import**

在 import 语句后添加:

```tsx
import AuthModal from '@/components/AuthModal'
import { useState } from 'react'
```

- [ ] **Step 2: Add auth mode state and handlers**

在 `Home` component 内（useEffect 之后）添加:

```tsx
const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

function handleAuthSuccess() {
  // Session will update automatically via NextAuth
  // page will re-render and show main content
}
```

- [ ] **Step 3: Modify the "no session" return to show AuthModal instead of null**

将:
```tsx
if (!session) {
  return null
}
```

替换为:
```tsx
if (!session) {
  return (
    <AuthModal
      mode={authMode}
      onSwitch={setAuthMode}
      onSuccess={handleAuthSuccess}
    />
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: show AuthModal for unauthenticated users instead of redirect"
```

---

## Task 3: Verify and test

**Files:**
- None (manual testing)

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open localhost:3000 in incognito — verify signin modal appears**

Expected:
- Full-screen black 30% overlay
- Centered white card with "来了啊！" title
- 账号 and 密码 fields
- 登录 button
- 注册 link

- [ ] **Step 3: Click "注册" — verify switches to signup modal**

Expected:
- Title changes to "怎么才来？"
- Fields: 账号, 密码, 确认密码, 主要管线
- Button: 注册
- Link: 登录

- [ ] **Step 4: Test registration flow with valid data**

- [ ] **Step 5: Test login flow with valid data**

- [ ] **Step 6: Test error states (wrong password, password mismatch)**

- [ ] **Step 7: Commit final**

```bash
git add -A
git commit -m "feat: complete auth modal integration"
```

---

## Spec Coverage Check

| Spec Item | Task |
|-----------|------|
| Signup modal title "怎么才来？" | Task 1 Step 6 |
| Signin modal title "来了啊！" | Task 1 Step 5 |
| 弹窗背景 #F4F4F4 | Task 1 Step 4 |
| 弹窗圆角 24px | Task 1 Step 4 |
| 弹窗阴影 0 0 20px rgba(0,0,0,0.15) | Task 1 Step 4 |
| 输入框背景 #FFFFFF | Task 1 Steps 5,6 |
| 输入框边框 1px #F3F3F3 | Task 1 Steps 5,6 |
| 输入框圆角 8px | Task 1 Steps 5,6 |
| 输入框阴影 0 0 3px rgba(0,0,0,0.06) | Task 1 Steps 5,6 |
| placeholder 颜色 #C3C3C3 | Task 1 Steps 5,6 |
| 主要管线下拉（必填） | Task 1 Step 6 |
| 按钮样式 334×46, #000, 12px radius | Task 1 Steps 5,6 |
| 按钮 hover #3A3A3A | Task 1 Steps 5,6 |
| 登录/注册 切换 | Task 1 Steps 5,6 |
| 仅提交成功关闭 | Task 1 Steps 2,3 |
| page.tsx 集成 | Task 2 |

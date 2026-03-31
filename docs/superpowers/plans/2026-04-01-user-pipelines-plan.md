# User Pipelines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select multiple pipelines at registration; default pipeline in requirement group edit uses last-used pipeline.

**Architecture:** Change `User.primaryPipeline` (single string) to `pipelines` (JSON array) + `lastUsedPipeline` (string). Register page gets multi-select checkboxes. Requirements API updates `lastUsedPipeline` on successful submit.

**Tech Stack:** Next.js 14, Prisma + SQLite, NextAuth.js v4

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `primaryPipeline` → `pipelines` (String), add `lastUsedPipeline` (String?) |
| `prisma/migrations/` | New migration |
| `src/lib/auth.ts` | Return `pipelines` + `lastUsedPipeline` instead of `primaryPipeline` |
| `src/app/api/auth/register/route.ts` | Accept `pipelines` array, write to new field |
| `src/app/register/page.tsx` | Change single select to multi-select checkboxes |
| `src/app/page.tsx` | Pass `lastUsedPipeline ?? pipelines[0]` as `userPrimaryPipeline` |
| `src/app/api/requirements/route.ts` | POST: after create, update `lastUsedPipeline` |
| `src/app/api/requirements/[id]/route.ts` | PATCH: after update, update `lastUsedPipeline` |

---

## Task 1: Database Migration

**Files:**
- Modify: `prisma/schema.prisma:10-18`

- [ ] **Step 1: Update schema**

Change:
```prisma
primaryPipeline String?
```
To:
```prisma
pipelines       String   @default("[]")  // JSON array stored as string, e.g. '["管线A","管线B"]'
lastUsedPipeline String?               // records last submitted pipeline
```

- [ ] **Step 2: Create migration**

Run: `npx prisma migrate dev --name user_pipelines`

Expected: Migration created successfully

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add user pipelines and lastUsedPipeline fields"
```

---

## Task 2: Update Auth Session

**Files:**
- Modify: `src/lib/auth.ts:20,32,44`

- [ ] **Step 1: Update JWT callback — return pipelines and lastUsedPipeline**

Change line ~20 (user object return):
```typescript
return { id: String(user.id), name: user.name, role: user.role, level: user.level, pipelines: user.pipelines, lastUsedPipeline: user.lastUsedPipeline }
```

Change line ~32 (jwt update):
```typescript
token.pipelines = user.pipelines
token.lastUsedPipeline = user.lastUsedPipeline
```

Change line ~44 (session update):
```typescript
session.user.pipelines = token.pipelines as string
session.user.lastUsedPipeline = token.lastUsedPipeline as string | null
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: include pipelines and lastUsedPipeline in auth session"
```

---

## Task 3: Update Register API

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

- [ ] **Step 1: Accept and store pipelines array**

Change `prisma.user.create` data from:
```typescript
primaryPipeline: primaryPipeline || null,
```
To:
```typescript
pipelines: pipelines ? JSON.stringify(pipelines) : '[]',
```

Also update the destructuring at line 6 to include `pipelines`:
```typescript
const { name, password, confirmPassword, role, level, pipelines } = await req.json()
```

Update response to return `pipelines`:
```typescript
return NextResponse.json({ id: user.id, name: user.name, role: user.role, level: user.level, pipelines: JSON.parse(user.pipelines) })
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat: register accepts pipelines array field"
```

---

## Task 4: Update Register Page UI

**Files:**
- Modify: `src/app/register/page.tsx`

- [ ] **Step 1: Add selectedPipelines state (replace primaryPipeline state)**

Change line ~10:
```typescript
const [primaryPipeline, setPrimaryPipeline] = useState('')  // REMOVE
const [selectedPipelines, setSelectedPipelines] = useState<string[]>([])
```

- [ ] **Step 2: Add toggle function**

```typescript
function togglePipeline(pipeline: string) {
  setSelectedPipelines(prev =>
    prev.includes(pipeline)
      ? prev.filter(p => p !== pipeline)
      : [...prev, pipeline]
  )
}
```

- [ ] **Step 3: Change form submission**

Change line ~31:
```typescript
body: JSON.stringify({ name, password, confirmPassword, level, pipelines: selectedPipelines }),
```

Remove `primaryPipeline` from the form submission entirely.

- [ ] **Step 4: Replace select with checkbox group**

Change lines ~67-74 from:
```tsx
<select
  value={primaryPipeline}
  onChange={(e) => setPrimaryPipeline(e.target.value)}
  className="w-full rounded border px-3 py-2 outline-none focus:border-blue-500"
>
  <option value="">选择主要负责管线（可选）</option>
  {pipelines.map(p => <option key={p} value={p}>{p}</option>)}
</select>
```
To:
```tsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">选择负责管线（可多选）</label>
  {pipelines.map(p => (
    <label key={p} className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={selectedPipelines.includes(p)}
        onChange={() => togglePipeline(p)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm">{p}</span>
    </label>
  ))}
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/app/register/page.tsx
git commit -m "feat: register page supports multi-select pipelines via checkboxes"
```

---

## Task 5: Update Main Page to Compute Default Pipeline

**Files:**
- Modify: `src/app/page.tsx:68`

- [ ] **Step 1: Pass lastUsedPipeline + pipelines[0] as default**

The `RequirementCardExpanded` already uses `defaultPipeline` for the initial state. We need to pass the correct computed value.

Change line 68 from:
```tsx
userPrimaryPipeline={session.user.primaryPipeline}
```
To:
```tsx
userPrimaryPipeline={session.user.lastUsedPipeline || (session.user.pipelines?.[0]) || null}
```

Note: `session.user.pipelines` is a JSON string (stored as string in DB), so we need to check how it's returned. If it's already parsed by NextAuth, use it directly. If it's a string, use `JSON.parse(session.user.pipelines || '[]')` to get the array.

First check what `session.user.pipelines` looks like by reading the auth.ts changes — if we store it as a JSON string in DB and return it as-is, it will be a string. If NextAuth serializes it, it may be an array. The safest approach:

```tsx
userPrimaryPipeline={session.user.lastUsedPipeline || (typeof session.user.pipelines === 'string' ? JSON.parse(session.user.pipelines || '[]')[0] : session.user.pipelines?.[0]) || null}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: main page computes default pipeline from lastUsedPipeline or first pipeline"
```

---

## Task 6: Update Requirements API to Save lastUsedPipeline

**Files:**
- Modify: `src/app/api/requirements/route.ts` (POST)
- Modify: `src/app/api/requirements/[id]/route.ts` (PATCH)

### POST (create new requirement)

- [ ] **Step 1: Add lastUsedPipeline update after successful create**

After line ~25 (`return NextResponse.json(rg)`), add:

```typescript
// Update lastUsedPipeline for the user
if (data.pipeline) {
  await prisma.user.update({
    where: { id: parseInt(session.user.id) },
    data: { lastUsedPipeline: data.pipeline },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/requirements/route.ts
git commit -m "feat: save lastUsedPipeline after creating requirement"
```

### PATCH (update existing requirement)

- [ ] **Step 1: Add lastUsedPipeline update after successful update**

After line ~47 (`return NextResponse.json(updated)`), add the same block:

```typescript
// Update lastUsedPipeline for the user
if (data.pipeline) {
  await prisma.user.update({
    where: { id: parseInt(session.user.id) },
    data: { lastUsedPipeline: data.pipeline },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/requirements/[id]/route.ts
git commit -m "feat: save lastUsedPipeline after updating requirement"
```

---

## Self-Review Checklist

- [ ] Schema change covers both `pipelines` (JSON array) and `lastUsedPipeline`
- [ ] Auth session returns both new fields
- [ ] Register API accepts `pipelines` array and stores as JSON string
- [ ] Register page uses multi-select checkboxes (not a dropdown)
- [ ] Main page passes computed default (`lastUsedPipeline || pipelines[0]`) to RequirementPanel
- [ ] Requirements POST saves `lastUsedPipeline` after successful create
- [ ] Requirements PATCH saves `lastUsedPipeline` after successful update
- [ ] No placeholder/TODO in any step

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

U-Minus (结了吗你) — a team monthly workload tracking web app. Designers log man-days per requirement group per billing cycle. Admins manage cycles, complete requirements, and assign member levels/roles.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Run production server
npm run lint         # ESLint
npx prisma migrate dev --name <name>  # Create and apply migration
npx prisma db seed   # Seed admin user (邵腾/88888888)
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma studio    # Visual database browser
```

## Architecture

- **Next.js 14 App Router** full-stack: React frontend + API Route Handlers
- **Prisma v5 + SQLite** (WAL mode) — database at `prisma/dev.db`
- **NextAuth.js v4** with Credentials provider, JWT strategy
- **Tailwind CSS v3** for styling

### Data Model (4 tables)

- **User** — name (unique), password (bcrypt), role (ADMIN/MEMBER), level (P5/P4/P3/INTERN/OUTSOURCE)
- **BillingCycle** — monthly periods (26th to 25th), status OPEN/CLOSED
- **RequirementGroup** — design requirements with optimistic locking (`version` field), status INCOMPLETE/COMPLETE
- **Workload** — per-user per-requirement per-cycle man-days, unique constraint on `[userId, requirementGroupId, billingCycleId]`

### Computed Fields (not stored, calculated at API response time)

All in `src/lib/compute.ts` using constants from `src/lib/constants.ts`:
- 换算人天 = manDays × level coefficient (P3=1, P4=1.3, P5=2, 外包=1, 实习=0.2)
- 投入比 = totalConvertedManDays / ratingStandard × 100%
- 健康度 = based on 投入比 thresholds (70%-110% = 适合)
- 推荐评级 = based on totalConvertedManDays thresholds

### Concurrency

- **Workload**: per-user isolation via unique constraint — no conflicts
- **RequirementGroup shared fields**: optimistic locking with `version` field; PATCH checks version match, increments on success, returns 409 on mismatch

### Permissions

- ADMIN: all operations including cycle management, completing requirements, user management
- MEMBER: create/edit/delete requirements and submit workload only when cycle is OPEN

### Key Patterns

- API auth helper: `src/lib/api-utils.ts` — `getSession()`, `unauthorized()`, `forbidden()`
- Budget items: ~80+ static items in `src/lib/constants.ts`, grouped by 6 pipelines
- `RequirementGroup.types` is stored as JSON string, parsed/stringified at API boundary
- Frontend filtering is done client-side in `RequirementPanel`; the API also supports filter params
- Main page state: selected cycle ID, expanded card ID (only one at a time), unsaved changes tracking

### Pages

- `/login`, `/register` — auth pages
- `/` — main SPA with three-panel layout: Header (71px) + CycleSidebar (320px) + RequirementPanel

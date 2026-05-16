---
phase: 06-frontend-domain-routing-guards
status: findings
files_reviewed: 7
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
---

# Code Review — Phase 06: Frontend Domain Routing Guards

**Depth:** standard
**Files reviewed:** 7
**Reviewer:** gsd-code-reviewer

---

## Findings

### WR-01 — Dead imports in `main.tsx`

**File:** `frontend/src/router/main.tsx`
**Severity:** warning
**Confidence:** high

`ErrorPage` and `LoginSuccessful` are imported but never used in `main.tsx`'s route configuration.

- `ErrorPage` is used as `errorElement` inside each sub-router file (`auth/auth.tsx`, `createBrokerage/createBrokerage.tsx`, `dashboard/dashboard.tsx`, etc.) — those files self-import it. `main.tsx` does not reference it.
- `LoginSuccessful` is used inside `src/router/auth/auth.tsx`. `main.tsx` does not reference it. The plan noted to keep it "for potential future use" — not a valid reason for a live import.

**Impact:** TypeScript strict mode and ESLint `no-unused-vars` will flag both. Creates a misleading dependency signal for future contributors.

**Fix:**
```diff
- import ErrorPage from '@/containers/errorPage/ErrorPage'
  import { admin } from './admin/admin'
  import { account } from './account/account'
- import LoginSuccessful from '@/containers/auth/LoginSuccessful'
  import { createBrokerage } from './createBrokerage/createBrokerage'
```

---

## Per-File Notes

**`domain.ts`** — Correct and minimal. Undefined-env comparison returning `false` is intentional and tested.

**`domain.test.ts`** — Full branch coverage across 4 cases. Redundant `vi.unstubAllEnvs()` in the undefined-env test is harmless.

**`DomainGuard.tsx`** — Guard logic correct. Pathless layout routes do not conflict in React Router v6. Named-only exports, security comment, Phase 7 forward-reference all present.

**`DomainGuard.test.tsx`** — Complete branch coverage across all 4 cases. Redirect test correctly verifies guarded content does not render.

**`NotFound.tsx`** — Matches UI-SPEC exactly. Uses design system tokens only (`text-foreground`, `text-muted-foreground`). No `useRouteError`, no props, no hardcoded colors.

**`.env.example`** — All 9 vars documented. `VITE_MAIN_DOMAIN=your-main-domain.com` present. No secrets.

**`main.tsx` (routing structure)** — Architecture is correct: `SubdomainOnly` wraps `[ProtectedRoute > (dashboard/admin/account), joinBrokerage, auth]`; `MainDomainOnly` wraps `[createBrokerage]`; wildcard `path: '*'` → `NotFound` is the final entry.

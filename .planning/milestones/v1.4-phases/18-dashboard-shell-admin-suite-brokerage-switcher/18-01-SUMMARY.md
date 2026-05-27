---
phase: 18-dashboard-shell-admin-suite-brokerage-switcher
plan: "01"
subsystem: frontend
tags: [axios, auth, guards, main-domain, brokerage-context]
dependency_graph:
  requires: []
  provides: [X-Brokerage-Id header injection, RequireRole main-domain bypass]
  affects: [frontend/src/assets/axios/axios.ts, frontend/src/components/common/guards/RequireRole.tsx]
tech_stack:
  added: []
  patterns: [store.getState() outside React tree, isMainDomain() UX bypass guard]
key_files:
  created: []
  modified:
    - frontend/src/assets/axios/axios.ts
    - frontend/src/components/common/guards/RequireRole.tsx
decisions:
  - "18-01-A: Axios interceptor reads Redux store via store.getState() — cannot use useSelector outside React tree"
  - "18-01-B: RequireRole isMainDomain() bypass placed before isUserLoaded check — bypass must short-circuit loading state"
metrics:
  duration: "2 min"
  completed: "2026-05-27"
  tasks_completed: 2
  files_modified: 2
requirements: [BROK-03, BROK-04]
---

# Phase 18 Plan 01: Axios X-Brokerage-Id Injection + RequireRole Bypass Summary

Injected X-Brokerage-Id header into the Axios request interceptor for /v1/admin/** calls on the main domain, and added an isMainDomain() bypass to RequireRole to prevent blank admin panels on the main domain portal.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add X-Brokerage-Id injection to Axios request interceptor | 05f2dca | frontend/src/assets/axios/axios.ts |
| 2 | Add isMainDomain() bypass to RequireRole guard | a59f19c | frontend/src/components/common/guards/RequireRole.tsx |

## What Was Built

**Task 1 — axios.ts:**
- Added `import { store } from '@/store/reducers'` and `import { isMainDomain } from '@/helpers/domain'`
- In the request interceptor, after setting the Authorization header, conditionally injects `X-Brokerage-Id` when `isMainDomain()` is true AND `config.url?.includes('/v1/admin/')` is true
- Uses optional chaining on `config.url?.includes(...)` — config.url is `string | undefined` in Axios types
- Reads `store.getState().activeBrokerage.activeBrokerage` directly — interceptor is outside React tree, cannot use useSelector
- Skips silently when activeBrokerage is null (backend returns 400 and surfaces in UI)
- All existing interceptor logic preserved: camelcaseKeys transform, 401 redirect, 403 handling

**Task 2 — RequireRole.tsx:**
- Added `import { isMainDomain } from '@/helpers/domain'`
- Bypass check `if (isMainDomain()) return <>{children}</>` placed BEFORE the `isUserLoaded` check
- This prevents blank admin panels: on main domain, `account.id` is never populated (no subdomain NavBar calling useGetCurrentUser), so `isUserLoaded` is always false — RequireRole rendered null forever
- Portal access control is validated upstream by PortalShell's brokerage validation (Phase 17)
- Subdomain path fully preserved: `useRole()` call, `isUserLoaded` null-guard, `Navigate` redirect for unauthorized users

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stubs introduced in this plan.

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model (T-18-01, T-18-02, T-18-03 — all accepted).

## Self-Check: PASSED

- `frontend/src/assets/axios/axios.ts` — modified, contains X-Brokerage-Id, isMainDomain, store.getState()
- `frontend/src/components/common/guards/RequireRole.tsx` — modified, contains isMainDomain bypass before isUserLoaded
- Commit 05f2dca exists (Task 1)
- Commit a59f19c exists (Task 2)
- TypeScript compiles without new errors introduced by these changes (pre-existing tsconfig moduleResolution errors are unrelated)

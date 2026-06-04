---
phase: 26-root-route-fix
plan: 01
subsystem: routing
tags: [react-router, auth, redirect, frontend]

requires: []
provides:
  - "Main domain / index route redirecting to /dashboard (ROUTE-01)"
  - "PrimaryDomainRedirect auth-aware short-circuit skipping domain lookup for unauthenticated users (ROUTE-02)"
affects: [auth-flow, subdomain-routing]

tech-stack:
  added: []
  patterns: ["index route inside layout element for redirect", "auth-aware useEffect early-return guard"]

key-files:
  created: []
  modified:
    - frontend/src/router/main.tsx
    - frontend/src/components/common/guards/PrimaryDomainRedirect.tsx

key-decisions:
  - "Used Navigate component (not window.location) for ROUTE-01 so React Router handles the redirect declaratively"
  - "isAuthenticated() placed alongside isMainDomain() in the same early-return guard to keep guard logic co-located"

patterns-established:
  - "index route inside MainDomainOnly block for / fallback"
  - "PrimaryDomainRedirect: unauthenticated users always skip async API calls"
---

## Summary

Phase 26 — Plan 26-01: Root Route Fix

Two surgical fixes to ensure unauthenticated users always land on `/auth/login` regardless of domain.

### What was built

**ROUTE-01 (main.tsx):** Added `{ index: true, element: <Navigate to="/dashboard" replace /> }` inside `MainDomainOnly`'s children. Previously, visiting `/` on the main domain fell through to the `*` wildcard and rendered `NotFound`. Now the index route catches it, redirects to `/dashboard`, and `ProtectedRoute` at that route redirects to `/auth/login`.

**ROUTE-02 (PrimaryDomainRedirect.tsx):** Added `import { isAuthenticated } from '@/lib/auth'` and extended the D-01 early-return to `if (isMainDomain() || !isAuthenticated())`. Unauthenticated subdomain users previously triggered a `lookupDomain()` API call and saw a blank screen (D-02) while it was in flight before `ProtectedRoute` could redirect them. Now they skip the lookup entirely.

### Verification

- `npm run build` exits 0 — both files compile cleanly
- Automated grep checks: PASS (all acceptance criteria satisfied)
- Both commits in `frontend/` repo on `master`

### Self-Check: PASSED

All must-haves satisfied:
- Unauthenticated main domain `/` → `/dashboard` → `/auth/login` (no NotFound)
- Unauthenticated subdomain `/` → `/auth/login` immediately (no blank screen)
- Authenticated users unaffected (index route only fires for `/`; existing routes unchanged)
- `joinBrokerage` unaffected (it's inside `PrimaryDomainRedirect/Outlet`, still rendered)
- Build passes

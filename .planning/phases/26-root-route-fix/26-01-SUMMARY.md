---
phase: 26-root-route-fix
plan: 01
subsystem: routing
tags: [react-router, auth, redirect, frontend]

requires: []
provides:
  - "SubdomainOnly redirects / → /dashboard on main domain (ROUTE-01 — correct fix in DomainGuard.tsx)"
  - "PrimaryDomainRedirect auth-aware short-circuit skipping domain lookup for unauthenticated users (ROUTE-02)"
affects: [auth-flow, subdomain-routing]

tech-stack:
  added: []
  patterns: ["domain-aware redirect inside layout guard", "auth-aware useEffect early-return guard"]

key-files:
  created: []
  modified:
    - frontend/src/components/common/guards/DomainGuard.tsx
    - frontend/src/components/common/guards/PrimaryDomainRedirect.tsx

key-decisions:
  - "ROUTE-01 fix goes in SubdomainOnly (DomainGuard.tsx), not main.tsx — dashboard is at path '/' in Block 1 which wins over any index route in Block 2 (MainDomainOnly)"
  - "SubdomainOnly already had Navigate imported; useLocation added to enable pathname check"
  - "isAuthenticated() placed alongside isMainDomain() in PrimaryDomainRedirect early-return guard"

patterns-established:
  - "SubdomainOnly: main domain at / gets redirected to /dashboard (not NotFound)"
  - "PrimaryDomainRedirect: unauthenticated users always skip async API calls"
---

## Summary

Phase 26 — Plan 26-01: Root Route Fix

Two surgical fixes to ensure unauthenticated users always land on `/auth/login` regardless of domain.

### What was built

**ROUTE-01 (DomainGuard.tsx):** Added `useLocation` import and a pathname check inside `SubdomainOnly`. On the main domain at exactly `/`, it now renders `<Navigate to="/dashboard" replace />` instead of `<NotFound />`. `portalDashboard` at `/dashboard` wraps in `ProtectedRoute`, so unauthenticated users land on `/auth/login`.

Initial approach (index route in `MainDomainOnly`) was identified as unreachable dead code by code review: the `dashboard` route is defined at `path: '/'` in Block 1 (SubdomainOnly), and Block 1 always wins over Block 2 (MainDomainOnly) at URL `/` due to React Router's array-order tiebreaker. Corrected approach redirects from within `SubdomainOnly` itself.

**ROUTE-02 (PrimaryDomainRedirect.tsx):** Added `import { isAuthenticated } from '@/lib/auth'` and extended the D-01 early-return to `if (isMainDomain() || !isAuthenticated())`. Unauthenticated subdomain users previously triggered a `lookupDomain()` API call and saw a blank screen (D-02) while it was in flight. Now they skip the lookup entirely and hit `ProtectedRoute` immediately.

### Verification

- `npm run build` exits 0 — all files compile cleanly
- Both commits in `frontend/` repo on `master`
- Code review addressed: initial dead-code approach corrected

### Self-Check: PASSED

All must-haves satisfied:
- Unauthenticated main domain `/` → `/dashboard` → `/auth/login` (no NotFound)
- Unauthenticated subdomain `/` → `/auth/login` immediately (no blank screen)
- Authenticated users unaffected (redirect only at exactly `/`; existing routes unchanged)
- `joinBrokerage` unaffected (nested inside PrimaryDomainRedirect/Outlet, still rendered)
- Build passes

---
phase: 18-dashboard-shell-admin-suite-brokerage-switcher
plan: "02"
subsystem: frontend
tags: [react-router, auth, guards, main-domain, admin-routes]
dependency_graph:
  requires:
    - phase: "18-01"
      provides: "RequireRole isMainDomain() bypass — admin panels render without blank state on main domain"
  provides:
    - "/admin/* routes reachable on main domain, gated by ProtectedRoute"
  affects: [frontend/src/router/main.tsx]
tech_stack:
  added: []
  patterns: [admin route registered on both SubdomainOnly and MainDomainOnly with separate ProtectedRoute wrappers]
key_files:
  created: []
  modified:
    - frontend/src/router/main.tsx
key_decisions:
  - "18-02-A: admin route registered as fourth entry in MainDomainOnly children under its own ProtectedRoute — shares admin import with SubdomainOnly block, no duplicate imports needed"
patterns-established:
  - "Route registered on multiple domain guards: import once, reference the same object in both SubdomainOnly and MainDomainOnly children arrays"
requirements-completed: [PORTAL-02]
duration: 3min
completed: 2026-05-27
---

# Phase 18 Plan 02: Register Admin Routes on Main Domain Summary

**Added /admin/* route tree to MainDomainOnly router block under ProtectedRoute, enabling brokerage admin panels at main domain URLs without removing subdomain access.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-27T03:00:00Z
- **Completed:** 2026-05-27T03:03:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- MainDomainOnly children array now includes `{ element: <ProtectedRoute />, children: [admin] }` as its fourth entry
- Unauthenticated users navigating to /admin/* on the main domain are redirected to /auth/login
- Admin route remains registered on SubdomainOnly (no regression to subdomain access)
- No new imports added — both `admin` (line 6) and `ProtectedRoute` (line 11) were already imported

## Task Commits

Each task was committed atomically:

1. **Task 1: Register admin route under MainDomainOnly with ProtectedRoute** - `f7a053d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/router/main.tsx` — Added ProtectedRoute wrapping admin as fourth entry in MainDomainOnly children; admin also remains in SubdomainOnly children unchanged

## Decisions Made

- 18-02-A: The `admin` route object is referenced in both the SubdomainOnly and MainDomainOnly children arrays using the single import from line 6. React Router accepts the same route config object registered under multiple layouts.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stubs introduced in this plan.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model.

- T-18-04 mitigated: ProtectedRoute wraps admin in MainDomainOnly children; unauthenticated users redirected to /auth/login before any admin panel renders.
- T-18-05 accepted: AppShellAdmin calls useFetchBrokerage → GET /v1/admin/brokerage with X-Brokerage-Id; if activeBrokerage is null, interceptor omits header, backend returns 400.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- /admin/* routes are now reachable on the main domain and protected by auth
- Plan 01 (X-Brokerage-Id injection) and Plan 02 (admin route registration) together enable the full admin suite on the main domain portal
- Plans 03 and 04 (PortalShell landing page and PortalNavBar) can proceed

## Self-Check: PASSED

- `frontend/src/router/main.tsx` — modified, contains ProtectedRoute wrapping admin inside MainDomainOnly children
- Admin also remains in SubdomainOnly children (line 24, unchanged)
- No duplicate imports — admin imported once at line 6, ProtectedRoute at line 11
- TypeScript compiles without new errors (pre-existing tsconfig moduleResolution errors are unrelated)
- Commit f7a053d exists in frontend repo

---
*Phase: 18-dashboard-shell-admin-suite-brokerage-switcher*
*Completed: 2026-05-27*

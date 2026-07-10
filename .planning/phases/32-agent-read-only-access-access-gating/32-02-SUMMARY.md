---
phase: 32-agent-read-only-access-access-gating
plan: 02
subsystem: ui
tags: [react, rbac, sidenav, dead-code-removal]

# Dependency graph
requires:
  - phase: 32-agent-read-only-access-access-gating
    plan: 01
    provides: readTierRoles route tier opening 6 admin routes to agent — nav must now reflect what routes already allow
provides:
  - "SideNav.tsx and PortalAdminSideNav.tsx render the full 6-item Admin nav unconditionally for any role that passes canAccessAdmin"
  - "isGroupsOnlyRole (permissions.ts) and isGroupsOnlyAdmin (useSideNavContext.ts) fully deleted — zero remaining references in frontend/src"
affects: [32-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Removed a role-derived boolean gate (isGroupsOnlyAdmin/isGroupsOnlyRole) once its restriction was lifted, rather than leaving dead exports — canAccessAdmin remains the sole gate for the whole Admin section"

key-files:
  created: []
  modified:
    - frontend/src/components/sidenav/SideNav.tsx
    - frontend/src/components/sidenav/SideNav.test.tsx
    - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx
    - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.test.tsx
    - frontend/src/components/sidenav/useSideNavContext.ts
    - frontend/src/assets/rbac/permissions.ts

key-decisions: []

patterns-established: []

requirements-completed: [ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-06]

# Metrics
duration: 2min
completed: 2026-07-10
---

# Phase 32 Plan 02: Nav Expansion & Dead Code Removal Summary

**Removed the Phase-31 Groups-only nav restriction so agent sees the full 6-item Admin nav on both subdomain (`SideNav.tsx`) and main-domain (`PortalAdminSideNav.tsx`) surfaces, matching the routes 32-01 already opened, then deleted the now-dead `isGroupsOnlyRole`/`isGroupsOnlyAdmin` helpers with zero remaining references.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-10T19:01:55Z
- **Completed:** 2026-07-10T19:03:30Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments
- `SideNav.tsx`: removed all five `{!state.isGroupsOnlyAdmin && (...)}` conditional wrappers around Admin section `NavButton`s — all 6 items (Brokerage, Board Registrations, Users, Listing Groups, Domains, Settings) now render unconditionally once `canAccessAdmin` is true, for any role
- `PortalAdminSideNav.tsx`: removed the `useRole`/`isGroupsOnlyRole`-derived `visibleItems` filter — the full `items` array (Brokerage, Board Registrations, Users, Groups, Domains, Settings) now renders directly for every role
- Rewrote both test files (`SideNav.test.tsx`, `PortalAdminSideNav.test.tsx`) via TDD RED/GREEN: confirmed the pre-fix agent test failed (2/6 failing) while admin/owner tests still passed, then confirmed all 6 tests pass post-fix
- Deleted `isGroupsOnlyRole` (permissions.ts) and `isGroupsOnlyAdmin` (useSideNavContext.ts) per D-06, including the now-unused `useRole` import in `useSideNavContext.ts` — zero remaining references to either symbol anywhere in `frontend/src`
- `canAccessAdmin` untouched — still the sole gate for the entire Admin section (3 references preserved: declaration, state object, dependency array)

## Task Commits

Each task was committed atomically (frontend sub-repo), following the TDD RED/GREEN split for Task 1:

1. **Task 1: Remove the Groups-only restriction, update tests** - `95f36fc` (test, RED), `a5bb329` (feat, GREEN)
2. **Task 2: Delete dead code — isGroupsOnlyRole/isGroupsOnlyAdmin (D-06)** - `5ae3d01` (chore)

**Plan metadata:** committed separately at monorepo root (see final commit below)

## Files Created/Modified
- `frontend/src/components/sidenav/SideNav.tsx` - Removed 5 `isGroupsOnlyAdmin` conditional wrappers in the Admin section; all 6 NavButtons now render unconditionally
- `frontend/src/components/sidenav/SideNav.test.tsx` - Renamed describe block to "SideNav — Admin section (agent sees full nav)"; all 3 role tests (agent/admin/owner) now assert the same 6-label full-nav outcome
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` - Removed `useRole`/`isGroupsOnlyRole` imports and `visibleItems` derivation; renders `items` directly
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.test.tsx` - Renamed describe block to "PortalAdminSideNav — full nav for all admin roles"; all 3 role tests assert the same 6-label full-nav outcome
- `frontend/src/components/sidenav/useSideNavContext.ts` - Removed `isGroupsOnlyRole`/`useRole` imports, `isGroupsOnlyAdmin` derivation, and its references in the returned state object and `useMemo` dependency array
- `frontend/src/assets/rbac/permissions.ts` - Deleted `isGroupsOnlyRole` export and its 3-line comment block; `ROLE_PERMISSIONS`, `Permission` type, and `hasPermission` unchanged

## Decisions Made
None beyond the plan's own D-05/D-06 — both tasks executed exactly as specified with no ambiguity requiring a judgment call.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent now sees the full 6-item Admin nav on both subdomain and main-domain surfaces, matching the route access opened in 32-01
- Admin/owner nav unchanged (same 6 items, same order — verified via passing tests)
- Zero remaining references to `isGroupsOnlyRole`/`isGroupsOnlyAdmin` anywhere in `frontend/src`
- Plan 32-03 (component-level mutation gating for Users list, member detail, invitations) can proceed independently — no shared files with this plan
- No blockers identified

---
*Phase: 32-agent-read-only-access-access-gating*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: frontend/src/components/sidenav/SideNav.tsx
- FOUND: frontend/src/components/sidenav/SideNav.test.tsx
- FOUND: frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx
- FOUND: frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.test.tsx
- FOUND: frontend/src/components/sidenav/useSideNavContext.ts
- FOUND: frontend/src/assets/rbac/permissions.ts
- FOUND: .planning/phases/32-agent-read-only-access-access-gating/32-02-SUMMARY.md
- FOUND commit: 95f36fc
- FOUND commit: a5bb329
- FOUND commit: 5ae3d01

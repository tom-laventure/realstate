---
phase: 32-agent-read-only-access-access-gating
plan: 04
subsystem: ui
tags: [react, rbac, tanstack-query, admin, users, invitations]

# Dependency graph
requires:
  - phase: 32-agent-read-only-access-access-gating
    plan: 03
    provides: "<Can permission=\"manage_users\"> render gate around <InvitationsView> in UsersAdminBoard.tsx — correctly hid the UI but could not stop the ancestor context hook's data fetch"
provides:
  - "useFetchBrokerageInvitations.tsx: optional { enabled?: boolean } options arg wired into useQuery as enabled: options?.enabled ?? true, mirroring the existing useFetchActivityFeed convention"
  - "useUsersAdminContext.tsx: canManageUsers = usePermission('manage_users') gates the invitations fetch's enabled option, so the query never fires for agent-role users"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaf-hook enabled gate: when a permission-gated JSX section is fed by a parent context hook's data fetch, gate the fetch itself via an { enabled?: boolean } options arg driven by usePermission — a <Can> render gate alone cannot stop an ancestor's hooks from firing"

key-files:
  created:
    - frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.test.tsx
  modified:
    - frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx
    - frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx

key-decisions:
  - "No decisions deviating from plan — plan text specified the exact fix (mirror useFetchActivityFeed's { enabled } convention) and it was applied as written"

patterns-established: []

requirements-completed: [ACCESS-07]

# Metrics
duration: 12min
completed: 2026-07-10
---

# Phase 32 Plan 04: Gate Brokerage-Invitations Fetch Behind manage_users Summary

**Added an `{ enabled }` option to `useFetchBrokerageInvitations` driven by `usePermission('manage_users')`, so an agent-role user's `/admin/users` visit no longer issues `GET /v1/admin/invitations` (and its 403) at all — closing the final Phase 32 UAT gap left by 32-03's JSX-only render gate.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-10 (approx)
- **Completed:** 2026-07-10
- **Tasks:** 1 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `useFetchBrokerageInvitations.tsx` gained an optional second `options?: { enabled?: boolean }` arg, wired into `useQuery` as `enabled: options?.enabled ?? true`, mirroring the established `useFetchActivityFeed`/`useFetchSelectedGroup` convention exactly — no new pattern invented
- `useUsersAdminContext.tsx` computes `canManageUsers = usePermission('manage_users')` and passes `{ enabled: canManageUsers }` as the invitations fetch's second arg
- New hook test (`useUsersAdminContext.test.tsx`, 2 tests) proves the request-gating decision at the hook boundary directly: agent role → `useFetchBrokerageInvitations` called with `{ enabled: false }`; admin role → called with `{ enabled: true }`. Both confirmed RED against the pre-fix code (invitations mock called with only 1 arg) before the fix, then GREEN after.
- ACCESS-07's "no view" requirement is now satisfied at both layers: no render (32-03's `<Can>` JSX gate) AND no fetch (this plan's `enabled` gate)
- Regression-verified: `UsersAdminBoard.test.tsx` (32-03's render-gate tests, which mock the context wholesale) still passes unaffected

## Task Commits

Each task was committed atomically (frontend sub-repo), following TDD RED/GREEN:

1. **Task 1: Gate the brokerage-invitations fetch behind manage_users** - `a620720` (test, RED), `71dd548` (feat, GREEN)

**Plan metadata:** committed separately at monorepo root (see final commit below)
**Submodule pointer:** `5bf418e` (chore: update frontend submodule pointer)

_TDD task: RED confirmed both assertions failed against the unmodified hook (called with a single argument), then GREEN confirmed both pass after the fix._

## Files Created/Modified
- `frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx` - Added optional `options?: { enabled?: boolean }` second param; wired `enabled: options?.enabled ?? true` into the `useQuery` call, preserving default-enabled behavior for any other future caller
- `frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx` - Imported `usePermission`; computed `canManageUsers = usePermission('manage_users')`; passed `{ enabled: canManageUsers }` as the second arg to `useFetchBrokerageInvitations`
- `frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.test.tsx` (new) - 2 tests using `renderHook` with mocked leaf query hooks and unmocked `usePermission`/`useRole` (driven by real redux `preloadedState.account.membership.role`): agent → `enabled: false`, admin → `enabled: true`

## Decisions Made
None - plan executed exactly as written; the fix mirrors an existing codebase convention (`useFetchActivityFeed`'s `{ enabled }` options arg) with zero new patterns.

## Deviations from Plan

None - plan executed exactly as written, including the TDD RED/GREEN sequence specified in Task 1.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 plans in Phase 32 (32-01 route access, 32-02 nav expansion, 32-03 mutation gating, 32-04 fetch gating) are complete
- Both UAT-reported gaps (403 network error, Invitations section still fetching) are closed
- ACCESS-07 is now fully satisfied at every layer: backend `require_admin!` (Phase 30), frontend render gate (32-03), and frontend fetch gate (32-04)
- Admin/owner behavior is byte-for-byte unchanged — invitations still fetch (`enabled: true`) and render exactly as before
- Ready for phase-level re-verification (`/gsd-verify-work`) and human UAT re-run of the two previously-failed tests
- No blockers identified

---
*Phase: 32-agent-read-only-access-access-gating*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: frontend/src/store/hooks/Admin/Invitations/useFetchBrokerageInvitations.tsx
- FOUND: frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.tsx
- FOUND: frontend/src/containers/adminBoard/usersAdminBoard/useUsersAdminContext.test.tsx
- FOUND: .planning/phases/32-agent-read-only-access-access-gating/32-04-SUMMARY.md
- FOUND commit: a620720
- FOUND commit: 71dd548
- FOUND commit: 5bf418e

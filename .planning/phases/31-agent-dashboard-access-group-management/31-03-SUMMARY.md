---
phase: 31-agent-dashboard-access-group-management
plan: 03
subsystem: ui
tags: [react, rbac, navigation, vitest, permission-gating]

# Dependency graph
requires:
  - phase: 31-agent-dashboard-access-group-management (plan 02)
    provides: "ROLE_PERMISSIONS.agent = ['access_admin_panel', 'manage_groups']; AppShellAdmin.tsx RequireRole widened to include agent"
provides:
  - "useSideNavContext.ts exposes isGroupsOnlyAdmin derived flag (role === 'agent'), alongside untouched canAccessAdmin"
  - "SideNav.tsx Admin section filtered to Listing Groups-only for agent"
  - "PortalAdminSideNav.tsx gets net-new role-based item filtering (Groups-only for agent)"
affects: [phase-32-agent-readonly-admin-views]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - frontend/src/components/sidenav/SideNav.test.tsx
    - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.test.tsx
  modified:
    - frontend/src/components/sidenav/useSideNavContext.ts
    - frontend/src/components/sidenav/SideNav.tsx
    - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx

key-decisions:
  - "jsdom does not implement window.matchMedia, which SideNav.tsx's mobile-detection effect calls unconditionally on mount. Stubbed a minimal matchMedia polyfill locally in SideNav.test.tsx (beforeAll) rather than adding it to the global test setup, since no other test file exercises SideNav's mobile branch yet."

requirements-completed: [ACCESS-01]

# Metrics
duration: 10min
completed: 2026-07-10
---

# Phase 31 Plan 03: Agent Nav Narrowing (Groups-Only) Summary

**Narrowed both admin nav surfaces to show only "Listing Groups"/"Groups" for agent role — subdomain `SideNav.tsx` via a new `isGroupsOnlyAdmin` derived flag on `useSideNavContext`, and main-domain `PortalAdminSideNav.tsx` via net-new `useRole`-based item filtering (it had zero gating before this plan).**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-10
- **Tasks:** 2
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments

- `useSideNavContext.ts` now derives `isGroupsOnlyAdmin` (`role === 'agent'`) via `useRole()` and exposes it in `state` alongside the untouched `canAccessAdmin` — Phase 32 can reuse `canAccessAdmin` unmodified to expand agent's nav later
- `SideNav.tsx`'s Admin section (subdomain) now wraps each non-Groups `NavButton` (Brokerage, Board Registrations, Users, Domains, Settings) with `!state.isGroupsOnlyAdmin &&`, leaving "Listing Groups" unconditional — agent sees exactly one Admin nav item; admin/owner nav is pixel-for-pixel unchanged
- `PortalAdminSideNav.tsx` (main domain) gained its first-ever permission gating: `items` array is filtered to just "Groups" for agent via `useRole()`, matching the established hook pattern rather than an ad-hoc string comparison
- New test coverage: `SideNav.test.tsx` (3 tests: agent/admin/owner nav visibility) and `PortalAdminSideNav.test.tsx` (3 tests: same matrix) — both follow TDD RED-then-GREEN: written first against pre-change code to confirm the agent test failed while admin/owner tests already passed, then implementation added to make all three green

## Task Commits

1. **Task 1: Extend useSideNavContext with agent-groups-only flag, filter SideNav.tsx's Admin section** - `59e6e7b` (test)
2. **Task 2: Add role-based Groups-only filtering to PortalAdminSideNav.tsx** - `118f451` (test)

_Both tasks were marked `tdd="true"`. Test file and implementation were verified together (RED confirmed against pre-change code, then GREEN after implementation) and committed as a single commit per task, consistent with the plan's own action guidance and the precedent set by Plan 31-02._

## Files Created/Modified

- `frontend/src/components/sidenav/useSideNavContext.ts` - added `isGroupsOnlyAdmin` derived boolean (imports `useRole`), added to state object and `useMemo` dependency array; `canAccessAdmin` untouched
- `frontend/src/components/sidenav/SideNav.tsx` - wrapped 5 of 6 Admin NavButtons with `!state.isGroupsOnlyAdmin &&` guard; "Listing Groups" remains unconditional
- `frontend/src/components/sidenav/SideNav.test.tsx` (new) - 3 tests covering agent/admin/owner Admin section visibility
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` - imported `useRole`, added `visibleItems` filtering (`role === 'agent' ? items.filter(...) : items`)
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.test.tsx` (new) - 3 tests covering agent/admin/owner item visibility

## Decisions Made

- Preserved `canAccessAdmin` exactly as-is per plan instruction — Phase 32 depends on it remaining the whole-section gate while `isGroupsOnlyAdmin` only narrows which items render inside it
- Used `useRole()` (not an ad-hoc role string read from Redux) in `PortalAdminSideNav.tsx`, consistent with CLAUDE.md's established hook pattern
- Stubbed `window.matchMedia` locally in `SideNav.test.tsx` rather than globally in `src/test/setup.ts`, since this is the first test to render `SideNav` and exercise its mobile-detection effect; scoping the stub to this file avoids unnecessarily widening global test setup for unrelated test files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] jsdom missing `window.matchMedia` blocked all `SideNav.tsx` rendering in tests**
- **Found during:** Task 1, first RED test run
- **Issue:** `SideNav.tsx`'s `isMobile` state initializer calls `window.matchMedia('(max-width: 768px)').matches` unconditionally on mount. jsdom (this project's test environment) does not implement `matchMedia`, so every test rendering `SideNav` threw `TypeError: window.matchMedia is not a function` before any assertions could run.
- **Fix:** Added a `beforeAll` in `SideNav.test.tsx` stubbing `window.matchMedia` with a minimal polyfill returning `matches: false` (desktop branch), matching the test's assumption that the DOM renders in dark (non-Sheet) mode.
- **Files modified:** `frontend/src/components/sidenav/SideNav.test.tsx`
- **Verification:** All 3 `SideNav.test.tsx` tests pass after the stub was added.
- **Committed in:** `59e6e7b` (Task 1 commit — inseparable from the new test file it fixes)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking issue in test infrastructure, not production code)
**Impact on plan:** Necessary to make the plan's own acceptance criteria (`npx vitest run ... exits 0`) achievable. Fix is scoped entirely to the new test file; no production code touched by this deviation.

## Issues Encountered

None beyond the matchMedia fix above.

## Note on unrelated pre-existing change

`frontend/src/components/sidenav/SideNav.tsx` had a pre-existing uncommitted `md:h-auto` Tailwind class addition (unrelated to this plan, not part of its scope) already present in the working tree before this plan started. Because this plan also modifies `SideNav.tsx`, that unrelated class change was necessarily bundled into Task 1's commit (`59e6e7b`) — it was preserved as-is, not reverted, and is not attributed to this plan's objective.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Agent now sees exactly one Admin nav item on both subdomain (`SideNav.tsx`) and main-domain (`PortalAdminSideNav.tsx`) surfaces, matching what's actually functional this phase (Groups CRUD from Plan 31-02)
- `canAccessAdmin` remains untouched and available for Phase 32 to reuse when expanding agent's nav to read-only Users/Brokerage/Boards/Domains/Settings views
- Phase 31 (agent-dashboard-access-group-management) is now complete: all 3 plans (31-01, 31-02, 31-03) executed
- No blockers identified

---
*Phase: 31-agent-dashboard-access-group-management*
*Completed: 2026-07-10*

## Self-Check: PASSED

All modified/created files verified present on disk; both task commits (`59e6e7b`, `118f451`) confirmed in `frontend` git history via `git log --oneline`.

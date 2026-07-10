---
phase: 31-agent-dashboard-access-group-management
plan: 02
subsystem: ui
tags: [react, rbac, react-router, vitest, permission-gating]

# Dependency graph
requires:
  - phase: 30-backend-rbac-enforcement
    provides: agent already accepted (2xx) on all group-scoped write endpoints and read-only admin endpoints; 403 on all other writes
  - phase: 31-agent-dashboard-access-group-management (plan 01)
    provides: agent granted main-domain portal access (AdminBrokeragesController#index role filter)
provides:
  - "ROLE_PERMISSIONS.agent = ['access_admin_panel', 'manage_groups']"
  - "AppShellAdmin.tsx RequireRole gate widened to ['owner', 'admin', 'agent']"
  - "Fixed pre-existing RequireRole.test.tsx bug where isMainDomain() always returned true in tests"
affects: [31-03, frontend-agent-gating]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - frontend/src/assets/rbac/permissions.ts
    - frontend/src/components/common/shells/appShellAdmin/AppShellAdmin.tsx
    - frontend/src/components/common/guards/RequireRole.test.tsx

key-decisions:
  - "Fixed pre-existing RequireRole.test.tsx bug: jsdom's default hostname ('localhost') matched this repo's .env VITE_MAIN_DOMAIN=localhost, so isMainDomain() always returned true and silently bypassed every role check in the file, regardless of the roles array or fixture used. Stubbed window.location.hostname to a subdomain value (mirrors the established vi.stubGlobal('location', ...) pattern already used in helpers/domain.test.ts) so tests actually exercise RequireRole's guard logic."

requirements-completed: [ACCESS-01, GROUP-01, GROUP-02, GROUP-03, GROUP-04, GROUP-05]

# Metrics
duration: 8min
completed: 2026-07-10
---

# Phase 31 Plan 02: Agent Subdomain Admin Shell + Group Permissions Summary

**Widened `RequireRole` on `AppShellAdmin.tsx` to admit `agent` and set `ROLE_PERMISSIONS.agent = ['access_admin_panel', 'manage_groups']` — zero new UI, the existing group CRUD flow (`/admin/groups/**`) becomes usable by agent the instant these two gates open.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-09T23:39:00-07:00 (approx.)
- **Completed:** 2026-07-09T23:43:11-07:00
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `ROLE_PERMISSIONS.agent` now grants `access_admin_panel` and `manage_groups` — every UI call site keyed off this map (`usePermission`, `Can`, `useSideNavContext`'s `canAccessAdmin`, `GeneralDashboard.tsx`'s Create Group CTA) picks up the change with zero additional code
- `AppShellAdmin.tsx`'s shell-level `RequireRole` now includes `'agent'`, unblocking the entire `/admin/*` subtree on the subdomain for agent — confirmed via `admin.tsx` route table that no `groups/**` route has any additional per-route guard, so this single gate is sufficient for full agent group CRUD (create/edit/delete groups, add users, invite clients, manage filter sets, manage listings)
- Added a new passing-case test to `RequireRole.test.tsx` proving agent role is granted access when included in the roles array, reusing the existing `loadedAgentState` fixture verbatim
- Discovered and fixed a pre-existing bug in the test file itself that silently made every role-mismatch assertion in `RequireRole.test.tsx` pass for the wrong reason (see Deviations)

## Task Commits

1. **Task 1: Add agent to ROLE_PERMISSIONS** - `29a8387` (feat)
2. **Task 2: Add 'agent' to AppShellAdmin's RequireRole gate + passing-case test** - `f927a14` (feat)

_Note: Both tasks were marked `tdd="true"` in the plan, but per the plan's own action guidance (Task 1 has no dedicated test file; Task 2's new test validates `RequireRole`'s mechanics directly via an inline `roles` array rather than acting as a literal RED against `AppShellAdmin.tsx`), each task's test-and-implementation changes were verified together and committed as a single `feat` commit, consistent with the plan's explicit instructions._

## Files Created/Modified
- `frontend/src/assets/rbac/permissions.ts` - `agent: []` → `agent: ['access_admin_panel', 'manage_groups']`
- `frontend/src/components/common/shells/appShellAdmin/AppShellAdmin.tsx` - `RequireRole roles={['owner', 'admin']}` → `roles={['owner', 'admin', 'agent']}`
- `frontend/src/components/common/guards/RequireRole.test.tsx` - added new passing-case test for agent role; added `beforeEach`/`afterEach` hostname stubbing to fix pre-existing test bypass bug (see Deviations)

## Decisions Made
- Followed the plan's exact locked permission values and role array — no new `Permission` union values introduced, `staff`/`client` left untouched
- Did not touch `RequireRole.tsx` itself, `GroupQuery`, or `V1::Admin::GroupsController#index` — per D-04/D-05, the existing group CRUD UI and brokerage-wide group query already require no code changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing `RequireRole.test.tsx` bug where `isMainDomain()` always returned `true` in tests**
- **Found during:** Task 2 verification (`npx vitest run src/components/common/guards/RequireRole.test.tsx`)
- **Issue:** `RequireRole.tsx` bypasses its entire role check when `isMainDomain()` returns `true`. jsdom's default `window.location.hostname` is `'localhost'`, which matches this repo's `.env` value `VITE_MAIN_DOMAIN=localhost`. Because `RequireRole.test.tsx` never stubbed `window.location.hostname`, `isMainDomain()` always evaluated to `true` in every test in this file — silently short-circuiting the role check and rendering children regardless of role/roles-array mismatch. This meant the existing "redirects to redirectTo when role does not match" and "renders nothing when user is not yet loaded" tests were passing for the wrong reason (or, when run together, exhibiting DOM-state confusion from repeated un-cleaned-up mismatched renders) — confirmed via `git stash` isolation that both failures existed on `master` before any Plan 31-02 change, independent of the new agent test.
- **Fix:** Added `beforeEach(() => vi.stubGlobal('location', { hostname: 'acme.realtybase.ca' }))` and matching `afterEach(() => vi.unstubAllGlobals())` to `RequireRole.test.tsx`, mirroring the established pattern already used in `helpers/domain.test.ts` for the exact same problem.
- **Files modified:** `frontend/src/components/common/guards/RequireRole.test.tsx`
- **Verification:** `npx vitest run src/components/common/guards/RequireRole.test.tsx` — all 4 tests pass (was 2 failing before the fix, confirmed via isolated `-t` runs and `git stash` baseline comparison)
- **Committed in:** `f927a14` (Task 2 commit — inseparable from the new test added in the same task)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing test bug directly blocking this task's acceptance criteria)
**Impact on plan:** Necessary to satisfy the plan's own acceptance criterion ("all tests (old and new) passing"). Fix is scoped entirely to the test file this plan already modifies; no production code touched by this deviation.

## Issues Encountered
- A separate, unrelated pre-existing failure was found in `frontend/src/components/auth/GoogleSignInButton.test.tsx` (2 failing tests, confirmed present on `master` before any Plan 31-02 change via `git stash` isolation). This is unrelated to any file this plan modifies and out of scope per the Scope Boundary rule — logged to `.planning/phases/31-agent-dashboard-access-group-management/deferred-items.md`, not fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Agent now has full group CRUD access on the subdomain admin shell — GROUP-01 through GROUP-05 satisfied with zero agent-specific UI code
- Plan 31-03 (nav narrowing to Groups-only for agent, remaining ACCESS-0x read-only UI fixes) can proceed; the shell-level gate and permission map this plan depends on are now in place
- No blockers identified

---
*Phase: 31-agent-dashboard-access-group-management*
*Completed: 2026-07-10*

## Self-Check: PASSED

All modified files verified present on disk (`permissions.ts`, `AppShellAdmin.tsx`, `RequireRole.test.tsx`); both task commits (`29a8387`, `f927a14`) confirmed in `frontend` git history; `deferred-items.md` and this SUMMARY confirmed present on disk.

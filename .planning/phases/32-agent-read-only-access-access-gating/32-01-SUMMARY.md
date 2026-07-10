---
phase: 32-agent-read-only-access-access-gating
plan: 01
subsystem: ui
tags: [react, react-router, rbac, admin, domains]

# Dependency graph
requires:
  - phase: 30-backend-rbac-enforcement
    provides: agent already receives 2xx on all relevant read endpoints (users, brokerages, domains, boards, board_credentials, activity)
  - phase: 31-agent-dashboard-access-group-management
    provides: admin dashboard shell reachable by agent; per-route RequireRole gating pattern in admin.tsx; Can/usePermission RBAC primitives
provides:
  - "readTierRoles route tier in admin.tsx opening 6 admin routes (brokerage, boards, users, users/add-to-group, users/members/:memberId, domains, settings) to agent"
  - "ownerAdminOnly route tier retained on brokerage/add-agent and users/members/:memberId/edit"
  - "DomainCard.tsx Verify now / Upgrade plan buttons correctly gated by manage_brokerage_settings (was access_admin_panel), closing ACCESS-08"
affects: [32-02, 32-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-tier RequireRole route gating: readTierRoles (owner/admin/agent) for read surfaces vs ownerAdminOnly (owner/admin) for mutation-only routes"

key-files:
  created:
    - frontend/src/components/view/admin/domainsAdminView/DomainCard.test.tsx
  modified:
    - frontend/src/router/admin/admin.tsx
    - frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx

key-decisions:
  - "DomainCard.test.tsx Test 2 uses role 'owner' (not 'admin' as originally specified in the plan's behavior block) — manage_brokerage_settings is owner-only in ROLE_PERMISSIONS, matching the pre-existing Set as primary/Delete gates on the same card; admin never held this permission"

patterns-established:
  - "readTierRoles / ownerAdminOnly route helper split in admin.tsx — future admin routes should default to readTierRoles unless they are pure mutation flows"

requirements-completed: [ACCESS-02, ACCESS-03, ACCESS-04, ACCESS-05, ACCESS-06, ACCESS-07, ACCESS-08]

# Metrics
duration: 13min
completed: 2026-07-10
---

# Phase 32 Plan 01: Route Access Gating & ACCESS-08 Fix Summary

**Opened six admin routes to `agent` at the read tier via a new `readTierRoles` RequireRole helper, kept the two mutation-only routes owner/admin-locked, and fixed DomainCard.tsx's `access_admin_panel`-gated "Verify now"/"Upgrade plan" buttons to use `manage_brokerage_settings`, matching the card's existing owner-only mutation gates.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-10T18:44:00Z (approx)
- **Completed:** 2026-07-10T18:57:00Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `admin.tsx` route table split into `readTierRoles` (owner/admin/agent) and `ownerAdminOnly` (owner/admin) — agent can now directly navigate to `/admin/brokerage`, `/admin/boards`, `/admin/users`, `/admin/users/members/:memberId`, `/admin/users/add-to-group`, `/admin/domains`, `/admin/settings` without redirect
- `/admin/brokerage/add-agent` and `/admin/users/members/:memberId/edit` remain owner/admin-only by direct route block
- Closed ACCESS-08: `DomainCard.tsx`'s "Verify now" and "Upgrade plan" buttons no longer render for agent (previously visible via the too-broad `access_admin_panel` permission, which agent holds); both now correctly require `manage_brokerage_settings`, consistent with the card's pre-existing "Set as primary"/"Delete" gates
- New `DomainCard.test.tsx` (5 tests) proves the fix via TDD RED/GREEN: agent sees neither mutation button; owner sees both; the pre-existing "Set as primary" gate is unaffected (regression guard)

## Task Commits

Each task was committed atomically (frontend sub-repo):

1. **Task 1: Split admin.tsx route access into read-tier and write-tier role gates** - `5556fc9` (feat)
2. **Task 2: Fix ACCESS-08 — gate DomainCard.tsx buttons by manage_brokerage_settings** - `83a9ffc` (test, RED), `6468d47` (feat, GREEN)

**Plan metadata:** committed separately at monorepo root (see final commit below)

## Files Created/Modified
- `frontend/src/router/admin/admin.tsx` - Split single `ownerAdminOnly` helper into `readTierRoles` (owner/admin/agent) + `ownerAdminOnly` (owner/admin); repointed 7 routes to `readTierRoles`, kept 2 on `ownerAdminOnly`
- `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` - Changed `permission="access_admin_panel"` to `permission="manage_brokerage_settings"` on the "Verify now" and "Upgrade plan" `<Can>` wrappers (2 of 4 total gates in the file; the other 2 were already correct)
- `frontend/src/components/view/admin/domainsAdminView/DomainCard.test.tsx` (new) - 5 tests: agent hidden from Verify now (pending) and Upgrade plan (frozen); owner sees both; regression guard confirms "Set as primary" (already `manage_brokerage_settings`-gated) is unaffected by agent

## Decisions Made
- **TDD RED confirmation:** Ran the new test suite against pre-fix `DomainCard.tsx` first — confirmed exactly 2 of 5 tests failed (agent saw both mutation buttons), 3 passed (owner-visibility and regression cases), matching the plan's documented RED expectation before applying the fix.
- **Test role correction (Rule 1 - Bug):** The plan's `<behavior>` block specified role `admin` for the "Verify now IS rendered" test case. `ROLE_PERMISSIONS.admin` does not include `manage_brokerage_settings` (only `owner` does — confirmed against the live `permissions.ts` file, matching PROJECT.md's existing "Owner-only set-primary action" decision for this same card). Using `admin` would make Test 2 permanently fail post-fix, contradicting the plan's own acceptance criterion of "5 passing tests." Corrected Test 2 to use role `owner`, consistent with Test 4 and the card's established owner-only mutation-permission pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected DomainCard.test.tsx Test 2 role from `admin` to `owner`**
- **Found during:** Task 2 (writing the RED test file against pre-fix `DomainCard.tsx`)
- **Issue:** Plan's `<behavior>` spec said "Test 2: ...role admin, 'Verify now' IS rendered" — but `manage_brokerage_settings` (the corrected gate) is owner-only in the live `ROLE_PERMISSIONS` table, matching the card's pre-existing owner-only "Set as primary"/"Delete" gates. `admin` never held this permission, so the test as originally specified would fail permanently after the fix (confirmed empirically: it failed post-fix with role `admin`).
- **Fix:** Changed the test to assert role `owner` sees "Verify now" instead of `admin`, added an inline comment explaining why.
- **Files modified:** `frontend/src/components/view/admin/domainsAdminView/DomainCard.test.tsx`
- **Verification:** All 5 tests pass; `grep -c 'permission="manage_brokerage_settings"'` returns 4 as required by acceptance criteria
- **Commit:** `83a9ffc` (test commit, corrected version)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** No scope creep — the fix target (swap both gates to `manage_brokerage_settings`) was implemented exactly as specified; only the test's role assertion was corrected to match the actual, pre-existing permission model in the same file.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Route-level access for agent is fully open on the 6 read-tier admin surfaces; write-only routes remain blocked
- ACCESS-08 fully resolved
- Plans 32-02 and 32-03 (component-level mutation gating for Users list, member detail, invitations) can proceed — they build directly on the `manage_users`/`Can` pattern already validated here for `manage_brokerage_settings`
- No blockers identified

---
*Phase: 32-agent-read-only-access-access-gating*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: frontend/src/router/admin/admin.tsx
- FOUND: frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx
- FOUND: frontend/src/components/view/admin/domainsAdminView/DomainCard.test.tsx
- FOUND: .planning/phases/32-agent-read-only-access-access-gating/32-01-SUMMARY.md
- FOUND commit: 5556fc9
- FOUND commit: 83a9ffc
- FOUND commit: 6468d47

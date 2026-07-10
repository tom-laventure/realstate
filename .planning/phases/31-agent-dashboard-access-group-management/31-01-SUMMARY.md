---
phase: 31-agent-dashboard-access-group-management
plan: 01
subsystem: api
tags: [rails, rbac, main-domain-portal, minitest]

# Dependency graph
requires:
  - phase: 30-backend-rbac-enforcement
    provides: agent already granted full CRUD on group-scoped endpoints and read-only admin access on Users/Brokerage/Boards/Domains/Settings
provides:
  - "agent role included in V1::Account::AdminBrokeragesController#index membership filter"
  - "integration + controller test coverage proving agent inclusion, client-role exclusion, and admin/owner regression safety"
affects: [31-02, 31-03, main-domain-portal-access, frontend-agent-gating]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - backend/test/controllers/v1/account/admin_brokerages_controller_test.rb
  modified:
    - backend/app/controllers/v1/account/admin_brokerages_controller.rb
    - backend/test/integration/admin_brokerages_test.rb

key-decisions:
  - "Extended role: %w[admin owner] to role: %w[admin owner agent] in AdminBrokeragesController#index — the only backend gap not covered by Phase 30's RBAC work, since this endpoint lives in V1::Account, not V1::Admin"
  - "Updated the pre-existing Phase 15 (BE-01) AdminBrokeragesTest, which asserted 'agent-only user gets an empty list' as correct behavior — that assertion is now obsolete by design; replaced with an assertion that the agent's brokerage is included with role agent, and added a new test for the true empty-list case (user with zero brokerage memberships)"

requirements-completed: [ACCESS-01]

# Metrics
duration: 14min
completed: 2026-07-10
---

# Phase 31 Plan 01: Agent Main-Domain Portal Access Summary

**Widened `V1::Account::AdminBrokeragesController#index`'s role filter to include `agent`, unblocking main-domain `/dashboard` access for agents and updating both new and pre-existing test coverage to match.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-10T06:22:00Z
- **Completed:** 2026-07-10T06:36:25Z
- **Tasks:** 1
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `admin_brokerages_controller.rb`'s membership query now includes `agent` alongside `admin`/`owner`, so an agent signing in on the main domain sees their brokerage in the selector instead of hitting `/no-access`
- New `V1::Account::AdminBrokeragesControllerTest` (4 tests) proves: agent's brokerage appears with `role: "agent"`; a client-role brokerage is correctly excluded (filter isn't overly broad); owner behavior is unchanged; `member_count`/`client_count`/`owners` computation is correct and unaffected
- Discovered and fixed a pre-existing regression: the Phase 15 `AdminBrokeragesTest` integration test explicitly asserted the old "agent gets empty list" behavior as correct — updated it to assert the new, intentional behavior, and added a true empty-list case (user with zero memberships) to preserve that original guarantee

## Task Commits

TDD task, RED then GREEN:

1. **Task 1 (RED): add failing test for agent role in admin_brokerages filter** - `a0e0699` (test)
2. **Task 1 (GREEN): include agent role in admin_brokerages membership filter** - `7eceecc` (feat)

## Files Created/Modified
- `backend/app/controllers/v1/account/admin_brokerages_controller.rb` - `role: %w[admin owner]` → `role: %w[admin owner agent]` (single line change)
- `backend/test/controllers/v1/account/admin_brokerages_controller_test.rb` - new controller test, 4 tests covering inclusion/exclusion/regression/aggregate-field correctness
- `backend/test/integration/admin_brokerages_test.rb` - updated pre-existing Phase 15 test to reflect agent now being portal-eligible; added replacement empty-list case

## Decisions Made
- Followed the plan's exact one-line filter change; did not touch `member_roles`, the `owners` computation, or any other line in the controller, per PATTERNS.md guidance that those were already correct
- Fixed the pre-existing `AdminBrokeragesTest` regression in-scope (Rule 1 — auto-fix bug) rather than deferring it, since it directly and predictably breaks from this exact change and is part of the acceptance criteria ("Full backend test suite has no new failures")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated pre-existing `AdminBrokeragesTest` integration test that encoded the now-obsolete behavior**
- **Found during:** Task 1 verification (`bin/rails test test/integration/`)
- **Issue:** `backend/test/integration/admin_brokerages_test.rb` (Phase 15, BE-01) contained a test explicitly named "agent-only user gets an empty list (not an error)" asserting `admin_brokerages == []` for an agent — this is precisely the behavior D-01 intentionally changes, so the test failed once the controller filter was widened.
- **Fix:** Renamed/rewrote the test to assert the agent's brokerage is now included with `role: "agent"`, and added a new test preserving the original guarantee (a user with zero brokerage memberships still gets an empty list, not an error). Updated the class-level comment to reference Phase 31/D-01.
- **Files modified:** `backend/test/integration/admin_brokerages_test.rb`
- **Verification:** `bin/rails test test/integration/admin_brokerages_test.rb` passes (5 tests, 0 failures); full `test/integration/` suite confirmed no new failures introduced (0 failures, same 16 pre-existing errors as baseline)
- **Committed in:** `7eceecc` (part of the GREEN task commit, since it's inseparable from the controller change that caused it)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/regression fix)
**Impact on plan:** Necessary to satisfy the plan's own acceptance criterion ("Full backend test suite has no new failures"). No scope creep — same file/endpoint the plan targets.

## Issues Encountered
- Initial RED-phase test run surfaced a test-authoring bug (not a controller bug): the `member_count`/`owners` test used `create(:user)` for both agent and owner without differentiating `first_name`, so `refute_includes owner_names, @agent.first_name` failed spuriously because the factory default (`"Test"`) collided. Fixed by giving the owner user a distinct `first_name: "Owner"` in the test setup.
- Full `test/integration/` suite has 16 pre-existing errors in `BoardCredentialCrudTest`/`BoardConnectFlowTest` caused by a documented pre-existing issue (RealEstateBoard `:test_board` factory trait colliding with a live seeded row in the shared test-environment Postgres DB — see Phase 30 `deferred-items.md`). Confirmed via full-suite run that these are unrelated to this plan's change (same errors, same tests, unrelated files) and were present before this plan's tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend gap for ACCESS-01 (main-domain portal access) is now closed; agents signing in from the main domain will see `data.adminBrokerages.length > 0` be true and route into `/dashboard` (no frontend code change needed for this specific check, per CONTEXT.md).
- Plans 31-02/31-03 (subdomain gate, nav narrowing, group CRUD UI) can proceed without backend blockers from this plan.
- No blockers or concerns identified.

---
*Phase: 31-agent-dashboard-access-group-management*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (`a0e0699`, `7eceecc`) confirmed in `backend` git history.

---
phase: 33-backend-owner-api-endpoint-lockdown
plan: 01
subsystem: api
tags: [rails, rbac, authorization, admin, owner-lockdown]

# Dependency graph
requires:
  - phase: 30-backend-rbac-enforcement
    provides: "Admin::BaseController require_owner!/require_admin!/require_agent_or_above!/current_membership guard primitives"
provides:
  - "UsersController#update rejects all owner-touching role transitions (assign or demote), 403, regardless of caller role"
  - "UsersController#destroy requires owner-only caller + last-owner COUNT guard when target is an owner"
  - "InvitationsController#create rejects role \"owner\" invitations (403) for any caller while still allowing agent/admin invites"
  - "Integration test suite proving all three bypass paths are closed"
affects: [33-02-owner-settings-endpoints, 34-ownership-management-ui, 35-remove-owner-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Value-level role guard inside action body (not action-level before_action) for endpoints where only specific param values must be locked down, not the whole action"
    - "Inline require_owner! call + `return if performed?` for conditional (target-role-dependent) owner-only gating inside a shared action"
    - "Last-owner COUNT guard: BrokerageMembership.without_deleted.where(brokerage_id:, role: \"owner\").count <= 1"

key-files:
  created:
    - backend/test/integration/admin_owner_lockdown_test.rb
  modified:
    - backend/app/controllers/v1/admin/users_controller.rb
    - backend/app/controllers/v1/admin/invitations_controller.rb

key-decisions:
  - "UsersController#update now rejects owner role in both directions (assign AND demote) unconditionally — forces all owner-role changes through the future /admin/settings/owners endpoints (Plan 02), which alone will carry the last-owner guard"
  - "UsersController#destroy's owner-only + last-owner guard is evaluated inline in the action body (conditional on target's current role), not as a blanket before_action, so non-owner targets keep working under the existing require_admin! gate"
  - "InvitationsController#create's owner-role rejection is a value-level check (flat {error: \"...\"} + 403), not an action-level gate — before_action :require_admin! is untouched so admins can still invite agent/admin users"
  - "Fixed pre-existing soft-delete scoping gaps (.without_deleted) on both membership lookups in users_controller.rb while those exact lines were already being rewritten for D-01/D-02"

requirements-completed: [LOCK-01]

# Metrics
duration: 15min
completed: 2026-07-12
---

# Phase 33 Plan 01: Backend Owner API Endpoint Lockdown Summary

**Closed the CR-02/CR-03 admin-takeover chain by locking down owner-role transitions on `UsersController#update`/`#destroy` and rejecting owner-role invitations on `InvitationsController#create`, backed by 10 new integration tests.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-12T23:39:49Z (per STATE.md session start)
- **Completed:** 2026-07-12T23:43:09-07:00 (last task commit)
- **Tasks:** 3/3 completed
- **Files modified:** 2 edited, 1 created

## Accomplishments
- `PATCH /v1/admin/users/:id` now rejects both assigning role `"owner"` and demoting an existing owner, 403, regardless of caller role (D-02) — the generic endpoint can no longer be used to change ownership at all.
- `DELETE /v1/admin/users/:id` now requires the caller to be an owner (403 otherwise) when the target is an owner, and additionally blocks destroying the brokerage's last remaining owner (422) (D-01).
- `POST /v1/admin/invitations` rejects `role: "owner"` for any caller (403) while admins can still invite `agent`/`admin` users unchanged (D-03/LOCK-01).
- Fixed two pre-existing soft-delete scoping gaps (`.without_deleted`) on membership lookups touched by this work.
- 10 new integration test assertions cover every bypass path called out in the phase's threat model (T-33-01 through T-33-04, T-33-06).

## Task Commits

Each task was committed atomically (backend repo):

1. **Task 1: Lock down owner-role transitions on UsersController#update and #destroy (D-01, D-02)** - `f64ab73` (fix)
2. **Task 2: Reject owner-role invitations on InvitationsController#create (D-03 / LOCK-01)** - `7f081f9` (fix)
3. **Task 3: Integration tests for all lockdown bypass paths** - `5d1982e` (test)

_Backend and frontend are separate sub-repos per CLAUDE.md; all three commits above are in `backend/`. No frontend changes in this plan._

## Files Created/Modified
- `backend/app/controllers/v1/admin/users_controller.rb` - `#update` rejects owner-touching transitions both ways (403); `#destroy` adds inline `require_owner!` + last-owner COUNT guard (422) when target is an owner; both membership lookups now `.without_deleted`-scoped
- `backend/app/controllers/v1/admin/invitations_controller.rb` - `#create` adds a value-level 403 rejection for `role == "owner"`, inserted after the existing `role == "client"` check
- `backend/test/integration/admin_owner_lockdown_test.rb` - new `AdminOwnerLockdownTest` covering invitation owner-rejection (admin + owner callers), agent-invite-still-allowed, update owner-assign/demote rejection, non-owner-transition-still-allowed, destroy-owner-by-nonowner rejection, last-owner-destroy rejection, and non-owner-destroy-still-allowed

## Decisions Made
- Reused `Admin::BaseController#require_owner!`/`#current_membership` directly rather than re-deriving role checks — no new authorization primitives introduced, consistent with RESEARCH.md's "reuse and extend" recommendation.
- Chose 422 (`unprocessable_entity`) for the last-owner rejection message (flat `{error: "..."}` shape) and 403 (`forbidden`, nested `{error: {code:, message:}}` shape) for pure authorization failures, matching the two pre-existing shape conventions identified in RESEARCH.md Pitfall 1.
- Built a second, single-owner brokerage inline in the last-owner test (rather than reusing the shared `setup` brokerage, which intentionally has 3 owners) so the COUNT guard is exercised at exactly the boundary condition (`owner_count <= 1`).

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was a post-write `standardrb --fix` pass on the new test file to correct alignment/spacing (`Layout/ExtraSpacing`), which is normal formatting cleanup covered by the plan's own verification step, not a functional deviation.

## Issues Encountered
- `RAILS_ENV=test bin/rails test` printed a `PG::ObjectInUse` stack trace during its `db:test:purge` pre-step (pre-existing environment quirk noted in STATE.md — `DATABASE_URL` leaks a shared Postgres connection into the test environment). This did not prevent the test run itself: all 10 assertions in the new file passed against the existing test schema (10 runs, 18 assertions, 0 failures, 0 errors). No code changes were needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (new `Settings::OwnersController` with `index`/`eligible`/`create`/`update`) can now proceed — the generic `UsersController` endpoints are fully locked down, so no bypass path will remain open once Plan 02 ships the owner-only promote/demote endpoints.
- Plan 03 (LOCK-02, frontend `AddAgentView` role-selector removal) is unblocked — the backend now rejects `role: "owner"` server-side independent of any frontend change, so Plan 03's UI fix is now pure defense-in-depth as intended.
- No blockers identified.

---
*Phase: 33-backend-owner-api-endpoint-lockdown*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: `.planning/phases/33-backend-owner-api-endpoint-lockdown/33-01-SUMMARY.md`
- FOUND: `f64ab73` (backend)
- FOUND: `7f081f9` (backend)
- FOUND: `5d1982e` (backend)

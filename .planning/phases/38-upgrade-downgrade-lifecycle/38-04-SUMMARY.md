---
phase: 38-upgrade-downgrade-lifecycle
plan: 04
subsystem: backend
tags: [rails, cognito-auth, multi-tenancy, board-credentials, authorization]

# Dependency graph
requires:
  - phase: 38-01
    provides: "brokerage_memberships.suspended_at, BrokerageBoardCredential#status suspended enum value, BrokerageMembership#suspended?/#suspend!/#restore!"
provides:
  - "Request-level 403 rejection of suspended client memberships in CognitoAuth (D-09)"
  - "Suspended board credentials fully invisible in member-visible board list (D-07)"
  - "Suspended board credentials immutable via update/destroy — 404 as if nonexistent (D-07, T-38-10)"
affects: [38-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Suspended-membership rejection colocated with existing membership-existence check in CognitoAuth#authenticate_cognito_user!, distinct 403 message"
    - "Write-endpoint invisibility: .where.not(status: \"suspended\") on the same lookup chain used by the read-endpoint scope, so update/destroy reuse the existing RecordNotFound 404 path instead of a new error branch"

key-files:
  created:
    - backend/test/integration/suspended_membership_auth_test.rb
    - backend/test/controllers/v1/admin/board_credentials_controller_test.rb
  modified:
    - backend/app/controllers/concerns/cognito_auth.rb
    - backend/app/controllers/v1/admin/board_credentials_controller.rb

key-decisions:
  - "Task 3 fix used approach (a) from the plan's checker — a plain 404 via .where.not(status: \"suspended\") on update/destroy's existing lookup chain, reusing the existing RecordNotFound rescue — rather than introducing a new plan-tier-aware error path, matching D-07's 'same as if it never existed' framing exactly"
  - "Regression test for update on an active credential uses webmock against a plain (non-test) real_estate_board rather than creating a second :test_board fixture, to avoid the pre-existing :test_board factory/live-DB collision documented in STATE.md"

requirements-completed: [PLAN-16, PLAN-17]

# Metrics
duration: ~25min
completed: 2026-07-22
---

# Phase 38 Plan 04: Suspend Enforcement — Auth Rejection, Board-List Invisibility, Write Immutability Summary

**CognitoAuth now rejects suspended client memberships with a distinct 403 (D-09); board_credentials#index excludes suspended credentials (D-07); board_credentials#update/#destroy treat a suspended credential as nonexistent, closing the reactivation hole where an admin could PATCH a frozen real-board credential back to active (T-38-10)**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-22
- **Tasks:** 3/3 completed
- **Files modified:** 4 (2 controllers/concerns + 2 new test files)

## Accomplishments

- `CognitoAuth#authenticate_cognito_user!` replaced its `.exists?` membership check with `.find_by`, added a `membership.suspended_at.present?` guard rendering a distinct 403 (`"Your access has been suspended"`) separate from the existing `"You are not a member of this brokerage"` 403 — the "not a member" wording is unchanged.
- `V1::Admin::BoardCredentialsController#index` scope now excludes `status: "suspended"` — suspended real-board credentials are fully invisible in the member-visible board list, with no new "suspended" indicator added to `BrokerageBoardCredentialSerializer`.
- `#update` and `#destroy` lookup chains both add `.where.not(status: "suspended")`, so a suspended credential id raises `ActiveRecord::RecordNotFound` before any `assign_attributes`/`RetsAuthService` call — a suspended credential 404s as if it never existed and its `status` is never mutated back to `"active"`. `create`'s existing `plan_config.real_boards || board.is_test_board?` gate was left untouched.
- New `test/integration/suspended_membership_auth_test.rb` (3 tests): suspended client gets 403 with the distinct message on `GET /v1/user`; restoring the membership lifts the block; a non-suspended membership authenticates normally.
- New `test/controllers/v1/admin/board_credentials_controller_test.rb` (5 tests): index excludes suspended, includes active+invalid; PATCH/DELETE on a suspended credential both 404 without mutating status/deleted_at; PATCH/DELETE on an active credential still succeed (regression guard).

## Task Commits

All three tasks were committed atomically in the `backend` sub-repo (branch `worktree-agent-a1eb29eaab8c7fb32-backend`, based on `backend@main` at `36e44de` — the tip after Plan 38-01 and 38-02 were merged):

1. **Task 1: Block suspended memberships in CognitoAuth** — `383cd5f` (feat) — backend
2. **Task 2: Exclude suspended credentials from board list + tests** — `c578ddf` (feat) — backend
3. **Task 3: Block reactivation/disconnect of suspended credentials via update & destroy** — `a446f83` (feat) — backend

**Plan metadata:** committed separately in the monorepo worktree (this SUMMARY + no shared STATE.md/ROADMAP.md writes — orchestrator owns those per worktree execution mode).

## Files Created/Modified

- `backend/app/controllers/concerns/cognito_auth.rb` — `.exists?` → `.find_by` membership lookup; added `suspended_at.present?` 403 branch
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` — `index`/`update`/`destroy` all add `.where.not(status: "suspended")`
- `backend/test/integration/suspended_membership_auth_test.rb` — new, 3 tests
- `backend/test/controllers/v1/admin/board_credentials_controller_test.rb` — new, 5 tests

## Decisions Made

- Followed the plan's exact interface extension for Task 1 — no deviation from the locked `.find_by`/two-branch shape.
- For Task 3, used the plan's recommended approach (a): reuse the existing `RecordNotFound` 404 path via `.where.not(status: "suspended")` rather than a new plan-tier error, per the plan's explicit checker guidance and D-07's "same as if it never existed" framing.
- Chose `GET /v1/user` (`V1::UsersController#show`) as the authenticated brokerage-scoped endpoint for the suspended-membership integration test — it is guarded only by `CognitoAuth`/`BrokerageAuth` with no additional role restriction, so a `client`-role membership can exercise it directly without hitting an unrelated `require_agent_or_above!`/`require_admin!` 403 that would confound the suspended-403 assertion.
- Regression test for "PATCH update on an active credential still succeeds" uses `webmock` against a plain (non-test) `real_estate_board` fixture instead of creating a second `:test_board` fixture, specifically to avoid the pre-existing `:test_board` factory/live-DB name collision documented in `.planning/STATE.md`'s Blockers/Concerns section (confirmed still present — see Issues Encountered below).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written for all three tasks. No Rule 1-4 deviations were needed; the only adjustment was a test-fixture choice (avoiding a known pre-existing environment collision), not a functional deviation from the plan's specified behavior.

**Total deviations:** 0
**Impact on plan:** None — all three tasks implemented exactly per the plan's interfaces and acceptance criteria.

## Issues Encountered

- Confirmed the pre-existing `RealEstateBoard(:test_board)` factory/live-seeded-row collision (documented in `.planning/STATE.md` Blockers/Concerns) is still present: running the unrelated, untouched `test/integration/board_credential_crud_test.rb` in this environment produces `ActiveRecord::RecordInvalid: Name has already been taken, Short code has already been taken` for every test that creates a second `:test_board` fixture, because `RAILS_ENV=test` leaks `DATABASE_URL` into the same live Postgres instance as `development`, which already has a seeded TEST board row. This is out of scope for this plan (pre-existing, unrelated file) — not fixed, logged here per the SCOPE BOUNDARY rule. This plan's own new tests deliberately avoid the `:test_board` trait for this reason (see Decisions Made).
- The `db:test:load_schema => db:test:purge` rake task also errors before every `bin/rails test` invocation in this environment (same shared-live-DB condition, cannot `DROP DATABASE` on the live Neon Postgres instance) — this is cosmetic noise preceding the actual test run; all test runs in this plan completed and reported accurate pass/fail counts despite the preceding rake error.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CognitoAuth's suspended-membership rejection is live for Plan 05's re-upgrade/restore orchestration to depend on (a restored membership must pass this same check).
- Board-credential invisibility/immutability is enforced at all three surfaces the requirement touches (`index`, `update`, `destroy`); Plan 05's restore logic can safely flip `status: "suspended"` → `"active"` via `update_all` (bypassing these controller-level guards entirely, as it operates at the model/job layer) without needing any further guard changes here.
- Blocker: the orchestrator must merge branch `worktree-agent-a1eb29eaab8c7fb32-backend` (based on `backend@main` at `36e44de`) into `backend/main` before any downstream plan/agent that depends on this enforcement can build on top of it in a fresh worktree — same merge pattern as Plans 38-01/38-02.

---
*Phase: 38-upgrade-downgrade-lifecycle*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: backend/app/controllers/concerns/cognito_auth.rb
- FOUND: backend/app/controllers/v1/admin/board_credentials_controller.rb
- FOUND: backend/test/integration/suspended_membership_auth_test.rb
- FOUND: backend/test/controllers/v1/admin/board_credentials_controller_test.rb
- FOUND: .planning/phases/38-upgrade-downgrade-lifecycle/38-04-SUMMARY.md
- FOUND commit 383cd5f (backend: Task 1 - block suspended memberships in CognitoAuth)
- FOUND commit c578ddf (backend: Task 2 - exclude suspended credentials from board list + tests)
- FOUND commit a446f83 (backend: Task 3 - block reactivate/disconnect of suspended credentials)

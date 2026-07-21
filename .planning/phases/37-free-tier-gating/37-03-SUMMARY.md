---
phase: 37-free-tier-gating
plan: 03
subsystem: testing
tags: [minitest, rails-integration-test, plan-tiers, free-tier, regression]

requires:
  - phase: 36-plan-config-migration
    provides: "AppConstants::PLAN_TIERS config, plan enum on Brokerage, Phase-36 custom-domain gate in domains_controller.rb#custom"
provides:
  - "PLAN-06 regression: Free-tier brokerages have no seat cap (request-level + source grep)"
  - "PLAN-08 + PLAN-12 regression: custom-domain gate proven for Free, proven absent for independent and growth"
  - "PLAN-09 regression: engagement features (groups, filter sets, ratings) work identically on Free and are free of plan gating"
affects: [37-01, 37-02, 37-04, 37-05, 37-06]

tech-stack:
  added: []
  patterns:
    - "Source-assertion regression tests: grep controller directories for forbidden wording/method calls (seat_limit|seat_cap|max_seats, plan_config|plan_required), filtering comment lines, asserting empty matches"
    - "Request-level member-add regression via the real UI-facing endpoint: POST /v1/dashboard/invitations/accept_token (not just factory inserts)"

key-files:
  created:
    - backend/test/integration/free_tier_seats_test.rb
    - backend/test/integration/free_tier_domain_gate_test.rb
    - backend/test/integration/free_tier_engagement_test.rb
  modified: []

key-decisions:
  - "Task 2 test file re-asserts the Free-403 case (PLAN-08) alongside the new independent/growth not-403 cases (PLAN-12), even though admin_domains_test.rb (DMOD-05) already covers the Free-403 case — the plan's acceptance criteria require all three assertions live together in this file as a single source-of-truth regression; the pre-existing DMOD-05 test is left untouched (not a duplicate removal), noted here for traceability."
  - "free_tier_engagement_test.rb reuses an already-persisted is_test_board row if one exists in the shared test-environment Postgres DB, falling back to a fresh factory build otherwise — works around the documented pre-existing pitfall (STATE.md Blockers: DATABASE_URL leaks a seeded TEST board into RAILS_ENV=test), without touching app/ code or the pre-existing affected test files (board_connect_flow_test.rb, board_credential_crud_test.rb), which are out of scope for this plan."

requirements-completed: [PLAN-06, PLAN-08, PLAN-09, PLAN-12]

duration: ~25min
completed: 2026-07-21
---

# Phase 37 Plan 03: Free-Tier "Verify, Don't Build" Regression Tests Summary

**Three new Minitest integration test files locking in Free-tier's uncapped seats, the Phase-36 custom-domain gate (plus its paid-tier non-restriction counterpart), and plan-agnostic engagement features — zero application code changed.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 3 (all new test files)

## Accomplishments

- `free_tier_seats_test.rb`: proves a Free brokerage accepts 11+ direct membership inserts and 10 real HTTP member-adds (`POST /v1/dashboard/invitations/accept_token`) with zero 403/seat-limit responses; source-asserts no `seat_limit|seat_cap|max_seats` wording exists anywhere under `app/controllers/v1/admin`.
- `free_tier_domain_gate_test.rb`: proves `POST /v1/admin/domains/custom` returns 403 `plan_required` for a Free brokerage, and is NOT rejected (200, no `plan_required` code) for both `independent` and `growth` brokerages — without modifying `domains_controller.rb`.
- `free_tier_engagement_test.rb`: proves a Free brokerage owner can create a group, create/read a group filter set matching a TEST-board estate, and rate a TEST-board estate in a group they belong to — all via real HTTP endpoints, all 2xx. Source-asserts zero `plan_config|plan_required` references across `app/controllers/v1/dashboard/**` and `app/controllers/v1/admin/group/*` (excluding `group/invitations_controller.rb`, which legitimately gates client invites and is out of scope here).

## Task Commits

Each task was committed atomically in the `backend` sub-repo (branch `worktree-agent-ab8afe2bddd16b3b1-backend`, base `main` @ `4c2bb03`):

1. **Task 1: Uncapped-seats regression (PLAN-06)** — `434c8fa` (test)
2. **Task 2: Domain gate + paid-unrestricted regression (PLAN-08, PLAN-12)** — `395fa5f` (test)
3. **Task 3: Engagement-features-unchanged regression (PLAN-09)** — `70b75be` (test)

**Sub-repo:** `backend` — branch `worktree-agent-ab8afe2bddd16b3b1-backend`, 3 commits on top of `main` @ `4c2bb03`. No monorepo-root code changes other than this SUMMARY.md (per orchestrator instructions, STATE.md/ROADMAP.md are not touched by this worktree agent).

## Files Created/Modified

- `backend/test/integration/free_tier_seats_test.rb` — PLAN-06 uncapped-seats regression (direct inserts, real HTTP accept_token path, source grep)
- `backend/test/integration/free_tier_domain_gate_test.rb` — PLAN-08 + PLAN-12 domain gate regression (free 403, independent/growth not-403)
- `backend/test/integration/free_tier_engagement_test.rb` — PLAN-09 engagement-unchanged regression (group create, filter set, rating, source grep)

## Decisions Made

- Task 2's acceptance criteria required the Free-403 assertion to live in the new file alongside the paid-tier counterparts, even though `admin_domains_test.rb` (DMOD-05) already covers the Free-403 case from Phase 36. Both now exist; no duplication was removed, since the plan explicitly scoped this task to verification-only and did not ask for consolidation.
- `free_tier_engagement_test.rb`'s setup reuses an existing `is_test_board` row (`RealEstateBoard.find_by(is_test_board: true) || create(:real_estate_board, :test_board)`) instead of always creating a fresh one. This is a Rule 3 (blocking-issue) auto-fix: the shared test-environment Postgres DB has a pre-existing seeded TEST board (documented in `.planning/STATE.md` Blockers/Concerns — `DATABASE_URL` leaks into `RAILS_ENV=test`), which collided with the factory's hardcoded `short_code: "TEST"` on every fresh `create`. The fix is test-code-only, scoped to this plan's new file, and does not touch `app/` or the already-affected pre-existing test files (`board_connect_flow_test.rb`, `board_credential_crud_test.rb` — both fail standalone in this environment for the same pre-existing reason, confirmed out of scope for this plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reused existing TEST board row instead of always factory-creating one**
- **Found during:** Task 3 (`free_tier_engagement_test.rb`)
- **Issue:** `bin/rails test test/integration/free_tier_engagement_test.rb` failed with `ActiveRecord::RecordInvalid: Validation failed: Name has already been taken, Short code has already been taken` on every test — the shared test-environment Postgres DB already has a permanently seeded `RealEstateBoard(is_test_board: true, short_code: "TEST")` row (confirmed via `RAILS_ENV=test bin/rails runner`), and the `:test_board` factory trait hardcodes the same `short_code`. This is the exact pre-existing pitfall documented in `.planning/STATE.md` Blockers/Concerns.
- **Fix:** Changed setup to `RealEstateBoard.find_by(is_test_board: true) || create(:real_estate_board, :test_board)` — reuses the pre-existing seeded row when present, falls back to a fresh factory build when the test DB is clean/isolated.
- **Files modified:** `backend/test/integration/free_tier_engagement_test.rb`
- **Verification:** `bin/rails test test/integration/free_tier_engagement_test.rb` — 4 runs, 9 assertions, 0 failures, 0 errors.
- **Committed in:** `70b75be` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to make this plan's own new test pass in the actual shared environment; no scope creep — pre-existing failures in `board_connect_flow_test.rb`/`board_credential_crud_test.rb` (same root cause) were left untouched as genuinely out of scope for this plan.

## Issues Encountered

- **Nested sub-repo worktree bootstrap:** The `backend/` directory was empty in the isolated monorepo worktree (gitlink with no `.gitmodules`, per the documented known repo quirk). Created a proper nested `git -C backend worktree add` off `backend`'s `main` branch, then copied `vendor/bundle` (396M, installed gems), `.bundle/config`, `.env`, and `config/master.key` from the primary `backend` checkout so `bin/rails test` could run — none of these are plan deliverables, all are local environment bootstrap only, not committed.
- **Shared Postgres test DB contention:** Every `bin/rails test` invocation logs a `PG::ObjectInUse` error during `db:test:load_schema => db:test:purge` (another session holding the Neon Postgres connection — consistent with parallel sibling worktree agents also running tests against the same `DATABASE_URL`). Tests still ran to completion afterward in every invocation; all three new files pass individually and together (`10 runs, 52 assertions, 0 failures, 0 errors, 0 skips` for the combined run). This matches the pre-existing environment blocker already logged in `.planning/STATE.md`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three "verify, don't build" requirements (PLAN-06, PLAN-08, PLAN-09, PLAN-12 domain slice) are now codified as regression tests and passing.
- No application code was changed by this plan (`git status backend/app` shows no diff in the `backend` sub-repo worktree) — confirmed against the plan's overall `<verification>` requirement.
- The orchestrator should merge `worktree-agent-ab8afe2bddd16b3b1-backend` (3 commits, based on `backend` `main` @ `4c2bb03`) into `backend`'s `main`, alongside this monorepo worktree's merge.

---
*Phase: 37-free-tier-gating*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: `.planning/phases/37-free-tier-gating/37-03-SUMMARY.md`
- FOUND: commit `434c8fa` (backend sub-repo)
- FOUND: commit `395fa5f` (backend sub-repo)
- FOUND: commit `70b75be` (backend sub-repo)
- FOUND: `backend/test/integration/free_tier_seats_test.rb`
- FOUND: `backend/test/integration/free_tier_domain_gate_test.rb`
- FOUND: `backend/test/integration/free_tier_engagement_test.rb`

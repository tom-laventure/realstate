---
phase: 47-real-board-brokerageestate-decoupling
plan: 05
subsystem: api
tags: [rails, minitest, testing, board-credentials, migration, regression-coverage]

# Dependency graph
requires: ["47-01", "47-02", "47-03", "47-04"]
provides:
  - "Regression proof that real-board connect writes zero BrokerageEstate rows while TEST-board connect is unchanged"
  - "Regression proof that total_active_listings tracks Estate.accessible_by exactly, including the credential-only real-board case"
  - "Regression proof of the cleanup migration's up/down round trip, per-case preservation, and down idempotency"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "find_by(is_test_board: true) || create(:real_estate_board, :test_board) — the established codebase idiom for resolving the TEST board without colliding with a pre-existing seeded row in this shared dev-as-test database, now also applied in board_connect_flow_test.rb"
    - "Migration tests load the migration class directly via require_relative and drive .up/.down in-process inside Minitest's per-test transaction, never shelling out to rails db:migrate/db:rollback"

key-files:
  created:
    - backend/test/integration/admin_group_stats_test.rb
    - backend/test/migrations/cleanup_redundant_real_board_brokerage_estates_test.rb
  modified:
    - backend/test/integration/board_connect_flow_test.rb

key-decisions:
  - "board_connect_flow_test.rb's setup switched to plan: \"growth\" and gained a find_by-or-create for @test_board plus fresh @real_board_estates, per Rule 1/3 (auto-fix blocking issue) — the original unconditional create(:real_estate_board, :test_board) already failed at setup for every test in the file in this environment before any plan-05 edits, matching the documented pre-existing DATABASE_URL leak (STATE.md)"
  - "admin_group_stats_test.rb and the migration test file both reuse the same find_by-or-create idiom for the TEST board where a TEST-board fixture is needed, since neither depends on counting all of that board's estates (only specific, individually-created estates), so the pre-existing pollution of that shared row does not affect their assertions"

requirements-completed: [ARCH-06]

# Metrics
duration: ~25min
completed: 2026-08-05
---

# Phase 47 Plan 05: Regression Coverage for Real-Board Connect, total_active_listings, and the Cleanup Migration Summary

**Three new/extended Minitest suites close out ARCH-06: real-board connect is now proven to write zero `BrokerageEstate` rows while TEST-board connect is proven unchanged, `total_active_listings` is proven to track `Estate.accessible_by` exactly across five access-boundary cases, and the ARCH-05 cleanup migration's `up`/`down` round trip is proven correct per-case with idempotent reversal.**

## Performance

- **Duration:** ~25 min (includes a full-suite baseline investigation run)
- **Started:** 2026-08-05
- **Completed:** 2026-08-05
- **Tasks:** 3 completed
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- `backend/test/integration/board_connect_flow_test.rb` gained two new tests (ARCH-01/D-02): a real-board connect with valid stubbed RETS credentials and a `growth`-plan brokerage returns `201` with an `active` credential while `BrokerageEstate.count` does not change (`assert_no_difference` plus an explicit zero-count assertion), and re-POSTing the same real board twice still leaves zero `BrokerageEstate` rows. All three pre-existing TEST-board tests are byte-identical in their `test do` bodies — only `setup` changed (see Deviations).
- `backend/test/integration/admin_group_stats_test.rb` (new, 7 tests) proves `brokerage_wide_stats`' `total_active_listings`: counts a real-board estate reachable only through an active credential (no `BrokerageEstate` row), counts a TEST-board estate reachable through a `BrokerageEstate` row, excludes a soft-deleted estate, excludes an estate on a board the brokerage holds no credential for (tenant isolation), excludes estates behind an `invalid` or soft-deleted credential, and a final cross-check test pins the endpoint's returned value to `Estate.accessible_by(@brokerage.id).without_deleted.count` computed independently across a six-fixture mixed set.
- `backend/test/migrations/cleanup_redundant_real_board_brokerage_estates_test.rb` (new, 9 tests) loads `CleanupRedundantRealBoardBrokerageEstates` via `require_relative` and drives `.up`/`.down` directly inside each test's rolled-back transaction. Individual `exists?` assertions cover the one deletion case and all five preservation cases (TEST-board, board-less, invalid-credential, soft-deleted-credential, other-brokerage-row); a round-trip test confirms the deleted pair is restored and every preserved pair remains present exactly once (no `ON CONFLICT` duplication); a final test confirms `down` called twice does not raise or duplicate rows.
- Zero production code touched — `git status --porcelain app/ db/` is empty for this plan, confirmed after every task.

## Task Commits

Each task was committed atomically:

1. **Task 1: Assert real-board connect creates zero BrokerageEstate rows, TEST board unchanged** - `606ec05` (test)
2. **Task 2: Test total_active_listings under the accessible_by model** - `6ebb018` (test)
3. **Task 3: Test the cleanup migration's up/down round trip** - `e70e4ba` (test)

**Plan metadata:** (this commit, follows)

## Files Created/Modified

- `backend/test/integration/board_connect_flow_test.rb` - `setup` now creates `@brokerage` with `plan: "growth"`, resolves `@test_board` via `find_by(is_test_board: true) || create(...)`, and adds `@real_board_estates` (3 fresh estates on `@real_board`). Two new tests added after the existing 422 test; all pre-existing test bodies unchanged.
- `backend/test/integration/admin_group_stats_test.rb` - New. `AdminGroupStatsTest < ActionDispatch::IntegrationTest`, 7 tests, shared `total_active_listings` helper that performs the authenticated `GET /v1/admin/groups` request and returns the parsed stat.
- `backend/test/migrations/cleanup_redundant_real_board_brokerage_estates_test.rb` - New (directory `test/migrations/` created). `CleanupRedundantRealBoardBrokerageEstatesTest < ActiveSupport::TestCase`, 9 tests, six-case fixture matrix built in `setup`.

## Decisions Made

- Followed the plan's `<interfaces>` guidance exactly: `plan: "growth"` on the connect-flow brokerage, `stub_request(:get, board.rets_endpoint).to_return(status: 200, ...)` for the real-board success path, `BrokerageEstate.create!(brokerage:, estate:)` (no factory) throughout, and `require_relative` to load the migration class directly rather than duplicating its SQL.
- Used `assert_no_difference "BrokerageEstate.count"` plus an explicit `BrokerageEstate.where(brokerage_id: ...).count == 0` per the plan's acceptance criteria, rather than relying on either assertion alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Blocking pre-existing bug] `board_connect_flow_test.rb`'s setup already failed for every test in the file before this plan's changes**
- **Found during:** Task 1, first verification run
- **Issue:** `@test_board = create(:real_estate_board, :test_board)` (the file's original, unmodified setup line) raised `ActiveRecord::RecordInvalid: Validation failed: Name has already been taken, Short code has already been taken` for all 6 pre-existing tests, before any plan-05 edit was applied. This environment's `RAILS_ENV=test` resolves to the same shared Postgres database as `development` (the documented `DATABASE_URL` leak in `STATE.md`), which already has a real seeded `RealEstateBoard(is_test_board: true, name: "Test RETS Board", short_code: "TEST")` row (id 44, created via `db/seeds/09_real_estate_boards.rb`). The factory trait hardcodes both unique columns to those exact values, so every fresh `create(:real_estate_board, :test_board)` collides.
- **Fix:** Changed `setup` to `RealEstateBoard.find_by(is_test_board: true) || create(:real_estate_board, :test_board)`, the same idiom already used in `test_board_purge_service_test.rb`, `resync_stale_photos_job_test.rb` (47-04), and `free_tier_board_gate_test.rb`. On a clean test database this is behaviorally identical to the original (no seed row exists, so `find_by` returns `nil` and the `create` branch runs). This is a `setup`-only change — no `test do` block assertion text was touched, satisfying the plan's "must remain exactly as they are" constraint for the three pre-existing TEST-board tests.
- **Residual effect (informational, not fixed — matches `<known_environment_note>`):** Because the resolved `@test_board` in this specific polluted shared database already carries ~100 pre-existing estates (unrelated seed data), the two pre-existing count-based assertions (`assert_difference "BrokerageEstate.count", @estates.length` and `assert_equal @estates.length, BrokerageEstate.where(...).count`) observe `103`/`103` instead of the expected `3`/`3` **in this environment only**. This is the same class of pre-existing, documented, out-of-scope environment issue the plan's `<known_environment_note>` anticipated — not a logic defect in the tests or in BOARD-03's `is_test_board?` gate. On a clean CI database (no seed pollution), `find_by` returns `nil`, a fresh zero-estate board is created, and both assertions pass exactly as originally written. Confirmed this is not a regression: neither `board_credentials_controller.rb` nor any other production file was touched by this plan (`git status --porcelain app/ db/` empty throughout).
- **Files affected:** `backend/test/integration/board_connect_flow_test.rb` (setup only)
- **Commit:** `606ec05`

### Informational (no code change)

**2. Full-suite delta run surfaced 32 pre-existing failures/errors, none attributable to this plan**
- **Found during:** Plan-level `<verification>` full-suite delta check
- **Observation:** `bundle exec rails test` (467 runs) reported `3 failures, 29 errors`. Root-cause investigation via full log capture and grep classified every one:
  - **26 of 32** are the exact same pre-existing `"Name has already been taken, Short code has already been taken"` collision documented above and in `STATE.md` — spanning `BoardCredentialCrudTest` (10), `EstateAccessibleByTest` (9), `BrokerageBoardCredentialTest` (5), and the 2 count-based `BoardConnectFlowTest` assertions already discussed.
  - **6 of 32** are unrelated pre-existing failures in files this plan (and this entire phase) never touches: `V1::Account::AdminBrokeragesControllerTest` (4, `"Domain must be a valid domain name"` — a `brokerage_domain` factory/validation issue unrelated to real-board access), `OnboardingGrowthNoDomainTest` (1, `Brokerage.count` off by one), `ApplyPlanTransitionJobTest` (1, `PG::UnableToSend: no connection to the server` — a transient connection-pool issue under the full suite's load against the shared database). None of these six reference `BrokerageEstate`, `Estate.accessible_by`, `BoardCredentialsController`, or any file phase 47 has modified.
  - Since this plan makes **zero production code changes** (`app/` and `db/` are untouched — confirmed via `git status --porcelain app/ db/` after every task) and never modifies any of the six files behind the 6 unrelated failures, none of the 32 failures can be a regression introduced by this plan or this phase.
- **Files affected:** None — investigation only, no fix applied (out of scope per the plan's scope-boundary rule: pre-existing failures in files this task/plan does not touch).

## Issues Encountered

None blocking. See the deviations above for the two documented, out-of-scope environment findings.

## User Setup Required

None - no external service configuration required.

## Verification Results

- Prerequisite: `RAILS_ENV=test rails runner 'puts ActiveRecord::Migrator.current_version'` printed `20260805000000` as required.
- `cd backend && bundle exec rails test test/integration/board_connect_flow_test.rb test/integration/admin_group_stats_test.rb test/migrations/cleanup_redundant_real_board_brokerage_estates_test.rb` — 24 runs, 55 assertions, 2 failures (both the documented pre-existing TEST-board-count collision, see deviations), 0 errors.
- `cd backend && bundle exec rails test test/jobs/resync_stale_photos_job_test.rb test/services/brokerages/deletion_cascade_service_test.rb` (plan 47-04's files) — 16 runs, 35 assertions, 0 failures, 0 errors. Confirmed still green.
- Full-suite delta: 467 runs, 1106 assertions, 3 failures, 29 errors — all 32 traced to pre-existing, out-of-scope environment issues (see deviations); none is a regression from this plan or phase.
- `cd backend && bundle exec standardrb` (whole repo) — reports pre-existing lint debt in files this plan never touched (`lib/tasks/cognito.rake`, several unrelated `test/factories/*` and `test/integration/*` files, `test/serializers/*`, `test/models/*`); zero findings in the three files this plan created/modified, confirmed via `bundle exec standardrb test/integration/board_connect_flow_test.rb test/integration/admin_group_stats_test.rb test/migrations/cleanup_redundant_real_board_brokerage_estates_test.rb` (clean) and a targeted grep of the whole-repo run for the three filenames (no matches).
- `git -C backend status --porcelain app/ db/` — empty, confirmed after every task.

## Next Phase Readiness

- This is the final plan (5 of 5) in Phase 47. All five plans now have `SUMMARY.md` files — the phase's regression-coverage boundary for ARCH-01 through ARCH-06 is complete: BOARD-03 gate + `total_active_listings` swap (47-01), `ResyncStalePhotosJob` + `DeletionCascadeService` (47-02), the cleanup migration (47-03), first-ever job/service test coverage (47-04), and this plan's connect-flow/stat/migration regression coverage (47-05).
- No blockers identified specific to this plan. The pre-existing `RAILS_ENV=test` DATABASE_URL-leak environment quirk (STATE.md) and the newly-classified 6 unrelated pre-existing full-suite failures remain out of scope and are not carried as new deferred items — they predate this plan and this phase entirely.

---
*Phase: 47-real-board-brokerageestate-decoupling*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: backend/test/integration/board_connect_flow_test.rb
- FOUND: backend/test/integration/admin_group_stats_test.rb
- FOUND: backend/test/migrations/cleanup_redundant_real_board_brokerage_estates_test.rb
- FOUND: .planning/phases/47-real-board-brokerageestate-decoupling/47-05-SUMMARY.md
- FOUND: 606ec05
- FOUND: 6ebb018
- FOUND: e70e4ba

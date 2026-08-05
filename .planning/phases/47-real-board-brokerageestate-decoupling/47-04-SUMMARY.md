---
phase: 47-real-board-brokerageestate-decoupling
plan: 04
subsystem: api
tags: [rails, minitest, testing, background-jobs, board-credentials]

# Dependency graph
requires: ["47-01", "47-02", "47-03"]
provides:
  - "First-ever test coverage for ResyncStalePhotosJob (all four brokerage-resolution paths)"
  - "First-ever test coverage for Brokerages::DeletionCascadeService (real-board estate survival + join-row scoping)"
affects: [47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Job/service tests assert on behavior (enqueued args, row presence/absence, deleted_at state) never on implementation internals, except one queue-name config assertion mirroring an existing sibling-test convention"

key-files:
  created:
    - backend/test/jobs/resync_stale_photos_job_test.rb
    - backend/test/services/brokerages/deletion_cascade_service_test.rb
  modified: []

key-decisions:
  - "include ActiveJob::TestHelper explicitly in ResyncStalePhotosJobTest — assert_enqueued_with/assert_no_enqueued_jobs are not resolvable from bare ActiveSupport::TestCase in this suite, confirming the interface note's fallback instruction was needed"
  - "Every ListingDetail fixture given a distinct mls_number (unique partial index) and every real-board test builds its own RealEstateBoard via create(:real_estate_board) rather than sharing one across tests, avoiding cross-test credential/board collisions"
  - "Zero production files touched — both app/jobs/resync_stale_photos_job.rb and app/services/brokerages/deletion_cascade_service.rb verified unmodified via git status --porcelain after each task"

requirements-completed: [ARCH-06]

# Metrics
duration: 6min
completed: 2026-08-05
---

# Phase 47 Plan 04: Test Coverage for ResyncStalePhotosJob and Brokerages::DeletionCascadeService Summary

**First-ever Minitest coverage lands for `ResyncStalePhotosJob`'s four-way brokerage-resolution chain and `Brokerages::DeletionCascadeService`'s real-board-estate-survival behavior, closing the D-12 regression gap this phase's ARCH-03/ARCH-04 changes opened without any prior test enforcement.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-05
- **Completed:** 2026-08-05
- **Tasks:** 2 completed
- **Files created:** 2

## Accomplishments

- `backend/test/jobs/resync_stale_photos_job_test.rb` (130 lines, 10 tests): covers the real-board credential resolution path (zero `BrokerageEstate` rows), both preserved legacy paths (TEST-board via `BrokerageEstate`, manually-added estate via `GroupEstate` → group fallback), the two no-active-credential negative cases (`invalid` status and soft-deleted credential), chain-order precedence (`BrokerageEstate` wins when both a join row and a credential exist), the fresh-listing skip, the `photos_synced_at`/`photos_sync_claimed_at` reset side effect, and a queue-name config assertion mirroring `geocode_listings_job_test.rb`'s convention.
- `backend/test/services/brokerages/deletion_cascade_service_test.rb` (75 lines, 6 tests): covers a real-board estate (credential-only access, no `BrokerageEstate` row) surviving the cascade with `deleted_at` nil, a TEST-board estate whose sole `BrokerageEstate` row belonged to the deleted brokerage being soft-deleted with its join row hard-deleted, a shared estate keeping a second brokerage's join row intact while only the deleted brokerage's row disappears, the brokerage itself ending `deletion_status: "deleted"` with `deleted_at` set, and groups/memberships/board credentials being soft-deleted with domains decommissioned.
- Both test files are 100% behavioral assertions (enqueued job args, row presence/absence via `with_deleted`, `deleted_at`/`deletion_status` state) per T-47-13's mitigation — the only source-level assertion is the queue-name check, matching the existing sibling-test pattern.
- Zero production code touched in either task, confirmed via `git status --porcelain app/` returning empty after both tasks.

## Task Commits

Each task was committed atomically:

1. **Task 1: Test ResyncStalePhotosJob brokerage resolution paths** - `e7b4ebe` (test)
2. **Task 2: Test Brokerages::DeletionCascadeService estate handling** - `958e2aa` (test)

**Plan metadata:** (this commit, follows)

## Files Created/Modified

- `backend/test/jobs/resync_stale_photos_job_test.rb` - New. `ResyncStalePhotosJobTest < ActiveSupport::TestCase`, `include ActiveJob::TestHelper` (required — `assert_enqueued_with`/`assert_no_enqueued_jobs` were not resolvable from bare `ActiveSupport::TestCase` in this suite). 10 tests covering all behaviors listed in the plan's `<behavior>` block.
- `backend/test/services/brokerages/deletion_cascade_service_test.rb` - New (directory `test/services/brokerages/` created). `Brokerages::DeletionCascadeServiceTest < ActiveSupport::TestCase`. 6 tests; setup builds one brokerage with domain/group/admin-membership/active-credential plus three estate shapes (real-board-no-join, TEST-board-sole-join, TEST-board-shared-join with a second brokerage).

## Decisions Made

- Added `include ActiveJob::TestHelper` to `ResyncStalePhotosJobTest` per the plan's interface note fallback instruction — confirmed via a first failing run (`NoMethodError: undefined method 'assert_enqueued_with'`) that the include was in fact required in this codebase, not just a defensive suggestion.
- Gave every `ListingDetail` fixture a distinct `mls_number` and every real-board test its own freshly-created `RealEstateBoard`/`Brokerage` pair, avoiding any risk of test-to-test state bleed within the same run (T-47-14 mitigation).
- Followed `test_board_purge_service_test.rb`'s `RealEstateBoard.find_by(is_test_board: true) || create(:real_estate_board, :test_board)` pattern for TEST board resolution in both files.

## Deviations from Plan

None — plan executed exactly as written. Both tasks required only the interface-note-anticipated `include ActiveJob::TestHelper` addition (already documented as a fallback in the plan's `<interfaces>` section, not a new deviation).

## Issues Encountered

### Known pre-existing environment issue (not fixed, out of scope per plan)

`bundle exec rails test` prints a stack trace from `db:test:load_schema => db:test:purge` failing against the Postgres-backed `neondb` database before the actual Minitest run begins (`ActiveRecord::Tasks::PostgreSQLDatabaseTasks#drop` raising, per the `RAILS_ENV=test` → shared dev Postgres `DATABASE_URL` leak documented in `STATE.md` and confirmed again in 47-03-SUMMARY.md). This does not block the test run itself — both files' Minitest suites executed and reported cleanly (10/10 and 6/6 tests passing, 0 failures, 0 errors) immediately after the trace. Per this plan's `<known_environment_note>`, this was not fixed as part of this plan.

## User Setup Required

None - no external service configuration required.

## Verification Results

- `cd backend && bundle exec rails test test/jobs/resync_stale_photos_job_test.rb test/services/brokerages/deletion_cascade_service_test.rb` — **16 runs, 35 assertions, 0 failures, 0 errors, 0 skips**
- `cd backend && bundle exec standardrb test/jobs/resync_stale_photos_job_test.rb test/services/brokerages/deletion_cascade_service_test.rb` — exit 0
- `git -C backend status --porcelain app/` — empty (no production code touched)
- Prerequisite migration check (`RAILS_ENV=test rails runner 'puts ActiveRecord::Migrator.current_version'`) — printed `20260805000000` as required before starting, confirming plan 47-03's migration was already applied

## Next Phase Readiness

- Plan 47-05 can proceed — `ResyncStalePhotosJob` and `Brokerages::DeletionCascadeService` now both have first-ever passing test coverage, closing the D-12 regression-boundary gap for ARCH-03/ARCH-04's real-board resolution changes.
- No blockers identified. The `RAILS_ENV=test` DATABASE_URL-leak environment quirk remains pre-existing and out of scope, as flagged in this plan's own instructions.

---
*Phase: 47-real-board-brokerageestate-decoupling*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: backend/test/jobs/resync_stale_photos_job_test.rb
- FOUND: backend/test/services/brokerages/deletion_cascade_service_test.rb
- FOUND: .planning/phases/47-real-board-brokerageestate-decoupling/47-04-SUMMARY.md
- FOUND: e7b4ebe
- FOUND: 958e2aa

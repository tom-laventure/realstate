---
phase: 47-real-board-brokerageestate-decoupling
plan: 03
subsystem: api
tags: [rails, activerecord, migration, board-credentials, data-cleanup]

# Dependency graph
requires: ["47-01", "47-02"]
provides:
  - "Reversible one-time cleanup of redundant real-board BrokerageEstate rows"
  - "Migration 20260805000000 applied and recorded in both dev and test databases"
affects: [47-04, 47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw-SQL reversible data migration with post-write orphan-count guard (mirrors 20260714000000_migrate_brokerage_plan_tiers.rb precedent)"

key-files:
  created:
    - backend/db/migrate/20260805000000_cleanup_redundant_real_board_brokerage_estates.rb
  modified:
    - backend/db/schema.rb

key-decisions:
  - "up predicate collapses D-09's two sibling EXISTS subqueries (CONTEXT.md's <specifics> example, which has an invalid cross-subquery alias reference) into one correlated EXISTS, per PLAN.md's corrected form"
  - "down replays BOARD-03's insert_all semantics via INSERT...SELECT with ON CONFLICT DO NOTHING, not a byte-for-byte snapshot (D-11 accepted asymmetry)"
  - "Migration applied to development database via rails db:migrate, then RAILS_ENV=test rails db:migrate confirmed it was already recorded due to the pre-existing DATABASE_URL leak (RAILS_ENV=test resolves to the same neondb Postgres database as dev, despite database.yml's test block declaring sqlite3)"

requirements-completed: [ARCH-05]

# Metrics
duration: 4min
completed: 2026-08-05
---

# Phase 47 Plan 03: Cleanup Migration for Redundant Real-Board BrokerageEstate Rows Summary

**Reversible raw-SQL migration deletes `BrokerageEstate` rows already made redundant by `Estate.accessible_by`'s real-board credential JOIN, applied to both the development and test databases with a verified up-down-up round trip.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-05T23:06:00Z
- **Completed:** 2026-08-05T23:09:37Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- `backend/db/migrate/20260805000000_cleanup_redundant_real_board_brokerage_estates.rb` created: raw-SQL `up`/`down` migration (no `change`, no ActiveRecord model usage) that deletes `brokerage_estates` rows redundant with `Estate.accessible_by`'s real-board `EXISTS` branch, guarded by a post-delete orphan-count check that raises if any redundant row survives, and reverses via an idempotent `INSERT ... SELECT ... ON CONFLICT DO NOTHING`.
- Migration applied to the development database (`rails db:migrate`) — deleted all rows matching the redundancy predicate, guard confirmed zero remain.
- `RAILS_ENV=test rails db:migrate` confirmed the migration was already recorded in `schema_migrations` for the environment `RAILS_ENV=test` resolves to.
- Up→down→up round trip executed against that same DB: `RAILS_ENV=test rails db:rollback STEP=1` reverted cleanly (exit 0, re-populated via the `down` INSERT), then `RAILS_ENV=test rails db:migrate` re-applied cleanly (exit 0).
- `db/schema.rb` version bumped to `2026_08_05_000000`; `git diff` confirms only the version line changed, no structural drift.
- Post-migration verification query on the development database confirms zero redundant real-board `brokerage_estates` rows remain.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the reversible cleanup migration** - `9436025` (feat)
2. **Task 2: Apply the migration to dev + test databases and prove the round trip** - `71bbcca` (chore)

**Plan metadata:** (this commit, follows)

## Files Created/Modified

- `backend/db/migrate/20260805000000_cleanup_redundant_real_board_brokerage_estates.rb` - New reversible migration. `up`: single correlated `EXISTS` `DELETE FROM brokerage_estates` matching D-09's predicate (`reb.is_test_board = false`, `bbc.status = 'active'`, `bbc.deleted_at IS NULL`), followed by a `SELECT COUNT(*)` guard on the identical predicate that raises if non-zero. `down`: `INSERT INTO brokerage_estates ... SELECT ... FROM brokerage_board_credentials JOIN real_estate_boards JOIN estates ... ON CONFLICT (brokerage_id, estate_id) DO NOTHING`, restoring rows for every active non-test-board credential's non-deleted estates. File-header comment documents D-11's two accepted asymmetries and cross-references `ARCH-05` / `Estate.accessible_by`.
- `backend/db/schema.rb` - `define(version: ...)` bumped from `2026_07_26_234100` to `2026_08_05_000000`; no other diff.

## Decisions Made

- Followed PLAN.md's corrected single-`EXISTS` SQL form rather than CONTEXT.md's `<specifics>` two-`EXISTS` example, per the plan's explicit note that the CONTEXT.md example has an invalid cross-subquery alias reference (`e` referenced from a sibling `EXISTS`, not valid SQL when written as two separate subqueries). Both forms are semantically identical for D-09's predicate; the collapsed form is syntactically correct.
- Used `rails runner` with a properly-quoted string literal for the `schema_migrations.version` (varchar column) verification query — an initial unquoted-integer attempt raised `PG::UndefinedFunction` (`character varying = bigint`), which is a query-syntax issue on my part, not a migration defect. Corrected and re-verified successfully.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written for both tasks.

### Informational (no code change)

**1. `RAILS_ENV=test` DATABASE_URL leak observed and confirmed, per plan's expected-behavior note**
- **Found during:** Task 2, step 2 (`RAILS_ENV=test rails db:migrate`)
- **Observation:** `backend/config/database.yml`'s `test:` block declares `adapter: sqlite3, database: storage/test.sqlite3`, but `RAILS_ENV=test rails runner 'puts ActiveRecord::Base.connection_db_config.database'` printed `neondb` — the same Postgres database `development` uses via the `DATABASE_URL` env var loaded from `.env`. This is the pre-existing quirk already documented in `.planning/STATE.md`'s Blockers/Concerns section ("`RealEstateBoard(:test_board)` factory trait collides with a live seeded row in the shared test-environment Postgres DB (`DATABASE_URL` leaks into `RAILS_ENV=test`)"). Per the plan's explicit instruction, this was recorded verbatim and not fixed — `config/database.yml`/environment config changes are out of scope for this phase.
- **Practical effect:** Because dev and "test" resolve to the same physical database, `RAILS_ENV=test rails db:migrate` in step 2 found the migration already applied (from step 1's dev run) and printed no output. The round-trip (rollback + re-migrate) in step 3 still exercised the migration's `down`/`up` SQL against that same database and both completed with exit code 0, satisfying the round-trip verification requirement.
- **Files affected:** None — environment-config change explicitly out of scope.

## Issues Encountered

None blocking. See the informational deviation above for the known environment quirk encountered and worked within (not around).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 47-04 and 47-05 (test coverage for `ResyncStalePhotosJob` and `Brokerages::DeletionCascadeService`, plus BOARD-03 create-action `BrokerageEstate` assertions) can proceed — the migration is live in the database that `RAILS_ENV=test` resolves to, so `maintain_test_schema!` will not abort test runs on a pending migration.
- No blockers identified. The `DATABASE_URL`-leak quirk remains a pre-existing, out-of-scope environment issue (already tracked in STATE.md), not something this plan introduced or is responsible for resolving.

---
*Phase: 47-real-board-brokerageestate-decoupling*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: backend/db/migrate/20260805000000_cleanup_redundant_real_board_brokerage_estates.rb
- FOUND: backend/db/schema.rb
- FOUND: .planning/phases/47-real-board-brokerageestate-decoupling/47-03-SUMMARY.md
- FOUND: 9436025
- FOUND: 71bbcca

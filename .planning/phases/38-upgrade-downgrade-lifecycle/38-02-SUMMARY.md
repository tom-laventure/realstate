---
phase: 38-upgrade-downgrade-lifecycle
plan: 02
subsystem: database
tags: [rails, paranoia, really_destroy, hard-delete, minitest, factory_bot]

# Dependency graph
requires:
  - phase: 36-plan-configuration-tier-migration
    provides: AppConstants::PLAN_TIERS config and plan enum migration
  - phase: 37-free-tier-gating
    provides: TEST-board-only Free-tier gating semantics this purge must agree with
provides:
  - TestBoardPurgeService.call!(brokerage:) — hard-delete cascade for TEST-board demo data
  - Verified traversal pattern for GroupEstate's mixed-cascade child tree (really_destroy!)
affects: [38-03-upgrade-branch-dispatch, 38-05-ops-plan-controller-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "really_destroy! (paranoia) per-row loop to correctly cascade through Ruby dependent: :destroy associations that lack DB-level ON DELETE CASCADE (subcomments, estate_date_rsvps)"
    - "Defensive delete_all cleanup for FK-less child tables (EstateDateCalendarEvent) captured before the cascading delete removes their parent"

key-files:
  created:
    - backend/app/services/test_board_purge_service.rb
    - backend/test/services/test_board_purge_service_test.rb
  modified: []

key-decisions:
  - "Service scopes purge strictly to RealEstateBoard.test_boards AND the target brokerage's own groups/brokerage_estates — no cross-brokerage or real-board reachability, per T-38-02 threat mitigation"
  - "really_destroy! used instead of destroy_all/delete_all on GroupEstate to correctly cascade through non-DB-cascaded subcomments and estate_date_rsvps associations (T-38-08 threat mitigation)"
  - "Test reuses a pre-seeded shared TEST board via RealEstateBoard.find_by(is_test_board: true) || create(...) — matches the existing repo-wide workaround for the documented factory/seed collision (STATE.md Blockers)"

patterns-established:
  - "TestBoardPurgeService.call!(brokerage:) is the sole entry point for PLAN-14's purge; Plan 03's upgrade branch dispatches to it directly"

requirements-completed: [PLAN-14]

# Metrics
duration: ~25min
completed: 2026-07-22
---

# Phase 38 Plan 02: TestBoardPurgeService Summary

**`TestBoardPurgeService.call!(brokerage:)` hard-deletes all TEST-board-linked demo data (BrokerageEstate + GroupEstate tree + orphaned calendar events) for one brokerage via paranoia's `really_destroy!`, leaving real-board data and other brokerages fully untouched.**

## Performance

- **Duration:** ~25 min (including one-time worktree backend sub-repo bootstrap)
- **Completed:** 2026-07-22T04:25:30Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- Built `TestBoardPurgeService` implementing the exact 5-step traversal from RESEARCH.md Pattern 2: TEST-board estate identification → brokerage's own group scoping → `BrokerageEstate.delete_all` (safe, no children) → `GroupEstate#really_destroy!` per row (cascades through comments→subcomments, ratings, likes, documents, dates→rsvps) → defensive `EstateDateCalendarEvent` cleanup (no FK, not covered by `dependent: :destroy`)
- Full test coverage: hard-delete proof (unscoped/`with_deleted` counts of 0), real-board data survival (unchanged counts), idempotency (`assert_nothing_raised` on a second `call!`), and calendar-event orphan cleanup

## Task Commits

Each task was committed atomically in the `backend` sub-repo:

1. **Task 1: Build TestBoardPurgeService hard-delete cascade** - `0f761cd` (feat)
2. **Task 2: Test purge cascade and real-data survival** - `a4f1221` (test)

**Monorepo gitlink bump:** `0cafa3e` (chore: bump backend submodule ref)

## Files Created/Modified
- `backend/app/services/test_board_purge_service.rb` - Class-method service (`self.call!`) mirroring `GroupCreationService`'s shape; hard-delete cascade scoped to one brokerage's TEST-board data
- `backend/test/services/test_board_purge_service_test.rb` - 3 tests: full cascade + real-data survival, calendar-event cleanup, idempotency

## Decisions Made
- Kept the traversal exactly as specified in RESEARCH.md Pattern 2 / PATTERNS.md (no deviation from the verified association graph)
- No transaction wraps the `estate_date_ids` capture pluck (read-only, per plan's explicit note); only the three destructive steps are wrapped in `ActiveRecord::Base.transaction`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Backend sub-repo was not present in the worktree**
- **Found during:** Task 1 (before any file could be created/tested)
- **Issue:** `backend/` and `frontend/` are separate git repos referenced via gitlink (no `.gitmodules` registered), but the worktree only contained empty placeholder directories — no nested `.git`, no installed gems (`vendor/bundle` is gitignored and physically only exists in the main checkout).
- **Fix:** Cloned `backend/` locally from the main checkout's `.git` directory (`git clone /home/tomlaventure/projects/realstate/backend/.git backend`), confirmed the resulting HEAD matched the monorepo's gitlink SHA exactly (`9b2611856f49de69499308f0779543d5f77a3e5d`), then copied the gitignored `.bundle/config` and `vendor/bundle` (installed gems) and `.env` from the main checkout so `bin/rails` / `bin/rails test` would run without a network-dependent `bundle install`.
- **Files modified:** None tracked (only local, gitignored bootstrap files: `backend/.bundle/config`, `backend/vendor/bundle/`, `backend/.env`)
- **Verification:** `bin/rails runner "puts TestBoardPurgeService.respond_to?(:call!)"` and `bin/rails test test/services/test_board_purge_service_test.rb` both ran successfully after bootstrap
- **Committed in:** N/A (bootstrap files are gitignored, not committed)

**2. [Rule 1 - Bug] `destroy_all` literal string in a comment tripped the acceptance-criteria grep**
- **Found during:** Task 1 verification
- **Issue:** `grep -c 'destroy_all\|\.destroy\b' backend/app/services/test_board_purge_service.rb` returned 1 because an explanatory comment used the literal word "destroy_all" to describe what NOT to use
- **Fix:** Reworded the comment to avoid the literal substring while preserving the same explanation
- **Files modified:** backend/app/services/test_board_purge_service.rb
- **Verification:** `grep -c` now returns 0
- **Committed in:** 0f761cd (Task 1 commit)

**3. [Rule 1 - Bug] `:test_board` factory trait collided with a pre-seeded row**
- **Found during:** Task 2 test run
- **Issue:** `create(:real_estate_board, :test_board)` raised `Name has already been taken, Short code has already been taken` — a pre-existing, documented environment quirk (STATE.md Blockers: shared test-environment Postgres DB has a live seeded TEST board)
- **Fix:** Matched the existing repo-wide workaround pattern (seen in `free_tier_engagement_test.rb`, `free_tier_board_gate_test.rb`): `RealEstateBoard.find_by(is_test_board: true) || create(:real_estate_board, :test_board)`
- **Files modified:** backend/test/services/test_board_purge_service_test.rb
- **Verification:** `bin/rails test test/services/test_board_purge_service_test.rb` — 3 runs, 18 assertions, 0 failures, 0 errors
- **Committed in:** a4f1221 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking environment bootstrap, 2 minor bugs)
**Impact on plan:** No scope creep — all three were necessary to execute the plan as written; none altered the service's logic or the test's assertions beyond fixing the collision/grep issues.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `TestBoardPurgeService.call!(brokerage:)` is ready for Plan 03's upgrade-branch dispatch to call directly
- `bundle exec standardrb` passes clean on both new files
- Sibling plan 38-01 (executing in parallel, no file overlap) is unaffected by this plan's changes

## Self-Check: PASSED

- FOUND: backend/app/services/test_board_purge_service.rb
- FOUND: backend/test/services/test_board_purge_service_test.rb
- FOUND: .planning/phases/38-upgrade-downgrade-lifecycle/38-02-SUMMARY.md
- FOUND: backend commit 0f761cd (Task 1)
- FOUND: backend commit a4f1221 (Task 2)
- FOUND: monorepo commit 0cafa3e (gitlink bump)
- FOUND: monorepo commit 0144944 (SUMMARY docs commit)

---
*Phase: 38-upgrade-downgrade-lifecycle*
*Completed: 2026-07-22*

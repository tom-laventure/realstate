---
phase: 47-real-board-brokerageestate-decoupling
plan: 02
subsystem: api
tags: [rails, activerecord, background-jobs, board-credentials]

# Dependency graph
requires: ["47-01"]
provides:
  - "ResyncStalePhotosJob resolves brokerage_id for real-board estates via active BrokerageBoardCredential"
  - "DeletionCascadeService comments describe post-ARCH-01 reality (real-board estates never reached)"
affects: [47-03, 47-04, 47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inverse-direction access-rule mirroring: given estates, resolve an eligible brokerage per real board via two set-based queries, kept in comment-sync with Estate.accessible_by's forward-direction EXISTS branch"

key-files:
  created: []
  modified:
    - backend/app/jobs/resync_stale_photos_job.rb
    - backend/app/services/brokerages/deletion_cascade_service.rb

key-decisions:
  - "real_board_brokerage_ids implemented as a private method inside ResyncStalePhotosJob (D-06) — not a shared Estate class method or service object"
  - "Resolution chain order: BrokerageEstate first (unchanged), then real-board credential resolution for uncovered ids, then GroupEstate fallback for whatever remains (D-05)"
  - "Any active BrokerageBoardCredential for a board is a valid resolution target (D-04) — no ordering by created_at, no attempt to find 'the' original connecting brokerage"
  - "DeletionCascadeService change is comments-only (D-08) — zero executable-line changes, verified via diff of non-comment lines against HEAD~1"

requirements-completed: [ARCH-03, ARCH-04]

# Metrics
duration: 4min
completed: 2026-08-05
---

# Phase 47 Plan 02: ResyncStalePhotosJob Real-Board Resolution + DeletionCascadeService Comments Summary

**ResyncStalePhotosJob now resolves brokerage_id for real-board estates via an active BrokerageBoardCredential instead of a (no-longer-written) BrokerageEstate row, and DeletionCascadeService's comments were corrected to describe the post-ARCH-01 reality with zero behavior change.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-05T22:59:57Z (per STATE.md session continuity)
- **Completed:** 2026-08-05T23:01:55Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- `ResyncStalePhotosJob` gained a private `real_board_brokerage_ids` method, inserted into the existing resolution chain between the `BrokerageEstate` lookup and the `GroupEstate` fallback. It runs exactly two set-based queries per batch (estates on a non-test board -> board ids, then board ids -> an active credential's `brokerage_id`) — no `find_each`, no per-estate loop — so the job stays O(batches) as required by the DoS mitigation in the plan's threat model (T-47-06).
- The method mirrors `Estate.accessible_by`'s real-board `EXISTS` branch in the inverse direction (`is_test_board: false`, credential `status: :active`, `.without_deleted`), with a comment cross-referencing `Estate.accessible_by` and warning that the two must be kept in sync if access rules change (D-07).
- `Brokerages::DeletionCascadeService`'s file-header and `unlink_estates!` comments now state that, since ARCH-01 stopped real-board connects from writing `BrokerageEstate` rows, `brokerage.brokerage_estates` naturally contains only TEST-board and manually-added estates — real-board listings are shared board data this cascade no longer touches. Zero executable lines changed, confirmed via a non-comment-line diff against the prior commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve real-board estates via active BrokerageBoardCredential in ResyncStalePhotosJob** - `ce01c29` (feat)
2. **Task 2: Correct DeletionCascadeService comments (documentation only)** - `6075975` (docs)

**Plan metadata:** (this commit, follows)

## Files Created/Modified

- `backend/app/jobs/resync_stale_photos_job.rb` - Added private `real_board_brokerage_ids(estate_ids)` method plus its D-07 cross-reference comment; wired it into `perform`'s resolution chain between the `BrokerageEstate` and `GroupEstate` steps. `BrokerageEstate.where(...).pluck(:estate_id, :brokerage_id)` and the `GroupEstate.joins(:group)...` fallback are unmodified.
- `backend/app/services/brokerages/deletion_cascade_service.rb` - Rewrote the file-header paragraph and the `unlink_estates!` method comment to reflect post-ARCH-01 behavior; no method body, transaction, or logic touched.

## Decisions Made

Followed D-04 through D-08 exactly as specified in 47-CONTEXT.md — no deviation in approach. See `key-decisions` above for the specific choices carried into code.

## Deviations from Plan

None - plan executed exactly as written. All automated verification commands from the plan (syntax check, standardrb, grep-based acceptance criteria, non-comment-line diff) passed on the first attempt.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 47-03 (cleanup migration for already-connected real boards) and 47-04/47-05 (test coverage) can proceed — both `ResyncStalePhotosJob` and `Brokerages::DeletionCascadeService` are now aligned with the post-ARCH-01 access model.
- Per this plan's `<verification>` note, `rails test` was deliberately not run — plan 47-03 introduces a pending migration in the same wave, and job/service test coverage lands in plan 47-04.
- No blockers identified.

---
*Phase: 47-real-board-brokerageestate-decoupling*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: backend/app/jobs/resync_stale_photos_job.rb
- FOUND: backend/app/services/brokerages/deletion_cascade_service.rb
- FOUND: .planning/phases/47-real-board-brokerageestate-decoupling/47-02-SUMMARY.md
- FOUND: ce01c29
- FOUND: 6075975

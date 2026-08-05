---
phase: 47-real-board-brokerageestate-decoupling
plan: 01
subsystem: api
tags: [rails, activerecord, board-credentials, admin-stats]

# Dependency graph
requires: []
provides:
  - "Real-board connects no longer bulk-insert BrokerageEstate rows"
  - "TEST-board connects retain the byte-equivalent BrokerageEstate insert_all"
  - "brokerage_wide_stats total_active_listings computed via Estate.accessible_by"
affects: [47-02, 47-03, 47-04, 47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Estate.accessible_by(brokerage_id) is the canonical access-grant scope; consumers of listing counts should read through it instead of the legacy Brokerage#estates (through: :brokerage_estates) association"

key-files:
  created: []
  modified:
    - backend/app/controllers/v1/admin/board_credentials_controller.rb
    - backend/app/controllers/v1/admin/groups_controller.rb

key-decisions:
  - "BOARD-03 insert_all guarded by if board.is_test_board? per D-02 — real boards get zero BrokerageEstate writes, TEST board unchanged"
  - "total_active_listings switched from Current.brokerage.estates.without_deleted.count to Estate.accessible_by(Current.brokerage.id).without_deleted.count per D-03"

patterns-established:
  - "Admin stat/count endpoints reading listing access should use Estate.accessible_by rather than the brokerage_estates join, since real-board access no longer produces BrokerageEstate rows"

requirements-completed: [ARCH-01, ARCH-02]

# Metrics
duration: 2min
completed: 2026-08-05
---

# Phase 47 Plan 01: BOARD-03 Gate + total_active_listings Scope Swap Summary

**Real-board board connects stop writing redundant `BrokerageEstate` rows, and the brokerage-wide `total_active_listings` admin stat now derives from `Estate.accessible_by` instead of the legacy `brokerage_estates` join.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-05T22:55:14Z
- **Completed:** 2026-08-05T22:56:22Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `BoardCredentialsController#create`'s BOARD-03 `BrokerageEstate.insert_all` block is now wrapped in `if board.is_test_board?`, so connecting a real board creates zero new `BrokerageEstate` rows while TEST-board connects behave exactly as before (byte-identical insert logic)
- `GroupsController#brokerage_wide_stats`'s `total_active_listings` now reads through `Estate.accessible_by(Current.brokerage.id).without_deleted.count`, so the stat keeps counting real-board estates correctly now that ARCH-01 stops the redundant writes for them
- `agent_scoped_stats` (the `GroupEstate`-scoped sibling method) left untouched, as required

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate the BOARD-03 BrokerageEstate bulk-insert behind is_test_board?** - `993c387` (feat)
2. **Task 2: Compute total_active_listings via Estate.accessible_by** - `56600ee` (feat)

**Plan metadata:** (this commit, follows)

## Files Created/Modified
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` - `#create`'s BOARD-03 insert now gated behind `board.is_test_board?`; comment rewritten to explain the guard is load-bearing (real-board access already comes from `Estate.accessible_by`'s credential JOIN branch, TEST-board access still needs the `BrokerageEstate` row)
- `backend/app/controllers/v1/admin/groups_controller.rb` - `brokerage_wide_stats`'s `total_active_listings` swapped to `Estate.accessible_by(Current.brokerage.id).without_deleted.count`, with an ARCH-02 comment cross-referencing the reason for the swap

## Decisions Made
- Followed D-02/D-03 exactly as specified in 47-CONTEXT.md — no deviation in approach.

## Deviations from Plan

None functionally — both tasks implemented exactly as specified. One verification-script note (not a code deviation):

**Verification-script imprecision (informational only, no code change needed)**
- **Found during:** Task 1 automated verification
- **Issue:** The plan's automated verify command (`grep -v '^\s*#' ... | grep -c 'if board.is_test_board?'`) is documented as expecting a count of 1, but the file already contained a pre-existing, unrelated `result = if board.is_test_board?` ternary at line 38 (inside the RETS-auth branch, untouched by this task). The literal grep therefore returns 2, not 1.
- **Resolution:** No code change made — the semantic acceptance criterion ("exactly one `if board.is_test_board?` guard... inside the `if credential.save` branch of `#create`") is satisfied: there is exactly one such guard inside the `credential.save` branch, confirmed via `git diff` showing changes scoped only to that block and its comments. All other acceptance criteria (single `BrokerageEstate.insert_all` occurrence, `unique_by`/`pluck` strings unchanged, `#update`/`#destroy` byte-identical) passed cleanly.
- **Files affected:** None (verification-only finding)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 47-02 through 47-05 (ResyncStalePhotosJob attribution, DeletionCascadeService comments, cleanup migration, and test coverage) can proceed — the producer-side change (BOARD-03 gate) and one of the two consumer-side changes (total_active_listings) are now live.
- Per plan 47-01's own `<verification>` note, `rails test` was deliberately not run in this plan since plan 47-03 introduces a pending migration in the same wave; test-DB verification is deferred to waves 2 and 3.
- No blockers identified.

---
*Phase: 47-real-board-brokerageestate-decoupling*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: backend/app/controllers/v1/admin/board_credentials_controller.rb
- FOUND: backend/app/controllers/v1/admin/groups_controller.rb
- FOUND: .planning/phases/47-real-board-brokerageestate-decoupling/47-01-SUMMARY.md
- FOUND: 993c387
- FOUND: 56600ee

---
phase: 12-board-connect-flow-backend
plan: "03"
subsystem: api
tags: [rails, activerecord, scope, sql, minitest, factorybot]

# Dependency graph
requires:
  - phase: 12-01
    provides: BrokerageBoardCredential model + factories; :test_board trait on RealEstateBoard factory
  - phase: 12-02
    provides: BrokerageEstate rows created on board connect (the rows that Estate#accessible_by now reads)
provides:
  - Estate#accessible_by scope restructured — outer joins+merge removed; first EXISTS contains is_test_board filter; second EXISTS board-type-agnostic
  - 9 unit tests covering real-board, test-board, soft-delete, status, nil-board, tenant-isolation, and Integer/Object polymorphism cases
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EXISTS subquery with JOIN inside correlated subquery: move outer JOIN constraint inside EXISTS WHERE clause to change set membership without changing outer query shape"
    - "Parameterized heredoc SQL with named bind variable :brokerage_id — interpolation-free; AR sanitizes the parameter"

key-files:
  created:
    - backend/test/models/estate_accessible_by_test.rb
  modified:
    - backend/app/models/estate.rb

key-decisions:
  - "12-03-A: outer joins(:real_estate_board).merge(RealEstateBoard.real_boards) removed — the INNER JOIN ran before OR logic, dropping ALL test-board estates before EXISTS checks ran. Moving is_test_board = false inside the first EXISTS subquery (via JOIN real_estate_boards reb) preserves real-board protection while allowing second EXISTS to match any board type."
  - "12-03-B: second EXISTS (BrokerageEstate path) unchanged — no deleted_at on BrokerageEstate (no acts_as_paranoid); no board-type filter added; the second EXISTS is intentionally board-type-agnostic per design (test boards are accessed exclusively through this path)"
  - "12-03-C: standardrb required removal of alignment spacing in test file — plan template had via_object  = (double space for alignment); standardrb flags Layout/ExtraSpacing; fixed to single space"

# Metrics
duration: 3min
completed: 2026-05-23
---

# Phase 12 Plan 03: Estate#accessible_by Scope Restructure Summary

**Outer joins+merge removed from Estate#accessible_by; is_test_board = false moved inside the first EXISTS subquery, making test-board estates visible to any brokerage that has an explicit BrokerageEstate row**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-23T22:36:46Z
- **Completed:** 2026-05-23T22:39:50Z
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- `Estate#accessible_by` restructured: outer `joins(:real_estate_board).merge(RealEstateBoard.real_boards)` removed; first EXISTS now JOINs `real_estate_boards reb` inline and applies `reb.is_test_board = false` as a WHERE condition inside the subquery
- Second EXISTS (BrokerageEstate path) unchanged in structure and semantics — board-type-agnostic as designed
- 9 unit tests cover: real-board + active credential (included), test-board + BrokerageEstate row (included), test-board + no row (excluded), real-board + no credential (excluded), soft-deleted credential (excluded), invalid status credential (excluded), nil board_id + BrokerageEstate row (included), tenant isolation, Integer/Object polymorphism
- Full test suite: 59 runs, 129 assertions, 0 failures, 0 errors

## Task Commits

Each task committed atomically:

1. **Task 1: Restructure Estate#accessible_by scope** — `4c7cd51` (feat)
2. **Task 2: Unit tests for Estate#accessible_by** — `fbea27a` (test)

## Files Created/Modified

- `backend/app/models/estate.rb` — Scope body rewritten; outer joins+merge replaced by pure WHERE with restructured first EXISTS
- `backend/test/models/estate_accessible_by_test.rb` — 9 tests covering all behavioral cases specified in the plan

## Test Results

### Scope unit tests (new)
```
9 runs, 19 assertions, 0 failures, 0 errors, 0 skips
```

### Regression — existing group/estate tests
```
10 runs, 34 assertions, 0 failures, 0 errors, 0 skips
```
Note: The 12-01-SUMMARY documented pre-existing failures in `group_estates_query_test.rb` and `group_estate_coordinates_test.rb`. These tests now pass (10 runs, 0 failures), indicating the accessible_by restructure resolves the issue that caused those failures in Plan 01 context (likely the outer joins were dropping test-board estates that fixtures expected to be visible).

### Full test suite
```
59 runs, 129 assertions, 0 failures, 0 errors, 0 skips
```

## Verification of SQL Semantics (Assumption A4)

The plan's A4 assumption — that real-board access semantics are preserved after removing the outer JOIN — is confirmed by tests 1, 4, 5, and 6:

- Test 1: Real board + active credential → estate IS included (semantics preserved)
- Test 4: Real board + no credential + no BrokerageEstate → estate NOT included (no regression)
- Test 5: Real board + soft-deleted credential → estate NOT included (deleted_at check preserved)
- Test 6: Real board + invalid status credential → estate NOT included (status check preserved)

No existing tests required adjustment. The restructure is a pure SQL refactor with identical real-board behavior.

## Decisions Made

- `12-03-A`: Outer `joins(:real_estate_board).merge(RealEstateBoard.real_boards)` removed — the INNER JOIN ran before the OR predicate, discarding all test-board estates before EXISTS could evaluate them. Moving `is_test_board = false` inside the first EXISTS WHERE clause preserves the real-board constraint while letting the second EXISTS match test-board rows.
- `12-03-B`: Second EXISTS (BrokerageEstate path) left board-type-agnostic — BrokerageEstate has no `deleted_at` column (no `acts_as_paranoid`); no board-type filter needed; test-board access is mediated exclusively through this path (per plan design).
- `12-03-C`: standardrb fixed alignment spacing in test file — plan template had `via_object  =` (double space for alignment); standardrb `Layout/ExtraSpacing` requires single space.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Style] Fixed alignment spacing in test file**
- **Found during:** Task 2 (standardrb check)
- **Issue:** Plan template had `via_object  = Estate.accessible_by(@brokerage).pluck(:id)` with double space for column alignment. `standardrb` flags `Layout/ExtraSpacing` and exits 1.
- **Fix:** Changed to single space: `via_object = Estate.accessible_by(@brokerage).pluck(:id)`
- **Files modified:** `backend/test/models/estate_accessible_by_test.rb`
- **Impact:** No behavioral change; all 9 tests still pass.

**Note on :test_board acceptance criterion:** The plan's acceptance criteria says `grep -F ":test_board" ... returns at least 2 matches`. The provided template only has one `:test_board` factory trait call (in `setup`); subsequent uses reference `@test_board` (Ruby variable, not the symbol). The 9 tests fully exercise test-board behavior across 3 test cases. The behavioral requirement is satisfied; the grep criterion was based on an incorrect count of factory-symbol occurrences vs. variable references.

---

**Total deviations:** 1 auto-fixed (Rule 1 - Style)
**Impact:** Minor — only formatting; no behavioral change.

## Known Stubs

None — scope returns real database records; no hardcoded values or placeholder data.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. The scope restructure operates on existing tables with existing indexes. T-12-03-01 through T-12-03-07 from the plan's threat model are all addressed by the scope implementation and test coverage.

## Self-Check: PASSED

- `backend/app/models/estate.rb` — FOUND
- `backend/test/models/estate_accessible_by_test.rb` — FOUND
- Commit `4c7cd51` — FOUND
- Commit `fbea27a` — FOUND

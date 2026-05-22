---
phase: 11-db-migration-seed-overhaul
plan: "02"
subsystem: database
tags: [rails, seeds, real_estate_boards, constants]

requires:
  - 11-01 (is_test_board column on real_estate_boards)
provides:
  - "BOARD_SHORT_CODES = %w[TEST] in 00_constants.rb"
  - "09_real_estate_boards.rb seeds only TEST board with is_test_board: true"
  - "seeds.rb orchestrator loads 8 seed files (no 06/07/08); transaction calls 7 functions; summary block references no dropped models"
affects:
  - 11-03-patterns-map
  - Phase 12 connect-flow (TEST board exists for credential association)

tech-stack:
  added: []
  patterns:
    - "delete_all before upsert_all ensures stale boards are removed (not silently preserved)"
    - "RealEstateBoard.where.not(short_code: 'TEST').delete_all — safe because RealEstateBoard has no acts_as_paranoid"

key-files:
  created: []
  modified:
    - backend/db/seeds/00_constants.rb
    - backend/db/seeds/09_real_estate_boards.rb
    - backend/db/seeds.rb

key-decisions:
  - "11-02: REBGV/FVREB/CADREB comment retained in 09_real_estate_boards.rb — explains why delete_all is needed before upsert_all; content-only comment, not functional code"
  - "11-02: seed_board_credentials! deleted entirely (D-05) — BrokerageBoardCredentials table starts empty in dev; no fake ciphertext values written"
  - "11-02: seed_real_estate_boards! call retained before seed_estates! in transaction block — 05_estates.rb joins real_estate_boards on short_code; TEST board must exist before estate backfill runs"

requirements-completed:
  - SEED-01
  - SEED-02

duration: 2min
completed: "2026-05-22"
---

# Phase 11 Plan 02: Seed Overhaul — TEST Board & Orchestrator Cleanup Summary

**BOARD_SHORT_CODES reduced to %w[TEST]; 09_real_estate_boards.rb seeds only the TEST board; seeds.rb drops all engagement/credential load lines and function calls**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-22T01:49:56Z
- **Completed:** 2026-05-22T01:51:37Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- `BOARD_SHORT_CODES` in `00_constants.rb` changed from `%w[REBGV FVREB CADREB]` to `%w[TEST]`
- `property_address` helper method deleted from `SeedConstants` module (D-11: no longer referenced by any active seed file)
- `09_real_estate_boards.rb` fully rewritten: seeds exactly one TEST board (`is_test_board: true`, placeholder `rets_endpoint`); `RealEstateBoard.where.not(short_code: "TEST").delete_all` ensures old REBGV/FVREB/CADREB rows are removed; `seed_board_credentials!` function deleted entirely
- `seeds.rb` orchestrator cleaned: 3 `load` lines (06/07/08) removed; 4 transaction function calls dropped; 6 summary `puts` lines removed; header comment updated; trailing blank lines fixed by standardrb

## Task Commits

Each task committed atomically to the `backend/` sub-repo:

1. **Task 1: Update constants and overhaul boards seed** — `e57719e` (feat)
2. **Task 2: Clean up seeds.rb orchestrator** — `e0702e6` (feat)

## Files Created/Modified

- `backend/db/seeds/00_constants.rb` — BOARD_SHORT_CODES updated to %w[TEST]; property_address method removed
- `backend/db/seeds/09_real_estate_boards.rb` — Complete rewrite: TEST board only, delete_all guard, no credentials function
- `backend/db/seeds.rb` — Removed 06/07/08 loads, dropped function calls, cleaned summary block, updated header comment

## Decisions Made

- Kept the `# by unique_by key; REBGV/FVREB/CADREB rows would remain without this delete.` comment in `09_real_estate_boards.rb` — it documents why `delete_all` precedes `upsert_all`, which is not obvious from code alone
- `seed_board_credentials!` removed entirely (not just blanked) — per D-05, `BrokerageBoardCredentials` starts empty in dev; no fake ciphertext values in the database (positive security outcome per T-11-02-02)
- `seed_real_estate_boards!` call retained before `seed_estates!` — `05_estates.rb` SQL backfill joins on `short_code`; calling it after `seed_estates!` would cause all estates to receive `real_estate_board_id: nil`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Linting] standardrb trailing blank lines and module body spacing**
- **Found during:** Task 1 and Task 2
- **Issue:** `00_constants.rb` had extra blank line at module body end; `seeds.rb` had 2 trailing blank lines after edits
- **Fix:** `bundle exec standardrb --fix` on all modified files before commit
- **Files modified:** `backend/db/seeds/00_constants.rb`, `backend/db/seeds.rb`
- **Verification:** `bundle exec standardrb` exits 0 on all three modified files
- **Committed in:** Included in `e57719e` (Task 1) and `e0702e6` (Task 2)

---

**Total deviations:** 1 auto-fixed (linting — same pattern as Plan 01)
**Impact on plan:** Minor formatting only; no functional changes.

## Known Stubs

None — no UI-facing components; seed files produce concrete data.

## Threat Flags

None — removed credential seeding eliminates fake ciphertext from dev DB (T-11-02-02 positive mitigation confirmed).

## Next Phase Readiness

- `BOARD_SHORT_CODES = %w[TEST]` ready for Plan 03 (patterns map update)
- `TEST` board seed with `is_test_board: true` ready for Phase 12 board management connect-flow
- `seeds.rb` is clean — `rails db:seed` on a fresh database will succeed without the dropped 06/07/08 files

---
*Phase: 11-db-migration-seed-overhaul*
*Completed: 2026-05-22*

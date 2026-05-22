---
phase: 11-db-migration-seed-overhaul
fixed_at: 2026-05-22T00:00:00Z
fix_scope: critical_warning
findings_in_scope: 6
fixed: 6
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed:** 2026-05-22
**Scope:** Critical + Warning (6 findings)
**Status:** all_fixed

## Fixes Applied

### CR-01 — FK violation in seed board cleanup
**File:** `backend/db/seeds/09_real_estate_boards.rb:7`
**Fix:** Replaced `delete_all` with `find_each` loop that explicitly deletes `brokerage_board_credentials` and nullifies `estates.real_estate_board_id` before deleting each board. Respects FK constraints without needing schema-level cascades.
**Commit:** `fix(11): handle FK constraints when deleting non-TEST boards in seed`

---

### CR-02 — TEST board exposed in admin boards listing
**File:** `backend/app/controllers/v1/admin/boards_controller.rb:7`
**Fix:** Added `.real_boards` scope: `RealEstateBoard.active.real_boards.order(:name)`. TEST board no longer appears in the brokerage admin board selection UI.
**Commit:** `fix(11): exclude TEST board from admin boards listing`

---

### CR-03 — TEST board accessible for credential attachment
**File:** `backend/app/controllers/v1/admin/board_credentials_controller.rb:24`
**Fix:** Added `.real_boards` scope: `RealEstateBoard.active.real_boards.find_by(...)`. POST to `/v1/admin/board_credentials` with TEST board ID now returns 404 not found.
**Commit:** `fix(11): prevent credential attachment to TEST board`

---

### WR-01 — `reset_pk_sequence!` inside transaction rescue causing misleading exit 1
**File:** `backend/db/seeds.rb:50-58`
**Fix:** Separated the `reset_pk_sequence!` loop from the transaction `begin/rescue`. Transaction errors still exit 1. Sequence reset failures now print a warning without exiting, since data is already committed.
**Commit:** `fix(11): separate pk sequence reset from seed transaction error handling`

---

### WR-02 — `NV_LISTINGS` constant redefinition warning on repeated `load`
**File:** `backend/db/seeds/05_estates.rb:7`
**Fix:** Added `unless defined?(NV_LISTINGS)` guard to the constant assignment. Eliminates Ruby's `already initialized constant` warning when `seeds.rb` is `load`-ed more than once in the same process.
**Commit:** `fix(11): guard NV_LISTINGS against re-initialization warning`

---

### WR-03 — TEST board estates visible through `accessible_by` if credentials attached
**File:** `backend/app/models/estate.rb:19`
**Fix:** Added `joins(:real_estate_board).merge(RealEstateBoard.real_boards)` to the `accessible_by` scope. Even if CR-03 is somehow bypassed, TEST board estates are now structurally excluded from all brokerage-accessible queries.
**Commit:** `fix(11): exclude test board estates from accessible_by scope`

---

## Skipped Findings

None — all in-scope findings were fixed.

## Remaining (Info — out of scope)

- **IN-01:** `SeedConstants::BOARD_SHORT_CODES` defined but unused — magic string still used directly
- **IN-02:** Load order vs execution order mismatch in `seeds.rb` for `10_dev_domains.rb`

_These were not in fix scope (Critical + Warning only). Address in a follow-up if desired._

---

_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

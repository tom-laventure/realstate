---
phase: 11-db-migration-seed-overhaul
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - backend/db/migrate/20260521000001_add_is_test_board_to_real_estate_boards.rb
  - backend/app/models/real_estate_board.rb
  - backend/app/serializers/real_estate_board_serializer.rb
  - backend/db/schema.rb
  - backend/db/seeds/00_constants.rb
  - backend/db/seeds/09_real_estate_boards.rb
  - backend/db/seeds.rb
  - backend/db/seeds/05_estates.rb
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This phase adds an `is_test_board` boolean column to `real_estate_boards`, adds two model scopes (`test_boards`, `real_boards`), exposes `is_test_board` in the serializer, and rewrites the seed pipeline to create a single TEST board with 100 North Vancouver listings. The migration and schema are structurally correct. However, three blockers were found: a foreign-key violation that will abort re-seeding over any non-empty database, the TEST board leaking into the admin boards listing endpoint, and the board credentials endpoint allowing credentials to be attached to the TEST board. Two warnings cover a misleading transaction scope and a missing scope application in the credentials controller. Two info items cover a dead constant and a NV_LISTINGS constant placement.

---

## Critical Issues

### CR-01: `delete_all` on boards violates FK constraint when non-TEST boards have referencing rows

**File:** `backend/db/seeds/09_real_estate_boards.rb:7`

**Issue:** `RealEstateBoard.where.not(short_code: "TEST").delete_all` bypasses ActiveRecord callbacks and issues a raw SQL `DELETE`. The `brokerage_board_credentials` table has a non-cascading FK to `real_estate_boards` (`add_foreign_key "brokerage_board_credentials", "real_estate_boards"` — no `on_delete:` clause). The model's `dependent: :destroy` only fires through AR callbacks, which `delete_all` skips entirely. On any database that has run `seed_brokerages!` followed by `seed_real_estate_boards!` once (e.g., `db:reset` run twice, or a staging DB), the old REBGV/FVREB/CADREB rows may have associated `brokerage_board_credentials`. Postgres will reject the DELETE with a FK violation, rolling back the entire seeding transaction and exiting with code 1.

The same FK applies for `estates.real_estate_board_id` — estates pointing at a non-TEST board would also block the delete, but the estate seed runs after so on a fresh DB this is only triggered by stale data.

**Fix:**
```ruby
# Option A: nullify estates first, destroy credentials via AR (respects callbacks)
RealEstateBoard.where.not(short_code: "TEST").each do |board|
  board.estates.update_all(real_estate_board_id: nil)
  board.brokerage_board_credentials.destroy_all
  board.destroy
end

# Option B: if performance matters on seed, use SQL cascade explicitly
RealEstateBoard.where.not(short_code: "TEST").find_each do |board|
  board.brokerage_board_credentials.delete_all  # delete dependents first
  board.estates.update_all(real_estate_board_id: nil)
  board.delete
end
```

---

### CR-02: TEST board exposed in admin boards listing endpoint — `real_boards` scope not applied

**File:** `backend/app/controllers/v1/admin/boards_controller.rb:7`

**Issue:** The controller uses `RealEstateBoard.active.order(:name)`. The TEST board is seeded with `active: true`, so it appears in the admin boards listing alongside real production boards. The `real_boards` scope was added specifically to prevent this, but it is not applied anywhere. A brokerage admin sees "Test RETS Board" in their board selection UI and can attempt to associate it as a real board.

**Fix:**
```ruby
# app/controllers/v1/admin/boards_controller.rb
boards = RealEstateBoard.active.real_boards.order(:name)
```

---

### CR-03: TEST board accessible for credential attachment — `real_boards` scope not applied in credentials controller

**File:** `backend/app/controllers/v1/admin/board_credentials_controller.rb:24`

**Issue:** `RealEstateBoard.active.find_by(id: ...)` does not exclude the TEST board. A brokerage admin who knows the TEST board's ID (exposed via CR-02 or by guessing) can POST to `/v1/admin/board_credentials` with `real_estate_board_id` pointing at the TEST board, attaching real RETS credentials to a synthetic board. This is both a logic error (the TEST board has no real RETS endpoint) and a data integrity problem.

**Fix:**
```ruby
# app/controllers/v1/admin/board_credentials_controller.rb
board = RealEstateBoard.active.real_boards.find_by(id: board_credential_params[:real_estate_board_id])
```

---

## Warnings

### WR-01: `reset_pk_sequence!` outside transaction causes misleading exit code on failure

**File:** `backend/db/seeds.rb:50-58`

**Issue:** The `ActiveRecord::Base.connection.reset_pk_sequence!(table)` loop runs outside the `ActiveRecord::Base.transaction` block but inside the `begin/rescue` block. If `reset_pk_sequence!` raises for any table (e.g., a Solid Queue table with a non-standard sequence), the rescue clause fires and calls `exit 1` — but the transaction has already committed successfully. The operator sees `❌ Seeding failed` even though all seed data is in the database. This is particularly confusing on CI.

**Fix:**
```ruby
# Separate the sequence reset from the seed transaction error handling
ActiveRecord::Base.transaction do
  seed_users!
  seed_brokerages!
  seed_dev_domains!
  seed_real_estate_boards!
  seed_groups!
  seed_memberships!
  seed_estates!
end

puts "=" * 60
# ... success output ...

begin
  ActiveRecord::Base.connection.tables.each do |table|
    ActiveRecord::Base.connection.reset_pk_sequence!(table)
  end
  puts "✅ PK sequences reset"
rescue => e
  puts "⚠️  PK sequence reset failed (data was seeded): #{e.message}"
  # Do not exit 1 — data is committed
end
```

---

### WR-02: `NV_LISTINGS` constant defined at top-level scope, not inside `SeedConstants`

**File:** `backend/db/seeds/05_estates.rb:7`

**Issue:** `NV_LISTINGS = [...]` is assigned at the Ruby top level. `seeds.rb` uses `load` (not `require`), which re-executes the file on every invocation. If `rails db:seed` is somehow invoked twice in the same Ruby process (e.g., some test harnesses do this), Ruby emits `warning: already initialized constant NV_LISTINGS` and silently uses the new value. This is inconsistent with `SeedConstants`, which uses a module and avoids re-opening warnings for constants.

More practically, top-level constants pollute the global namespace and are visible outside the seed context. `SeedConstants` was created precisely to avoid this.

**Fix:**
```ruby
# Move NV_LISTINGS inside SeedConstants in 00_constants.rb, or guard it in 05_estates.rb:
NV_LISTINGS = [
  # ...
].freeze unless defined?(NV_LISTINGS)
```
Or, preferably, move the constant into `SeedConstants::NV_LISTINGS` in `00_constants.rb` and reference it as `SeedConstants::NV_LISTINGS[idx]` in the seed function.

---

### WR-03: `Estate` accessible_by scope does not exclude TEST board estates — TEST listings visible to all brokerages

**File:** `backend/app/models/estate.rb:19-38`

**Issue:** The `accessible_by` scope returns estates where either a `brokerage_board_credential` exists for the estate's board OR a direct `brokerage_estate` join exists. Since no `BrokerageEstate` rows are seeded (by design), and no `BrokerageBoardCredential` for the TEST board exists by default, TEST board estates are invisible to all brokerages through this scope. This is probably the intended behavior for Phase 12.

However, if any brokerage attaches credentials to the TEST board (possible via CR-03), all 100 TEST estates immediately become accessible to that brokerage, bypassing any board-type guard. The `accessible_by` scope has no awareness of `is_test_board`. Depending on Phase 12 design intent, this could cause TEST listings to surface in production brokerage dashboards.

**Fix:** Add a guard to `accessible_by` to exclude test board estates, or add it to `real_boards` scope chain at the query call sites:
```ruby
scope :accessible_by, ->(brokerage) {
  brokerage_id = brokerage.is_a?(Integer) ? brokerage : brokerage.id
  joins(:real_estate_board).merge(RealEstateBoard.real_boards).where(
    <<~SQL,
      EXISTS (
        SELECT 1 FROM brokerage_board_credentials bbc
        WHERE bbc.brokerage_id = :brokerage_id
          AND bbc.real_estate_board_id = estates.real_estate_board_id
          AND bbc.status = 'active'
          AND bbc.deleted_at IS NULL
      ) OR EXISTS (
        SELECT 1 FROM brokerage_estates be
        WHERE be.brokerage_id = :brokerage_id
          AND be.estate_id = estates.id
      )
    SQL
    brokerage_id: brokerage_id
  )
}
```

---

## Info

### IN-01: `SeedConstants::BOARD_SHORT_CODES` is defined but never referenced

**File:** `backend/db/seeds/00_constants.rb:50`

**Issue:** `BOARD_SHORT_CODES = %w[TEST].freeze` is declared in the constants module but is not referenced anywhere in any seed file. The actual board short code `"TEST"` is hardcoded as a string literal in both `09_real_estate_boards.rb` (line 7 and line 23) and `05_estates.rb` (line 177). The constant exists to enforce DRY and prevent drift, but it is not being used for that purpose.

**Fix:** Either delete `BOARD_SHORT_CODES` and accept the magic string, or use the constant consistently:
```ruby
# 09_real_estate_boards.rb
RealEstateBoard.where.not(short_code: SeedConstants::BOARD_SHORT_CODES).delete_all
# ...
short_code: SeedConstants::BOARD_SHORT_CODES.first,
```

---

### IN-02: `load` order for `10_dev_domains.rb` is last but execution happens inside the transaction at line 31

**File:** `backend/db/seeds.rb:20, 31`

**Issue:** `10_dev_domains.rb` is loaded last (line 20) but `seed_dev_domains!` is called third inside the transaction (line 31), before `seed_real_estate_boards!`. This means if `10_dev_domains.rb` has a load-time side effect (a constant definition, a `puts`, etc. outside the function), it runs after all other files are loaded but the function is executed early. Currently this is harmless — the file only defines a function — but the inconsistency between load order and execution order is a readability and maintenance trap.

**Fix:** Either keep load order matching execution order (move `load "10_dev_domains.rb"` to before `load "03_groups.rb"`), or add a comment explaining the deliberate ordering:
```ruby
# Load order matches execution order in transaction block below
load Rails.root.join("db/seeds/00_constants.rb")
load Rails.root.join("db/seeds/01_users.rb")
load Rails.root.join("db/seeds/02_brokerages.rb")
load Rails.root.join("db/seeds/10_dev_domains.rb")   # moved up to match execution order
load Rails.root.join("db/seeds/09_real_estate_boards.rb")
load Rails.root.join("db/seeds/03_groups.rb")
load Rails.root.join("db/seeds/04_memberships.rb")
load Rails.root.join("db/seeds/05_estates.rb")
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

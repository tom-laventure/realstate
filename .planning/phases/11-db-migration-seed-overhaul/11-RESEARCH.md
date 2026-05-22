# Phase 11: DB Migration & Seed Overhaul - Research

**Researched:** 2026-05-21
**Domain:** Rails migrations, ActiveRecord seed data, RealEstateBoard model
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Remove `BrokerageEstate` rows from seeds (SEED-04 requirement).
- **D-02:** Remove `GroupEstate` rows from seeds as well — dashboard starts completely empty after seeding. Consistent with the clean-slate intent; Phase 12 connect flow grants access.
- **D-03:** Drop seed files 06, 07, and 08 entirely (`06_engagement.rb`, `07_estate_dates.rb`, `08_estate_documents.rb`). These all depend on GroupEstate rows; with GroupEstate absent, they produce broken data. No stubs — delete the files and remove their calls from `seeds.rb`.
- **D-04:** Remove `BrokerageEstate` creation block from `05_estates.rb` and `GroupEstate` creation block from `05_estates.rb`. The estate + listing detail upsert remains; only the association creation is removed.
- **D-05:** Drop credential seeding entirely. Remove `seed_board_credentials!` function from `09_real_estate_boards.rb` and remove its call from `seeds.rb`. Board Registrations table starts empty in dev — the full Phase 12 connect flow can be tested from scratch.
- **D-06:** Explicitly delete REBGV, FVREB, CADREB records before upserting the TEST board in the boards seed. Use `RealEstateBoard.where.not(short_code: 'TEST').delete_all` before the upsert.
- **D-07:** Claude generates a hardcoded array of 100 real North Vancouver street addresses embedded directly in the seed file.
- **D-08:** Coordinates at neighborhood-level precision: 3–4 decimal places. Each listing gets a unique lat/lng. All within NV City + District bounds (lat 49.32–49.38, lng -123.10–-122.98).
- **D-09:** No geocoding job or external API call during seeding — coordinates are hardcoded constants. Seeds must run without network access.
- **D-10:** Update `BOARD_SHORT_CODES` in `db/seeds/00_constants.rb` from `%w[REBGV FVREB CADREB]` to `%w[TEST]`.
- **D-11:** Update `property_address` helper in `00_constants.rb` or remove it — the new seed embeds real addresses directly rather than generating fictional ones from a helper.

### Claude's Discretion

None explicitly designated.

### Deferred Ideas (OUT OF SCOPE)

- **"Rethink listing access model — BrokerageEstate vs board credential JOIN"** — scope too broad; deferred until adding a second real board integration.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEED-01 | All seeded listings belong to a single "Test RETS Board" (short_code: `TEST`) — REBGV, FVREB, CADREB removed from seeds | D-06 board cleanup + D-10 constant update + SQL backfill continues to work with single TEST board |
| SEED-02 | All seeded brokerage board credentials reference the TEST board | Satisfied vacuously via D-05: credential seeding dropped entirely; table starts empty |
| SEED-03 | All 100 seeded listing addresses are real streets in/around North Vancouver, BC with matching hardcoded lat/lng coordinates | D-07/D-08/D-09: hardcoded NV address+coord array in seed file |
| SEED-04 | Listings are seeded without pre-attached `BrokerageEstate` rows | D-01/D-04: BrokerageEstate and GroupEstate creation blocks removed from 05_estates.rb |
| BOARD-01 | `real_estate_boards` has an `is_test_board` boolean column (default `false`) | Standard Rails 7.1 add_column migration with null: false, default: false |
| BOARD-02 | TEST board seeded with `is_test_board: true`; `is_test_board` exposed in `RealEstateBoardSerializer` | Add attribute to serializer; include is_test_board: true in upsert_all payload |
</phase_requirements>

---

## Summary

Phase 11 is a pure backend data-layer phase: one Rails migration, two model/serializer file edits, and a seed overhaul. No frontend work is required. No new API endpoints are added — the existing `GET /v1/admin/boards` endpoint will automatically return `is_test_board` once the serializer is updated.

The seed overhaul removes approximately 80% of the existing seed volume (engagement, estate dates, estate documents, board credentials, BrokerageEstate rows, GroupEstate rows) and replaces the three-board listing dataset with 100 hardcoded North Vancouver listings all on a single TEST board. The `seeds.rb` orchestrator must also lose its calls to the dropped seed files and update its summary `puts` block.

**Primary recommendation:** Execute in three sequential tasks — (1) migration + model + serializer, (2) constants + board seed overhaul, (3) estates seed overhaul + seeds.rb cleanup + file deletions.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `is_test_board` column | Database | — | Schema change only |
| `is_test_board` model awareness | API / Backend (model) | — | Validation conditional for Phase 12 |
| `is_test_board` serialized to API | API / Backend (serializer) | — | BoardsController renders via RealEstateBoardSerializer |
| TEST board seed data | Database | — | Seed file writes directly to DB |
| 100 NV listing seeds | Database | — | Estate + ListingDetail upsert with hardcoded coords |
| File deletions (06/07/08) | API / Backend (seeds) | — | Removal of broken data generators |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rails migrations | 7.1 (project-established) | Add `is_test_board` column | Project uses ActiveRecord migrations throughout |
| `upsert_all` | Rails 6+ built-in | Idempotent board + estate inserts | Already used in existing seeds; re-runnable |
| `insert_all` | Rails 6+ built-in | Batch estate inserts | Already used in existing seeds |
| `ActiveRecord::Base.connection.execute` | Rails built-in | SQL backfill for `real_estate_board_id` | Already established pattern in 05_estates.rb |

[VERIFIED: codebase — schema.rb, migrate/, seeds/]

### No New Gems Required

This phase adds no new dependencies. All patterns (migrations, upsert_all, serializer attributes) are in use across the existing codebase.

---

## Architecture Patterns

### System Architecture Diagram

```
rails db:seed
  └── seeds.rb (orchestrator)
        ├── 00_constants.rb   ← BOARD_SHORT_CODES updated to ['TEST']
        │                        property_address helper removed
        ├── 01_users.rb       (unchanged)
        ├── 02_brokerages.rb  (unchanged)
        ├── 09_real_estate_boards.rb  ← REBGV/FVREB/CADREB deleted, TEST upserted
        │                               seed_board_credentials! dropped
        ├── 03_groups.rb      (unchanged)
        ├── 04_memberships.rb (unchanged)
        ├── 05_estates.rb     ← BrokerageEstate + GroupEstate blocks removed
        │                        hardcoded NV addresses + coords used
        │                        SQL backfill still runs (now all point to TEST board)
        ├── 06_engagement.rb  ← DELETED
        ├── 07_estate_dates.rb ← DELETED
        ├── 08_estate_documents.rb ← DELETED
        └── 10_dev_domains.rb (unchanged)

Migration path:
  add_column :real_estate_boards, :is_test_board, :boolean, null: false, default: false
  → PostgreSQL >=11: metadata-only, no table rewrite, no backfill needed

API response path:
  GET /v1/admin/boards
    → BoardsController#index
    → RealEstateBoard.active.order(:name)
    → RealEstateBoardSerializer
    → attributes :id, :name, :short_code, :region, :active, :created_at, :is_test_board  ← ADD THIS
```

### Recommended Project Structure (unchanged)

```
backend/
├── db/
│   ├── migrate/
│   │   └── 20260521NNNNNN_add_is_test_board_to_real_estate_boards.rb  ← NEW
│   ├── seeds/
│   │   ├── 00_constants.rb   ← MODIFIED
│   │   ├── 05_estates.rb     ← MODIFIED
│   │   ├── 09_real_estate_boards.rb  ← MODIFIED
│   │   ├── 06_engagement.rb  ← DELETED
│   │   ├── 07_estate_dates.rb ← DELETED
│   │   └── 08_estate_documents.rb ← DELETED
│   └── seeds.rb              ← MODIFIED
├── app/
│   ├── models/real_estate_board.rb  ← MODIFIED (optional is_test_board scope)
│   └── serializers/real_estate_board_serializer.rb  ← MODIFIED
```

### Pattern 1: Boolean column migration (Rails 7.1 PostgreSQL)

```ruby
# Source: [VERIFIED: codebase — db/migrate/20260516191150_add_geocoding_to_listing_details.rb]
class AddIsTestBoardToRealEstateBoards < ActiveRecord::Migration[7.1]
  def change
    add_column :real_estate_boards, :is_test_board, :boolean, null: false, default: false
  end
end
```

This is a metadata-only operation on PostgreSQL >= 11 when `default:` is a constant. Existing rows receive `false` automatically — no explicit backfill needed. [VERIFIED: codebase — geocoding_failed column uses identical pattern]

### Pattern 2: Board seed with delete_all + upsert_all

```ruby
# Source: [VERIFIED: codebase — db/seeds/09_real_estate_boards.rb]
def seed_real_estate_boards!
  RealEstateBoard.where.not(short_code: 'TEST').delete_all  # D-06

  now = Time.current
  boards = [{
    name: "Test RETS Board",
    short_code: "TEST",
    rets_endpoint: "https://test.example.com/rets/login",  # required by validates :rets_endpoint, presence: true
    region: "North Vancouver",
    is_test_board: true,
    active: true,
    created_at: now,
    updated_at: now
  }]

  RealEstateBoard.upsert_all(boards, unique_by: :short_code)
end
```

**Critical:** `rets_endpoint` has `validates :rets_endpoint, presence: true` on the model AND `null: false` in the schema. The TEST board MUST supply a non-blank value even though it will never be used. Use a placeholder URL. [VERIFIED: codebase — app/models/real_estate_board.rb, db/schema.rb line 373]

### Pattern 3: Estate seed with hardcoded NV addresses

```ruby
# Source: [VERIFIED: codebase — db/seeds/05_estates.rb existing pattern]
# 100 hardcoded NV address+coordinate tuples replace the property_address() helper call
NV_LISTINGS = [
  { address: "123 Lonsdale Ave, North Vancouver", lat: 49.3257, lng: -123.0698 },
  { address: "456 Marine Dr, North Vancouver",    lat: 49.3329, lng: -123.0755 },
  # ... 98 more
].freeze

# In seed loop:
listing_detail_data << {
  estate_id: estate_id,
  address: NV_LISTINGS[idx][:address],
  latitude: NV_LISTINGS[idx][:lat],
  longitude: NV_LISTINGS[idx][:lng],
  board: "TEST",          # single board short code
  geocoding_failed: false,
  ...
}
```

Since `BOARD_SHORT_CODES = %w[TEST]`, the board assignment is always `"TEST"` — no modulo selection needed.

### Pattern 4: Serializer attribute addition

```ruby
# Source: [VERIFIED: codebase — app/serializers/real_estate_board_serializer.rb]
class RealEstateBoardSerializer < ActiveModel::Serializer
  attributes :id, :name, :short_code, :region, :active, :created_at, :is_test_board
end
```

No custom method needed — `is_test_board` is a plain boolean column, no computation required.

### Pattern 5: seeds.rb call removal

```ruby
# Remove these lines from seeds.rb:
load Rails.root.join("db/seeds/06_engagement.rb")
load Rails.root.join("db/seeds/07_estate_dates.rb")
load Rails.root.join("db/seeds/08_estate_documents.rb")

# Remove these calls from the transaction block:
seed_board_credentials!
seed_estate_documents!
seed_estate_dates!
seed_engagement!

# Remove these from summary puts block:
puts "  EstateDates: #{EstateDate.count}"
puts "  EstateDocuments: #{EstateDocument.count}"
puts "  Comments: #{EstateComment.count}"
puts "  Likes: #{EstateLike.count}"
puts "  Ratings: #{EstateRating.count}"
puts "  BoardCredentials: #{BrokerageBoardCredential.count}"
```

### Anti-Patterns to Avoid

- **Using upsert_all alone for board cleanup:** `upsert_all` with `unique_by: :short_code` will INSERT TEST and IGNORE REBGV/FVREB/CADREB (they remain in the DB). The CONTEXT.md D-06 pattern — `delete_all` first, then upsert — is required. [VERIFIED: codebase — D-06 explicitly specifies this]
- **Using destroy_all for board cleanup:** `RealEstateBoard` has no `acts_as_paranoid` (confirmed from model file). `delete_all` is correct — no callbacks, no soft-delete overhead. [VERIFIED: codebase — real_estate_board.rb has no paranoid call]
- **Omitting rets_endpoint from TEST board seed:** The model validates `rets_endpoint` presence. `upsert_all` bypasses AR callbacks BUT schema has `null: false` on the column — the DB will reject a null value. Must include a placeholder string.
- **Using .sample in new seed blocks:** `%w[RETS IDX MLS].sample` in the existing `05_estates.rb` is non-deterministic. The new estate seed replacing `BrokerageEstate`/`GroupEstate` blocks should use deterministic index-based selection.
- **Leaving summary puts for dropped models:** Leaving `EstateDate.count` etc. in seeds.rb after dropping those seed files will error if the tables/data are gone or cause misleading output.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent board insert | Custom `find_or_create_by` loop | `upsert_all(boards, unique_by: :short_code)` | Already established pattern; single SQL statement |
| Backfilling `real_estate_board_id` on estates | Ruby loop with AR updates | Raw SQL UPDATE...FROM...JOIN pattern already in 05_estates.rb | O(1) SQL vs O(n) Ruby |
| PostgreSQL boolean default | Manual backfill migration | `add_column :is_test_board, :boolean, null: false, default: false` | PG >= 11 handles it in metadata only |

---

## Runtime State Inventory

> This phase modifies seeds, not running services. No rename/refactor involved.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Any existing REBGV/FVREB/CADREB rows in dev DB | `db:reset` or `delete_all` in seed re-run clears them |
| Live service config | None — board data is in the relational DB, not external config | None |
| OS-registered state | None | None |
| Secrets/env vars | `seed_board_credentials!` writes fake ciphertext values — no real secrets | No action; function being dropped entirely |
| Build artifacts | None | None |

**Dev database state after `rails db:seed` on a clean DB:** 1 RealEstateBoard (TEST), 100 Estates, 100 ListingDetails, 0 BrokerageEstates, 0 GroupEstates, 0 BrokerageBoardCredentials.

---

## Common Pitfalls

### Pitfall 1: rets_endpoint null constraint blocks TEST board insert

**What goes wrong:** The `real_estate_boards.rets_endpoint` column is `null: false` in the schema AND the model validates `presence: true`. If the TEST board seed omits `rets_endpoint`, the PostgreSQL INSERT will raise `NOT NULL constraint violation` even via `upsert_all` (which bypasses AR callbacks but not DB constraints).

**Why it happens:** The column was designed for real RETS boards that always have an endpoint. Test boards conceptually don't need one.

**How to avoid:** Include a clearly-labelled placeholder string: `rets_endpoint: "https://test.example.com/rets/login"` in the TEST board seed hash.

**Warning signs:** `ActiveRecord::NotNullViolation` during `rails db:seed`.

### Pitfall 2: SQL backfill fails if TEST board insert rolls back

**What goes wrong:** The `seed_real_estate_boards!` call occurs before `seed_estates!` in `seeds.rb`. If the TEST board doesn't exist at backfill time, the UPDATE...JOIN produces 0 rows updated and all estate `real_estate_board_id` values stay NULL.

**Why it happens:** The SQL backfill in `05_estates.rb` joins `real_estate_boards` on `short_code = listing_details.board`. If board rows are absent, the join finds nothing.

**How to avoid:** Ensure `seed_real_estate_boards!` is called and committed before `seed_estates!` in the transaction. The current `seeds.rb` call order already does this correctly — maintain it.

**Warning signs:** All estates have `real_estate_board_id: nil` after seeding.

### Pitfall 3: seeds.rb load order vs. function calls

**What goes wrong:** `seeds.rb` does two things: (1) `load`s the seed files to define the functions, and (2) calls the functions. Removing files 06/07/08 requires removing BOTH the `load` lines AND the function calls. Leaving either half causes a `NameError` (undefined function) or a `NoMethodError` (undefined model method on empty tables).

**Why it happens:** Ruby's `load` is a file-level include; the function definitions only exist after the `load`.

**How to avoid:** Remove all three `load` lines and all three `seed_*!` calls and all three `puts` summary lines in a single edit to `seeds.rb`.

**Warning signs:** `NoMethodError: undefined method 'seed_engagement!'`.

### Pitfall 4: Duplicate MLS numbers if seed runs twice

**What goes wrong:** `ListingDetail` has a unique index on `mls_number`. If seeds are run twice without a `db:reset`, the `upsert_all` on estates uses `unique_by: :id` and `unique_by: :index_listing_details_on_estate_id` — idempotent. But the `mls_number` column is also uniquely indexed. As long as `upsert_all` is used (not `insert_all`) for listing details, re-running is safe.

**How to avoid:** Keep `ListingDetail.upsert_all(listing_detail_data, unique_by: :index_listing_details_on_estate_id)` — already the existing pattern.

**Warning signs:** `ActiveRecord::RecordNotUnique` on `index_listing_details_on_mls_number` during second seed run.

### Pitfall 5: BOARD_SHORT_CODES still referenced for board assignment in 05_estates.rb

**What goes wrong:** The existing `05_estates.rb` uses `SeedConstants::BOARD_SHORT_CODES[idx % SeedConstants::BOARD_SHORT_CODES.length]` to assign the `board` field. After `BOARD_SHORT_CODES = %w[TEST]`, this produces `"TEST"` for every listing — which is correct. However the logic still calls `.sample` for `mls_source`, which is non-deterministic. This is benign (seeds still work) but worth noting.

**How to avoid:** Replace `%w[RETS IDX MLS].sample` with a deterministic selection like `%w[RETS IDX MLS][idx % 3]` in the new seed.

---

## Code Examples

### Migration

```ruby
# Source: [VERIFIED: codebase — existing migration pattern, e.g. 20260516191150_add_geocoding_to_listing_details.rb]
class AddIsTestBoardToRealEstateBoards < ActiveRecord::Migration[7.1]
  def change
    add_column :real_estate_boards, :is_test_board, :boolean, null: false, default: false
  end
end
```

**Naming convention:** Latest migrations use `YYYYMMDDHHMMSS_verb_noun_to_table.rb` format with dates from 2026. New migration timestamp should follow the last migration: `20260518000001` → use `20260521000001`.

### Serializer

```ruby
# Source: [VERIFIED: codebase — app/serializers/real_estate_board_serializer.rb]
class RealEstateBoardSerializer < ActiveModel::Serializer
  attributes :id, :name, :short_code, :region, :active, :created_at, :is_test_board
end
```

### Model (optional scope)

```ruby
# Source: [VERIFIED: codebase — real_estate_board.rb existing scope pattern]
scope :test_boards, -> { where(is_test_board: true) }
scope :real_boards, -> { where(is_test_board: false) }
```

Adding these scopes is not strictly required for Phase 11 but Phase 12 will need `is_test_board?` — the boolean column auto-generates a predicate method in ActiveRecord.

### seeds.rb after cleanup

```ruby
# Load order (seed files 06/07/08 load lines removed)
load Rails.root.join("db/seeds/00_constants.rb")
load Rails.root.join("db/seeds/01_users.rb")
load Rails.root.join("db/seeds/02_brokerages.rb")
load Rails.root.join("db/seeds/09_real_estate_boards.rb")
load Rails.root.join("db/seeds/03_groups.rb")
load Rails.root.join("db/seeds/04_memberships.rb")
load Rails.root.join("db/seeds/05_estates.rb")
load Rails.root.join("db/seeds/10_dev_domains.rb")

# Call order (seed_board_credentials!, seed_estate_documents!, seed_estate_dates!, seed_engagement! removed)
ActiveRecord::Base.transaction do
  seed_users!
  seed_brokerages!
  seed_dev_domains!
  seed_real_estate_boards!
  seed_groups!
  seed_memberships!
  seed_estates!
end

# Summary puts (removed: EstateDates, EstateDocuments, Comments, Likes, Ratings, BoardCredentials)
puts "  Users: #{User.count}"
puts "  Brokerages: #{Brokerage.count}"
puts "  Groups: #{Group.count}"
puts "  Estates: #{Estate.count}"
puts "  RealEstateBoards: #{RealEstateBoard.count}"
```

---

## File-by-File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `db/migrate/20260521000001_add_is_test_board_to_real_estate_boards.rb` | CREATE | `add_column :is_test_board, :boolean, null: false, default: false` |
| `app/models/real_estate_board.rb` | MODIFY | Add optional `scope :test_boards` / `scope :real_boards` |
| `app/serializers/real_estate_board_serializer.rb` | MODIFY | Add `:is_test_board` to `attributes` list |
| `db/seeds/00_constants.rb` | MODIFY | `BOARD_SHORT_CODES = %w[TEST]`; remove `property_address` helper |
| `db/seeds/09_real_estate_boards.rb` | MODIFY | Delete REBGV/FVREB/CADREB data; add TEST board; drop `seed_board_credentials!` |
| `db/seeds/05_estates.rb` | MODIFY | Replace `property_address` calls with NV address array; remove BrokerageEstate + GroupEstate blocks; remove `brokerage_estate_data` and `group_estate_data` arrays |
| `db/seeds/06_engagement.rb` | DELETE | File deleted entirely |
| `db/seeds/07_estate_dates.rb` | DELETE | File deleted entirely |
| `db/seeds/08_estate_documents.rb` | DELETE | File deleted entirely |
| `db/seeds.rb` | MODIFY | Remove load lines + function calls for files 06/07/08 + `seed_board_credentials!`; remove summary puts lines for dropped models |

---

## Full Column Inventory for Seed Records

### estates table (required + commonly set)
```
id (deterministic: ESTATE_ID_START + idx)
link (string, nullable)
is_verified (boolean, default false)
created_at / updated_at (required: not null)
real_estate_board_id (backfilled via SQL after boards seed)
deleted_at (omit — defaults null)
```

### listing_details table (required + commonly set)
```
estate_id (not null, FK)
created_at / updated_at (not null)
address       ← NV address from hardcoded array
latitude      ← hardcoded NV coordinate
longitude     ← hardcoded NV coordinate
geocoding_failed ← false (hardcoded, no geocoding job needed)
board         ← "TEST" (single value)
mls_number    ← SeedConstants.mls_number(estate_id)
list_price    ← formatted string
price         ← price.to_s
price_numeric ← price.to_f
images        ← array of picsum URLs (already deterministic)
bedrooms / full_bathrooms / sqft / days_on_market ← deterministic from idx
property_type ← deterministic from idx
year_built    ← deterministic from idx
community / city ← can simplify to fixed values (e.g. "North Vancouver")
mls_source    ← deterministic (remove .sample)
```

**Optional columns (nullable, safely omitted):** `gross_taxes`, `strata_fees`, `age`, `title`, `style`, `heating_type`, `features`, `amenities`, `appliances`, `views_count`, `hero_image_url`, `photo_count`, `photos_synced_at`, `photos_sync_claimed_at`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Three seeded boards (REBGV/FVREB/CADREB) | Single TEST board | Phase 11 | Seeds are self-contained; no RETS credentials needed in dev |
| Multi-board estate distribution via `BOARD_SHORT_CODES[idx % 3]` | All estates on TEST board | Phase 11 | SQL backfill still works; simpler |
| BrokerageEstate + GroupEstate pre-seeded | Empty — Phase 12 connect flow creates them | Phase 11 | Dashboard shows empty state until brokerage connects |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgreSQL >= 11 is running in dev — `null: false, default: false` is a metadata-only migration | Migration pattern | If PG < 11, migration rewrites the table (slow, but still correct) |
| A2 | `upsert_all` bypasses model validations but not DB NOT NULL constraints | Pitfall 1 | If validation is bypassed at DB level too, omitting rets_endpoint would work — but the constraint still enforces correctness |
| A3 | No tests reference REBGV/FVREB/CADREB board short codes | Open Questions | Tests would fail after board deletion if wrong |

**If this table is empty:** Not empty — three low-risk assumptions documented above.

---

## Open Questions

1. **rets_endpoint validation for TEST board**
   - What we know: Model validates `presence: true`; schema has `null: false`. TEST boards don't use RETS.
   - What's unclear: Whether the model validation should be conditionalized (`unless is_test_board?`) now or deferred to Phase 12.
   - Recommendation: For Phase 11, supply a placeholder URL in the seed. Model validation can remain unconditional. Phase 12 can add `validates :rets_endpoint, presence: true, unless: :is_test_board?` when it matters for the connect flow.

2. **mls_source determinism**
   - What we know: Existing seed uses `.sample` (non-deterministic). New seed should be deterministic per project philosophy.
   - What's unclear: Whether any code or test relies on `mls_source` values.
   - Recommendation: Replace `.sample` with `%w[RETS IDX MLS][idx % 3]` in the new seed.

---

## Environment Availability

> Step 2.6: SKIPPED (no external dependencies — phase is code/config/data changes only; no new CLIs, services, or runtimes required).

---

## Validation Architecture

> Step 4: SKIPPED — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. [VERIFIED: .planning/config.json]

---

## Security Domain

> This phase adds a boolean data attribute and seed data. No authentication, authorization, or user-facing input handling is involved.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | `is_test_board` is not user-supplied |
| V6 Cryptography | no | Credential seeding is being dropped entirely |

**Security note:** Removing `seed_board_credentials!` eliminates the pattern of writing fake ciphertext values directly to `_ciphertext` columns in dev. This is a positive security hygiene improvement — no fake credentials in the dev database.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase — backend/db/seeds/] — all seed files read directly
- [VERIFIED: codebase — backend/db/schema.rb] — real_estate_boards, estates, listing_details, brokerage_estates table definitions
- [VERIFIED: codebase — backend/app/models/real_estate_board.rb] — validates :rets_endpoint, presence: true confirmed
- [VERIFIED: codebase — backend/app/serializers/real_estate_board_serializer.rb] — current attributes list confirmed
- [VERIFIED: codebase — backend/app/controllers/v1/admin/boards_controller.rb] — GET /v1/admin/boards endpoint confirmed
- [VERIFIED: codebase — backend/db/migrate/20260516191150_add_geocoding_to_listing_details.rb] — null: false, default: false boolean migration pattern confirmed
- [VERIFIED: codebase — backend/db/migrate/20260321000001_create_real_estate_boards.rb] — original table structure
- [VERIFIED: codebase — backend/test/] — no test files reference REBGV/FVREB/CADREB short codes
- [VERIFIED: .planning/config.json] — nyquist_validation: false

### Secondary (MEDIUM confidence)
- [CITED: Rails 7.1 migration docs — implicit in codebase patterns] — PostgreSQL >= 11 metadata-only boolean default migration

---

## Metadata

**Confidence breakdown:**
- Migration: HIGH — identical pattern (geocoding_failed) already in codebase
- Seed overhaul: HIGH — all seed file contents read and fully understood
- Serializer: HIGH — file read, change is trivial (one attribute addition)
- Board cleanup: HIGH — delete_all vs destroy_all verified by reading model (no paranoid)
- rets_endpoint constraint: HIGH — both model validation and schema NOT NULL confirmed

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable stack)

# Phase 11: DB Migration & Seed Overhaul - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `is_test_board` boolean column to `real_estate_boards`, update the model and serializer to expose it, then replace the three-board seed (REBGV, FVREB, CADREB) with a single TEST board seeded with 100 real North Vancouver listings. Listings are seeded with no pre-attached `BrokerageEstate` or `GroupEstate` rows — access is granted when a brokerage connects in Phase 12.

</domain>

<decisions>
## Implementation Decisions

### Seed Structure — Clean Slate

- **D-01:** Remove `BrokerageEstate` rows from seeds (SEED-04 requirement).
- **D-02:** Remove `GroupEstate` rows from seeds as well — dashboard starts completely empty after seeding. Consistent with the clean-slate intent; Phase 12 connect flow grants access.
- **D-03:** Drop seed files 06, 07, and 08 entirely (`06_engagement.rb`, `07_estate_dates.rb`, `08_estate_documents.rb`). These all depend on GroupEstate rows; with GroupEstate absent, they produce broken data. No stubs — delete the files and remove their calls from `seeds.rb`.
- **D-04:** Remove `BrokerageEstate` creation block from `05_estates.rb` and `GroupEstate` creation block from `05_estates.rb`. The estate + listing detail upsert remains; only the association creation is removed.

### Board Credentials Seed

- **D-05:** Drop credential seeding entirely. Remove `seed_board_credentials!` function from `09_real_estate_boards.rb` and remove its call from `seeds.rb`. Board Registrations table starts empty in dev — the full Phase 12 connect flow can be tested from scratch.

### Old Board Cleanup

- **D-06:** Explicitly delete REBGV, FVREB, CADREB records before upserting the TEST board in the boards seed. Success criteria requires they be absent — `upsert_all` alone won't remove them. Use `RealEstateBoard.where.not(short_code: 'TEST').destroy_all` (or `delete_all` since no paranoid) before the upsert.

### NV Address Data

- **D-07:** Claude generates a hardcoded array of 100 real North Vancouver street addresses embedded directly in the seed file. Streets must be real NV streets (Lonsdale Ave, Marine Dr, 3rd St W, Chesterfield Ave, etc.) — not fictional names.
- **D-08:** Coordinates at neighborhood-level precision: 3–4 decimal places (~10–100m accuracy). Each listing gets a unique lat/lng. All coordinates within North Vancouver City + District bounds (approximately lat 49.32–49.38, lng -123.10–-122.98).
- **D-09:** No geocoding job or external API call during seeding — coordinates are hardcoded constants in the seed file. Seeds must run without network access.

### Constants Update

- **D-10:** Update `BOARD_SHORT_CODES` in `db/seeds/00_constants.rb` from `%w[REBGV FVREB CADREB]` to `%w[TEST]`.
- **D-11:** Update `property_address` helper in `00_constants.rb` or remove it — the new seed embeds real addresses directly rather than generating fictional ones from a helper.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — SEED-01..04 and BOARD-01..02 are the requirements for this phase
- `.planning/ROADMAP.md` §Phase 11 — Success criteria (4 items) define what must be true when done

### Existing Seeds (to be overhauled)
- `backend/db/seeds/00_constants.rb` — `BOARD_SHORT_CODES`, `property_address` helper need updating
- `backend/db/seeds/05_estates.rb` — remove `BrokerageEstate` + `GroupEstate` creation blocks
- `backend/db/seeds/09_real_estate_boards.rb` — remove REBGV/FVREB/CADREB, add TEST board, drop credential function
- `backend/db/seeds/06_engagement.rb` — drop entirely
- `backend/db/seeds/07_estate_dates.rb` — drop entirely
- `backend/db/seeds/08_estate_documents.rb` — drop entirely

### Schema & Models
- `backend/db/schema.rb` — current `real_estate_boards` table (no `is_test_board` column yet)
- `backend/app/models/real_estate_board.rb` — model to receive `is_test_board` awareness
- `backend/app/serializers/real_estate_board_serializer.rb` — add `is_test_board` attribute

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RealEstateBoard.upsert_all(boards, unique_by: :short_code)` — existing upsert pattern in `09_real_estate_boards.rb`; reuse for TEST board insert
- `Estate.upsert_all` + `ListingDetail.upsert_all` — existing batch insert pattern in `05_estates.rb`; keep for estate + listing detail creation
- `ActiveRecord::Base.connection.execute(SQL)` — used for `real_estate_board_id` backfill from `listing_details.board`; keep this SQL backfill

### Established Patterns
- Seeds write directly to `_ciphertext` columns to bypass AR encryption — no longer needed once credential seeding is dropped
- Seeds use deterministic IDs (`ESTATE_ID_START = 1000`, `USER_ID_START = 100`) for reproducibility — keep for estates
- `insert_all`/`upsert_all` preferred over `create!` loops for performance
- No `acts_as_paranoid` on `RealEstateBoard` — use `delete_all` (not `destroy_all`) for board cleanup

### Integration Points
- `GET /v1/admin/real_estate_boards` (or similar board list endpoint) must return `is_test_board: true` for TEST board — requires serializer update AND migration
- `rails db:seed` entry point is `backend/db/seeds.rb` (or `db/seeds/seeds.rb`) — the call order determines what runs; remove calls to dropped seed files
- `real_estate_board_id` FK on `estates` table already exists — SQL backfill in estate seed continues to work as-is

</code_context>

<specifics>
## Specific Ideas

- All 100 listings should use real NV streets: Lonsdale Ave, Marine Dr, 3rd St W, Chesterfield Ave, Queens Rd, Mountain Hwy, Lynn Valley Rd, Dollarton Hwy, etc.
- Coordinates bounded within NV City + District: lat 49.32–49.38, lng -123.10–-122.98
- Each listing gets a unique street number + one of ~15–20 real NV streets, distributed so no two listings share the exact same address
- The `is_test_board` migration should use `null: false, default: false` (PostgreSQL metadata-only migration on Rails 7.1 — no backfill needed for existing rows)

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- **"Rethink listing access model — BrokerageEstate vs board credential JOIN"** (`arch-brokerage-listing-access.md`) — reviewed and explicitly deferred. Scope is too broad (requires query-layer refactoring across dashboard endpoints) and acceptable at 100 test listings. Surface before adding a second real board integration.

</deferred>

---

*Phase: 11-db-migration-seed-overhaul*
*Context gathered: 2026-05-21*

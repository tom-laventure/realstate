---
phase: 08-geocoding-data-layer
plan: "01"
subsystem: database
tags: [rails, migration, serializer, geocoding, decimal, listing_details]

# Dependency graph
requires: []
provides:
  - latitude/longitude/geocoding_failed columns on listing_details table
  - ListingDetailSerializer exposes all three fields
  - ListingDetail model has attribute hints for readability
  - EstatesController index and show responses include geocoding fields (via existing EstateSerializer#listing_detail chain)
affects:
  - 08-02-geocoding-service-and-job (writes to latitude/longitude/geocoding_failed)
  - Phase 9 frontend map (reads latitude/longitude from API response)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "decimal(10,6) for coordinate storage — exact precision, no float rounding loss"
    - "boolean geocoding_failed with default: false, null: false — existing rows auto-backfilled via DB default on metadata-only migration"

key-files:
  created:
    - backend/db/migrate/20260516191150_add_geocoding_to_listing_details.rb
  modified:
    - backend/app/serializers/listing_detail_serializer.rb
    - backend/app/models/listing_detail.rb
    - backend/db/schema.rb

key-decisions:
  - "08-01: decimal(10,6) for lat/lng — not float; preserves ~0.1m precision exactly as stored"
  - "08-01: geocoding_failed uses null: false + default: false — PostgreSQL >=11 applies as metadata-only change with no table rewrite; existing rows get false automatically"
  - "08-01: No index added in this plan — deferred to Phase 9 if spatial index (PostGIS) is needed per CONTEXT.md"
  - "08-01: EstateSerializer required no changes — ListingDetailSerializer is already wired as listing_detail association in EstateSerializer; appending attributes there flows to both index and show"

patterns-established:
  - "Serializer attribute append: add new columns at end of attributes block, no trailing comma on last entry"
  - "Model attribute hints: document new decimal columns with attribute :col, :decimal after existing hints block"

requirements-completed: [MAP-01]

# Metrics
duration: 2min
completed: "2026-05-16"
---

# Phase 8 Plan 01: Geocoding Data Layer — Schema & Serializer Summary

**Three geocoding columns added to listing_details via reversible Rails 7.1 migration and exposed through ListingDetailSerializer using decimal(10,6) precision storage**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-16T20:41:20Z
- **Completed:** 2026-05-16T20:44:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Migration `20260516191150_add_geocoding_to_listing_details` applied — adds `latitude decimal(10,6)`, `longitude decimal(10,6)`, `geocoding_failed boolean default false not null` to `listing_details` table
- `ListingDetailSerializer` now exposes `:latitude`, `:longitude`, `:geocoding_failed` — automatically flows to both `EstatesController#index` and `EstatesController#show` via existing `EstateSerializer#listing_detail` association chain (no EstateSerializer changes needed)
- `ListingDetail` model has three new attribute hints for reader clarity; migration confirmed reversible using `change` method
- Regression suite (`group_estates_query_test.rb`) passes: 4 runs, 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration adding latitude/longitude/geocoding_failed columns** - `efcaf1d` (chore)
2. **Task 2: Expose latitude/longitude/geocoding_failed in ListingDetailSerializer and document on model** - `58b4a5f` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `backend/db/migrate/20260516191150_add_geocoding_to_listing_details.rb` — Reversible migration adding 3 columns; `change` method; decimal precision 10 scale 6 for coordinates
- `backend/app/serializers/listing_detail_serializer.rb` — Three new attributes appended after `:photos_synced_at` (lines 38-40)
- `backend/app/models/listing_detail.rb` — Three attribute hints appended after `photos_sync_claimed_at` hint (lines 22-24)
- `backend/db/schema.rb` — Regenerated after `rails db:migrate`; `listing_details` block now shows all three new columns

## Decisions Made

- `decimal(10,6)` chosen over `float` — floats silently lose precision; decimal stores exactly; consistent with `price_numeric decimal(15,2)` already on the table
- `geocoding_failed` uses `null: false, default: false` — ensures existing rows receive `false` via PostgreSQL metadata-only default (no table rewrite on PG ≥ 11); rake task backfill scope `where(geocoding_failed: false)` immediately includes all existing rows
- No `estateSerializer` changes — existing `has_one :listing_detail` association in `EstateSerializer` already renders through `ListingDetailSerializer`; adding attributes there is sufficient

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed standardrb Layout/ExtraSpacing lint failure in migration file**
- **Found during:** Task 2 verification (standardrb lint on all modified files)
- **Issue:** Migration file used alignment spacing (extra spaces before `:decimal`) which standardrb flags as `Layout/ExtraSpacing`; 2 offenses would have caused lint exit 1
- **Fix:** Removed extra alignment spaces on lines 3-4 of the migration file (`:latitude` and `:longitude` lines)
- **Files modified:** `backend/db/migrate/20260516191150_add_geocoding_to_listing_details.rb`
- **Verification:** `bundle exec standardrb` exits 0 on all three modified files
- **Committed in:** `58b4a5f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — lint bug in migration alignment spacing)
**Impact on plan:** Trivial formatting fix only; no logic changes. All plan goals achieved.

## Issues Encountered

None beyond the lint deviation above.

## User Setup Required

None — no external service configuration required for this plan. Environment variable `NOMINATIM_USER_AGENT` is needed by Plan 02 (GeocodingService), not this plan.

## Next Phase Readiness

- Plan 02 (`GeocodeListingsJob` + `GeocodingService` + rake task) can now proceed — it calls `listing_detail.update!(latitude:, longitude:)` and `update_columns(geocoding_failed: true)` against these columns
- API contract established: both dashboard endpoints return `latitude`, `longitude`, `geocoding_failed` in each `listing_detail` object — frontend (Phase 9) can begin reading these fields

## Known Stubs

None — no UI rendering in this plan. Schema and serializer changes only.

---
*Phase: 08-geocoding-data-layer*
*Completed: 2026-05-16*

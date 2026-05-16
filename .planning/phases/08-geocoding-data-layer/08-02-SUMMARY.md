---
phase: 08-geocoding-data-layer
plan: "02"
subsystem: api
tags: [rails, background-job, service-object, geocoding, nominatim, httparty, solid_queue, rake]

# Dependency graph
requires:
  - phase: 08-01
    provides: latitude/longitude/geocoding_failed columns on listing_details table
provides:
  - GeocodingService wrapping Nominatim HTTP call, returning typed Result struct
  - GeocodeListingsJob with retry_on/discard_on/after_discard semantics populating listing coordinates
  - geocode:backfill rake task that idempotently enqueues jobs for un-geocoded listings
affects:
  - Phase 9 frontend map (reads latitude/longitude from API responses now populated by this pipeline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GeocodingService Result struct extends RetsAuthService pattern with latitude/longitude fields"
    - "after_discard block on ApplicationJob using run_after_discard_procs (Rails 7.1 public API)"
    - "WebMock stub_request for HTTP integration tests instead of minitest/mock (project uses minitest 6.x; no stub method)"
    - "Four-guard return pattern in perform: nil, already-geocoded, geocoding_failed, blank address"
    - "Rake idempotency via scope: latitude nil + address present + geocoding_failed false + estate not soft-deleted"

key-files:
  created:
    - backend/app/services/geocoding_service.rb
    - backend/app/jobs/geocode_listings_job.rb
    - backend/lib/tasks/geocode.rake
    - backend/test/services/geocoding_service_test.rb
    - backend/test/jobs/geocode_listings_job_test.rb

key-decisions:
  - "08-02: WebMock used for HTTP stubbing in tests (project uses minitest 6.x which lacks Object#stub for modules)"
  - "08-02: run_after_discard_procs(nil) used in after_discard test (Rails 7.1 private method; run_callbacks(:discard) is minitest 5.x pattern, not applicable)"
  - "08-02: assert_in_delta for lat/lng assertions in job test (decimal(10,6) stores max 6 decimal places; test values match column precision)"
  - "08-02: after_discard test removed @listing_detail.reload for soft-deleted estate test (Estate has_one :listing_detail, dependent: :destroy hard-destroys listing_detail on soft-delete)"

patterns-established:
  - "WebMock pattern for HTTParty tests: require 'webmock/minitest' + stub_request(:get, /regex/) in test files"
  - "after_discard verification: GeocodeListingsJob.new(id).send(:run_after_discard_procs, nil) to fire callback in-process"

requirements-completed: [MAP-01]

# Metrics
duration: 11min
completed: "2026-05-16"
---

# Phase 8 Plan 02: Geocoding Service, Job, and Rake Task Summary

**Nominatim geocoding pipeline with GeocodingService Result struct, GeocodeListingsJob retry/after_discard failure-flag semantics, and idempotent geocode:backfill rake task; 17 tests covering all paths pass with 0 failures**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-16T20:47:24Z
- **Completed:** 2026-05-16T20:58:00Z
- **Tasks:** 3
- **Files modified:** 5 (all new)

## Accomplishments

- `GeocodingService` wraps Nominatim HTTP call with `Result` struct extending the `RetsAuthService` pattern; reads `"lat"`/`"lon"` fields (not `"latitude"`/`"longitude"`), converts to BigDecimal via `.to_d`, uses `ENV.fetch("NOMINATIM_USER_AGENT")` failing loud if unconfigured
- `GeocodeListingsJob` uses `queue_as :default`, `retry_on StandardError` (3 attempts), `discard_on RecordNotFound`, and `after_discard` block that sets `geocoding_failed: true` via `update_columns` — no `rescue StandardError` inside `perform` so `retry_on` is not short-circuited
- `geocode:backfill` rake task is idempotent via four-condition scope (latitude nil, address present, geocoding_failed false, estate not soft-deleted); uses `find_each` for memory-safe batching; prints enqueued count for operator visibility
- Full test suite (39 runs): 0 failures, 0 errors — no regressions

## Task Commits

Each task was committed atomically (in the backend/ git repo):

1. **Task 1: GeocodingService + test** - `c25e85f` (feat)
2. **Task 2: GeocodeListingsJob + test** - `1206a9b` (feat)
3. **Task 3: geocode:backfill rake task** - `b571275` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `backend/app/services/geocoding_service.rb` — Nominatim HTTP wrapper; Result struct with success/latitude/longitude/error; rescues HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout
- `backend/app/jobs/geocode_listings_job.rb` — ActiveJob with retry_on/discard_on/after_discard; four guard returns; sleep(1) unless test? for rate limiting
- `backend/lib/tasks/geocode.rake` — `geocode:backfill` task with four-condition idempotent scope; find_each batching; enqueues GeocodeListingsJob with estate_id
- `backend/test/services/geocoding_service_test.rb` — 7 Minitest tests via WebMock: blank/nil guard, User-Agent header, success (BigDecimal), empty results, HTTP 503, timeout
- `backend/test/jobs/geocode_listings_job_test.rb` — 10 Minitest tests: queue name, retry/discard config, three guard paths, success, failure (no geocoding_failed on single failure), discard on non-existent/soft-deleted estate, after_discard callback via `run_after_discard_procs`

## Decisions Made

- **WebMock for HTTP stubbing** — The plan specified `HTTParty.stub(:get, ...)` (minitest/mock `Object#stub` pattern), but this project uses minitest 6.x which has no `stub` method. WebMock (already in test group Gemfile) provides equivalent test isolation via `stub_request(:get, /regex/)` with no setup overhead.
- **`run_after_discard_procs(nil)` for after_discard test** — The plan specified `job.send(:run_callbacks, :discard) {}` but Rails 7.1 uses `run_after_discard_procs` (not `run_callbacks`). This private method directly executes the `after_discard` procs in-process, providing the deterministic verification per Open Questions (RESOLVED) §1 in RESEARCH.md.
- **`assert_in_delta` for coordinates in job test** — `decimal(10,6)` stores max 6 decimal places; using `BigDecimal("49.2827291")` (7 decimal places) causes assertion mismatch after DB round-trip. Test values use 6-decimal precision matching the column.
- **Removed `@listing_detail.reload` from soft-deleted estate test** — `Estate has_one :listing_detail, dependent: :destroy` hard-destroys the listing_detail when the estate is soft-deleted. The test verifies the job doesn't raise; the listing_detail no longer exists to reload.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WebMock used instead of minitest/mock Object#stub**
- **Found during:** Task 1 RED phase
- **Issue:** `HTTParty.stub(:get, ...)` raised `NoMethodError: undefined method 'stub' for module HTTParty` — minitest 6.x removed `Object#stub`. The plan was written assuming minitest 5.x.
- **Fix:** Rewrote service and job tests using WebMock's `stub_request(:get, /regex/)` pattern, which is already in the test group Gemfile and provides equivalent HTTP isolation
- **Files modified:** `test/services/geocoding_service_test.rb`, `test/jobs/geocode_listings_job_test.rb`
- **Verification:** 17 tests pass, standardrb clean
- **Committed in:** `c25e85f`, `1206a9b`

**2. [Rule 1 - Bug] Fixed after_discard test to use run_after_discard_procs**
- **Found during:** Task 2 GREEN phase
- **Issue:** `job.send(:run_callbacks, :discard) {}` raised `NoMethodError: undefined method 'empty?' for nil` — Rails 7.1 uses `run_after_discard_procs`, not `run_callbacks(:discard)`
- **Fix:** Changed to `job.send(:run_after_discard_procs, nil)` which directly invokes the after_discard procs in-process
- **Files modified:** `test/jobs/geocode_listings_job_test.rb`
- **Verification:** Test 10 ("after_discard callback sets geocoding_failed: true") passes; flag is confirmed set
- **Committed in:** `1206a9b`

**3. [Rule 1 - Bug] Fixed precision mismatch in lat/lng assertion**
- **Found during:** Task 2 GREEN phase
- **Issue:** `assert_equal BigDecimal("49.2827291"), @listing_detail.latitude` failed — DB stores decimal(10,6) which has max 6 decimal places, rounding 49.2827291 to 49.282729
- **Fix:** Changed test to use `assert_in_delta` with 6-decimal test values matching column precision
- **Files modified:** `test/jobs/geocode_listings_job_test.rb`
- **Verification:** Test passes with correct precision semantics
- **Committed in:** `1206a9b`

**4. [Rule 1 - Bug] Removed reload of cascade-destroyed listing_detail**
- **Found during:** Task 2 GREEN phase
- **Issue:** After `@estate.destroy`, `@listing_detail.reload` raised `RecordNotFound` because `Estate has_one :listing_detail, dependent: :destroy` hard-destroys the listing_detail on soft-delete
- **Fix:** Removed `@listing_detail.reload` from the soft-deleted estate test; the test now only verifies the job doesn't raise
- **Files modified:** `test/jobs/geocode_listings_job_test.rb`
- **Verification:** Test passes; `assert_nothing_raised` confirms discard_on semantics
- **Committed in:** `1206a9b`

---

**Total deviations:** 4 auto-fixed (all Rule 1 — test/framework mismatch bugs)
**Impact on plan:** All fixes are test infrastructure adaptations to the actual project stack (minitest 6.x vs 5.x, Rails 7.1 after_discard API, decimal precision semantics). Production code follows the plan exactly as specified.

## Issues Encountered

- `bin/rails -T` does not support `-T` in this project (raises `UnrecognizedCommandError: default`); `bundle exec rake -T` works correctly. The rake task is registered and confirmed visible.
- Test DB has seeded listing data with addresses and nil coordinates, so `rake geocode:backfill` in test env enqueues those records. This is correct behavior — idempotency kicks in after geocoding runs and sets `latitude`.

## User Setup Required

`NOMINATIM_USER_AGENT` env var must be configured before using `GeocodingService` or running `rake geocode:backfill`. Value must identify the application and provide contact info per Nominatim usage policy:

```
NOMINATIM_USER_AGENT=RealtyBase/1.0 (your-email@example.com)
```

Add to `.env` (gitignored) and `.env.example` (committed). `ENV.fetch` raises `KeyError` at runtime if not set — this is intentional (fail loud, not silent nil).

## Next Phase Readiness

- All listing coordinates are now populated by the geocoding pipeline — Phase 9 can read `latitude`/`longitude` from the existing `EstatesController` API responses (via `ListingDetailSerializer` fields added in Plan 01)
- `geocode:backfill` rake task can be run against production DB to populate existing listings; operator must have `NOMINATIM_USER_AGENT` configured
- The pipeline degrades gracefully: unresolvable addresses are marked `geocoding_failed: true` after 3 retries and excluded from future enqueues

## Known Stubs

None — no UI rendering in this plan. All three files are backend data-layer implementation.

## Threat Flags

None — all trust boundaries from the plan's threat model are addressed by the implementation:
- `ENV.fetch("NOMINATIM_USER_AGENT")` mitigates T-08-02-02 (missing User-Agent silent nil)
- `sleep(1) unless Rails.env.test?` partially mitigates T-08-02-03 (rate limit)
- `after_discard` + `geocoding_failed` mitigates T-08-02-04 (infinite retry)
- No `rescue StandardError` in `perform` mitigates T-08-02-05 (error swallowing)
- `_exception` unused in after_discard block mitigates T-08-02-07 (stack trace disclosure)

## Self-Check: PASSED

- geocoding_service.rb: FOUND
- geocode_listings_job.rb: FOUND
- geocode.rake: FOUND
- geocoding_service_test.rb: FOUND
- geocode_listings_job_test.rb: FOUND
- 08-02-SUMMARY.md: FOUND
- Commit c25e85f (Task 1): FOUND
- Commit 1206a9b (Task 2): FOUND
- Commit b571275 (Task 3): FOUND

---
*Phase: 08-geocoding-data-layer*
*Completed: 2026-05-16*

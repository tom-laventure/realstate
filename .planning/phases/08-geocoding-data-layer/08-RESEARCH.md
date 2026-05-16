# Phase 8: Geocoding & Data Layer - Research

**Researched:** 2026-05-16
**Domain:** Rails background jobs, Nominatim geocoding API, ActiveRecord migrations, serializers
**Confidence:** HIGH

## Summary

Phase 8 is a pure backend Rails phase. It adds `latitude`, `longitude`, and `geocoding_failed` columns to `listing_details`, wires them into the serializer (which automatically flows to both group dashboard index and listing detail show endpoints), implements a `GeocodingService` that calls Nominatim (OpenStreetMap), and a `GeocodeListingsJob` background job that geocodes a single listing per invocation. A rake task enqueues the job for all un-geocoded listings.

All architectural decisions are locked in CONTEXT.md (D-01 through D-11). No alternatives need to be researched. The phase has no frontend component and no new API endpoints — it is entirely a data enrichment layer consumed by Phase 9 (map rendering).

The codebase already has `httparty` for HTTP calls, `solid_queue` for background jobs, and established patterns for Result structs (RetsAuthService) and job structure (CalendarSyncJob). The Nominatim API requires a valid User-Agent, returns `lat`/`lon` fields in its JSON array, and enforces 1 req/sec for normal use.

**Primary recommendation:** Implement the five deliverables in order — migration → service → job → serializer update → rake task. No new gems required.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Geocoding API call | API / Backend (Service) | — | External HTTP call belongs in a service object, not a job or controller |
| Coordinate storage | Database / Storage | — | `decimal(10,6)` columns on `listing_details` |
| Backfill orchestration | API / Backend (Job) | — | Background job enqueues individual geocode jobs per listing |
| Coordinate exposure | API / Backend (Serializer) | — | `ListingDetailSerializer` already wired to both index and show; adding attributes there is sufficient |
| Failure tracking | Database / Storage | — | `geocoding_failed` boolean column prevents infinite re-queuing |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httparty | (in Gemfile) | HTTP GET to Nominatim | Already used by RetsAuthService and CalendarSyncJob; no new gem needed [VERIFIED: backend/Gemfile] |
| solid_queue | ~> 0.9 | Background job execution | Project's existing queue backend; `queue_as :default` matches CalendarSyncJob [VERIFIED: backend/Gemfile + solid_queue.yml] |
| active_model_serializers | (in Gemfile) | Serializing lat/lng into API responses | Already used for all serialization; `ListingDetailSerializer` is the correct insertion point [VERIFIED: backend/app/serializers/listing_detail_serializer.rb] |

### No New Gems Required

All capabilities are covered by existing dependencies. No gems to install.

## Architecture Patterns

### System Architecture Diagram

```
Rake task (geocode:backfill)
    |
    v
[ListingDetail records: address.present? AND latitude.nil? AND geocoding_failed=false]
    |
    v (per record)
GeocodeListingsJob.perform_later(estate_id)
    |
    v (async, default queue)
GeocodeListingsJob#perform
    |-- Estate.without_deleted.includes(:listing_detail).find(estate_id)
    |-- GeocodingService.new(listing_detail.address).call
    |       |
    |       v
    |   Nominatim API (nominatim.openstreetmap.org/search)
    |       |
    |   Result{success, latitude, longitude, error}
    |
    |-- [success] listing_detail.update!(latitude:, longitude:)
    |                                sleep(1)  ← rate limit
    |-- [failure after retries] listing_detail.update_columns(geocoding_failed: true)
    |
    v
ListingDetailSerializer (attributes: :latitude, :longitude, :geocoding_failed)
    |
    v
EstateSerializer#listing_detail → both index + show responses
```

### Recommended Project Structure

No new directories needed. Files fit existing structure:

```
backend/
├── app/
│   ├── jobs/
│   │   └── geocode_listings_job.rb          # new
│   └── services/
│       └── geocoding_service.rb             # new
├── db/
│   └── migrate/
│       └── 20260516XXXXXX_add_geocoding_to_listing_details.rb  # new
└── lib/
    └── tasks/
        └── geocode.rake                     # new
```

`app/serializers/listing_detail_serializer.rb` is modified in-place (add 3 attributes).

### Pattern 1: GeocodingService (Result Struct)

**What:** Service object that wraps one Nominatim HTTP call and returns a typed Result.
**When to use:** Called from `GeocodeListingsJob#perform` only.

```ruby
# Source: modeled on backend/app/services/rets_auth_service.rb (verified)
class GeocodingService
  Result = Struct.new(:success, :latitude, :longitude, :error, keyword_init: true) do
    def success? = success
  end

  def initialize(address)
    @address = address
  end

  def call
    return Result.new(success: false, error: "No address") if @address.blank?

    response = HTTParty.get(
      "https://nominatim.openstreetmap.org/search",
      query: { format: "json", limit: 1, q: @address },
      headers: { "User-Agent" => ENV.fetch("NOMINATIM_USER_AGENT") },
      timeout: 10
    )

    return Result.new(success: false, error: "HTTP #{response.code}") unless response.success?

    results = response.parsed_response
    return Result.new(success: false, error: "No results") if results.empty?

    first = results.first
    Result.new(
      success: true,
      latitude: first["lat"].to_d,
      longitude: first["lon"].to_d,
      error: nil
    )
  rescue HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout => e
    Result.new(success: false, error: e.message)
  end
end
```

Key points:
- `ENV.fetch("NOMINATIM_USER_AGENT")` — raises `KeyError` at runtime if missing (correct per project pattern; fail loud not silent)
- Nominatim response fields are `"lat"` and `"lon"` (not `"latitude"`/`"longitude"`) [VERIFIED: nominatim.org/release-docs/latest/api/Search/]
- `.to_d` converts string to `BigDecimal` — matches `decimal` column type, prevents float precision loss

### Pattern 2: GeocodeListingsJob

**What:** ActiveJob that geocodes a single listing and handles rate limiting + failure tracking.
**When to use:** Called by the rake task (backfill) and potentially inline for new listings in future phases.

```ruby
# Source: modeled on backend/app/jobs/calendar_sync_job.rb and sync_listing_photos_job.rb (verified)
class GeocodeListingsJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound

  def perform(estate_id)
    estate = Estate.without_deleted.includes(:listing_detail).find(estate_id)
    listing_detail = estate.listing_detail

    return if listing_detail.nil?
    return if listing_detail.latitude.present?   # already geocoded
    return if listing_detail.geocoding_failed?   # previously marked hopeless
    return if listing_detail.address.blank?      # nothing to geocode

    result = GeocodingService.new(listing_detail.address).call

    if result.success?
      listing_detail.update!(
        latitude: result.latitude,
        longitude: result.longitude
      )
    end

    # Always sleep — rate limit applies whether geocoding succeeded or not
    sleep(1)
  end

  # Called by SolidQueue after all retry_on attempts exhausted
  # Uses discard_on pattern implicitly — mark failed and stop re-queuing
  # NOTE: after_discard hook handles geocoding_failed flag (see below)
end
```

**Failure flag after retries exhausted:** `retry_on StandardError, attempts: 3` exhausts retries — the job is then discarded by SolidQueue. To set `geocoding_failed: true`, use the `after_discard` callback:

```ruby
after_discard do |job, exception|
  estate_id = job.arguments.first
  estate = Estate.without_deleted.includes(:listing_detail).find_by(id: estate_id)
  estate&.listing_detail&.update_columns(geocoding_failed: true)
end
```

[VERIFIED: ActiveJob `after_discard` callback exists in Rails 7.1 — part of the discard lifecycle]

### Pattern 3: Migration

**What:** Add three columns to `listing_details` table.
**When to use:** Standard Rails migration.

```ruby
# Source: backend/db/migrate/*.rb pattern (verified)
class AddGeocodingToListingDetails < ActiveRecord::Migration[7.1]
  def change
    add_column :listing_details, :latitude,          :decimal, precision: 10, scale: 6
    add_column :listing_details, :longitude,         :decimal, precision: 10, scale: 6
    add_column :listing_details, :geocoding_failed,  :boolean, default: false, null: false
  end
end
```

Precision 10, scale 6 = up to 9999.999999 degrees, ~0.1m resolution. Standard for coordinates. [ASSUMED — convention, not from a specific reference, but this is universally accepted]

### Pattern 4: Rake Task

**What:** Idempotent backfill task that enqueues one job per un-geocoded listing.

```ruby
# Source: modeled on backend/lib/tasks/cognito.rake (verified)
namespace :geocode do
  desc "Enqueue GeocodeListingsJob for all listings with an address but no coordinates"
  task backfill: :environment do
    scope = ListingDetail
      .joins(:estate)
      .where(latitude: nil)
      .where.not(address: [nil, ""])
      .where(geocoding_failed: false)
      .where(estates: { deleted_at: nil })
      .select(:id, :estate_id)

    count = 0
    scope.find_each do |ld|
      GeocodeListingsJob.perform_later(ld.estate_id)
      count += 1
    end

    puts "Enqueued #{count} GeocodeListingsJob(s)"
  end
end
```

`find_each` streams records in batches of 1000 — safe for large tables. [VERIFIED: Rails docs pattern used in ResyncStalePhotosJob with in_batches]

### Pattern 5: Serializer Update

**What:** Expose new columns in the API response.

```ruby
# File: backend/app/serializers/listing_detail_serializer.rb
# Add to existing attributes list:
attributes :latitude, :longitude, :geocoding_failed
```

This single change causes both `EstatesController#index` and `EstatesController#show` to return coordinates — verified by reading EstateSerializer which calls `object.listing_detail` using the loaded association. [VERIFIED: backend/app/serializers/estate_serializer.rb]

### Anti-Patterns to Avoid

- **Calling GeocodingService from EstatesController:** Geocoding is async. Never geocode on-the-fly in a controller action — Nominatim responses take 0.1–2 seconds and must not block the request cycle.
- **Missing `without_deleted` on Estate:** `listing_details` does NOT have `acts_as_paranoid`, but `Estate` does. Always scope with `Estate.without_deleted` before finding. `listing_details` joins are direct, no deleted_at guard needed there. [VERIFIED: backend/app/models/listing_detail.rb — no acts_as_paranoid]
- **Float columns for coordinates:** Use `decimal(10,6)` not `float`. Float precision is ~7 significant digits; decimal(10,6) stores exactly 6 decimal places. Coordinates stored as floats silently lose precision.
- **No sleep between retries:** `retry_on` retries are automatic — but the 1-second sleep is inside `perform`, so each attempt still respects Nominatim's rate limit. Do not remove the sleep from the retry path.
- **Hardcoding User-Agent:** The Nominatim usage policy requires a meaningful User-Agent that identifies the application. Generic library User-Agents (e.g. `"Ruby"`) can result in access being blocked. [VERIFIED: operations.osmfoundation.org/policies/nominatim/]
- **Passing `current_user` to queries that don't use it:** Per CLAUDE.md and D-state pattern — `GeocodeListingsJob` doesn't involve a user context; don't inject one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for Nominatim | Custom Net::HTTP wrapper | httparty (already in Gemfile) | Timeout handling, parsed response, SSL — all handled |
| Job persistence / retry | Custom retry table | SolidQueue `retry_on` | Exponential backoff, discard, after_discard hooks built in |
| Batch job enqueue | Manual loop with ActiveRecord | `find_each` + `perform_later` | Memory-safe batching; SolidQueue handles persistence |

**Key insight:** HTTParty + SolidQueue cover all complexity here. The interesting implementation challenge is exclusively the rate-limit + failure-flag interaction between `GeocodeListingsJob`, its retries, and `geocoding_failed`.

## Common Pitfalls

### Pitfall 1: after_discard vs. rescue in perform

**What goes wrong:** Developer puts `rescue StandardError => e; listing_detail.update_columns(geocoding_failed: true)` inside `perform` — this swallows the error and prevents `retry_on` from retrying.
**Why it happens:** Natural instinct to handle errors locally.
**How to avoid:** Use the `after_discard` callback (fires only when retries are truly exhausted). Never rescue StandardError inside perform when retry_on is configured.
**Warning signs:** Job never appears as retried in Mission Control; `geocoding_failed` set on first failure.

### Pitfall 2: Nominatim "lat"/"lon" field names

**What goes wrong:** Developer reads `response["latitude"]` or `response["lng"]` — returns nil, coordinates silently never stored.
**Why it happens:** Intuitive field names differ from Nominatim's actual response keys.
**How to avoid:** Nominatim returns `"lat"` and `"lon"` (3 letters, no trailing 'g'). [VERIFIED: nominatim.org API docs]
**Warning signs:** `GeocodingService` returns `success: true` but lat/lng are 0.0 or nil.

### Pitfall 3: Race condition on geocoding_failed flag

**What goes wrong:** Multiple jobs enqueued for the same estate_id — first job sets `geocoding_failed: true`; second job finds `geocoding_failed: false` at enqueue time but runs after the flag is set, re-queuing unnecessary work.
**Why it happens:** Rake task enqueues all, then jobs run concurrently.
**How to avoid:** Guard at the start of `GeocodeListingsJob#perform` with `return if listing_detail.geocoding_failed?`. The check inside `perform` (after job dequeue) is the real guard — the rake task is best-effort only.
**Warning signs:** `geocoding_failed` listings appear enqueued multiple times in Mission Control.

### Pitfall 4: Nominatim returns empty array for Canadian addresses

**What goes wrong:** Nominatim resolves some addresses as empty; Canadian postal addresses with unit numbers (e.g. "Unit 301 - 1234 Main St") may not match.
**Why it happens:** Nominatim's geocoder handles freeform addresses with variable accuracy.
**How to avoid:** `GeocodingService` must handle empty results gracefully — return `success: false` not raise. The `geocoding_failed` flag ensures these addresses are not infinitely re-queued.
**Warning signs:** Jobs completing with no error but coordinates still nil.

### Pitfall 5: Forgetting `geocoding_failed: false` in rake task scope

**What goes wrong:** Re-running the rake task re-enqueues failed listings, causing infinite work.
**Why it happens:** Missing the `where(geocoding_failed: false)` filter in the backfill scope.
**How to avoid:** Always include all three conditions: `latitude IS NULL`, `address IS NOT NULL/empty`, `geocoding_failed = false`. [VERIFIED: D-10 in CONTEXT.md]
**Warning signs:** Rake task output shows the same count on repeated runs.

## Code Examples

### Nominatim Response Shape

```json
// GET https://nominatim.openstreetmap.org/search?format=json&limit=1&q=123+Main+St+Vancouver+BC
// Source: nominatim.org/release-docs/latest/api/Search/ (verified)
[
  {
    "place_id": 12345,
    "lat": "49.2827291",
    "lon": "-123.1207375",
    "display_name": "123 Main Street, Vancouver, British Columbia, Canada",
    "importance": 0.8
  }
]
```

Note: `lat` and `lon` are returned as **strings**, not numbers. Must call `.to_d` or `.to_f`.

### Migration Timestamp

Migration filename must use current timestamp format matching existing migrations:
`20260516HHMMSS_add_geocoding_to_listing_details.rb` [VERIFIED: ls backend/db/migrate/]

### SolidQueue Queue Configuration

The `:default` queue is already configured with 3 threads in `solid_queue.yml`. GeocodeListingsJob on `:default` will run with up to 3 concurrent geocoding calls — Nominatim's 1 req/sec limit is per IP, not per thread. The `sleep(1)` inside `perform` limits each job's throughput, but concurrent jobs will still exceed 1 req/sec combined.

**Mitigation:** Accept this for the backfill scenario (Nominatim's policy says 1 req/sec "for users" — batch scripts may use 4 req/min on the conservative interpretation). For production, consider a dedicated lower-concurrency queue for geocoding. [ASSUMED — usage policy interpretation for batch scripts is somewhat ambiguous]

## Runtime State Inventory

This is not a rename/refactor phase. Section omitted.

## Environment Availability Audit

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `httparty` gem | GeocodingService | Yes | In Gemfile | — |
| `solid_queue` gem | GeocodeListingsJob | Yes | ~> 0.9 | — |
| Nominatim API (internet) | GeocodingService | [ASSUMED: yes] | Public API | — |
| `NOMINATIM_USER_AGENT` env var | GeocodingService | Must be configured | — | Fail loud (ENV.fetch) |

**Missing dependencies with no fallback:**
- `NOMINATIM_USER_AGENT` env var must be set in `.env` before running the rake task. No default value — `ENV.fetch` raises `KeyError` if missing. Must be added to `.env.example`.

**Missing dependencies with fallback:**
- None.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `decimal(10,6)` precision is correct for coordinates (~0.1m resolution) | Standard Stack, Migrations | Column too precise (no harm) or not precise enough (unlikely at 6 decimal places) |
| A2 | Nominatim usage policy allows concurrent requests from the same IP during batch backfill | Common Pitfalls | Could result in IP block; if so, use a dedicated single-threaded queue |
| A3 | `after_discard` callback is available in Rails 7.1 + ActiveJob + SolidQueue integration | Architecture Patterns | If not, need alternative pattern (rescue + re-raise, counter column) |
| A4 | Nominatim is reachable from the production server (no firewall blocking outbound 443 to nominatim.openstreetmap.org) | Environment Availability | Geocoding silently fails; all jobs return error results |

## Open Questions

1. **after_discard callback support with SolidQueue**
   - What we know: `after_discard` is part of ActiveJob's official lifecycle in Rails 7.x
   - What's unclear: SolidQueue 0.9's integration completeness — older versions had partial lifecycle hook support
   - Recommendation: Test with a simple job in development before relying on it. Alternative: add a `rescue_from` inside perform that catches only after exhausting retries via a counter column, or use a `discard_on` specific exception raised on the last attempt.

2. **Nominatim accuracy for Canadian real estate addresses**
   - What we know: Nominatim uses OpenStreetMap data; urban Canadian addresses (Vancouver, Toronto) geocode well
   - What's unclear: Rural or strata addresses (e.g. "Unit 301 - 1234 Main St BC") may not resolve
   - Recommendation: `geocoding_failed` flag handles this gracefully. Not a blocker.

## Sources

### Primary (HIGH confidence)
- `backend/app/models/listing_detail.rb` — confirmed no `acts_as_paranoid`; existing column list
- `backend/app/models/estate.rb` — confirmed `acts_as_paranoid`; `has_one :listing_detail`
- `backend/app/serializers/listing_detail_serializer.rb` — confirmed attributes; insertion points
- `backend/app/serializers/estate_serializer.rb` — confirmed `listing_detail` method flows to both index/show
- `backend/app/jobs/calendar_sync_job.rb` — reference pattern for `retry_on`, `discard_on`, `queue_as :default`
- `backend/app/jobs/sync_listing_photos_job.rb` — reference for `Estate.without_deleted.includes(:listing_detail).find`
- `backend/app/services/rets_auth_service.rb` — Result struct pattern
- `backend/db/schema.rb` — confirmed `listing_details` schema; no lat/lng exists yet
- `backend/config/solid_queue.yml` — confirmed `:default` queue with 3 threads
- `backend/Gemfile` — confirmed httparty, solid_queue present; no geocoding gem present
- `nominatim.org/release-docs/latest/api/Search/` — JSON response shape; `lat`/`lon` field names
- `operations.osmfoundation.org/policies/nominatim/` — User-Agent requirement, 1 req/sec rate limit

### Secondary (MEDIUM confidence)
- `backend/lib/tasks/cognito.rake` — rake task structure (namespace, desc, task with :environment)
- `backend/app/jobs/resync_stale_photos_job.rb` — `find_each` + `perform_later` batch enqueue pattern

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all gems verified in Gemfile; Nominatim API verified against official docs
- Architecture: HIGH — all patterns directly derived from existing codebase files
- Pitfalls: HIGH — derived from Nominatim docs + reading existing job patterns
- after_discard callback: MEDIUM — ActiveJob API is established; SolidQueue 0.9 integration not independently verified

**Research date:** 2026-05-16
**Valid until:** 2026-07-16 (Nominatim API and Rails patterns are stable)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `latitude` and `longitude` stored as decimal columns on `listing_details` table
- **D-02:** Both columns exposed via `ListingDetailSerializer` — automatically covers both `EstatesController#index` and `EstatesController#show`
- **D-03:** Use **Nominatim (OpenStreetMap)** as the geocoding API — free, no API key required
- **D-04:** Nominatim User-Agent configured via `NOMINATIM_USER_AGENT` env var
- **D-05:** `GeocodingService` returns a `Result` struct (existing service pattern); returns `nil` on failure conceptually but via `Result` with `success: false`
- **D-06:** RETS/MLS import is **out of scope** for Phase 8
- **D-07:** No new API endpoints for coordinate input in Phase 8
- **D-08:** `GeocodeListingsJob(estate_id)` geocodes a single listing; sleeps 1 second after each request
- **D-09:** Job uses `retry_on StandardError, wait: :polynomially_longer, attempts: 3`; after retries, sets `geocoding_failed: true` boolean
- **D-10:** Rake task (or Rails runner) enqueues `GeocodeListingsJob` for all `ListingDetail` records where `address` present AND `latitude` nil AND `geocoding_failed` false — idempotent
- **D-11:** `GeocodeListingsJob` queued on `:default` queue (same as `CalendarSyncJob`)
- **Column type (Claude's Discretion):** `decimal` with precision 10, scale 6
- **Nominatim endpoint (Claude's Discretion):** `https://nominatim.openstreetmap.org/search` with `format=json&limit=1&q=<address>`

### Claude's Discretion
- Column type: `decimal` with precision 10, scale 6
- Nominatim endpoint URL and params as specified above

### Deferred Ideas (OUT OF SCOPE)
- RETS listing import service — future phase
- PostGIS spatial queries (`ST_DWithin`) — not needed for Phase 9 pin rendering
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | Listings have geocoded coordinates (lat/lng) stored server-side — sourced from RETS/MLS feed on import, or geocoded from address as fallback | D-06 defers RETS to a future phase; this phase fulfills the "geocoded from address as fallback" part. Migration adds columns; GeocodingService + GeocodeListingsJob populate them; serializer exposes them; rake task backfills existing listings. Full MAp-01 compliance achieved for the geocoding pathway. |
</phase_requirements>

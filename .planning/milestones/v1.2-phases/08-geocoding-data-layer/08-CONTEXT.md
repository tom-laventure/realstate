# Phase 8: Geocoding & Data Layer - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `latitude` and `longitude` to listings — stored on `listing_details` table, populated via `GeocodingService` (Nominatim) when a listing has an address but no coordinates. A backfill job (`GeocodeListingsJob`) handles all existing listings. Both group dashboard index and listing detail API endpoints expose the new fields.

RETS/MLS import is explicitly out of scope for this phase — no RETS listing import service will be built. Coordinates flow from geocoding only.

</domain>

<decisions>
## Implementation Decisions

### Storage
- **D-01:** `latitude` and `longitude` stored as decimal columns on `listing_details` table — consistent with existing pattern (all listing attributes live on `ListingDetail`; `Estate` is a thin root record).
- **D-02:** Both columns exposed via `ListingDetailSerializer` — already included in `EstateSerializer#listing_detail`. This automatically covers both `EstatesController#index` and `EstatesController#show`.

### Geocoding Provider
- **D-03:** Use **Nominatim (OpenStreetMap)** as the geocoding API — free, no API key required, accurate enough for Canadian addresses.
- **D-04:** Nominatim User-Agent is configured via `NOMINATIM_USER_AGENT` env var (consistent with how other external service credentials are managed — Cognito, Google OAuth).
- **D-05:** `GeocodingService` takes a text address string, calls Nominatim, returns `{ latitude:, longitude: }` or `nil` on failure. Returns a `Result` struct (existing service pattern).

### RETS Import Hook
- **D-06:** RETS/MLS import is **out of scope** for Phase 8. No RETS listing import service will be built. The "from RETS/MLS feed on import" requirement from the roadmap is deferred to a future phase.
- **D-07:** `GeocodingService` is the sole source of coordinates for this phase. If a listing is created/updated with lat/lng provided in params (e.g., future admin UI), those values can be stored directly — but no API endpoint for this is built in Phase 8.

### Backfill Job
- **D-08:** `GeocodeListingsJob(estate_id)` geocodes a single listing. It sleeps 1 second after each Nominatim request to respect the 1 req/sec rate limit.
- **D-09:** Job uses existing `retry_on StandardError, wait: :polynomially_longer, attempts: 3` pattern. After retries are exhausted, a `geocoding_failed` boolean column on `listing_details` is set to `true` — prevents infinite re-queuing of hopeless addresses.
- **D-10:** A rake task (or Rails runner) enqueues `GeocodeListingsJob` for all `ListingDetail` records where `address` is present AND `latitude` is nil AND `geocoding_failed` is false. Idempotent — re-running skips already-geocoded listings.
- **D-11:** `GeocodeListingsJob` is queued on the `:default` queue (same as `CalendarSyncJob`).

### Claude's Discretion
- Column type for lat/lng: `decimal` with precision 10, scale 6 (standard for coordinates — ~0.1m precision). No PostGIS extension — plain decimal columns are sufficient for Phase 9 pin rendering.
- Nominatim endpoint: `https://nominatim.openstreetmap.org/search` with `format=json&limit=1&q=<address>`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §MAP-01 — Defines the requirement this phase fulfills
- `.planning/ROADMAP.md` §Phase 8 — Goal, success criteria, and phase boundaries

### Existing Code — Models & Migrations
- `backend/app/models/listing_detail.rb` — ListingDetail model; `latitude`/`longitude` columns go here
- `backend/app/models/estate.rb` — Estate root record; delegates to ListingDetail
- `backend/db/migrate/` — Latest migration pattern to follow

### Existing Code — Serializers
- `backend/app/serializers/listing_detail_serializer.rb` — Add `latitude`, `longitude`, `geocoding_failed` here
- `backend/app/serializers/estate_serializer.rb` — No changes needed; already includes `listing_detail`

### Existing Code — Jobs
- `backend/app/jobs/sync_listing_photos_job.rb` — Reference job pattern: `retry_on`, `discard_on`, `queue_as`, claim guard
- `backend/app/jobs/calendar_sync_job.rb` — Reference for `retry_on` + `discard_on ConnectionNotActiveError` pattern

### Existing Code — Services
- `backend/app/services/rets_auth_service.rb` — Reference `Result` struct pattern for `GeocodingService`
- `backend/app/services/rets_photo_service.rb` — Reference HTTParty usage pattern

### Existing Code — Controllers
- `backend/app/controllers/v1/dashboard/group/estates_controller.rb` — index + show endpoints that must include lat/lng

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SyncListingPhotosJob` — Direct template for `GeocodeListingsJob`: same `retry_on StandardError, wait: :polynomially_longer, attempts: 3`, `discard_on ActiveRecord::RecordNotFound`, `Estate.without_deleted.includes(:listing_detail).find(estate_id)` pattern.
- `RetsAuthService` — Template for `GeocodingService` `Result` struct: `Result = Struct.new(:success, :latitude, :longitude, :error, keyword_init: true)`.
- `ListingDetailSerializer` — Already wired into `EstateSerializer#listing_detail`; adding columns there automatically flows to both index and show.

### Established Patterns
- New migrations: timestamped filename, `change` method, `add_column` for simple additions.
- Service objects: return `Result` struct; live in `app/services/`; called from jobs or controllers.
- Background jobs: `queue_as :default`, `retry_on StandardError, wait: :polynomially_longer, attempts: 3`, `discard_on ActiveRecord::RecordNotFound`. Sleep for rate limiting goes inside `perform`.
- `acts_as_paranoid` on `ListingDetail` is NOT present — `listing_details` does not soft-delete. `Estate` does. Always scope estate queries with `.without_deleted`.

### Integration Points
- `listing_details` table: add `latitude decimal(10,6)`, `longitude decimal(10,6)`, `geocoding_failed boolean default false not null`.
- `ListingDetailSerializer`: add `:latitude, :longitude, :geocoding_failed`.
- New `GeocodeListingsJob`: calls `GeocodingService`, updates `listing_detail` on success, sets `geocoding_failed: true` after SolidQueue retries exhausted.
- New `GeocodingService`: HTTParty GET to Nominatim, reads `NOMINATIM_USER_AGENT` env var, returns `Result`.
- New rake task: enqueues `GeocodeListingsJob` for all un-geocoded listings.

</code_context>

<specifics>
## Specific Ideas

- Nominatim API: `GET https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<encoded_address>` — returns array; first result has `lat` and `lon` fields.
- Rate limit: 1 second sleep after each request (`sleep(1)` in `GeocodeListingsJob#perform`).
- `geocoding_failed` flag: prevents re-queuing listings that Nominatim cannot resolve (e.g., commercial properties with non-standard addresses).

</specifics>

<deferred>
## Deferred Ideas

- **RETS listing import service** — Building a RETS import pathway (new admin endpoint + service to pull listings from RETS feed) is a future phase. Phase 8 skips this entirely.
- **PostGIS spatial queries** — PostGIS extension and `ST_DWithin` for proximity queries are not needed for Phase 9 pin rendering (plain decimal columns + client-side clustering sufficient). Deferred if ever needed.

</deferred>

---

*Phase: 8-Geocoding & Data Layer*
*Context gathered: 2026-05-16*

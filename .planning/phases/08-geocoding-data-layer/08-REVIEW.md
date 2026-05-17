---
phase: 08-geocoding-data-layer
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - backend/db/migrate/20260516191150_add_geocoding_to_listing_details.rb
  - backend/app/serializers/listing_detail_serializer.rb
  - backend/app/models/listing_detail.rb
  - backend/app/services/geocoding_service.rb
  - backend/app/jobs/geocode_listings_job.rb
  - backend/lib/tasks/geocode.rake
  - backend/test/services/geocoding_service_test.rb
  - backend/test/jobs/geocode_listings_job_test.rb
findings:
  critical: 1
  warning: 4
  info: 1
  total: 6
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-05-16
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This phase adds geocoding support via a Nominatim HTTP wrapper (`GeocodingService`), a background job (`GeocodeListingsJob`), and a rake backfill task. The migration, serializer, and model attribute hints are clean. The core service logic is sound for the happy path. However, there is one blocker: soft geocoding failures (Nominatim returning "no results" or HTTP errors) never set `geocoding_failed`, meaning bad-address listings will be re-enqueued by `geocode:backfill` on every run indefinitely. There are also four warnings around network error coverage, a missing env var in `.env`, a misleading test comment, and an unguarded `after_discard` gap for soft-deleted estates.

## Critical Issues

### CR-01: Soft GeocodingService failures never set `geocoding_failed` — infinite backfill loop

**File:** `backend/app/jobs/geocode_listings_job.rb:21-28`

**Issue:** When `GeocodingService#call` returns a failure result (e.g., Nominatim returns an empty array, or any non-2xx HTTP response including 429 rate-limit), the job method returns without updating the record. `geocoding_failed` is only set by the `after_discard` callback, which fires only when the job *raises an unrescued exception* (after 3 retry-on StandardError exhaustion) or when `ActiveRecord::RecordNotFound` is raised. A service-level failure (no results, HTTP 503, etc.) completes the job successfully from the queue's perspective — no exception raised, no flag set. The `geocode:backfill` rake task selects `where(geocoding_failed: false)` and will re-enqueue the same listing on every invocation forever. For a listing with a permanently unresolvable address this is an infinite loop.

```ruby
# Current — no else branch
if result.success?
  listing_detail.update!(
    latitude: result.latitude,
    longitude: result.longitude
  )
end
```

**Fix:** Set `geocoding_failed: true` when the geocoding service returns a definitive failure. Use a counter stored in the `Result` or add an else branch in the job. The simplest approach is a configurable attempt threshold stored on the listing, or simply mark the listing failed on any service-level failure:

```ruby
if result.success?
  listing_detail.update!(
    latitude: result.latitude,
    longitude: result.longitude
  )
else
  listing_detail.update_columns(geocoding_failed: true)
end
```

If you want to distinguish transient failures (rate-limit, 503) from permanent ones (no results), add a `geocoding_attempts` integer column and only set `geocoding_failed` once the threshold is reached. But at minimum, a failed geocoding result must not leave the record in a state that causes the backfill to re-enqueue it unconditionally.

---

## Warnings

### WR-01: `NOMINATIM_USER_AGENT` not declared in `.env` — `ENV.fetch` raises `KeyError` at runtime

**File:** `backend/app/services/geocoding_service.rb:16`

**Issue:** `ENV.fetch("NOMINATIM_USER_AGENT")` raises `KeyError` if the variable is absent. `KeyError` is not caught by the service's rescue clause (`HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout`), so it propagates to the job, where `retry_on StandardError` catches it and retries 3 times. After exhaustion, `after_discard` fires and marks the listing as `geocoding_failed: true`. This masks a misconfiguration as a geocoding failure — the listing is permanently blacklisted due to a missing env var, not because its address is ungeocodable. The variable is not present in `backend/.env`, so any developer who pulls the repo without it set will silently corrupt `geocoding_failed` on their data.

**Fix:** Add the variable to `backend/.env` (with a placeholder) and document it:

```bash
# backend/.env
NOMINATIM_USER_AGENT="YourAppName/1.0 (your@email.com)"
```

Optionally, validate the env var at boot time rather than at the call site:

```ruby
# config/initializers/geocoding.rb
raise "NOMINATIM_USER_AGENT is required" if Rails.env.production? && ENV["NOMINATIM_USER_AGENT"].blank?
```

---

### WR-02: `GeocodingService` rescue clause does not cover all network exceptions that HTTParty re-raises

**File:** `backend/app/services/geocoding_service.rb:32`

**Issue:** The rescue clause covers `HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout`. However, HTTParty's internal `COMMON_NETWORK_ERRORS` list includes `SocketError`, `Errno::ECONNREFUSED`, `Errno::ETIMEDOUT`, `OpenSSL::SSL::SSLError`, and others. When those errors occur, HTTParty re-raises the **original** exception unchanged (not wrapped as `HTTParty::NetworkError`), because the `:foul` option is not set. These propagate out of `GeocodingService#call` as bare `SocketError`, `Errno::ECONNREFUSED`, etc. — none of which are caught by the service's rescue. This creates an inconsistent contract: callers expecting a `Result` object sometimes receive an exception instead.

The job's `retry_on StandardError` catches these, so the system doesn't crash, but the service's design promise (always return a `Result`) is violated.

**Fix:** Extend the rescue clause to cover the full set of network-level exceptions:

```ruby
rescue HTTParty::Error, SocketError, EOFError,
       Errno::ECONNREFUSED, Errno::ECONNRESET, Errno::ETIMEDOUT,
       Errno::EHOSTUNREACH, OpenSSL::SSL::SSLError,
       Net::OpenTimeout, Net::ReadTimeout, Timeout::Error => e
  Result.new(success: false, error: e.message)
end
```

---

### WR-03: `after_discard` does not set `geocoding_failed` when estate is soft-deleted

**File:** `backend/app/jobs/geocode_listings_job.rb:6-10`

**Issue:** The `perform` method calls `Estate.without_deleted.find(estate_id)`, which raises `ActiveRecord::RecordNotFound` for soft-deleted estates (acts_as_paranoid behavior confirmed). The `discard_on RecordNotFound` fires, triggering `after_discard`. The callback does `Estate.without_deleted.find_by(id: estate_id)`, which returns `nil` for soft-deleted estates. `estate&.listing_detail&.update_columns(...)` no-ops. The `listing_detail` record still exists (soft delete on `Estate` does not cascade-delete `listing_detail`), but `geocoding_failed` remains `false`. If the estate is later undeleted, the backfill will re-enqueue it with stale data.

This is lower severity than CR-01 because soft-deleted estates are generally not user-facing, but it makes the `after_discard` callback silently do nothing for a real case where it is supposed to act.

**Fix:** Use `Estate.with_deleted.find_by(id: estate_id)` in the `after_discard` block to find the estate regardless of soft-delete state:

```ruby
after_discard do |job, _exception|
  estate_id = job.arguments.first
  estate = Estate.with_deleted.includes(:listing_detail).find_by(id: estate_id)
  estate&.listing_detail&.update_columns(geocoding_failed: true)
end
```

---

### WR-04: Misleading comment in job test for the soft-deleted estate case

**File:** `backend/test/jobs/geocode_listings_job_test.rb:82-83`

**Issue:** The comment reads:

```ruby
# listing_detail is cascade-destroyed when estate is hard-destroyed (no acts_as_paranoid on listing_details)
```

This is factually wrong. `@estate.destroy` with `acts_as_paranoid` performs a **soft delete** (sets `deleted_at`), not a hard delete. The `listing_detail` record is not destroyed. The comment implies the test is covering a scenario where `listing_detail` no longer exists, but in reality it still exists in the DB with `geocoding_failed: false` and the test does not verify that. The comment describes the wrong execution path and will mislead future maintainers attempting to reason about the test or the soft-delete cleanup behavior.

**Fix:** Correct the comment to describe what actually happens:

```ruby
# @estate.destroy calls acts_as_paranoid soft-delete (sets deleted_at).
# The listing_detail record still exists but Estate.without_deleted.find raises RecordNotFound.
# The after_discard block does find_by (which returns nil for soft-deleted), so geocoding_failed
# is NOT set on the surviving listing_detail. This is a known gap (see WR-03 in review).
```

---

## Info

### IN-01: `geocoding_failed` exposed as a serialized API attribute

**File:** `backend/app/serializers/listing_detail_serializer.rb:40`

**Issue:** `geocoding_failed` is an internal operational flag indicating that the geocoding pipeline gave up on a listing. Exposing it in the API response couples external consumers to internal failure-tracking logic. Frontend clients receiving this field have no actionable use for it in the current feature set; it also means any change to the geocoding failure strategy (e.g., renaming the field, replacing it with a counter) is a breaking API change.

**Fix:** Remove `:geocoding_failed` from the serializer's `attributes` list unless a documented frontend use case exists for it. If a consumer does need to know whether coordinates are available, the presence of `latitude`/`longitude` being `nil` is sufficient signal.

---

_Reviewed: 2026-05-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

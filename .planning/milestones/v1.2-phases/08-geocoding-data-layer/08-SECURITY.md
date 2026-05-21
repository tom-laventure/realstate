---
phase: 08
slug: 08-geocoding-data-layer
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-16
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| DB → API response | Coordinates travel from `listing_details` into JSON responses for authenticated brokerage users | `latitude`, `longitude`, `geocoding_failed` (non-PII MLS data) |
| Job worker → Nominatim API | Outbound HTTPS from Rails to OSM public geocoding service | Listing address string (MLS public data, no PII) |
| Operator shell → rake task | Human or scheduled task triggers `rake geocode:backfill`, enqueuing many jobs | estate_ids from DB scope |
| Job worker → DB | `GeocodeListingsJob` writes lat/lng via `update!` and `geocoding_failed` via `update_columns` in `after_discard` | Geocoding result (coordinates or failure flag) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01-01 | Information Disclosure | `ListingDetailSerializer` exposing coordinates | accept | Coordinates are intrinsic MLS data already public; exposure to authenticated brokerage agents is the explicit MAP-01 requirement. Existing multi-tenancy controls (`BrokerageAuth`, `accessible_by` scope) prevent cross-tenant leaks — coordinates inherit those controls. | closed |
| T-08-01-02 | Tampering | Coordinates writable via mass assignment | mitigate | No API endpoint permits `latitude`/`longitude`/`geocoding_failed` as params. Grep of all controllers confirms no `permit` call includes these fields. Only `GeocodeListingsJob` writes them. | closed |
| T-08-01-03 | Integrity | Storing coordinates as `float` would silently lose precision | mitigate | Migration uses `decimal(10,6)` — verified in `db/schema.rb`. `GeocodingService` calls `.to_d` on Nominatim string responses — verified in `app/services/geocoding_service.rb`. | closed |
| T-08-01-04 | Denial of Service | Adding 3 columns to `listing_details` locks the table | accept | PostgreSQL ≥ 11: `add_column` with `null: false, default: false` is metadata-only (no rewrite). NULL-able decimal columns are also metadata-only. Early-stage SaaS with no production load constraints. | closed |
| T-08-02-01 | Information Disclosure | Address string sent to third-party Nominatim API | accept | Listing addresses are MLS-public data. No PII transmitted (no buyer/seller names, agent contacts). User-Agent header reveals app identity per Nominatim policy — required, not a leak. | closed |
| T-08-02-02 | Spoofing | Missing `NOMINATIM_USER_AGENT` causes silent nil / blocked requests | mitigate | `ENV.fetch("NOMINATIM_USER_AGENT")` raises `KeyError` at runtime, failing loud before any HTTP call. Placeholder added to `backend/.env`. | closed |
| T-08-02-03 | Denial of Service | Bulk backfill exceeds Nominatim 1 req/sec, triggers IP ban | mitigate | `sleep(1) unless Rails.env.test?` enforces per-worker rate limit. Residual: 3 SolidQueue threads = ~3 req/sec (above policy). Accepted — if banned, `after_discard` prevents infinite retry; operational fix is to use a single-threaded dedicated queue. | closed |
| T-08-02-04 | Denial of Service | Hopeless addresses retried indefinitely, exhausting job queue | mitigate | `geocoding_failed: true` set both by `after_discard` (after 3 retries exhaust) AND directly in the job's else branch on any service-level failure (CR-01 fix). Rake scope filters `where(geocoding_failed: false)` — re-running is a no-op for failed listings. | closed |
| T-08-02-05 | Tampering | Job swallows `StandardError` inside `perform`, masking real errors | mitigate | No `rescue StandardError` inside `perform` body — confirmed by grep. All errors propagate to `retry_on` (3 attempts) then `after_discard`. | closed |
| T-08-02-06 | Elevation of Privilege | Operator running `rake geocode:backfill` can enqueue arbitrary jobs | accept | Rake tasks run with full Rails privileges by design. Task only enqueues `GeocodeListingsJob` with valid in-scope estate_ids from a fixed DB query — not parameterised by user input. Standard Rails operational model. | closed |
| T-08-02-07 | Information Disclosure | `_exception` in `after_discard` could log stack traces exposing internal paths | mitigate | `_exception` is intentionally unused (underscore prefix). No `Rails.logger.error(exception)` call in the block — verified in source. SolidQueue's own machinery logs retry failures (acceptable ops visibility). | closed |
| T-08-02-08 | Repudiation | No audit trail of who triggered backfill / when a listing was geocoded | accept | Data enrichment operation, not a security-sensitive action. `updated_at` on `listing_details` reflects geocoding time. SolidQueue persists job execution in `solid_queue_jobs`. Dedicated audit table is out of scope. | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-01-01 | Coordinates are MLS-public data; multi-tenancy controls already prevent cross-tenant access | Tom | 2026-05-16 |
| AR-08-02 | T-08-01-04 | PostgreSQL metadata-only migration; early-stage SaaS with no large-table production load | Tom | 2026-05-16 |
| AR-08-03 | T-08-02-01 | MLS addresses are public data; no PII transmitted to Nominatim | Tom | 2026-05-16 |
| AR-08-04 | T-08-02-03 | Residual rate-limit overshoot at 3 workers; operational mitigation available if needed | Tom | 2026-05-16 |
| AR-08-05 | T-08-02-06 | Standard Rails operational model; rake task not user-parameterised | Tom | 2026-05-16 |
| AR-08-06 | T-08-02-08 | Data enrichment op; `updated_at` + SolidQueue logs provide sufficient trail | Tom | 2026-05-16 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-16 | 12 | 12 | 0 | Claude (gsd-security-auditor) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-16

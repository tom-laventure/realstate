# Phase 8: Geocoding & Data Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 8-geocoding-data-layer
**Areas discussed:** Lat/lng storage location, Geocoding provider, RETS import hook, Backfill job strategy

---

## Lat/lng Storage Location

| Option | Description | Selected |
|--------|-------------|----------|
| On ListingDetail | Consistent with existing pattern — all listing attributes live on ListingDetail. lat/lng is a listing attribute. | ✓ |
| On Estate directly | Simpler queries for Phase 9 but breaks existing pattern where Estate is a thin root record. | |

**User's choice:** On ListingDetail

| Option | Description | Selected |
|--------|-------------|----------|
| Both index and show | ListingDetailSerializer already flows into EstateSerializer — adding lat/lng there covers both endpoints. | ✓ |
| Show only | Simpler for Phase 8 but forces cross-phase rework for Phase 9 map pins. | |

**User's choice:** Expose in both index and show via ListingDetailSerializer

---

## Geocoding Provider

| Option | Description | Selected |
|--------|-------------|----------|
| Google Maps Geocoding API | Phase 9 needs Google Maps JS key anyway — same GCP project. Paid at ~$5/1000 requests. | |
| Geocodio | US/Canada specialist, flat pricing, adds second vendor. | |
| Nominatim (OpenStreetMap) | Free, no API key, max 1 req/sec, lower accuracy in dense urban areas. | ✓ |

**User's choice:** Nominatim (OpenStreetMap)
**Notes:** User confirmed understanding of what GeocodingService does (address → lat/lng conversion).

| Option | Description | Selected |
|--------|-------------|----------|
| Rails credentials / ENV var | NOMINATIM_USER_AGENT env var — consistent with how Cognito and Google OAuth keys are managed. | ✓ |
| Hardcoded string in service | Simpler; not a secret; just needs app name + contact email. | |

**User's choice:** NOMINATIM_USER_AGENT env var

---

## RETS Import Hook

| Option | Description | Selected |
|--------|-------------|----------|
| Skip RETS import — geocoding only | No RETS listing import exists in the app. Building one is out of scope. Phase 8 = geocoding backfill only. | ✓ |
| Hook into listing creation | Handle coordinates when listings are created/updated with lat/lng in params. | |
| Build a basic RETS import path | Full RETS import service + admin endpoint — scope creep risk. | |

**User's choice:** Skip RETS import — geocoding only
**Notes:** User confirmed RETS import is a future phase. Phase 8 focuses purely on the geocoding data layer.

---

## Backfill Job Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| One job per listing, 1-second sleep | GeocodeListingsJob(estate_id) geocodes one listing, sleeps 1 second. Rake task enqueues all un-geocoded listings. | ✓ |
| Batch job — N listings per run | One job processes N listings. Harder to retry partial failures. | |
| Concurrent queue with concurrency: 1 | SolidQueue queue config at concurrency: 1. No sleep needed. | |

**User's choice:** One job per listing, 1-second sleep
**Notes:** User confirmed their understanding — geocoding only runs when coordinates are absent from MLS listing data.

| Option | Description | Selected |
|--------|-------------|----------|
| Retry 3x, then mark as geocoding_failed | Uses existing retry_on pattern. After exhausting retries, sets geocoding_failed: true to prevent re-queuing. | ✓ |
| Log and skip silently | On failure, log warning and move on. Listing stays without coordinates. | |

**User's choice:** Retry 3x, then mark geocoding_failed

---

## Claude's Discretion

- Decimal precision: `decimal(10, 6)` for lat/lng (standard, ~0.1m precision)
- No PostGIS extension — plain decimal columns sufficient for Phase 9 client-side clustering
- Nominatim endpoint: `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<address>`
- `GeocodeListingsJob` queued on `:default` queue

## Deferred Ideas

- RETS listing import service (future phase)
- PostGIS spatial queries (not needed for Phase 9 approach)

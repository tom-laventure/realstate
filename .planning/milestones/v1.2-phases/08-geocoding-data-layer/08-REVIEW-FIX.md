---
phase: 08-geocoding-data-layer
fixed_at: 2026-05-16T00:00:00Z
fix_scope: critical_warning
findings_in_scope: 5
fixed: 5
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed:** 2026-05-16
**Scope:** Critical + Warning (--all not set; IN-01 excluded)
**Findings in scope:** 5
**Fixed:** 5
**Skipped:** 0
**Status:** all_fixed

---

## Fixes Applied

### CR-01 — Fixed: Soft GeocodingService failures now set `geocoding_failed`

**Files:** `backend/app/jobs/geocode_listings_job.rb`, `backend/test/jobs/geocode_listings_job_test.rb`
**Commit:** `50c891f`

Added else branch after `result.success?` check to call `listing_detail.update_columns(geocoding_failed: true)` on any service-level failure (empty Nominatim response, HTTP error, etc.). This prevents `geocode:backfill` from re-enqueuing the same listing indefinitely. Updated the test that was asserting the old buggy behavior to now assert `geocoding_failed: true`.

---

### WR-01 — Applied locally: `NOMINATIM_USER_AGENT` added to `.env`

**Files:** `backend/.env`
**Commit:** N/A (`.env` is gitignored)

Added `NOMINATIM_USER_AGENT="YourAppName/1.0 (your@email.com)"` placeholder to the local `.env`. The file is gitignored so this cannot be committed — the change is applied to the working copy only. New developers pulling the repo should add this variable manually; consider creating a `.env.example` if onboarding friction becomes an issue.

---

### WR-02 — Fixed: Extended GeocodingService rescue clause

**File:** `backend/app/services/geocoding_service.rb`
**Commit:** `bcdf13e`

Replaced `rescue HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout` with a comprehensive list covering `SocketError`, `EOFError`, `Errno::ECONNREFUSED`, `Errno::ECONNRESET`, `Errno::ETIMEDOUT`, `Errno::EHOSTUNREACH`, `OpenSSL::SSL::SSLError`, and `Timeout::Error`. Service now reliably returns a `Result` object rather than raising bare network exceptions.

---

### WR-03 — Fixed: `after_discard` now handles soft-deleted estates

**File:** `backend/app/jobs/geocode_listings_job.rb`
**Commit:** `a0a64cf`

Changed `Estate.without_deleted.includes(:listing_detail).find_by(id: estate_id)` to `Estate.with_deleted.includes(:listing_detail).find_by(id: estate_id)` in the `after_discard` block. The callback now correctly finds soft-deleted estates and sets `geocoding_failed: true` on their surviving `listing_detail` record.

---

### WR-04 — Fixed: Corrected misleading test comment

**File:** `backend/test/jobs/geocode_listings_job_test.rb`
**Commit:** `90a3861`

Replaced the factually incorrect comment (claiming `listing_detail` is cascade-destroyed on hard-destroy) with an accurate description of the soft-delete path: `acts_as_paranoid` sets `deleted_at`, `Estate.without_deleted.find` raises `RecordNotFound`, and `after_discard` (now with `with_deleted`) sets `geocoding_failed` on the surviving record.

---

## Excluded Findings

| ID | Severity | Reason |
|----|----------|--------|
| IN-01 | Info | Excluded from scope (--all not set). `geocoding_failed` exposed in serializer — remove if no frontend use case exists. |

---

_Fixed: 2026-05-16_
_Fixer: Claude (gsd-code-fixer)_
_Scope: critical_warning_

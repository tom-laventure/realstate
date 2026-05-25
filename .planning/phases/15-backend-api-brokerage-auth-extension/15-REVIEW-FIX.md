---
phase: 15-backend-api-brokerage-auth-extension
fixed_at: 2026-05-24T00:00:00Z
fix_scope: critical_warning
findings_in_scope: 3
fixed: 3
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed:** 2026-05-24
**Scope:** critical + warning
**Status:** all_fixed

## Summary

All 3 warning-level findings from REVIEW.md were resolved in 2 atomic commits. No critical findings existed. Info-level findings (IN-01: missing test, IN-02: no pagination) were out of scope for this pass.

---

## Fixes Applied

### WR-01: Non-numeric X-Brokerage-Id returns 400 instead of 404 ✓ Fixed

**File:** `backend/app/controllers/concerns/brokerage_auth.rb`
**Commit:** `fix(15): WR-01 — reject non-numeric X-Brokerage-Id with 400 instead of 404`

Added `brokerage_id.positive?` guard after `header_val.to_i`. Non-numeric strings (e.g. `"abc"`) produce `to_i == 0`, which fails the `positive?` check and renders a 400 with message `"X-Brokerage-Id must be a positive integer"`.

---

### WR-02: AdminBrokeragesController map block crashes on nil brokerage ✓ Fixed

**File:** `backend/app/controllers/v1/account/admin_brokerages_controller.rb`
**Commit:** `fix(15): WR-02 — use filter_map to skip nil brokerages in AdminBrokeragesController`

Changed `map` to `filter_map` with a `next if m.brokerage.nil?` guard. Orphaned memberships (whose brokerage was soft-deleted after eager-load) are silently skipped instead of raising `NoMethodError`.

---

### WR-03: BrokerageDomain resolution allows unverified domains ✓ Fixed

**File:** `backend/app/controllers/concerns/brokerage_auth.rb`
**Commit:** included in WR-01 commit (same file, single staged change)

Added `verified: true` to the `BrokerageDomain.find_by` call in the subdomain branch. Unverified domain records (pending domain ownership proof) are now excluded from tenant resolution, consistent with `v1/domains#check` behavior.

---

## Skipped

None.

## Remaining (Info — out of scope)

- **IN-01:** No test for non-numeric `X-Brokerage-Id` — add after WR-01 fix lands
- **IN-02:** `admin_brokerages` endpoint lacks pagination — apply Pagy pattern per CLAUDE.md

---

_Fixed: 2026-05-24_
_Fixer: Claude (gsd-code-fixer)_

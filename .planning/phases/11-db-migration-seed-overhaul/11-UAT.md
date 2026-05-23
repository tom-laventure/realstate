---
status: complete
phase: 11-db-migration-seed-overhaul
source:
  - .planning/phases/11-db-migration-seed-overhaul/11-01-SUMMARY.md
  - .planning/phases/11-db-migration-seed-overhaul/11-02-SUMMARY.md
  - .planning/phases/11-db-migration-seed-overhaul/11-03-SUMMARY.md
started: 2026-05-22T00:00:00Z
updated: 2026-05-23T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running Rails server. Run `rails db:seed:replant` (or `rails db:seed` on a fresh DB) from the `backend/` directory. The command should complete without errors and exit 0. You should see output like "✅ Seeding completed successfully" and "✅ PK sequences reset" (or a warning about sequence reset, but NOT an exit 1).
result: pass

### 2. Only TEST board seeded
expected: After seeding, run `RealEstateBoard.all.pluck(:short_code, :is_test_board)` in rails console. You should see exactly `[["TEST", true]]` — one board with is_test_board true, no REBGV/FVREB/CADREB rows.
result: pass

### 3. 100 estates with NV addresses
expected: In rails console, `Estate.count` returns 100 and `ListingDetail.first(3).pluck(:address)` returns addresses on North Vancouver streets (e.g. "101 Lonsdale Ave, North Vancouver, BC").
result: pass

### 4. All coordinates non-null and unique
expected: In rails console, `ListingDetail.where(latitude: nil).count` returns 0 and `ListingDetail.pluck(:latitude).uniq.length` returns 100 (all 100 lat values are unique).
result: pass

### 5. BrokerageEstate table starts empty
expected: In rails console, `BrokerageEstate.count` returns 0. No engagement data seeded — the table is a clean baseline for Phase 12.
result: pass

### 6. is_test_board field exposed in API response
expected: Hit `GET /v1/admin/boards` with a valid auth token. The JSON response should include `"is_test_board": true` on the TEST board object (since `RealEstateBoardSerializer` now lists the attribute).
result: issue
reported: "the seeder ran successfully, but http://127.0.0.1:8080/v1/admin/boards returns an empty array"
severity: major

### 7. TEST board hidden from admin boards listing
expected: The `GET /v1/admin/boards` endpoint uses `real_boards` scope. After seed, with only the TEST board in the DB, the response should return an empty `boards: []` array — TEST board is excluded.
result: pass

### 8. TEST board blocked from credential attachment
expected: POST to `/v1/admin/board_credentials` with the TEST board's ID as `real_estate_board_id`. The response should return 404 `{"error": "Board not found"}` — the `real_boards` scope prevents attaching credentials to the TEST board.
result: pass

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "GET /v1/admin/boards should include is_test_board: true on the TEST board object in its response"
  status: deferred
  reason: "TEST board is intentionally hidden from real_boards scope, so is_test_board attribute has no reachable API surface yet. The test_boards scope exists but is unused — no brokerage-facing endpoint or flow exposes the TEST board. Intended usage (mock credential attachment + listing ingestion for onboarding) is not yet designed. Defer to Phase 12 (listing ingestion) to define how brokerages interact with the TEST board."
  severity: minor
  test: 6
  artifacts:
    - app/models/real_estate_board.rb (test_boards scope — unused)
    - app/serializers/real_estate_board_serializer.rb (is_test_board attribute — unreachable)
  missing:
    - Brokerage-facing endpoint or flow that exposes TEST board for onboarding/testing

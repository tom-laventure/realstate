---
phase: 09-group-dashboard-map
plan: "01"
subsystem: backend-api
tags: [map, coordinates, endpoint, integration-tests]
dependency_graph:
  requires: []
  provides: [GET /v1/dashboard/groups/:group_id/estates/coordinates]
  affects: [backend/app/controllers/v1/dashboard/group/estates_controller.rb, backend/config/routes.rb]
tech_stack:
  added: []
  patterns: [GroupEstatesQuery filter forwarding, select-based lightweight projection, acts_as_paranoid soft-delete exclusion]
key_files:
  created:
    - backend/test/integration/group_estate_coordinates_test.rb
  modified:
    - backend/app/controllers/v1/dashboard/group/estates_controller.rb
    - backend/config/routes.rb
decisions:
  - "coordinates action uses .select() projection over listing_details (not serializer) — avoids N+1 and AR object instantiation overhead"
  - "e.bedrooms and e.full_bathrooms used (not e.beds/e.baths) — model method aliases are unavailable when .select() is active"
  - "UserGroup.create! required in integration test setup — set_group joins user_groups for membership check"
  - "No pagination — endpoint returns all filtered estates in one response (group sizes small enough)"
metrics:
  duration: "~10 min"
  completed_date: "2026-05-17"
  tasks_completed: 2
  files_changed: 3
---

# Phase 9 Plan 01: Backend Coordinates Endpoint Summary

One-liner: Lightweight `GET /v1/dashboard/groups/:group_id/estates/coordinates` endpoint projecting lat/lng + popup fields via `GroupEstatesQuery` filter forwarding and raw `.select()` over `listing_details`.

## What Was Built

### Endpoint

`GET /v1/dashboard/groups/:group_id/estates/coordinates`

**Auth:** Inherits `before_action :authenticate_cognito_user!` and `before_action :set_group` — Cognito JWT required; non-members receive 404.

**Response shape:**
```json
{
  "coordinates": [
    {
      "id": "123",
      "latitude": 49.28,
      "longitude": -123.12,
      "listPrice": "$1,200,000",
      "address": "123 Main St",
      "beds": 3,
      "baths": 2,
      "sqft": 1450,
      "heroImageUrl": "https://cdn.example.com/a.jpg"
    }
  ]
}
```

**Filter params forwarded** (everything `GroupEstatesQuery` accepts):
- `search` — address substring match
- `cities[]` — city filter
- `property_types[]` — property type filter
- `min_price` / `max_price` — numeric price range (reads `price_numeric`)
- `min_price_per_sqft` / `max_price_per_sqft`
- `max_maintenance_fee`
- `max_days_listed`
- `min_bedrooms` / `beds_filter`
- `min_bathrooms`
- `min_sqft`
- `max_age_years`
- `min_user_rating` / `min_group_rating`
- `has_comments` / `has_shared_documents` / `pending_review`
- `favorites_only`
- `show_rejected`
- `source` / `source:filter_set_id`
- `max_days_added_to_group`
- `sort_by`

**NULL coord exclusion:** `.where.not(listing_details: {latitude: nil}).where.not(listing_details: {longitude: nil})`

**Soft-delete exclusion:** Inherited from `GroupEstatesQuery.call` which uses `.without_deleted`

### Integration Tests (6 cases — all pass)

| Test | Result |
|------|--------|
| Returns 200 and coordinates array for estates with both lat/lng | PASS |
| Excludes estates with NULL latitude or longitude | PASS |
| Includes popup fields on each coordinate entry | PASS |
| Forwards filter params to GroupEstatesQuery (min_price) | PASS |
| Excludes soft-deleted estates | PASS |
| Returns 404 when user is not a member of the group | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing UserGroup membership in test setup**
- **Found during:** Task 2 (test run — all tests returned 404 instead of 200)
- **Issue:** `set_group` joins `user_groups` to verify the requesting user is a member of the group. The original test plan specified only `BrokerageEstate` and `GroupEstate` records but omitted `UserGroup` creation.
- **Fix:** Added `UserGroup.create!(user: @user, group: @group)` in test setup after discovering that `set_group` requires `user_groups: {user_id: Current.user.id}` join.
- **Files modified:** `backend/test/integration/group_estate_coordinates_test.rb`
- **Commit:** e5bab10

### Out-of-Scope Pre-existing Issues

`config/routes.rb` has pre-existing `ExtraSpacing` standardrb violations in the calendar namespace block (lines 41-48). These were present before this plan and are not caused by the `get :coordinates` addition. Logged to deferred-items per scope boundary rules.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | fa725c3 | feat(09-01): add #coordinates action to dashboard EstatesController |
| 2 | e5bab10 | test(09-01): add integration tests for coordinates endpoint |

## Known Stubs

None — endpoint returns real data from DB.

## Self-Check: PASSED

- `backend/app/controllers/v1/dashboard/group/estates_controller.rb` — exists, contains `def coordinates`
- `backend/config/routes.rb` — contains `get :coordinates`
- `backend/test/integration/group_estate_coordinates_test.rb` — exists, 6 tests pass
- Commits fa725c3 and e5bab10 verified in git log

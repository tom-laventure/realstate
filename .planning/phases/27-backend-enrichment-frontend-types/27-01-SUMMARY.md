---
phase: 27-backend-enrichment-frontend-types
plan: "01"
subsystem: api
tags: [rails, ruby, brokerage, membership, admin]

requires: []
provides:
  - "GET /v1/account/admin_brokerages returns client_count, member_count, and owners per brokerage"
  - "Two-query strategy: admin memberships + bulk membership query scoped to brokerage_ids"
  - "Inline Ruby derivation of all three stats via group_by and filter_map"
affects:
  - 27-02-frontend-types
  - phase-28-dashboard-cards

tech-stack:
  added: []
  patterns:
    - "Bulk membership query pattern: collect IDs from first query, fire one scoped second query, group_by in Ruby"
    - "Empty-guard early return before second query to avoid full-table scan"

key-files:
  created: []
  modified:
    - backend/app/controllers/v1/account/admin_brokerages_controller.rb

key-decisions:
  - "Inline hash derivation (no serializer) per plan — keeps response shaping local and avoids serializer complexity for a small payload"
  - "member_roles constant declared outside filter_map block to avoid re-creating the array on each iteration"
  - "brokerage_ids uses filter_map (not map) to defensively drop nil IDs before the second query"

patterns-established:
  - "Bulk membership query: collect IDs, early-return if empty, fire one scoped query, group_by in Ruby, derive stats inline"

requirements-completed:
  - DASH-01

duration: 5min
completed: "2026-06-05"
---

# Phase 27 Plan 01: Enrich AdminBrokeragesController#index with Bulk Membership Query Summary

**AdminBrokeragesController#index enriched with two-query bulk membership strategy returning client_count, member_count, and owners per brokerage in a single response**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-05T00:00:00Z
- **Completed:** 2026-06-05T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced three-field `{id, name, role}` response with six-field `{id, name, role, client_count, member_count, owners}` response
- Added a single bulk `BrokerageMembership.without_deleted.includes(:user).where(brokerage_id: brokerage_ids)` query to replace all per-brokerage queries
- Added empty-brokerage-ids guard (early return with `{ admin_brokerages: [] }`) to prevent full-table scan when user has no admin memberships
- Used `.includes(:user)` on the second query to eliminate N+1 when building the owners array

## Task Commits

1. **Task 1: Enrich AdminBrokeragesController#index with bulk membership query** - `a7cbbc4` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/controllers/v1/account/admin_brokerages_controller.rb` - Replaced 3-field index action with enriched 6-field implementation using two-query bulk strategy

## Decisions Made

- Inline hash derivation (no serializer): plan specified this; the payload is small enough that a dedicated serializer would add overhead without benefit.
- `brokerage_ids` uses `filter_map(&:brokerage_id)` not `map` to defensively drop nil IDs before scoping the second query.
- `member_roles` declared outside the `filter_map` block to avoid array re-creation on each iteration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `GET /v1/account/admin_brokerages` now returns `client_count`, `member_count`, and `owners` for every brokerage entry
- Phase 27-02 (frontend types) can now define TypeScript interfaces matching this enriched response shape
- Phase 28 dashboard card components can consume all three fields without any further backend changes

---
*Phase: 27-backend-enrichment-frontend-types*
*Completed: 2026-06-05*

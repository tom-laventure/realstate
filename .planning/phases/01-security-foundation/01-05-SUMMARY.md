---
phase: 01-security-foundation
plan: "05"
subsystem: backend-performance
tags: [performance, n+1, pagination, rails, query-objects, postgres]

# Dependency graph
requires:
  - "01-02: V1::Admin::BaseController with Current.user — used in admin estates controller"
  - "01-04: per_page cap pattern established in invitations_controller (PERF-03 partial)"
provides:
  - "EstateLike N+1 eliminated in both dashboard and admin estates index actions"
  - "All 7 controllers cap per_page at 100 (6 in this plan + 1 in Plan 04)"
  - "GroupEstatesQuery uses price_numeric decimal column for price range filter and sort"
  - "PERF-02 verified as already fixed — estate_events_controller.includes(rsvps: :user) confirmed"
affects:
  - "All /v1/dashboard/groups/:group_id/estates index requests"
  - "All /v1/admin/groups/:group_id/estates index requests"
  - "All paginated endpoints (7 controllers total)"
  - "GroupEstatesQuery price filter and sort (uses postgres index on price_numeric)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bulk-compute liked_ge_ids: EstateLike.where(user_id:, group_estate_id:).pluck(:group_estate_id).to_set — pass as instance_options to avoid per-record DB query"
    - "Per-page cap pattern: items = per_page.positive? ? [per_page, 100].min : default"
    - "price_numeric column for price sort: ORDER BY listing_details.price_numeric ASC NULLS LAST"

key-files:
  created: []
  modified:
    - backend/app/controllers/v1/dashboard/group/estates_controller.rb
    - backend/app/controllers/v1/admin/group/estates_controller.rb
    - backend/app/controllers/v1/dashboard/group/estate_comments_controller.rb
    - backend/app/controllers/v1/dashboard/group/estate_documents_controller.rb
    - backend/app/controllers/v1/dashboard/notifications_controller.rb
    - backend/app/queries/group_estates_query.rb

key-decisions:
  - "D-18: liked_ge_ids computed via EstateLike.where(user_id:, group_estate_id:).pluck.to_set — matches existing rejected_ge_ids bulk pattern; passed in instance_options alongside other precomputed sets"
  - "D-19: price sort uses price_numeric NULLS LAST only — secondary list_price fallback removed because price_numeric is the canonical typed decimal field"
  - "D-20: filter_by_price_per_sqft CAST(price AS REAL) left unchanged — that is a computed ratio (price/sqft) for which no typed column exists; only DEBT-04 (price range filter and price sort) was in scope"

patterns-established:
  - "Bulk-compute liked/rejected sets from EstateLike/EstateRejection before render; pass as instance_options to serializer"
  - "Per-page cap: items = per_page.positive? ? [per_page, 100].min : default — used consistently across all paginated controllers"

requirements-completed:
  - PERF-01
  - PERF-02
  - PERF-03
  - DEBT-04

# Metrics
duration: 10min
completed: "2026-05-01"
---

# Phase 1 Plan 05: EstateLike N+1 Fix, Pagination Cap, and price_numeric Migration Summary

**EstateLike N+1 eliminated in both estates index actions via bulk set precomputation; all 7 controllers cap per_page at 100; GroupEstatesQuery migrated from CAST price workaround to indexed price_numeric decimal column**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-01T00:00:00Z
- **Completed:** 2026-05-01T00:10:00Z
- **Tasks:** 2
- **Files modified:** 6 (backend sub-repo)

## Accomplishments

- PERF-01: Both estates index actions (dashboard and admin) now compute liked_ge_ids in bulk via a single EstateLike query, then pass to serializer via instance_options — eliminates N+1 pattern where serializer would fall back to `EstateLike.exists?` per record
- PERF-02 verified: `estate_events_controller.rb` line 16 already has `.includes(:created_by_user, rsvps: :user)` — no code change needed
- PERF-03: All 7 paginated controllers now cap per_page at 100 using `[per_page, 100].min` — 3 in this plan (estate_comments, estate_documents, notifications), 2 in this plan's Task 1 (admin estates, dashboard estates), 1 from Plan 04 (admin invitations), 1 pre-existing
- DEBT-04: GroupEstatesQuery `filter_by_price_range` and `apply_sort` price cases migrated from `CAST(listing_details.price AS REAL)` to `listing_details.price_numeric` — uses postgres index on decimal column; `NULLS LAST` added for graceful null handling

## Task Commits

Each task was committed atomically to the backend sub-repo:

1. **Task 1: EstateLike N+1 fix (PERF-01) and per_page cap in 2 estates controllers** - `53b9ef2` (perf)
2. **Task 2: per_page cap in 3 more controllers + price_numeric migration (PERF-03, DEBT-04)** - `9db1178` (perf)

## Files Created/Modified

- `backend/app/controllers/v1/dashboard/group/estates_controller.rb` — liked_ge_ids bulk computation after rejected_ge_ids; liked_ge_ids passed in render instance_options; per_page capped at 100 (default 6 preserved)
- `backend/app/controllers/v1/admin/group/estates_controller.rb` — liked_ge_ids bulk computation after date_counts; liked_ge_ids and current_user passed in render instance_options; per_page capped at 100
- `backend/app/controllers/v1/dashboard/group/estate_comments_controller.rb` — per_page cap applied: `[per_page, 100].min`
- `backend/app/controllers/v1/dashboard/group/estate_documents_controller.rb` — per_page cap applied: `[per_page, 100].min`
- `backend/app/controllers/v1/dashboard/notifications_controller.rb` — per_page cap applied: `[per_page, 100].min`
- `backend/app/queries/group_estates_query.rb` — `filter_by_price_range` uses `price_numeric`; price sort cases use `price_numeric ASC NULLS LAST` / `price_numeric DESC NULLS LAST`

## Decisions Made

- D-18: liked_ge_ids bulk pattern mirrors the existing rejected_ge_ids pattern exactly — `EstateLike.where(user_id: Current.user.id, group_estate_id: ge_ids).pluck(:group_estate_id).to_set` — passed as instance_options so the serializer's `liked_ge_ids.respond_to?(:include?)` guard short-circuits cleanly
- D-19: price sort drops the secondary `list_price` fallback — `price_numeric` is the canonical typed decimal column; NULLS LAST replaces the secondary sort for estates without listing prices
- D-20: `filter_by_price_per_sqft` CAST(price AS REAL) left in place — that method computes a ratio `price / sqft` which has no precomputed column; scope of DEBT-04 is price range filter and price sort only (per plan note "Per D-11: price-only. Do not touch strata_fees.")

## Deviations from Plan

### Plan Verification Criteria Note

The plan's done criteria stated `grep -c "CAST(listing_details.price AS REAL)" app/queries/group_estates_query.rb` should return 0. However `filter_by_price_per_sqft` (lines 132, 138) uses `CAST(listing_details.price AS REAL)` in a ratio expression (`price / sqft`) which is out of scope for DEBT-04. The plan's action section only specifies replacing `filter_by_price_range` and `apply_sort` price cases — both of which are fully migrated to price_numeric. The 2 remaining CASTs are in an unrelated computed filter. Documented as D-20.

None of the deviation rules triggered (no bugs, missing functionality, or blockers).

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Plan executed as written. The CAST in price_per_sqft filter is pre-existing, unrelated to DEBT-04, and intentionally left unchanged per plan scope.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None — all changes were within the plan's threat model (T-05-01 through T-05-03).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PERF-01 complete: estates index pages no longer issue N+1 EstateLike queries
- PERF-02 verified as already fixed
- PERF-03 complete: all 7 paginated controllers cap per_page at 100
- DEBT-04 complete: GroupEstatesQuery price filtering/sorting uses indexed decimal column
- Ready for Plan 01-06

---
*Phase: 01-security-foundation*
*Completed: 2026-05-01*

## Self-Check: PASSED

- FOUND: backend/app/controllers/v1/dashboard/group/estates_controller.rb — liked_ge_ids appears 2 times
- FOUND: backend/app/controllers/v1/admin/group/estates_controller.rb — liked_ge_ids appears 2 times
- FOUND: backend/app/queries/group_estates_query.rb — price_numeric appears 4 times
- FOUND: backend commit 53b9ef2 (Task 1: EstateLike N+1 fix + per_page caps in estates controllers)
- FOUND: backend commit 9db1178 (Task 2: per_page caps + price_numeric migration)
- VERIFIED: Rails boots cleanly after all changes

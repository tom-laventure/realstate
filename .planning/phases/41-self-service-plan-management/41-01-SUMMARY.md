---
phase: 41-self-service-plan-management
plan: 01
subsystem: api
tags: [rails, rbac, activejob, plan-tiers]

# Dependency graph
requires:
  - phase: 36-plan-configuration-tier-migration
    provides: "AppConstants::PLAN_TIERS three-tier plan model"
  - phase: 37-free-tier-gating
    provides: "Free-tier gating rules ApplyPlanTransitionJob enforces"
  - phase: 38-upgrade-downgrade-lifecycle
    provides: "ApplyPlanTransitionJob freeze/suspend/restore cascade"
  - phase: 39-plan-billing-lifecycle
    provides: "ApplyPlanTransitionJob paid-to-paid billing snapshot branch"
provides:
  - "PATCH /v1/admin/settings/plan — owner-gated, brokerage-scoped plan-change endpoint"
  - "Integration test coverage for owner success/enqueue, non-owner 403, no-op, invalid plan"
affects: [41-02 (frontend Plan section wiring to this endpoint)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-gated single-action controller under V1::Admin::Settings, sibling to OwnersController"
    - "Controller-level no-op guard duplicated ahead of the job's own defense-in-depth guard"

key-files:
  created:
    - backend/app/controllers/v1/admin/settings/plan_controller.rb
    - backend/test/integration/admin_settings_plan_test.rb
  modified:
    - backend/config/routes.rb

key-decisions:
  - "New endpoint uses Current.brokerage exclusively (never params[:brokerage_id]) — cannot target another tenant's brokerage by construction"
  - "Controller-level no-op guard kept even though ApplyPlanTransitionJob has its own — prevents spurious enqueues and matches Ops::PlanController's proven contract"
  - "require_owner! layered on top of the inherited require_agent_or_above! via skip_before_action, only for :update — matches OwnersController's established two-line idiom"

patterns-established:
  - "Owner-gated mutation sibling controller under V1::Admin::Settings:: reusing Current.brokerage + require_owner! + skip_before_action idiom from OwnersController"

requirements-completed: [PLAN-24, PLAN-25]

# Metrics
duration: 25min
completed: 2026-07-23
---

# Phase 41 Plan 01: Owner-Gated Plan-Change Endpoint Summary

**New brokerage-scoped `PATCH /v1/admin/settings/plan` endpoint that flips `Current.brokerage.plan` and enqueues the real `ApplyPlanTransitionJob` cascade, gated by DB-backed owner-role re-validation.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-23T06:01:29Z
- **Completed:** 2026-07-23T06:25:50Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- Owners can now flip their own brokerage's plan tier via a real, tenant-scoped API endpoint (not the internal `Ops::PlanController` testing tool)
- Non-owner callers (admin/agent/client) are rejected with 403 regardless of any client-side state, closing the PLAN-25 security gap
- Same-plan requests are a safe no-op; invalid plan values are rejected with 422 — neither path enqueues a spurious job
- Full integration test coverage (6 tests, 29 assertions) proves the owner-gating, enqueue contract, no-op guard, and invalid-plan rejection all behave correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create owner-gated PlanController and route** - `be50f6d` (feat)
2. **Task 2: Integration test for owner success, non-owner 403, no-op, and invalid plan** - `95ce4f1` (test)

## Files Created/Modified
- `backend/app/controllers/v1/admin/settings/plan_controller.rb` - New owner-gated `update` action mirroring `Ops::PlanController`'s validate → no-op-check → flip → enqueue sequence, scoped to `Current.brokerage`
- `backend/config/routes.rb` - Added `resource :plan, only: [:update], controller: "plan"` inside the existing `namespace :settings` block, sibling to `resources :owners`
- `backend/test/integration/admin_settings_plan_test.rb` - 6 integration tests covering owner success/enqueue, no-op, invalid plan, and 3 non-owner 403 cases

## Decisions Made
- Followed the plan's exact prescribed sequence with no deviation: `Current.brokerage` scoping (never `params[:brokerage_id]`), no `set_brokerage` method, no `skip_before_action :verify_authenticity_token` copied from the Ops namespace variant
- Used `before_action :require_owner!, only: [:update]` without a `skip_before_action` for `require_agent_or_above!` since the plan's action list is `[:update]` only anyway — matches the plan's exact task instruction (mirrors `OwnersController`'s two-line idiom which is technically for a multi-action controller, but functionally equivalent here since `update` is the sole action and no read action exists on this controller to widen access for)

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `must_haves`/`acceptance_criteria` on first pass with no auto-fixes needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend endpoint is live, tested, and ready for the frontend Plan section (41-02) to wire against
- `PATCH /v1/admin/settings/plan` accepts `{ plan: "free" | "independent" | "growth" }` and returns `{ status: "transitioning" | "noop", brokerage_id, old_plan?, new_plan? | plan }` — this is the exact contract 41-02's `updatePlan.ts`/`useUpdatePlan.ts` should target
- No blockers for 41-02

---
*Phase: 41-self-service-plan-management*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: backend/app/controllers/v1/admin/settings/plan_controller.rb
- FOUND: backend/test/integration/admin_settings_plan_test.rb
- FOUND commit: be50f6d
- FOUND commit: 95ce4f1

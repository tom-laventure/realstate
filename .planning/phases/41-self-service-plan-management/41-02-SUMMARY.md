---
phase: 41-self-service-plan-management
plan: 02
subsystem: ui
tags: [react, tanstack-query, rbac, typescript, axios]

# Dependency graph
requires:
  - phase: 41-self-service-plan-management (plan 01)
    provides: "PATCH /v1/admin/settings/plan — owner-gated, brokerage-scoped plan-change endpoint"
provides:
  - "Owner-only manage_plan RBAC permission"
  - "Shared PlanTier type + PLAN_TIER_LABELS/PLAN_TIER_ORDER single source of truth"
  - "updatePlan Axios call typed to the real endpoint response (PlanUpdateResponse)"
  - "useUpdatePlan TanStack mutation with centralized single-key invalidation + toast"
  - "useSettingsAdminContext plan state/actions: currentPlan, canManagePlan, pendingDowngradePlan, isUpdatingPlan, isPlanError, handlePlanChange, setPendingDowngradePlan, confirmDowngrade"
affects: [41-03 (Plan section UI components consuming this data layer)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single mutation onSuccess/onError centralizes toast + invalidation so multiple call sites (direct selection, dialog confirm) share identical handling"
    - "Dedicated isPlanError sourced from the specific query it gates (useFetchBrokerage), never borrowed from an unrelated fetch (useFetchOwners) in the same Brain"

key-files:
  created:
    - frontend/src/assets/types/planType.ts
    - frontend/src/assets/api/admin/settings/plan/updatePlan.ts
    - frontend/src/store/hooks/Admin/Settings/Plan/useUpdatePlan.ts
  modified:
    - frontend/src/assets/rbac/permissions.ts
    - frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts

key-decisions:
  - "PlanTier values ('free' | 'independent' | 'growth') kept byte-identical to CreateBrokeragePlan to avoid tier-name drift between onboarding and settings"
  - "PlanUpdateResponse typed to the actual {status, brokerageId, oldPlan?, newPlan?, plan?} endpoint body, not BrokerageType — the endpoint renders a status object, not a brokerage record"
  - "isPlanError derived exclusively from useFetchBrokerage's own isError, not the pre-existing owners-fetch isError already in the context — prevents a failed owners fetch from spuriously reporting a plan-load error, and ensures a failed brokerage fetch is surfaced instead of silently defaulting to 'free'"
  - "handlePlanChange no-ops on same-tier reselection (defense-in-depth alongside the backend's own no-op guard) and opens the downgrade dialog only for paid->free; all other transitions mutate immediately per D-05"

patterns-established:
  - "Centralized mutation success/error handling (toast + invalidation) shared across direct and dialog-confirm call sites, per RESEARCH.md Pitfall 4"

requirements-completed: [PLAN-22, PLAN-23, PLAN-24]

# Metrics
duration: 12min
completed: 2026-07-23
---

# Phase 41 Plan 02: Frontend Plan Data Layer Summary

**Owner-gated `manage_plan` RBAC permission, shared `PlanTier` type, an Axios call + TanStack mutation targeting the real `PATCH /v1/admin/settings/plan` endpoint, and a `useSettingsAdminContext` extension exposing plan state and a branching `handlePlanChange` action (downgrade opens a dialog; upgrade/lateral mutates immediately).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-23T06:20:00Z
- **Completed:** 2026-07-23T06:32:30Z
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments
- Added an owner-only `manage_plan` permission, cleanly additive with no coupling to the unrelated `manage_ownership` permission
- Established `PlanTier` as the single source of truth for tier values and display labels, kept identical to the onboarding wizard's `CreateBrokeragePlan` to prevent drift
- Built the Axios call + TanStack mutation calling the real Plan 01 endpoint, typed to its actual `{status, brokerageId, oldPlan?, newPlan?, plan?}` response shape (not a brokerage record)
- Centralized all success/error side effects (single-key `adminBrokerageKeys.all` invalidation + toast) inside one mutation so both the future direct-selection and dialog-confirm UI call sites in Plan 03 share identical behavior
- Extended the settings Brain with `currentPlan` (read from the already-fetched `useFetchBrokerage`, no new GET endpoint), a dedicated `isPlanError` flag scoped only to that fetch, and a `handlePlanChange`/`confirmDowngrade` action pair implementing the downgrade-vs-immediate-apply branching from CONTEXT.md D-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Add manage_plan permission and the shared PlanTier type** - `04d7405` (feat)
2. **Task 2: Create updatePlan Axios call and useUpdatePlan mutation** - `7757d98` (feat)
3. **Task 3: Extend useSettingsAdminContext with plan state and handlePlanChange** - `48247e3` (feat)

## Files Created/Modified
- `frontend/src/assets/rbac/permissions.ts` - Added `manage_plan` to the `Permission` union and to `owner`'s array only in `ROLE_PERMISSIONS`
- `frontend/src/assets/types/planType.ts` - New `PlanTier` union, `PLAN_TIER_LABELS`, `PLAN_TIER_ORDER`
- `frontend/src/assets/api/admin/settings/plan/updatePlan.ts` - Axios PATCH to `/v1/admin/settings/plan`, typed `Promise<PlanUpdateResponse>`
- `frontend/src/store/hooks/Admin/Settings/Plan/useUpdatePlan.ts` - TanStack mutation with single-key invalidation and success/error toasts
- `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` - Extended with plan state/actions alongside the existing owners section

## Decisions Made
- Followed the plan's exact prescribed shapes with no deviation: `PlanUpdateResponse` typed to the real endpoint body (verified against 41-01-SUMMARY.md's documented response contract), single-key invalidation only (`adminBrokerageKeys.all`), no Domains/Boards keys touched
- `isPlanError` deliberately pulled from `useFetchBrokerage()`'s own `isError`, kept distinct from the pre-existing `isError` (sourced from `useFetchOwners()`) already in the same context — this was an explicit plan instruction, not an ad hoc choice, and was verified via `grep` that the two remain independent state fields

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched their `must_haves`/`acceptance_criteria` on first pass with no auto-fixes needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The data layer (`manage_plan` permission, `PlanTier` type, `updatePlan`/`useUpdatePlan`, and `useSettingsAdminContext`'s plan state/actions) is fully wired and ready for Plan 03's UI components (`PlanManagementSection`, `PlanSelector`, `DowngradeConfirmDialog`) to consume with no further data wiring
- Plan 03 should call `actions.handlePlanChange(tier)` from the selector's `onValueChange`, and wire `actions.confirmDowngrade`/`actions.setPendingDowngradePlan(null)` to the `DowngradeConfirmDialog`'s confirm/cancel handlers, gating both with `state.canManagePlan`
- No blockers for 41-03

---
*Phase: 41-self-service-plan-management*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: frontend/src/assets/rbac/permissions.ts
- FOUND: frontend/src/assets/types/planType.ts
- FOUND: frontend/src/assets/api/admin/settings/plan/updatePlan.ts
- FOUND: frontend/src/store/hooks/Admin/Settings/Plan/useUpdatePlan.ts
- FOUND: frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts
- FOUND commit: 04d7405
- FOUND commit: 7757d98
- FOUND commit: 48247e3

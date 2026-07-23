---
phase: 41-self-service-plan-management
plan: 03
subsystem: ui
tags: [react, radix-tabs, alert-dialog, rbac, typescript]

# Dependency graph
requires:
  - phase: 41-self-service-plan-management (plan 02)
    provides: "useSettingsAdminContext plan state/actions (currentPlan, canManagePlan, pendingDowngradePlan, isUpdatingPlan, isPlanError, handlePlanChange, setPendingDowngradePlan, confirmDowngrade), PlanTier type, manage_plan permission"
provides:
  - "PlanSelector — Tabs-based 3-way segmented control (interactive + disabled variants, no TabsContent)"
  - "DowngradeConfirmDialog — AlertDialog single-warning downgrade confirmation"
  - "PlanManagementSection — Card section wrapping the selector/dialog/error states, mirroring OwnershipManagementSection"
  - "Plan section rendered on /admin/settings below Ownership Management, fully wired to the Brain"
affects: [41-04 (human-verify checkpoint for interactive/visual behavior)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same disabled-toggle component rendered for owner and non-owner views (no text/badge swap) — D-04"
    - "Tabs used as a value-driven selector (no TabsContent) rather than content tabs"

key-files:
  created:
    - frontend/src/components/view/admin/settingsAdminView/PlanSelector.tsx
    - frontend/src/components/view/admin/settingsAdminView/DowngradeConfirmDialog.tsx
    - frontend/src/components/view/admin/settingsAdminView/PlanManagementSection.tsx
  modified:
    - frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx

key-decisions:
  - "PlanSelector's Tabs value is bound to currentPlan (the confirmed/server-known tier), not an intermediate selection — ensures a cancelled downgrade leaves the active pill unchanged (UI-SPEC Interaction Contract)"
  - "PlanManagementSection renders the identical PlanSelector for owner and non-owner views, toggling only the disabled prop plus a conditional read-only caption — no separate text/badge fallback (D-04)"
  - "isError prop wired from state.isPlanError (the dedicated plan-fetch error flag from Plan 02), not the context's owners-fetch isError, per the plan's explicit checker-fix instruction"
  - "DowngradeConfirmDialog gated by <Can permission=\"manage_plan\"> exactly like OwnershipManagementSection gates its Add/Remove dialogs"

patterns-established:
  - "Read-only/disabled RBAC views reuse the exact same interactive component with a disabled prop, never a degraded text/badge substitute"

requirements-completed: [PLAN-22, PLAN-23, PLAN-26]

# Metrics
duration: 10min
completed: 2026-07-23
---

# Phase 41 Plan 03: Plan Section UI Components Summary

**Built the "Plan" section UI on `/admin/settings` — a Tabs-based 3-way segmented selector, an AlertDialog downgrade confirmation, and a Card wrapper section, all wired to the Plan 02 Brain state/actions and rendered below Ownership Management.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-23T06:36:00Z
- **Completed:** 2026-07-23T06:39:00Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- Built `PlanSelector.tsx`, a pure `Tabs`/`TabsList variant="default"`/`TabsTrigger` control iterating `PLAN_TIER_ORDER`, with no `TabsContent` — a value-driven selector, not content tabs
- Built `DowngradeConfirmDialog.tsx`, an `AlertDialog` mirroring `DeleteDomainDialog.tsx`'s exact single-warning/plain-Confirm-Cancel shape with the UI-SPEC's verbatim copy and destructive button override
- Built `PlanManagementSection.tsx`, a `Card` section mirroring `OwnershipManagementSection`'s header/spacing conventions, rendering the identical selector for owner and non-owner roles (toggling only `disabled`) plus a conditional read-only caption
- Wired `PlanManagementSection` into `SettingsAdminBoard.tsx` in place of the `{/* TODO: Add billing management section */}` placeholder, sourcing `isError` from the dedicated `state.isPlanError` flag (not the unrelated owners-fetch `state.isError`)
- Verified `npm run build` completes cleanly with no import/bundling errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Build PlanSelector and DowngradeConfirmDialog components** - `a8b86aa` (feat)
2. **Task 2: Build PlanManagementSection and wire into SettingsAdminBoard** - `df68dc3` (feat)

## Files Created/Modified
- `frontend/src/components/view/admin/settingsAdminView/PlanSelector.tsx` - Tabs-based 3-way segmented control, `value={currentPlan}`, `disabled` prop drives both interactive and read-only variants
- `frontend/src/components/view/admin/settingsAdminView/DowngradeConfirmDialog.tsx` - AlertDialog with UI-SPEC verbatim copy, destructive-styled confirm action, `isSubmitting` disables the confirm button
- `frontend/src/components/view/admin/settingsAdminView/PlanManagementSection.tsx` - Card wrapper: title/description, error state, selector + read-only caption, `Can`-gated downgrade dialog
- `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` - Renders `PlanManagementSection` below `OwnershipManagementSection`, replacing the billing TODO placeholder

## Decisions Made
- Followed the plan's exact prescribed component shapes and copy with no deviation — every `grep` verification target (Tabs/no TabsContent, exact downgrade copy, destructive className, read-only caption, `manage_plan` gate, `isError={state.isPlanError}`, removed TODO) matched on first pass
- Confirmed no primary-colored button, badge, or highlight ring was introduced anywhere in the three new components, per UI-SPEC's explicit "accent reserved for nothing in this phase" declaration

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and automated verification checks passed on first implementation without auto-fixes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. All three components consume real Brain state/actions from Plan 02 (`useSettingsAdminContext`); no hardcoded/placeholder data.

## Next Phase Readiness

- The Plan section is fully wired end-to-end: backend endpoint (Plan 01) → Brain state/actions (Plan 02) → UI components (this plan)
- Interactive/visual behavior (owner selector, disabled admin/agent view, downgrade dialog flow, toast) is confirmed via the Plan 04 human-verify checkpoint
- No blockers for 41-04

---
*Phase: 41-self-service-plan-management*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: frontend/src/components/view/admin/settingsAdminView/PlanSelector.tsx
- FOUND: frontend/src/components/view/admin/settingsAdminView/DowngradeConfirmDialog.tsx
- FOUND: frontend/src/components/view/admin/settingsAdminView/PlanManagementSection.tsx
- FOUND: frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx (modified)
- FOUND commit: a8b86aa
- FOUND commit: df68dc3

---
phase: 33-backend-owner-api-endpoint-lockdown
plan: 03
subsystem: ui
tags: [react, typescript, rbac, admin]

# Dependency graph
requires:
  - phase: 33-backend-owner-api-endpoint-lockdown
    provides: "Plan 01/02 backend owner-lockdown (403 on owner-role invitations, dedicated owner-management API)"
provides:
  - "Add-agent role selector limited to Agent/Admin only — owner option removed from UI"
affects: [34-ownership-management-settings-page, 35-remove-owner-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - frontend/src/components/view/admin/brokerageView/addAgentView/AddAgentView.tsx

key-decisions:
  - "RolePermissions.tsx left untouched — it's a generic reusable component with its own default roles=['client','agent','admin','owner']; only the AddAgentView call-site's roles prop was trimmed"

patterns-established: []

requirements-completed: [LOCK-02]

# Metrics
duration: 2min
completed: 2026-07-12
---

# Phase 33 Plan 03: Add-Agent Role Selector Owner Removal Summary

**Removed the "Owner" option from the `/admin/brokerage/add-agent` role selector and its RolePermissions description, closing the UX-layer accidental-owner-assignment path (LOCK-02).**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-12T23:58:15Z
- **Completed:** 2026-07-12T23:59:28Z
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments
- `<SelectItem value="owner">Owner</SelectItem>` removed from the add-agent role `<Select>`, leaving only Agent and Admin
- `RolePermissions` roles prop trimmed from `['agent', 'admin', 'owner']` to `['agent', 'admin']`, removing the owner permission description from the form

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the owner option from the add-agent role selector (LOCK-02)** - `52513c7` (fix)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `frontend/src/components/view/admin/brokerageView/addAgentView/AddAgentView.tsx` - Removed owner `SelectItem` and trimmed `RolePermissions` roles prop to `['agent', 'admin']`

## Decisions Made
- None beyond the plan's own guidance — `RolePermissions.tsx` (the shared component) was correctly left unmodified since its default prop still serves other call sites that need to display all four roles; only the `AddAgentView` usage was scoped down.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LOCK-02 is complete: the add-agent form can no longer submit an owner-role invitation from the UI. Combined with Plan 01's backend 403 (LOCK-01), the pre-existing brokerage-takeover gap (30-REVIEW.md CR-02/CR-03) is now closed at both layers.
- Owner promotion/demotion moves entirely to the dedicated Ownership Management flow, to be built in Phases 34 (Settings page shell, Current Owners, Add Owner) and 35 (Remove Owner two-step flow) against the API shipped in Plan 02.
- No blockers for Phase 34.

---
*Phase: 33-backend-owner-api-endpoint-lockdown*
*Completed: 2026-07-12*

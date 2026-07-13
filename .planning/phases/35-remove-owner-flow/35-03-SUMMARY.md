---
phase: 35-remove-owner-flow
plan: 03
subsystem: ui
tags: [react, shadcn, dialog, ownership-management]

# Dependency graph
requires:
  - phase: 35-remove-owner-flow
    provides: "StepDots shared indicator component (35-01)"
provides:
  - "Two-step Add Owner dialog (decision -> review -> confirm) matching the Remove Owner flow's shape"
affects: [35-remove-owner-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: ["useState<1 | 2> step-gated JSX blocks inside a single Dialog, reset-on-close via handleOpenChange"]

key-files:
  created: []
  modified:
    - frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx

key-decisions:
  - "Reused StepDots (@/components/view/admin/common/StepDots, shipped in 35-01) rather than duplicating the dot-indicator markup locally"
  - "Step 1's former submit button relabeled 'Continue to Review' and only advances step state — the usePromoteOwner call moved to step 2 without any change to its signature or the AddOwnerDialogProps contract"

patterns-established: []

requirements-completed: [OWN-13]

# Metrics
duration: ~12min
completed: 2026-07-13
---

# Phase 35 Plan 03: Add Owner Review Step Retrofit Summary

**Retrofitted `AddOwnerDialog.tsx` from a single-screen promote form into a two-step decision-then-review flow, matching the Remove Owner dialog's shape, with the `usePromoteOwner` API contract left completely unchanged.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-13
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Step 1 (combobox + note + amber warning) is unchanged in content, now wrapped in `{step === 1 && (...)}` and gated behind a "Continue to Review" button instead of submitting directly
- New step 2 review screen renders a "Confirm Owner Promotion" heading and a summary sentence ("{name} ({email}) will be changed from {role} to Owner."), hosting the sole "Confirm Add Owner" button
- `StepDots` (shared component from 35-01) renders in `DialogHeader` with `totalSteps={2}`
- `handleOpenChange` resets both `selectedUser` and `step` to their initial values on close, so reopening never resumes mid-flow (D-05)

## Task Commits

Each task was committed atomically (inside the `frontend/` linked worktree):

1. **Task 1: Add a final review step (step 2) to AddOwnerDialog** - `8b1be88` (feat)

**Plan metadata:** committed at monorepo root alongside this SUMMARY.md

## Files Created/Modified
- `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx` - Retrofitted into a two-step `useState<1 | 2>` flow; step 1 unchanged content with a relabeled advance button, step 2 is a new review screen hosting the unchanged `handleConfirm`/`onConfirm(selectedUser.id)` call

## Decisions Made
- Reused the shared `StepDots` component shipped in plan 35-01 instead of duplicating the dot-indicator JSX locally in this file, matching the UI-SPEC's "adopt for both dialogs" cross-cutting decision
- Kept the review screen's heading as a plain `<h3 className="text-base font-semibold">` rather than a `DialogTitle`, since `DialogTitle` is reserved for the static "Add Owner" title in `DialogHeader` per the UI-SPEC's typography table (16px/`text-base`/`font-semibold` for "step heading" is distinct from 18px/`text-lg` for "Dialog title")

## Deviations from Plan

None - plan executed exactly as written. The `AddOwnerDialogProps` interface, `handleConfirm`, and the `onConfirm(selectedUser.id)` call are byte-for-byte unchanged from before this plan (verified via `git diff` — those lines show zero additions/removals), so `OwnershipManagementSection.tsx` required no edit.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`AddOwnerDialog.tsx` and (per the sibling 35-02 plan) `RemoveOwnerDialog.tsx` now share the same decision -> review -> confirm two/three-step shape and the `StepDots` indicator, closing OWN-13. No blockers for subsequent Phase 35 plans (wiring/verification waves).

---
*Phase: 35-remove-owner-flow*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx
- FOUND: .planning/phases/35-remove-owner-flow/35-03-SUMMARY.md
- FOUND commit: 8b1be88 (frontend linked worktree, `worktree-agent-a48ae89c697b2fcb4-frontend` branch)

---
phase: 35-remove-owner-flow
plan: 02
subsystem: ui
tags: [react, radix, tailwind, shadcn, radio-group, dialog]

requires:
  - phase: 35-remove-owner-flow (plan 01)
    provides: DemoteTargetRole/OwnerType types, demoteOwner API module, useDemoteOwner hook, RadioGroup primitive, StepDots component
provides:
  - RemoveOwnerDialog.tsx — three-step demote dialog (warning -> role picker -> review/confirm), prop-driven
  - CurrentOwnersList.tsx — Remove icon button per row, gated by manage_ownership, last-owner disabled + tooltip
affects: [35-remove-owner-flow plan 04 (OwnershipManagementSection/Brain wiring)]

tech-stack:
  added: []
  patterns:
    - "Multi-step Dialog via useState<1|2|3> + goNext/goBack + reset-on-close (mirrors AddDomainWizard.tsx)"
    - "Tooltip-wraps-disabled-Button via focusable <span tabIndex={0}> TooltipTrigger wrapper (buttonVariants disabled:pointer-events-none pitfall)"

key-files:
  created:
    - frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx
  modified:
    - frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx

key-decisions:
  - "RemoveOwnerDialog uses plain Dialog (not AlertDialog) per UI-SPEC's multi-step convention; only Step 3's confirm button carries the destructive class"
  - "CurrentOwnersList props stay { owners, onRemove } — no currentUserId threaded through the list; RemoveOwnerDialog receives currentUserId directly from the future OwnershipManagementSection wiring (Plan 04)"

patterns-established:
  - "Pattern: three-step demote/confirm dialogs reuse StepDots + useState<1|2|3> step scaffold from AddDomainWizard.tsx"

requirements-completed: [OWN-06, OWN-07, OWN-09, OWN-10]

duration: 15min
completed: 2026-07-13
---

# Phase 35 Plan 02: Remove Owner Dialog & List Row Summary

**Three-step RemoveOwnerDialog (warning -> RadioGroup role picker -> destructive confirm) plus a gated, last-owner-aware Remove button on CurrentOwnersList — both presentational and prop-driven for Plan 04's Brain wiring.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-13T07:34:17Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 amended)

## Accomplishments
- `RemoveOwnerDialog.tsx` implements the full 3-step flow (D-02/D-03/D-04) with self-demotion copy (D-06) and full reset-on-close (D-05); exactly one destructive-styled button exists, on Step 3.
- `CurrentOwnersList.tsx` gains a `manage_ownership`-gated `UserMinus` Remove button per row, muted by default and destructive on hover, with a disabled + tooltip state when only one owner remains (OWN-10), using the focusable-span wrapper to work around `disabled:pointer-events-none` suppressing Tooltip hover.
- Both components expose the exact prop contracts specified in the plan's `<interfaces>` block for Plan 04 to consume without further contract changes.

## Task Commits

Both tasks committed atomically inside the `frontend` linked worktree (separate repo per CLAUDE.md):

1. **Task 1: RemoveOwnerDialog.tsx — three-step demote dialog** - `0c4c64c` (feat)
2. **Task 2: CurrentOwnersList.tsx — Remove button, last-owner disabled state + tooltip** - `df0248a` (feat)

**Plan metadata:** this commit (docs: complete plan, monorepo root)

## Files Created/Modified
- `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx` - New three-step demote dialog: Step 1 warning (+ self-demotion paragraph), Step 2 RadioGroup role picker (admin/agent/client, default admin), Step 3 review + destructive "Confirm Role Change" button calling `onConfirm(selectedRole)`
- `frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx` - Added `onRemove` prop, `manage_ownership`-gated Remove icon button per row, last-owner disabled/tooltip state via focusable `<span>` wrapper, `TooltipProvider` wrap at list level

## Decisions Made
- Kept `CurrentOwnersList` props as `{ owners, onRemove }` exactly per the plan's interface contract — no `currentUserId` added to this component; that prop flows into `RemoveOwnerDialog` directly from the future Brain wiring (Plan 04), not through the list.
- Wrapped the row's email + Remove button together in a new inner flex div so `justify-between` still separates name from trailing content — a minimal layout addition, not a rework, preserving `divide-y divide-border` / `flex items-center justify-between py-3 text-sm` at the row level.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `frontend/src/assets/types/ownerType.ts` already contained `DemoteTargetRole`, `DemoteOwnerPayload`, and `OwnerType.role` from Plan 01 (merged into frontend `master` before this plan started), so no type amendments were needed here.

Note: `OwnershipManagementSection.tsx`'s existing `<CurrentOwnersList owners={owners} />` call site (Phase 34) does not yet pass the new `onRemove` prop — this is expected and intentionally out of this plan's scope; Plan 04 wires it. TypeScript will flag this as a missing required prop until Plan 04 lands, consistent with the wave 2 -> wave 3 dependency sequencing (`depends_on: ["35-01"]`, Plan 04 depends on this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `RemoveOwnerDialog` and `CurrentOwnersList` prop contracts are locked and match `<interfaces>` exactly; Plan 04 (`OwnershipManagementSection`/`useSettingsAdminContext` wiring) can now consume `onRemove`, `target`, `currentUserId`, `onConfirm`, `isSubmitting` without further contract negotiation.
- No blockers. `OwnershipManagementSection.tsx` will show a TypeScript error for the missing `onRemove` prop until Plan 04 wires it — expected, not a regression.

## Self-Check: PASSED

- FOUND: frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx
- FOUND: frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx
- FOUND: .planning/phases/35-remove-owner-flow/35-02-SUMMARY.md
- FOUND: commit 0c4c64c (frontend repo)
- FOUND: commit df0248a (frontend repo)
- FOUND: commit 5fc27e4 (monorepo root)

---
*Phase: 35-remove-owner-flow*
*Completed: 2026-07-13*

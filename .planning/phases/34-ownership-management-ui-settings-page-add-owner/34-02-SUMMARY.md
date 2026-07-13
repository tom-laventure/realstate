---
phase: 34-ownership-management-ui-settings-page-add-owner
plan: 02
subsystem: ui
tags: [react, typescript, tanstack-query, rbac, shadcn, tailwind]

# Dependency graph
requires:
  - phase: 34-01
    provides: "OwnerType/EligibleOwnerUserType types, manage_ownership permission, ownersKeys/eligibleOwnerUsersKeys query keys, useFetchOwners/useFetchEligibleOwnerUsers/usePromoteOwner hooks"
provides:
  - "Live /admin/settings page rendering Ownership Management as the only functional section"
  - "useSettingsAdminContext Context brain with split owners/eligible loading flags and OWN-05/TOCTOU promote-failure toast"
  - "CurrentOwnersList, AddOwnerDialog, OwnershipManagementSection view components"
affects: [35-remove-owner-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Context brain wraps a mutation in try/catch to surface a mutation-hook-agnostic error toast (mutation hook itself has no onError)", "CommandEmpty branches on a query's isLoading flag to distinguish in-flight from genuinely-empty"]

key-files:
  created:
    - frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx
    - frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx
    - frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx
    - frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts
  modified:
    - frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx

key-decisions:
  - "isLoadingOwners and isLoadingEligible kept as two separate context state fields (not merged into one isLoading) so the owners-list skeleton and the eligible-dropdown loading state can be independently correct"
  - "handlePromoteOwner's try/catch is the sole surface for the OWN-05/TOCTOU error toast since usePromoteOwner (34-01) intentionally has no onError handler"
  - "Add Owner dialog's dismiss button reads 'Keep Looking' per the UI-SPEC Copywriting Contract, not the generic 'Cancel' used elsewhere in the codebase"

patterns-established:
  - "Ownership Management section reuses RolePermissions via Can's fallback branch with an explicit roles={['owner','admin','agent']} override — same pattern any future owner-gated read-only surface should follow"

requirements-completed: [SET-01, SET-02, OWN-01, OWN-02, OWN-03, OWN-04, OWN-05]

# Metrics
duration: ~10min
completed: 2026-07-12
---

# Phase 34 Plan 02: Ownership Management UI View Layer Summary

**Replaced the bare `/admin/settings` stub with a live Ownership Management card (Current Owners list + owner-gated Add Owner modal with searchable combobox, D-04 warning callout, and TOCTOU-aware error toast) wired through a new Context brain consuming the Plan 34-01 hooks.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-12
- **Tasks:** 3 completed
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `/admin/settings` now renders a real "Ownership Management" card as its only functional section, with the Billing stub reduced to an invisible `// TODO` code comment (SET-01)
- Owners see the full "Add Owner" action UI; admins/agents see the read-only `RolePermissions` card scoped to `['owner','admin','agent']`; both paths are mutually exclusive via `<Can permission="manage_ownership">` (SET-02, OWN-02)
- Current Owners renders as plain `divide-y` stacked rows (name + email only, no table/cards/avatars/self-badge) with a 3-row `animate-pulse` skeleton while loading and the verbatim fetch-error copy on failure (OWN-01)
- Add Owner dialog: `Popover`+`Command` searchable combobox over eligible admins/agents, with `CommandEmpty` branching on `isLoadingEligible` so the dropdown never shows a false-empty state while `/eligible` is still in flight (OWN-03)
- Warning callout renders only after selection with the exact D-04 three-point ownership-specific copy — not `RolePermissions`' generic description (OWN-04)
- Confirming Add Owner calls the 34-01 promote mutation; on success the dialog closes and both caches refetch; on failure (e.g. stale-role 422/TOCTOU) the context's `handlePromoteOwner` fires the verbatim `toast.error` and keeps the dialog open (OWN-05)

## Task Commits

Each task was committed atomically in the `frontend` sub-repo:

1. **Task 1: Context brain (+ OWN-05 error toast) + Current Owners list** - `59b9e07` (feat)
2. **Task 2: Add Owner dialog (searchable dropdown + warning + confirm)** - `b0ba46c` (feat)
3. **Task 3: Ownership Management section (list loading/error states) + Settings page shell** - `d5672ef` (feat)

_Sub-repo note: `backend/` and `frontend/` are separate git repos per CLAUDE.md — all three commits above live in the `frontend` repo. No backend changes in this plan._

## Files Created/Modified
- `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` - Context brain: consumes `useFetchOwners`/`useFetchEligibleOwnerUsers`/`usePromoteOwner`, exposes split `isLoadingOwners`/`isLoadingEligible`, `handlePromoteOwner` (closes dialog on success, fires OWN-05 toast on failure)
- `frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx` - Pure `divide-y` stacked-rows renderer (name + email), "No owners found." empty state
- `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx` - Dialog with searchable combobox, loading-aware `CommandEmpty`, D-04 warning callout, "Keep Looking"/"Confirm Add Owner" footer
- `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` - Card shell: owner-gated Add Owner button, 3-state owners region (error/skeleton/list), `RolePermissions` fallback, gated `AddOwnerDialog`
- `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` - Replaced stub: renders page header + `OwnershipManagementSection` + invisible Billing TODO comment; dropped the empty `.module.scss` import

## Decisions Made
- Kept `isLoadingOwners`/`isLoadingEligible` as two distinct context fields per the plan's explicit instruction — collapsing them would have broken the eligible-dropdown's loading-vs-empty distinction.
- `handlePromoteOwner`'s catch branch resolves the target user's display name from `eligibleUsers` (fallback `'this user'`) since the mutation's own error payload doesn't carry a display name.
- Did not delete `SettingsAdminBoard.module.scss` (now fully unused) — plan only required dropping the import; leaving the empty file in place avoids scope creep on file deletion not requested by the plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/admin/settings` is fully functional for SET-01/SET-02/OWN-01 through OWN-05; Phase 35's Remove Owner flow can extend `useSettingsAdminContext` and `OwnershipManagementSection` without structural changes.
- `cd frontend && npx vite build` exits 0 — full module graph resolves with no compile errors.
- Negative-path verification (non-owner JWT still gets 403 from `POST /admin/settings/owners`) remains a manual/QA checkpoint per RESEARCH.md Pitfall 4 — not exercised by this plan's automated tasks.

---
*Phase: 34-ownership-management-ui-settings-page-add-owner*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 5 created/modified files verified present on disk. All 3 task commits (`59b9e07`, `b0ba46c`, `d5672ef` in `frontend`) verified in git history. `npx vite build` exits 0.

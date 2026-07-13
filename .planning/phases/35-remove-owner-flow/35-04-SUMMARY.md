---
phase: 35-remove-owner-flow
plan: 04
subsystem: ui
tags: [react, redux, tanstack-query, settings, ownership]

# Dependency graph
requires:
  - phase: 35-remove-owner-flow (35-01)
    provides: useDemoteOwner mutation hook, demoteOwner API module, DemoteTargetRole/DemoteOwnerPayload types
  - phase: 35-remove-owner-flow (35-02)
    provides: RemoveOwnerDialog component, CurrentOwnersList onRemove prop
provides:
  - Full Remove Owner flow wired end-to-end through useSettingsAdminContext -> OwnershipManagementSection -> SettingsAdminBoard
  - Self-demote Redux session patch (account.membership.role, activeBrokerage.role) with no reload
  - Reliable currentUserId population on both subdomain and portal Settings paths via unconditional useGetCurrentUser()
affects: [35-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Brain-owned try/catch as sole error-toast surface for a mutation hook that intentionally omits onError (matches handlePromoteOwner precedent)"
    - "Dialog open state derived from a nullable target object (demoteTarget !== null) instead of a plain boolean flag, when the dialog needs to know *which* record is targeted"

key-files:
  created: []
  modified:
    - frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts
    - frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx
    - frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx
    - frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.test.tsx (new test file)

key-decisions:
  - "useGetCurrentUser() is called unconditionally in the Brain (not gated) to guarantee account.id is populated on both the subdomain NavBar path (cache hit, no extra network cost) and the portal path (fixes Pitfall 1)."
  - "Self-demote Redux patch reads the role straight off the trusted server mutation response (response.role), never client input, and only fires when response.id === account.id — it's a local session UX correction, not a privilege change (server already enforced authorization via require_owner!)."
  - "RemoveOwnerDialog's open prop derives from demoteTarget !== null rather than a boolean flag, deliberately diverging from AddOwnerDialog's isAddOwnerOpen convention, because the dialog needs to know which owner is targeted, not just open/closed."

patterns-established:
  - "Brain-owned try/catch as the sole toast.error surface for mutation hooks with no onError (second confirmed instance after handlePromoteOwner)."

requirements-completed: [OWN-08, OWN-09]

duration: ~10min
completed: 2026-07-13
---

# Phase 35 Plan 04: Remove Owner Flow Integration Summary

**Wired useDemoteOwner mutation, demoteTarget dialog state, currentUserId, and a self-demote Redux session patch through useSettingsAdminContext, OwnershipManagementSection, and SettingsAdminBoard — closing the end-to-end Remove Owner flow.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-13
- **Tasks:** 3 completed (Task 1 was TDD: RED then GREEN)
- **Files modified:** 3 production files + 1 new test file

## Accomplishments
- `useSettingsAdminContext` now owns the demote mutation, `demoteTarget` state, `currentUserId` (sourced from `account.id`), and the self-demote Redux patch (`updateUser` + `setActiveBrokerage`) — all following the existing `handlePromoteOwner` try/catch convention.
- `OwnershipManagementSection` renders `RemoveOwnerDialog` inside a `manage_ownership` `Can` gate, with open state derived from `demoteTarget !== null`, and drills `onRemove={setDemoteTarget}` into `CurrentOwnersList`.
- `SettingsAdminBoard` threads the five new context values (`currentUserId`, `demoteTarget`, `setDemoteTarget`, `onDemoteOwner`, `isDemoting`) into the section, leaving every Phase 34 prop pass-through and the billing TODO stub untouched.
- `npm run build` (vite build) completes clean, confirming the full Wave 1-3 Remove Owner wiring bundles without type errors.

## Task Commits

Each task was committed atomically inside the `frontend/` linked worktree:

1. **Task 1 (RED): failing test for demote wiring** - `0569dcc` (test)
2. **Task 1 (GREEN): demote mutation, target state, currentUserId, self-demote Redux patch** - `422cc8c` (feat)
3. **Task 2: wire RemoveOwnerDialog + drill onRemove to CurrentOwnersList** - `fd6c509` (feat)
4. **Task 3: thread demote props from context to section** - `a7517be` (feat)

**Plan metadata:** committed at monorepo root (this SUMMARY.md)

## Files Created/Modified
- `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` - Adds `useGetCurrentUser()` (unconditional), `useDemoteOwner`, `demoteTarget` state, `handleDemoteOwner` (self-demote Redux patch + single toast.error on failure), extends `state`/`actions` with `demoteTarget`, `isDemoting`, `currentUserId`, `setDemoteTarget`, `handleDemoteOwner`.
- `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.test.tsx` (new) - 6 tests covering `useGetCurrentUser` unconditional call, `currentUserId` sourcing, self-demote Redux patch, non-self demote no-op, single toast.error on failure, and `demoteTarget` reset.
- `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` - Imports and renders `RemoveOwnerDialog` gated by `Can permission="manage_ownership"`; `CurrentOwnersList` now receives `onRemove={setDemoteTarget}`.
- `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` - Passes the five new context values through to `OwnershipManagementSection`.

## Decisions Made
- Followed the plan exactly; no architectural deviations. The three key decisions documented above (unconditional `useGetCurrentUser`, self-demote Redux patch source-of-truth, and derived dialog open-state) were specified in the plan/patterns and implemented as written.

## Deviations from Plan

None - plan executed exactly as written. Task 1's TDD gate (RED then GREEN) was followed per `tdd="true"`: a new test file was authored first, confirmed to fail (6/6 failing against the pre-Task-1 file), then the implementation was added and confirmed to pass (6/6 passing).

## Issues Encountered

- The frontend linked worktree had no `node_modules` (gitignored, not part of the pinned commit). Symlinked `node_modules` from the sibling main `frontend/` checkout after confirming `package.json`/`package-lock.json` are byte-identical between the two — avoided a redundant `npm install`. This is local dev-environment plumbing, not a plan deviation.
- Prior to reading the plan, the worktree's `.planning/phases/35-remove-owner-flow/` directory did not exist because HEAD had drifted onto an older commit than the expected base (`ac677482ed...`). Ran the mandatory `worktree_branch_check` reset to the correct base commit before proceeding — this is the documented startup safety step, not a deviation from the plan itself.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- OWN-08 and OWN-09 are satisfied: confirming a demote calls the API (owners/eligible caches invalidate via Plan 01's `useDemoteOwner`), and self-demotion works on both subdomain and portal paths with an immediate Redux session patch (no reload, no forced navigation).
- The Settings page compiles and bundles with the full Remove Owner flow wired — ready for Plan 05 (verification checkpoint).
- Pre-existing, unrelated: `GoogleSignInButton.test.tsx` has 2 failing tests (documented in STATE.md as a pre-existing issue, untouched by this plan) — full suite otherwise green (55/57 passing, only those 2 pre-existing failures remain).

---
*Phase: 35-remove-owner-flow*
*Completed: 2026-07-13*

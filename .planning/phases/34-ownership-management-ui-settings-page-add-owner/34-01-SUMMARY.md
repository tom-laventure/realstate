---
phase: 34-ownership-management-ui-settings-page-add-owner
plan: 01
subsystem: ui
tags: [typescript, react, tanstack-query, rbac, axios]

# Dependency graph
requires:
  - phase: 33-backend-owner-api-and-endpoint-lockdown
    provides: "V1::Admin::Settings::OwnersController (index/eligible/create/update), owner-only server-side enforcement"
provides:
  - "OwnerType, EligibleOwnerUserType, PromoteOwnerPayload TypeScript interfaces"
  - "manage_ownership RBAC permission (owner-exclusive)"
  - "ownersKeys / eligibleOwnerUsersKeys centralized TanStack query keys"
  - "fetchOwners, fetchEligibleOwnerUsers, promoteOwner Axios API modules"
  - "useFetchOwners, useFetchEligibleOwnerUsers, usePromoteOwner TanStack Query hooks"
affects: [34-02-ownership-management-ui-view-layer, 35-remove-owner-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: ["flat-interface type module (boardType.ts analog)", "no-arg GET query hook with staleTime 0", "dual-cache-invalidation mutation hook"]

key-files:
  created:
    - frontend/src/assets/types/ownerType.ts
    - frontend/src/assets/api/admin/settings/owners/fetchOwners.ts
    - frontend/src/assets/api/admin/settings/owners/fetchEligibleOwnerUsers.ts
    - frontend/src/assets/api/admin/settings/owners/promoteOwner.ts
    - frontend/src/store/hooks/Admin/Settings/Owners/useFetchOwners.ts
    - frontend/src/store/hooks/Admin/Settings/Owners/useFetchEligibleOwnerUsers.ts
    - frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts
  modified:
    - frontend/src/assets/rbac/permissions.ts
    - frontend/src/store/hooks/queryKeys.tsx

key-decisions:
  - "manage_ownership added ONLY to the owner array in ROLE_PERMISSIONS, mirroring manage_brokerage_settings's owner-exclusivity"
  - "Single flat name field (not firstName/lastName) on OwnerType/EligibleOwnerUserType, matching backend user.full_name shape"
  - "usePromoteOwner invalidates both ownersKeys.all and eligibleOwnerUsersKeys.all so a promoted user disappears from the eligible list immediately"

patterns-established:
  - "Owner data/permission foundation mirrors the boardType.ts / useFetchBoardCredentials.ts / useCreateBoardCredential.ts analogs exactly, per 34-PATTERNS.md"

requirements-completed: [SET-02, OWN-01, OWN-03, OWN-05]

# Metrics
duration: ~5min
completed: 2026-07-12
---

# Phase 34 Plan 01: Ownership Management Data & Permission Foundation Summary

**TypeScript types, owner-exclusive `manage_ownership` RBAC permission, centralized query keys, three Axios API modules, and three TanStack Query hooks wired to the shipped Phase 33 owner endpoints.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-07-12
- **Tasks:** 3 completed
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments
- `ownerType.ts` establishes the exact contract shape (`OwnerType`, `EligibleOwnerUserType`, `PromoteOwnerPayload`) consumed by every downstream hook, component, and API module
- `manage_ownership` permission gates the Add Owner UI to the `owner` role only, with admin/agent/staff/client explicitly excluded
- Three Axios modules (`fetchOwners`, `fetchEligibleOwnerUsers`, `promoteOwner`) target the Phase 33 endpoints verbatim, with no redundant `camelcaseKeys` calls (interceptor handles it globally)
- Three TanStack Query hooks wrap the modules with centralized query keys; `usePromoteOwner` invalidates both the owners and eligible-users caches on success

## Task Commits

Each task was committed atomically in the `frontend` sub-repo:

1. **Task 1: Types, manage_ownership permission, and query keys** - `c56f635` (feat)
2. **Task 2: Three Axios API modules** - `81a200d` (feat)
3. **Task 3: Three TanStack Query hooks** - `a0ebedd` (feat)

_Sub-repo note: `backend/` and `frontend/` are separate git repos per CLAUDE.md — all three commits above live in the `frontend` repo. No backend changes in this plan._

## Files Created/Modified
- `frontend/src/assets/types/ownerType.ts` - `OwnerType`, `EligibleOwnerUserType` (with `role: UserRole`), `PromoteOwnerPayload` interfaces
- `frontend/src/assets/rbac/permissions.ts` - Added `manage_ownership` to `Permission` union and `ROLE_PERMISSIONS.owner` only
- `frontend/src/store/hooks/queryKeys.tsx` - Added `ownersKeys` and `eligibleOwnerUsersKeys` (both unpaginated, no `list()` variant)
- `frontend/src/assets/api/admin/settings/owners/fetchOwners.ts` - GET `/v1/admin/settings/owners`
- `frontend/src/assets/api/admin/settings/owners/fetchEligibleOwnerUsers.ts` - GET `/v1/admin/settings/owners/eligible`
- `frontend/src/assets/api/admin/settings/owners/promoteOwner.ts` - POST `/v1/admin/settings/owners` with `{ user: { user_id } }`
- `frontend/src/store/hooks/Admin/Settings/Owners/useFetchOwners.ts` - `useQuery` wrapper, `ownersKeys.all`, `staleTime: 0`
- `frontend/src/store/hooks/Admin/Settings/Owners/useFetchEligibleOwnerUsers.ts` - `useQuery` wrapper, `eligibleOwnerUsersKeys.all`, `staleTime: 0`
- `frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts` - `useMutation` wrapper, dual `invalidateQueries`, `toast.success('Owner added successfully')`

## Decisions Made
- Followed 34-PATTERNS.md verbatim for all six new files and both config modifications — no deviation from the documented target code was needed.
- `PromoteOwnerPayload` type is defined for contract documentation purposes even though `promoteOwner.ts`'s function signature takes a raw `userId: string` (per plan Task 2 spec) rather than the payload object directly — this matches the plan's explicit instruction and the 34-PATTERNS.md analog.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six new files and two modified config files are importable and typed for Plan 34-02 (view layer: `SettingsAdminBoard`, `OwnershipManagementSection`, `CurrentOwnersList`, `AddOwnerDialog`) with zero further backend or contract discovery needed.
- `manage_ownership` permission is live and owner-exclusive; Plan 34-02's `Can` guard usage can rely on it immediately.
- `cd frontend && npx vite build` exits 0 — full module graph resolves with no compile errors.

---
*Phase: 34-ownership-management-ui-settings-page-add-owner*
*Completed: 2026-07-12*

## Self-Check: PASSED

All 9 created/modified files verified present on disk. All 3 task commits (`c56f635`, `81a200d`, `a0ebedd` in `frontend`) verified in git history. `npx vite build` exits 0.

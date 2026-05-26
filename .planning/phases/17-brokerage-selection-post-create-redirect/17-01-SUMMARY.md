---
phase: 17-brokerage-selection-post-create-redirect
plan: "01"
subsystem: frontend/redux
tags: [frontend, redux, store, activeBrokerage]
dependency_graph:
  requires: []
  provides:
    - activeBrokerage Redux slice (setActiveBrokerage, setAdminBrokerages, clearActiveBrokerage)
    - RootState.activeBrokerage: ActiveBrokerageState
    - Test helper wired with activeBrokerage reducer
  affects:
    - frontend/src/store/reducers/index.tsx
    - frontend/src/test/renderWithProviders.tsx
tech_stack:
  added: []
  patterns:
    - Redux Toolkit createSlice pattern (mirrors tempBrokerage.tsx / createBrokerageWizard.ts)
key_files:
  created:
    - frontend/src/store/reducers/activeBrokerage.ts
  modified:
    - frontend/src/store/reducers/index.tsx
    - frontend/src/test/renderWithProviders.tsx
decisions:
  - Slice variable named activeBrokerageSlice (not activeBrokerageReducer) per Redux Toolkit convention — only the .reducer export is named with Reducer suffix
  - Used .ts extension (not .tsx) since no JSX — consistent with createBrokerageWizard.ts
metrics:
  duration: ~5min
  completed: "2026-05-25"
  tasks_completed: 3
  files_created: 1
  files_modified: 2
---

# Phase 17 Plan 01: activeBrokerage Redux Slice Summary

activeBrokerage Redux slice tracking active brokerage and full adminBrokerages list, wired into root store and test helper.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create activeBrokerage Redux slice | 006ed3c | frontend/src/store/reducers/activeBrokerage.ts (created) |
| 2 | Register activeBrokerage in root store | d43a233 | frontend/src/store/reducers/index.tsx |
| 3 | Wire activeBrokerage reducer into renderWithProviders test helper | 9afa082 | frontend/src/test/renderWithProviders.tsx |

## What Was Built

The `activeBrokerage` Redux slice provides the state foundation for Phase 17's brokerage selection and post-create redirect features:

- **`ActiveBrokerageState`** interface: `{ activeBrokerage: AdminBrokerage | null, adminBrokerages: AdminBrokerage[] }`
- **Three action creators**: `setActiveBrokerage`, `setAdminBrokerages`, `clearActiveBrokerage`
- **Root store** wires the slice under the `activeBrokerage` key — `RootState.activeBrokerage` is now available via `useAppSelector`
- **Test helper** includes the reducer so component tests that touch the slice do not throw "No reducer provided for key 'activeBrokerage'"

## Verification Results

- All grep acceptance checks passed for all three files
- TypeScript compile: no new errors in plan files (activeBrokerage.ts, index.tsx, renderWithProviders.tsx)
- Test suite: 13 passing, 2 failing (pre-existing GoogleSignInButton failures — documented in RESEARCH.md, predating Phase 17)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan creates pure Redux infrastructure with no UI rendering.

## Threat Flags

No new security-relevant surface introduced. The slice stores only `{ id, name, role }` already exposed via `/v1/account/admin_brokerages`. In-memory only — never persisted to localStorage/sessionStorage (T-17-01: accepted per threat model).

## Self-Check

- [x] `frontend/src/store/reducers/activeBrokerage.ts` exists
- [x] `frontend/src/store/reducers/index.tsx` contains `activeBrokerage: activeBrokerageReducer`
- [x] `frontend/src/test/renderWithProviders.tsx` contains `activeBrokerage: activeBrokerageReducer`
- [x] Commits 006ed3c, d43a233, 9afa082 exist in git log

## Self-Check: PASSED

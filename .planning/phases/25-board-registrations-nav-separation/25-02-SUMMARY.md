---
phase: 25
plan: 02
subsystem: frontend-routing
tags: [nav, boards, brokerage, admin, context, cleanup]
dependency_graph:
  requires: ["25-01"]
  provides: ["/admin/brokerage brokerage-only context", "trimmed BrokerageAdminBoardContext"]
  affects:
    - frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts
    - frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx
tech_stack:
  added: []
  patterns: ["context trimming (remove subset into dedicated context)"]
key_files:
  created: []
  modified:
    - frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts
    - frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx
decisions:
  - "BoardRegistrations component file NOT deleted — it is reused by BoardsAdminBoard (/admin/boards) from Plan 01"
  - "BrokerageAdminBoardContext now exports brokerage-only state/actions — NAV-07 satisfied"
metrics:
  duration: "90s"
  completed: "2026-05-31T22:35:00Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 25 Plan 02: Board Registrations Nav Separation — Trim Brokerage Page Summary

**One-liner:** Stripped board-registration hooks, handlers, and render block from `BrokerageAdminBoard` so `/admin/brokerage` shows only Brokerage Information and Branding, with board management exclusively at `/admin/boards`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Trim board hooks/state/handlers from BrokerageAdminBoardContext.ts | b542d71 | `brokerageAdminBoard/BrokerageAdminBoardContext.ts` |
| 2 | Remove BoardRegistrations render and import from BrokerageAdminBoard.tsx | 4406df4 | `brokerageAdminBoard/BrokerageAdminBoard.tsx` |

## What Was Built

**`BrokerageAdminBoardContext.ts` (trimmed)** — Removed all five board hook imports (`useFetchBoardCredentials`, `useFetchBoards`, `useCreateBoardCredential`, `useDeleteBoardCredential`, `useUpdateBoardCredential`), the `boardType` import, the `isConnectBoardOpen` useState, and the three board handlers (`handleConnectBoard`, `handleDeleteCredential`, `handleEditCredential`). Context now exports only `{ state: { brokerage, isLoading, error }, actions: { handleUpdateBrokerage } }`. React import reduced to `{ useCallback, useMemo }` (NAV-07 satisfied).

**`BrokerageAdminBoard.tsx` (trimmed)** — Removed the `BoardRegistrations` import (line 3) and the entire seven-prop `<BoardRegistrations ... />` JSX block that appeared after `<BrokerageBranding>`. The `isLoading`, `error`, and `!state.brokerage` guard blocks and the `BrokerageInformation` + `BrokerageBranding` renders are unchanged. `/admin/brokerage` now shows only Brokerage Information and Branding (NAV-04 satisfied).

## Verification

- `npm run build` exits 0 — no dangling references to removed `state.boardCredentials`, `state.boards`, `actions.handleConnectBoard`, etc.
- `grep BoardRegistrations BrokerageAdminBoard.tsx` returns nothing — confirmed
- Board hook grep in `BrokerageAdminBoardContext.ts` returns nothing — confirmed
- `BrokerageInformation` and `BrokerageBranding` still present in page render — confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `BrokerageInformation` and `BrokerageBranding` render live brokerage data from `useFetchBrokerage`. The `BoardRegistrations` component file is preserved and used by `/admin/boards` (Plan 01).

## Threat Flags

None. This plan only deletes code — no new network endpoints, auth paths, or trust boundaries introduced. The brokerage fetch/update path is unchanged and still authorized via existing backend guards.

## Self-Check: PASSED

- `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` — MODIFIED (board hooks removed)
- `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx` — MODIFIED (BoardRegistrations removed)
- Commit `b542d71` — EXISTS (git log confirms)
- Commit `4406df4` — EXISTS (git log confirms)
- `npm run build` — PASSES (exit 0 confirmed)

---
phase: 25
plan: 01
subsystem: frontend-routing
tags: [nav, boards, admin, context, routing]
dependency_graph:
  requires: []
  provides: ["/admin/boards route", "useBoardsAdminContext", "BoardsAdminBoard"]
  affects: ["frontend/src/router/admin/admin.tsx", "frontend/src/containers/adminBoard/boardsAdminBoard/"]
tech_stack:
  added: []
  patterns: ["boards-only context hook (subset extraction)", "container loading guard pattern"]
key_files:
  created:
    - frontend/src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts
    - frontend/src/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard.tsx
  modified:
    - frontend/src/router/admin/admin.tsx
decisions:
  - "isLoading derived from useFetchBoardCredentials (not boards) — credentials drive readiness"
  - "No error guard added to BoardsAdminBoard — BoardRegistrations handles empty arrays gracefully"
metrics:
  duration: "82s"
  completed: "2026-05-31T22:32:29Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 25 Plan 01: Board Registrations Nav Separation — New Boards Page Summary

**One-liner:** Self-contained `/admin/boards` route with boards-only context hook extracting the board credential slice from `BrokerageAdminBoardContext`, zero brokerage dependency.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useBoardsAdminContext.ts | 08074cb | `boardsAdminBoard/useBoardsAdminContext.ts` |
| 2 | Create BoardsAdminBoard.tsx + register /admin/boards route | a918cae | `boardsAdminBoard/BoardsAdminBoard.tsx`, `router/admin/admin.tsx` |

## What Was Built

**`useBoardsAdminContext.ts`** — Boards-only context hook that is a strict subset of `BrokerageAdminBoardContext`. Imports and calls `useFetchBoardCredentials`, `useFetchBoards`, `useCreateBoardCredential`, `useDeleteBoardCredential`, `useUpdateBoardCredential`. Returns `{ state: { boardCredentials, boards, isConnectBoardOpen, isLoading }, actions: { setIsConnectBoardOpen, handleConnectBoard, handleDeleteCredential, handleEditCredential } }` via `useMemo`. No `useFetchBrokerage` or `useUpdateBrokerage` dependency (NAV-06 satisfied).

**`BoardsAdminBoard.tsx`** — Container that calls `useBoardsAdminContext()`, shows a loading guard (`Loading board registrations...`) while credentials fetch, then renders `BoardRegistrations` with all seven required props wired from `state`/`actions`. Wraps content in `AdminBoard` following the `DomainsAdminBoard` pattern.

**`admin.tsx`** — Added `import BoardsAdminBoard` after `DomainsAdminBoard` import and inserted `{ element: <BoardsAdminBoard />, path: 'boards' }` route entry after the `brokerage/add-agent` entry.

## Verification

- `npm run build` exits 0 (TypeScript compiles, all imports resolve) — confirmed
- All five board hook imports present in `useBoardsAdminContext.ts` — confirmed
- `useFetchBrokerage` not present in `useBoardsAdminContext.ts` — confirmed
- `path: 'boards'` and `<BoardsAdminBoard />` in `admin.tsx` — confirmed
- `BoardRegistrations` rendered with all seven props — confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `BoardRegistrations` renders live data from `useFetchBoardCredentials` and `useFetchBoards`. The empty state ("No boards connected yet") is rendered by `BoardRegistrations` itself when the arrays are empty — this is correct behavior, not a stub.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced. The `/admin/boards` route sits inside `AdminDomainShell` which already enforces admin auth for all `/admin/*` children.

## Self-Check: PASSED

- `frontend/src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts` — EXISTS
- `frontend/src/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard.tsx` — EXISTS
- `frontend/src/router/admin/admin.tsx` — MODIFIED (boards route added)
- Commit `08074cb` — EXISTS (git log confirms)
- Commit `a918cae` — EXISTS (git log confirms)

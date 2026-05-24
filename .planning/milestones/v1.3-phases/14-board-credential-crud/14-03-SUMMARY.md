---
phase: 14-board-credential-crud
plan: "03"
subsystem: ui
status: checkpoint-pending
tags: [react, tanstack-query, typescript, shadcn, radix-ui, alert-dialog, dropdown-menu]

# Dependency graph
requires:
  - phase: 14-board-credential-crud plan 02
    provides: useDeleteBoardCredential + useUpdateBoardCredential hooks + AlertDialog primitives

provides:
  - EditBoardCredentialDialog component (test-board vs real-board paths, inline error display)
  - BoardRegistrations 5-column grid with per-row DropdownMenu row actions
  - shadcn AlertDialog delete confirmation (controlled pattern, outside Radix tree)
  - BrokerageAdminBoardContext handleDeleteCredential + handleEditCredential actions
  - BrokerageAdminBoard passes both new actions down to BoardRegistrations

affects: [Phase 14 completion — BOARD-06 BOARD-07 BOARD-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled AlertDialog pattern: open prop driven by deleteTarget state, no AlertDialogTrigger in Radix tree — required because trigger is DropdownMenuItem in different Radix context"
    - "fire-and-forget delete: mutate (not mutateAsync), AlertDialog closes immediately on confirm"
    - "Dialog inline error: mutateAsync in context re-throws rejection to dialog catch block, setServerError displays inline below fields"
    - "Can fallback={<span />}: NOT null — preserves grid-cols-5 column alignment when permission absent"

key-files:
  created:
    - frontend/src/components/view/admin/brokerageView/EditBoardCredentialDialog.tsx
  modified:
    - frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx
    - frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts
    - frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx

key-decisions:
  - "14-03-D01: AlertDialog uses controlled pattern (open + onOpenChange) instead of AlertDialogTrigger because the trigger is a DropdownMenuItem inside a different Radix portal tree — nesting AlertDialogTrigger inside DropdownMenuItem causes focus/portal conflicts"
  - "14-03-D02: deleteTarget state lives in BoardRegistrations (local to the table) rather than context — delete targeting is local UI state, not shared across the app"
  - "14-03-D03: variant='destructive' count is 2 in BoardRegistrations (expected) — one for the delete confirmation Button, one for the pre-existing Invalid badge; acceptance criteria says >=1 so this is correct"

# Metrics
duration: 4min
completed: "2026-05-24"
---

# Phase 14 Plan 03: Board Registrations UI (Actions Column) Summary

**PARTIAL SUMMARY — Tasks 1–3 complete; Task 4 (human-verify) pending user approval**

**5-column Board Registrations table with per-row ⋯ dropdown, edit dialog with test-board vs real-board branching, and shadcn AlertDialog delete confirmation — fully wired end-to-end through context**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-24T12:26:54Z
- **Completed (partial):** 2026-05-24T12:29:XX Z
- **Tasks completed:** 3 of 4
- **Files:** 1 created, 3 modified

## Accomplishments

**Task 1 — EditBoardCredentialDialog** (fea0105)
- Created 148-line single-step dialog with test-board / real-board branches
- Test board: blue info notice ("Test board — no credentials required."), "Re-verify connection" submit, autoFocus on submit button
- Real board: RETS Username + Password inputs (autoComplete off/new-password), "Save credentials" submit, autoFocus on username
- Inline server error (`<p className="text-sm text-destructive">`) below fields — no toast on failure
- Reset on close (username, password, serverError, isSubmitting) matching ConnectBoardDialog pattern
- No direct hook or API imports — receives `onEdit` via props; toast fired after successful `await onEdit()`
- Toast copy: "Board connection verified." (test) / "Board credentials updated." (real)

**Task 2 — BoardRegistrations 5-column grid** (7d66e83)
- Replaced `grid-cols-4` with `grid-cols-5` in both header and data rows (0 occurrences of old class remain)
- Added "Actions" header cell (right-aligned text-right)
- Per-row DropdownMenu with "Edit credentials" (setEditTarget) and "Delete connection" (setDeleteTarget) items using `onSelect` (not onClick) for Radix keyboard parity
- Controlled AlertDialog for delete (outside per-row Radix tree) with title "Delete [Board Name] connection?" / "This cannot be undone."
- AlertDialogAction asChild with destructive Button variant
- Mounted EditBoardCredentialDialog with controlled open state
- `Can permission="manage_brokerage_settings" fallback={<span />}` — explicit span preserves grid column alignment when permission absent
- ConnectBoardDialog + existing wiring untouched

**Task 3 — BrokerageAdminBoardContext + pass-through** (a5d8c57)
- Added `useDeleteBoardCredential` (`mutate: deleteCredential`) — fire-and-forget
- Added `useUpdateBoardCredential` (`mutateAsync: updateCredential`) — errors propagate to dialog
- `handleDeleteCredential`: `useCallback((id) => deleteCredential(id), [deleteCredential])`
- `handleEditCredential`: `useCallback(async (id, payload) => await updateCredential({ id, payload }), [updateCredential])`
- Expanded useMemo actions object and dependency array to include both new callbacks
- BrokerageAdminBoard.tsx passes `onDeleteCredential={actions.handleDeleteCredential}` and `onEditCredential={actions.handleEditCredential}` to BoardRegistrations
- All existing actions (handleConnectBoard, handleUpdateBrokerage, setIsConnectBoardOpen) unchanged

## Task Commits

| Task | Name | Commit | Repo |
|------|------|--------|------|
| 1 | Create EditBoardCredentialDialog | fea0105 | frontend/ |
| 2 | Extend BoardRegistrations to 5-column grid | 7d66e83 | frontend/ |
| 3 | Extend BrokerageAdminBoardContext + pass-through | a5d8c57 | frontend/ |
| 4 | Human-verify checkpoint | PENDING | — |

## Verification Results

- `npm run build` exits 0 after each task commit (Vite 5 with TypeScript 4.9 in node_modules — tsconfig uses `moduleResolution: bundler` requiring tsc v5; `npm run build` is the correct type-check method)
- All acceptance criteria grep checks passed for Tasks 1, 2, and 3

## Deviations from Plan

None — plan executed exactly as written.

Notable implementation detail: The plan offered two AlertDialog placement options (per-row inside Can, vs. controlled outside the map). The controlled pattern was chosen (matching the plan's `<action>` section) because AlertDialogTrigger inside a DropdownMenuItem causes Radix portal/focus conflicts — placing AlertDialog outside the map with a single `deleteTarget` state pointer is the correct Radix pattern.

## Known Stubs

None — all state is live and wired to real TanStack Query mutations.

## Threat Surface Scan

No new network endpoints introduced. No new auth paths. Changes are purely frontend UI wiring to existing Plan 01 endpoints (DELETE/PATCH /v1/admin/board_credentials/:id). No new threat surface beyond what was documented in plan threat model.

## Checkpoint Status

**Awaiting:** Task 4 — Human browser verification (sections A–F)
**Resume signal:** User types "approved" after verifying behavior in browser

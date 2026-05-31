---
phase: 25
plan: 03
subsystem: frontend-nav
tags: [nav, boards, brokerage, admin, sidebar, portal]
dependency_graph:
  requires: ["25-01", "25-02"]
  provides: ["AdminBoardSideNav Board Registrations item", "PortalAdminSideNav Brokerage rename + Board Registrations item"]
  affects:
    - frontend/src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx
    - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx
tech_stack:
  added: []
  patterns: ["nav-item insertion (insert at index 1 between existing items)", "icon convention per-file (JSX node vs component reference)"]
key_files:
  created: []
  modified:
    - frontend/src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx
    - frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx
decisions:
  - "AdminBoardSideNav uses JSX-node icon convention (<ClipboardList className='h-4 w-4' />) — matches existing file style"
  - "PortalAdminSideNav uses component-reference icon convention (icon: ClipboardList) — matches existing file style"
  - "Active-state logic left unchanged in both files — /admin/boards does not prefix-overlap /admin/brokerage so no active conflict"
metrics:
  duration: "90s"
  completed: "2026-05-31T22:40:11Z"
  tasks_completed: 2
  files_changed: 2
status: "partial — awaiting human verification (Task 3 checkpoint)"
---

# Phase 25 Plan 03: Board Registrations Nav Separation — Update Both Admin Sidebars

**One-liner:** Added `ClipboardList`-icon "Board Registrations" nav item between "Brokerage" and "Users" in both admin sidebars, and corrected the portal nav's mislabeled first item from "Board Registrations" to "Brokerage".

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Board Registrations item to AdminBoardSideNav (subdomain nav) | 544c05a | `AdminBoardSideNav/AdminBoardSideNav.tsx` |
| 2 | Fix mislabeled item + add Board Registrations to PortalAdminSideNav | 1b9fd9e | `portalAdminShell/PortalAdminSideNav.tsx` |

## Task 3 (Pending)

| Task | Name | Status |
|------|------|--------|
| 3 | Human verify both sidebars and both pages in the running app | Awaiting human verification |

## What Was Built

**`AdminBoardSideNav.tsx` (subdomain admin sidebar)** — Added `ClipboardList` to the `lucide-react` named import and inserted a new nav item at index 1 (between Brokerage and Users) using the file's JSX-node icon convention: `{ label: 'Board Registrations', icon: <ClipboardList className="h-4 w-4" />, path: '/admin/boards' }`. Active-state logic (`location.pathname.startsWith(item.path)`) is unchanged — `/admin/boards` does not prefix-overlap `/admin/brokerage`. Resulting order: Brokerage, Board Registrations, Users, Listing Groups, Settings, Activity.

**`PortalAdminSideNav.tsx` (portal admin sidebar)** — Added `ClipboardList` to the `lucide-react` named import. Renamed the first item's label from the broken `'Board Registrations'` to `'Brokerage'` (Building2 icon and `/admin/brokerage` path unchanged). Inserted a new `'Board Registrations'` item at index 1 using the file's component-reference icon convention: `{ label: 'Board Registrations', icon: ClipboardList, path: '/admin/boards' }`. Active-state logic (`location.pathname === path || location.pathname.startsWith(path + '/')`) is unchanged. Resulting order: Brokerage, Board Registrations, Users, Groups, Domains, Settings.

## Verification (Automated)

- `npm run build` exits 0 — confirmed
- `grep "ClipboardList"` returns matches in both files — confirmed
- `grep "Board Registrations"` returns matches in both `AdminBoardSideNav.tsx` and `PortalAdminSideNav.tsx` — confirmed
- No line in `PortalAdminSideNav.tsx` pairs label `'Board Registrations'` with path `/admin/brokerage` — confirmed (mislabel fixed)
- Nav item ordering verified by `grep -n`: Brokerage < Board Registrations < Users in both files

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Both nav items point to real routes established in Plan 01. The pages render live data.

## Threat Flags

None. This plan edits only static nav-item arrays and adds one icon import per file. No new network endpoints, auth paths, or trust boundaries introduced. Both `/admin/boards` and `/admin/brokerage` routes are children of `AdminDomainShell`, which already enforces admin auth on every `/admin/*` route.

## Self-Check: PASSED

- `frontend/src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx` — MODIFIED (ClipboardList import + Board Registrations nav item added)
- `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` — MODIFIED (ClipboardList import + mislabel fixed + Board Registrations added)
- Commit `544c05a` — EXISTS (Task 1)
- Commit `1b9fd9e` — EXISTS (Task 2)
- `npm run build` — PASSES (exit 0 confirmed)

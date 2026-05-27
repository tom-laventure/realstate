---
phase: 18-dashboard-shell-admin-suite-brokerage-switcher
plan: "03"
subsystem: frontend/portal
tags: [portal, nav, brokerage-switcher, redux, aws-amplify]
dependency_graph:
  requires:
    - "18-01 (activeBrokerage Redux slice, store.getState pattern)"
    - "17-xx (BrokerageSelection, role badge pattern, portal card conventions)"
  provides:
    - "PortalNavBar component for Plan 04 (PortalShell)"
  affects:
    - "frontend/src/containers/portal/PortalShell.tsx (imports PortalNavBar)"
tech_stack:
  added: []
  patterns:
    - "DropdownMenu trigger as brokerage switcher (NavBar.tsx pattern)"
    - "signOut({ global: true }) → clearToken() → window.location.href (NoAccess.tsx pattern)"
    - "Null guard on activeBrokerage before any field access (D-12)"
    - "dispatch-then-navigate for brokerage switch (D-14)"
key_files:
  created:
    - "frontend/src/containers/portal/PortalNavBar.tsx"
  modified: []
decisions:
  - "D-12: PortalNavBar returns null when activeBrokerage is null — loading handled by PortalShell"
  - "D-14: dispatch(setActiveBrokerage) before navigate — Redux must be updated before PortalShell re-validates on mount"
  - "No signingOut state on nav bar sign-out — ghost button, not full-page blocking button like NoAccess"
metrics:
  duration: "1m 8s"
  completed: "2026-05-27"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 18 Plan 03: PortalNavBar — Brokerage Switcher Nav Bar Summary

**One-liner:** PortalNavBar with brokerage DropdownMenu switcher, role badge, and sign-out — reads activeBrokerage and adminBrokerages from Redux, dispatches setActiveBrokerage then navigates on switch.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create PortalNavBar component | 4048502 | frontend/src/containers/portal/PortalNavBar.tsx |

## What Was Built

Created `frontend/src/containers/portal/PortalNavBar.tsx` — a new portal-specific nav bar component that:

- **Left side:** Brokerage name rendered as a `DropdownMenuTrigger` (the switcher). Clicking opens a `DropdownMenu` listing all `adminBrokerages` from Redux. Active brokerage row shows a `Check` icon in `text-primary`. Selecting a non-active brokerage dispatches `setActiveBrokerage(b)` then `navigate('/dashboard/:newId')` — unconditionally, in that order (D-14).
- **Right side:** Role badge (`inline-flex ... rounded-full bg-muted ... capitalize`) matching the Phase 17 `BrokerageSelection.tsx` pattern exactly. Ghost sign-out button using `text-sidebar-foreground hover:bg-sidebar-accent` classes.
- **Null guard:** `if (!activeBrokerage) return null` — renders nothing while PortalShell handles the loading/redirect state (D-12).
- **Sign-out:** `signOut({ global: true }).catch(() => null)` → `clearToken()` → `window.location.href = '/auth/login'` — exact NoAccess.tsx pattern.
- **Nav frame:** `<header className="border-b border-sidebar-border bg-sidebar">` with inner `flex h-16 items-center justify-between gap-3 px-4` — pixel-for-pixel match to `NavBar.tsx`.

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the provided code template in the plan, with all patterns verified against source files (NoAccess.tsx, NavBar.tsx, BrokerageSelection.tsx, activeBrokerage.ts).

## Known Stubs

None. PortalNavBar is a complete, self-contained component. It reads from Redux (populated by upstream flows) and wires all interactions fully.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary changes introduced. The brokerage switcher only shows items from `adminBrokerages[]` which was populated from a validated backend response (T-18-06 reviewed, disposition: accept).

## Self-Check: PASSED

- [x] `frontend/src/containers/portal/PortalNavBar.tsx` — FOUND
- [x] Commit `4048502` — FOUND
- [x] No unexpected file deletions
- [x] No PortalNavBar-specific TypeScript errors

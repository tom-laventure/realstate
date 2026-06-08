---
phase: 29-navbar-brand-unification
plan: "01"
subsystem: frontend
tags: [navbar, brand-logo, dashboard, auth, account-menu]
dependency_graph:
  requires: []
  provides: [DashboardNavBar component, VITE_BRAND_LOGO_URL env var]
  affects: [BrokerageSelection]
tech_stack:
  added: []
  patterns: [conditional-env-var-render, sign-out-mirror-pattern, fragment-wrapper]
key_files:
  created:
    - frontend/src/containers/portal/DashboardNavBar.tsx
  modified:
    - frontend/src/containers/portal/BrokerageSelection.tsx
    - frontend/.env.example
decisions:
  - "DashboardNavBar is a new standalone component (not NavBar.tsx with props) per D-01 — avoids importing notifications bell and auth hooks not needed on /dashboard"
  - "Brand logo is static with no click handler in DashboardNavBar (user is already on /dashboard per D-03/specifics)"
  - "Both loading and main grid return paths render DashboardNavBar; auto-redirect null path skipped (redirects immediately)"
  - "min-h-screen changed to min-h-[calc(100vh-4rem)] in both return paths so content centers below the 64px navbar"
metrics:
  duration_minutes: 3
  completed_date: "2026-06-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 29 Plan 01: DashboardNavBar Creation Summary

## One-Liner

Dedicated `/dashboard` navbar with build-time brand logo (conditionally rendered) and account dropdown mirroring PortalNavBar sign-out flow exactly.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create DashboardNavBar component | 58a6270 | `frontend/src/containers/portal/DashboardNavBar.tsx` (new) |
| 2 | Wire DashboardNavBar into BrokerageSelection and add env var | 57679d8 | `frontend/src/containers/portal/BrokerageSelection.tsx`, `frontend/.env.example` |

## What Was Built

**DashboardNavBar** (`frontend/src/containers/portal/DashboardNavBar.tsx`): New 69-line component rendered at the top of the `/dashboard` brokerage selection screen. Left side: `<img src={import.meta.env.VITE_BRAND_LOGO_URL}>` conditionally rendered only when the env var is truthy — no broken-image icon when empty. Right side: account dropdown with `UserCircle` trigger (`aria-label="account menu"`), "Account Settings" (`navigate('/account')`), and "Sign Out" (mirrors PortalNavBar sign-out verbatim: `signOut({ global: true })` + `dispatch(clearActiveBrokerage())` + `clearToken()` + `window.location.href = '/auth/login'`). No notifications bell, brokerage switcher, or role badge.

**BrokerageSelection wiring**: `DashboardNavBar` imported and rendered as first child of a React fragment in both the loading/spinner return and the main grid return. The single-brokerage auto-redirect path returns null unchanged (immediate redirect, no navbar needed). `min-h-screen` changed to `min-h-[calc(100vh-4rem)]` in both visible return paths so content is vertically centered below the 64px navbar height. `pt-12` removed from grid outer div (navbar provides top separation); replaced with `pt-8`.

**`.env.example`**: `VITE_BRAND_LOGO_URL=` appended as blank entry (operator-optional, build-time constant).

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on first pass.

## Success Criteria Verification

- DASH-05: `/dashboard` shows a navbar with brand logo (left, static) + account menu (Account Settings + Sign Out, right), no brokerage selector/role badge — PASS
- DASH-07 (first half): `VITE_BRAND_LOGO_URL` read via `import.meta.env` in DashboardNavBar and declared in `.env.example` — PASS
- Sign-out mirrors PortalNavBar exactly — PASS
- Empty `VITE_BRAND_LOGO_URL` hides logo with no broken-image icon — PASS
- TypeScript: zero errors referencing DashboardNavBar or BrokerageSelection — PASS

## Known Stubs

None.

## Threat Flags

None — all new surfaces covered by threat model in PLAN.md (T-29-01 through T-29-03). No new network endpoints, auth paths, or trust boundaries introduced beyond what was analyzed.

## Self-Check: PASSED

- `frontend/src/containers/portal/DashboardNavBar.tsx` exists: CONFIRMED
- `frontend/src/containers/portal/BrokerageSelection.tsx` contains `<DashboardNavBar />` (2 occurrences): CONFIRMED
- `frontend/.env.example` ends with `VITE_BRAND_LOGO_URL=`: CONFIRMED
- Task 1 commit 58a6270: CONFIRMED
- Task 2 commit 57679d8: CONFIRMED

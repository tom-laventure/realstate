---
phase: 29-navbar-brand-unification
plan: "02"
subsystem: frontend
tags: [navbar, brand, ux, portal]
dependency_graph:
  requires: []
  provides: [DASH-06, DASH-07-partial]
  affects:
    - frontend/src/containers/portal/PortalNavBar.tsx
tech_stack:
  added: []
  patterns:
    - "import.meta.env.VITE_BRAND_LOGO_URL build-time guard for optional brand logo"
    - "Plain <button> element instead of shadcn Button for logo click target to avoid padding distortion"
key_files:
  created: []
  modified:
    - frontend/src/containers/portal/PortalNavBar.tsx
decisions:
  - "Used plain <button> (not shadcn Button) for brand logo wrapper per UI-SPEC line 156 — Button variant=ghost adds horizontal padding that distorts logo proportions"
  - "VITE_BRAND_LOGO_URL guard checked before rendering both button and img — no orphan gap or broken-image icon when env var is empty"
  - "navigate target hardcoded to '/dashboard' literal — env var never flows into navigation (T-29-01, T-29-02)"
metrics:
  duration: "~15m"
  completed: "2026-06-06T08:50:59Z"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 29 Plan 02: PortalNavBar Brand Logo Summary

## One-liner

Clickable SaaS brand logo (VITE_BRAND_LOGO_URL-guarded, navigates to /dashboard) added left of brokerage switcher; per-brokerage trigger logo removed, favicon hook preserved.

## What Was Built

Modified `PortalNavBar.tsx` with two surgical edits:

1. **Removed** the per-brokerage `brokerageData?.logoUrl` conditional img from inside `DropdownMenuTrigger`. The trigger now shows only `{activeBrokerage.name}` and `ChevronDown`. The `useFetchBrokerage()` hook and `brokerageData` reference are preserved (still used by `useBrowserFavicon`).

2. **Added** a clickable brand logo to the left of the brokerage dropdown. Wrapped in a `flex items-center gap-2` div. The brand logo is a plain `<button>` (not shadcn `Button`) with `onClick={() => navigate('/dashboard')}`, `aria-label="Go to brokerage selection"`, and the img uses `h-8 max-w-[8rem] object-contain` with `alt="Platform logo"`. The entire button+img block is guarded by `import.meta.env.VITE_BRAND_LOGO_URL &&` — when empty/undefined, neither element renders and no gap appears.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove per-brokerage logo from trigger and add clickable brand logo left of switcher | 29b329b (frontend) | frontend/src/containers/portal/PortalNavBar.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Security Notes

- T-29-01: `VITE_BRAND_LOGO_URL` is a build-time Vite constant used only as `<img src>`. Never passed to `navigate()`.
- T-29-02: `navigate('/dashboard')` target is a hardcoded internal route literal — no env var or user input flows into it.

## Known Stubs

None. All data sources are wired: `useBrowserFavicon` still receives `brokerageData?.faviconUrl`, and the brand logo reads from `import.meta.env.VITE_BRAND_LOGO_URL` (operator-controlled).

## Threat Flags

None. All security-relevant surfaces were already in the plan's threat model and handled per dispositions.

## Self-Check: PASSED

- [x] `frontend/src/containers/portal/PortalNavBar.tsx` modified — FOUND
- [x] Commit 29b329b exists in frontend worktree branch — FOUND
- [x] `grep -c "VITE_BRAND_LOGO_URL &&"` returns 1 — PASS
- [x] `grep -c "navigate('/dashboard')"` returns 1 — PASS
- [x] `grep -c "brokerageData.logoUrl"` returns 0 — PASS
- [x] `grep -c "brokerageData?.faviconUrl"` returns 1 — PASS
- [x] `tsc --noEmit` passes with no PortalNavBar errors — PASS

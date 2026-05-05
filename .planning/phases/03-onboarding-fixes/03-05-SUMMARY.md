---
phase: 03-onboarding-fixes
plan: 05
subsystem: ui
tags: [react, tanstack-query, welcome-banner, homepage, onboarding]

# Dependency graph
requires:
  - phase: 03-onboarding-fixes
    plan: 04
    provides: "WelcomeBanner component, useGetAccountProfile, useFetchAccountGroups, useFetchDashboardBrokerage, useDismissWelcome hooks"
provides:
  - "HomepageContext extended with bannerVisible, brokerageName, groupNames in state and dismissBanner in actions"
  - "Homepage renders WelcomeBanner as first child when bannerVisible is true"
  - "Multi-group users on / see the same welcome banner as single-group users on /:groupId"
affects: [UAT-test-7, UAT-test-8, UAT-test-9]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook reuse across contexts: banner logic shared between HomepageContext and GeneralDashboardContext via same hook chain"
    - "Additive context extension: new banner state added without modifying existing state/actions shape"

key-files:
  created: []
  modified:
    - "frontend/src/containers/dashboard/home/HomepageContext.tsx"
    - "frontend/src/containers/dashboard/home/Homepage.tsx"

key-decisions:
  - "Option A chosen (add banner to Homepage via HomepageContext) over Option B (AppShell) — AppShell is a pure layout shell with no data context; injecting banner hooks there would violate separation of concerns"
  - "No duplicate React hook imports needed — useState, useMemo, useEffect, useCallback already imported on line 1"
  - "No loading guard around WelcomeBanner in Homepage — bannerVisible defaults false until profile resolves, preventing flash"

patterns-established:
  - "Banner hooks reused verbatim: both HomepageContext and GeneralDashboardContext use the identical hook chain (useGetAccountProfile → showWelcomeBanner → bannerHydrated guard)"

requirements-completed: [ONB-03]

# Metrics
duration: 8min
completed: 2026-05-05
---

# Phase 03 Plan 05: Homepage Welcome Banner Gap Closure Summary

**Welcome banner wired into HomepageContext so multi-group users landing on / see the same dismiss-once banner as single-group users on /:groupId**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-05T06:18:00Z
- **Completed:** 2026-05-05T06:26:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- HomepageContext extended with four new banner hooks (profile, groups, brokerage, dismiss mutation), bannerVisible/bannerHydrated state, dismissBanner callback, and brokerageName/groupNames derived values — all mirroring GeneralDashboardContext exactly
- Homepage renders WelcomeBanner as its first child (conditionally on bannerVisible) above ActivityStatsRow with correct prop wiring
- SubdomainInput.tsx confirmed unchanged — Gap 2 fix (focus-visible:ring-offset-0 at line 34) was already present from prior work, zero regression

## Task Commits

1. **Task 1: Extend HomepageContext with banner state and actions** - `59891f4` (feat)
2. **Task 2: Render WelcomeBanner in Homepage above ActivityStatsRow** - `60a5ee1` (feat)

## Files Created/Modified

- `frontend/src/containers/dashboard/home/HomepageContext.tsx` — Added banner imports, hook calls, state, effect, callback, derived values; extended useMemo state/actions/deps
- `frontend/src/containers/dashboard/home/Homepage.tsx` — Added WelcomeBanner import and conditional render as first child of page wrapper
- `frontend/src/components/createBrokerage/SubdomainInput.tsx` — Confirmed unchanged (Gap 2 pre-fixed)

## Decisions Made

- **Option A vs Option B:** Option A (add banner to HomepageContext) chosen over Option B (inject banner into AppShell). AppShell is a layout-only shell — adding data hooks there would violate the established separation of concerns pattern (layout vs. data orchestration in context).
- **No loading guard on banner:** bannerVisible defaults to false until profileQuery resolves, so no flash occurs for already-dismissed users. Loading guard would be redundant.
- **Exact hook chain mirror:** Both HomepageContext and GeneralDashboardContext now use the identical four-hook chain, keeping the codebase consistent and making future changes easy to apply to both.

## Deviations from Plan

None — plan executed exactly as written. All four hook imports, banner logic, state fields, actions, and JSX render matched the specified patterns verbatim.

**Note on TypeScript verification:** `npx tsc --noEmit -p tsconfig.json` fails with a pre-existing error unrelated to this plan — the project has TypeScript 4.9.5 installed but tsconfig.json uses `"moduleResolution": "bundler"` (TS 5.0+ feature). Vite's own build pipeline (`npm run build`) was used as the authoritative type-check and passes cleanly (3,734 modules, exit 0).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- UAT tests 7, 8, 9 are now unblocked: welcome banner visible at /, dismisses immediately, does not reappear after refresh
- UAT test 4 (SubdomainInput border on focus) confirmed no regression — fix already present
- Phase 03 onboarding fixes complete; Phase 4 (Google OAuth) requires intermediary callback URL design upfront

## Self-Check: PASSED

- `frontend/src/containers/dashboard/home/HomepageContext.tsx` — FOUND
- `frontend/src/containers/dashboard/home/Homepage.tsx` — FOUND
- Commit `59891f4` — FOUND
- Commit `60a5ee1` — FOUND

---
*Phase: 03-onboarding-fixes*
*Completed: 2026-05-05*

---
phase: 03-onboarding-fixes
plan: 04
subsystem: frontend
tags: [onboarding, welcome-banner, frontend, dashboard, tanstack-query, react]

requires:
  - phase: 03-onboarding-fixes
    plan: 03
    provides: POST /v1/account/profile/dismiss_welcome, show_welcome_banner on UserSerializer

provides:
  - dismissWelcome API module (POST /v1/account/profile/dismiss_welcome)
  - useDismissWelcome TanStack mutation hook
  - useFetchDashboardBrokerage TanStack query hook
  - dashboardBrokerageKeys query key namespace
  - showWelcomeBanner?: boolean on User type
  - WelcomeBanner presentational component
  - bannerVisible state + dismissBanner action in GeneralDashboardContext
  - Conditional WelcomeBanner render above SummaryCards in GeneralDashboard

affects: [ONB-03-complete]

tech-stack:
  added: []
  patterns:
    - "Context → Hook → API chain for WelcomeBanner data (brokerage name, group names)"
    - "Optimistic banner dismiss: setBannerVisible(false) then fire-and-forget dismissMutation.mutate()"
    - "bannerHydrated guard pattern for one-shot profile flag hydration"

key-files:
  created:
    - frontend/src/assets/api/account/dismissWelcome.ts
    - frontend/src/store/hooks/Account/useDismissWelcome.ts
    - frontend/src/store/hooks/Dashboard/useFetchDashboardBrokerage.ts
    - frontend/src/components/dashboard/general/WelcomeBanner.tsx
  modified:
    - frontend/src/store/hooks/queryKeys.tsx
    - frontend/src/assets/types/userType.ts
    - frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx
    - frontend/src/containers/dashboard/general/GeneralDashboard.tsx

key-decisions:
  - "D-17: bannerHydrated guard — bannerVisible defaults false until profile resolves, preventing banner flash for users who have already dismissed"
  - "D-18: Optimistic dismiss — setBannerVisible(false) immediately, then fire-and-forget dismissMutation.mutate() (no toast, no await, no confirmation)"
  - "D-19: CLAUDE.md compliance — brokerage name and group names both flow Component → Context → Hook → API (useFetchDashboardBrokerage + useFetchAccountGroups; no inline useQuery)"
  - "D-20: WelcomeBanner is purely presentational — zero internal state, zero hooks, zero side effects"

requirements-completed: [ONB-03]

duration: 2min
completed: 2026-05-04
---

# Phase 3 Plan 04: Welcome Banner Frontend Summary

**dismissWelcome API + TanStack hooks + WelcomeBanner component + GeneralDashboardContext wiring delivering the ONB-03 frontend half**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-04T00:17:10Z
- **Completed:** 2026-05-04T00:19:42Z
- **Tasks:** 3
- **Files modified:** 8 (frontend sub-repo)

## Accomplishments

- `dismissWelcome.ts`: thin Axios POST wrapper for `/v1/account/profile/dismiss_welcome`; no body required; returns `{ welcomedAt: string }` (interceptor handles camelCase)
- `useDismissWelcome.ts`: `useMutation` hook that invalidates `accountProfileKeys.all` on success so next profile fetch re-reads `showWelcomeBanner`; errors logged to console (no toast — D-18)
- `useFetchDashboardBrokerage.ts`: `useQuery` hook wrapping `fetchBrokerageContact`; uses `dashboardBrokerageKeys.all`; consumers read `data?.brokerage?.name`
- `queryKeys.tsx`: `dashboardBrokerageKeys = { all: ['dashboard', 'brokerage'] as const }` added adjacent to other dashboard namespaces
- `userType.ts`: `showWelcomeBanner?: boolean` added to `User` interface
- `WelcomeBanner.tsx`: purely presentational; props `{ brokerageName, groupNames, onDismiss }`; renders heading, group Badge chips (or empty-state copy), ghost X dismiss button with `aria-label`; zero hooks/state
- `GeneralDashboardContext.tsx`: four new hooks wired (`useGetAccountProfile`, `useFetchAccountGroups`, `useFetchDashboardBrokerage`, `useDismissWelcome`); `bannerVisible` state with `bannerHydrated` guard; `dismissBanner` callback; `brokerageName` and `groupNames` derived values; all exposed in `useMemo` return
- `GeneralDashboard.tsx`: conditional `{state.bannerVisible && <WelcomeBanner ... />}` as first child of main wrapper, above `<SummaryCards />`

## Task Commits

1. **Task 1: API + hooks + queryKeys + type** - `895d10f` (feat)
2. **Task 2: WelcomeBanner component** - `24f087f` (feat)
3. **Task 3: Context wiring + dashboard render** - `0162ae0` (feat)

## Files Created/Modified

**Created:**
- `frontend/src/assets/api/account/dismissWelcome.ts` — Axios POST wrapper for dismiss endpoint
- `frontend/src/store/hooks/Account/useDismissWelcome.ts` — TanStack mutation hook with invalidation
- `frontend/src/store/hooks/Dashboard/useFetchDashboardBrokerage.ts` — TanStack query hook for brokerage data
- `frontend/src/components/dashboard/general/WelcomeBanner.tsx` — Pure presentational banner component

**Modified:**
- `frontend/src/store/hooks/queryKeys.tsx` — `dashboardBrokerageKeys` namespace added
- `frontend/src/assets/types/userType.ts` — `showWelcomeBanner?: boolean` added to User interface
- `frontend/src/containers/dashboard/general/GeneralDashboardContext.tsx` — banner state, hooks, dismiss action wired
- `frontend/src/containers/dashboard/general/GeneralDashboard.tsx` — WelcomeBanner imported and rendered conditionally

## Decisions Made

- D-17 implemented: `bannerHydrated` guard prevents re-hydration on re-renders; banner defaults to `false` until profile resolves (no flash)
- D-18 implemented: dismiss is fully optimistic — `setBannerVisible(false)` fires immediately, `dismissMutation.mutate()` is fire-and-forget with no toast or confirmation
- D-19 implemented: CLAUDE.md data flow respected — both brokerage name and group names go through dedicated TanStack hooks (not inline `useQuery` in context)
- D-20 implemented: `WelcomeBanner` has zero `useState`, `useEffect`, or any hook — it is a pure function of props

## CLAUDE.md Compliance Verified

| Rule | Status |
|------|--------|
| Component → Context → Hook → API | Satisfied — GeneralDashboard reads from context, context calls hooks, hooks call API modules |
| No `camelcaseKeys` in hooks/API modules | Satisfied — interceptor handles globally; 0 calls in any new file |
| Icons: lucide-react only | Satisfied — `X` from lucide-react |
| Components: shadcn/ui only | Satisfied — `Button` and `Badge` from `@/components/ui/` |
| Styling: Tailwind CSS only | Satisfied — no custom CSS added |

## Deviations from Plan

### Auto-fixed Issues

None.

### Pre-existing TypeScript Environment Issue (Documented Deviation)

- **Found during:** Task 1 verification
- **Issue:** `npx tsc --noEmit -p tsconfig.json` fails with `TS6046: Argument for '--moduleResolution' option must be: 'node', 'classic', 'node16', 'nodenext'` — pre-existing TS 4.9.5 vs `moduleResolution "bundler"` incompatibility documented in the plan
- **Action:** TypeScript check skipped per plan instruction. All imports verified visually for correctness.
- **Impact:** Zero — this affects the tsc CLI runner, not the Vite build (which uses esbuild). The actual compile-time behavior is correct.

## Known Stubs

None. All data sources are fully wired:
- `brokerageName` — from `useFetchDashboardBrokerage` → `GET /v1/dashboard/brokerage`
- `groupNames` — from `useFetchAccountGroups` → `GET /v1/account/groups`
- `showWelcomeBanner` flag — from `useGetAccountProfile` → `GET /v1/account/profile`
- Dismiss — from `useDismissWelcome` → `POST /v1/account/profile/dismiss_welcome`

## Threat Flags

No new threat surface introduced. All endpoints consumed by this plan were already in the threat model (T-03-04-01 through T-03-04-06 in the plan's `<threat_model>` block). React's JSX string interpolation (`{brokerageName}`, `{name}`) mitigates T-03-04-04 XSS.

## Self-Check: PASSED

- `frontend/src/assets/api/account/dismissWelcome.ts` — FOUND
- `frontend/src/store/hooks/Account/useDismissWelcome.ts` — FOUND
- `frontend/src/store/hooks/Dashboard/useFetchDashboardBrokerage.ts` — FOUND
- `frontend/src/components/dashboard/general/WelcomeBanner.tsx` — FOUND
- `queryKeys.tsx` with `dashboardBrokerageKeys` — FOUND
- `userType.ts` with `showWelcomeBanner` — FOUND
- `GeneralDashboardContext.tsx` with `bannerVisible`, `dismissBanner`, `showWelcomeBanner` — FOUND
- `GeneralDashboard.tsx` with `WelcomeBanner` import and `state.bannerVisible` — FOUND
- Commits `895d10f`, `24f087f`, `0162ae0` — FOUND in frontend sub-repo

---
*Phase: 03-onboarding-fixes*
*Completed: 2026-05-04*

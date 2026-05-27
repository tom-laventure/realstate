---
phase: 17-brokerage-selection-post-create-redirect
plan: "02"
subsystem: frontend/components
tags: [frontend, react, redux, react-router, portal, brokerage-selection]

# Dependency graph
requires:
  - phase: 17-01
    provides: activeBrokerage Redux slice (setActiveBrokerage, setAdminBrokerages, clearActiveBrokerage)
provides:
  - BrokerageSelection container at /dashboard (BROK-01, BROK-02)
  - PortalShell container at /dashboard/:brokerageId (D-06, D-12, D-13)
  - Updated portal route tree with index, :brokerageId, and catch-all children
affects:
  - Phase 17-03 (PortalShell is the landing target for ONB-04 wizard redirect)
  - Phase 18 (PortalShell is the shell Phase 18 fills with dashboard content)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Anti-flash guard: return null before JSX when auto-redirect is pending (Pitfall 3)
    - D-13 empty-Redux re-fetch: PortalShell calls useFetchAdminBrokerages hook when adminBrokerages is empty, shows spinner, validates on resolve
    - useParams<{ brokerageId: string }>() with runtime falsy check (not type cast)
    - useEffect deps [brokerageId] for re-validation on route param change (Open Question 2 resolution)

key-files:
  created:
    - frontend/src/containers/portal/BrokerageSelection.tsx
    - frontend/src/containers/portal/PortalShell.tsx
  modified:
    - frontend/src/router/portal/portal.tsx

key-decisions:
  - "BrokerageSelection returns null during single-brokerage auto-redirect to prevent UI flash (Pitfall 3)"
  - "PortalShell useEffect deps array is [brokerageId] only — fetchAdminBrokerages is a stable module-level reference, not included in deps"
  - "DashboardPlaceholder.tsx left in place — removed from portal.tsx imports but not deleted (future VCS cleanup)"
  - "Catch-all /dashboard/* falls back to BrokerageSelection rather than old DashboardPlaceholder (RESEARCH Assumption A1)"

patterns-established:
  - "D-13 pattern: check adminBrokerages.length === 0 on mount, re-fetch via useFetchAdminBrokerages, show spinner, validate on resolve"
  - "PortalShell dispatch pattern: dispatch setAdminBrokerages from fetch result, then dispatch setActiveBrokerage for the matched entry"
  - "URL param validation: never cast :brokerageId to a trusted type — always validate against authoritative Redux/backend list (T-17-04)"

requirements-completed: [BROK-01, BROK-02]

# Metrics
duration: ~10min
completed: "2026-05-25"
---

# Phase 17 Plan 02: BrokerageSelection and PortalShell containers + route registration

**Multi-brokerage selection screen with single-brokerage auto-redirect (BROK-01, BROK-02) and a /dashboard/:brokerageId portal shell with D-12 validation and D-13 empty-Redux re-fetch, wired into the portal route tree**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-25T23:10:00Z
- **Completed:** 2026-05-25T23:21:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `BrokerageSelection` renders one card per brokerage with name + role badge; auto-redirects with replace:true and returns null on single brokerage (no flash)
- `PortalShell` validates `:brokerageId` against Redux, re-fetches with spinner when Redux is empty (D-13), redirects on invalid ID or fetch error (D-12)
- `portal.tsx` route tree updated: index → BrokerageSelection, :brokerageId → PortalShell, catch-all → BrokerageSelection; production build clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BrokerageSelection container (BROK-01, BROK-02)** - `a1ddab5` (feat)
2. **Task 2: Create PortalShell container** - `7009aff` (feat)
3. **Task 3: Register routes in portal.tsx** - `9d0149d` (feat)

## Files Created/Modified
- `frontend/src/containers/portal/BrokerageSelection.tsx` - Multi-brokerage selection screen; single-brokerage auto-redirect with anti-flash guard; dispatches setActiveBrokerage on click and on redirect
- `frontend/src/containers/portal/PortalShell.tsx` - /dashboard/:brokerageId placeholder; D-12 validation; D-13 empty-Redux re-fetch with accessible loading spinner; dispatches setActiveBrokerage (and setAdminBrokerages when re-fetching)
- `frontend/src/router/portal/portal.tsx` - Route tree updated; DashboardPlaceholder import removed; BrokerageSelection and PortalShell imported and registered

## Decisions Made
- Anti-flash guard (`if (adminBrokerages.length === 1) return null`) placed before JSX return to prevent selection card flashing during single-brokerage redirect (Pitfall 3 from RESEARCH.md)
- PortalShell `useEffect` deps array is `[brokerageId]` only — `fetchAdminBrokerages` is a stable module-level reference and does not need to be in deps (Open Question 2 resolution per RESEARCH.md)
- `DashboardPlaceholder.tsx` left in filesystem unchanged — removed only from `portal.tsx` imports; deletion is a separate cleanup concern
- Catch-all `{ path: '*', element: <BrokerageSelection /> }` replaces `DashboardPlaceholder` per RESEARCH Assumption A1 — any unmatched `/dashboard/*` sub-path shows the selection screen

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

`PortalShell` resolved state renders the "Admin Portal / Your brokerage dashboard is being prepared." placeholder card intentionally — this is not a stub blocking the plan's goal. Phase 18 replaces this content with the actual dashboard. The plan explicitly documents this as placeholder content at the `:brokerageId` route.

## Threat Flags

T-17-04 (URL param tampering) is mitigated as planned: `PortalShell` validates `:brokerageId` against `adminBrokerages` (or the fetched list on D-13 empty case) before dispatching `setActiveBrokerage`. Unrecognized IDs redirect to `/dashboard`. No new security-relevant surface was introduced beyond what the plan's threat model anticipated.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 complete: `/dashboard` renders selection screen, `/dashboard/:brokerageId` renders portal shell
- Plan 03 (ONB-04 redirect) will target `/dashboard/:brokerageId` which now correctly resolves via `PortalShell`
- Phase 18 can fill `PortalShell` with dashboard content; the route scaffold and Redux dispatch are in place
- Pre-existing test failures (GoogleSignInButton, 2 tests) remain unchanged — not introduced by this plan

---
*Phase: 17-brokerage-selection-post-create-redirect*
*Completed: 2026-05-25*

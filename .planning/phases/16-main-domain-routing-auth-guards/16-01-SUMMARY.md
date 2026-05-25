---
phase: 16-main-domain-routing-auth-guards
plan: 01
subsystem: ui
tags: [react, react-router, typescript, aws-amplify, cognito, tailwind]

requires:
  - phase: 15-backend-api-brokerage-auth-extension
    provides: GET /v1/account/admin_brokerages endpoint returning {id, name, role} per brokerage

provides:
  - AdminBrokerage TypeScript interface (id/name/role with UserRole)
  - FetchAdminBrokeragesResponse type and fetchAdminBrokerages API module
  - useFetchAdminBrokerages imperative wrapper hook
  - NoAccess component with Amplify signOut + clearToken + hard redirect
  - DashboardPlaceholder static placeholder component
  - portalDashboard and noAccess route objects (not yet wired into main.tsx)

affects: [16-02, 17, 18]

tech-stack:
  added: []
  patterns:
    - Imperative hook wrapper (useFetchAdminBrokerages) for fire-once lifecycle components
    - Raw div card pattern (no shadcn Card) for full-page auth screens matching LoginSuccessful
    - Named route object exports (createBrokerage pattern)

key-files:
  created:
    - frontend/src/assets/types/adminBrokerageType.ts
    - frontend/src/assets/api/account/fetchAdminBrokerages.ts
    - frontend/src/store/hooks/Account/useFetchAdminBrokerages.ts
    - frontend/src/containers/portal/NoAccess.tsx
    - frontend/src/containers/portal/DashboardPlaceholder.tsx
    - frontend/src/router/portal/portal.tsx
  modified: []

key-decisions:
  - "16-01-A: useFetchAdminBrokerages is a thin imperative passthrough (not useQuery) — LoginSuccessful is a fire-once lifecycle component that navigates away on completion; a useQuery would be orphaned by the unmount"
  - "16-01-B: noAccess route has no ProtectedRoute wrapper — adding one would create a redirect loop when unauthenticated users reach /no-access"
  - "16-01-C: Both portal components use raw div card pattern (not shadcn Card) — per UI-SPEC.md Card Pattern contract and consistency with LoginSuccessful"

patterns-established:
  - "Imperative hook wrapper: thin hook returning the API function directly for fire-once useEffect patterns"
  - "Portal components: containers/portal/ directory for main-domain-only screens"
  - "Router modules: router/portal/ follows the createBrokerage/auth naming convention"

requirements-completed: [PORTAL-01, AUTH-06]

duration: 4min
completed: 2026-05-25
---

# Phase 16 Plan 01: Foundation Files — Type, API Module, Hook, Components, Routes

**6 additive foundation files for the main-domain portal: AdminBrokerage type, fetchAdminBrokerages API module with imperative wrapper hook, NoAccess and DashboardPlaceholder components, and portalDashboard/noAccess route objects ready for Plan 02 wire-up**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-25T06:03:58Z
- **Completed:** 2026-05-25T06:07:29Z
- **Tasks:** 4
- **Files modified:** 6 (all created)

## Accomplishments

- AdminBrokerage interface typed to Phase 15 backend contract (id/name/role using UserRole union)
- fetchAdminBrokerages API module wrapping GET /v1/account/admin_brokerages with no camelcaseKeys call (interceptor handles it)
- useFetchAdminBrokerages imperative wrapper hook satisfying CLAUDE.md "through a hook" rule without TanStack Query overhead
- NoAccess component with STRIDE T-16-01-01 mitigation: signingOut guard + Amplify signOut({ global: true }) + clearToken + hard redirect
- DashboardPlaceholder static card — exact UI-SPEC.md copy contract
- portalDashboard route object with ProtectedRoute guard and dual children (index + wildcard); noAccess bare route (no ProtectedRoute to avoid redirect loop)
- Full `npm run build` succeeded — all 6 files compile cleanly despite not being wired into main.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: AdminBrokerage type + fetchAdminBrokerages API module** - `7f7c202` (feat)
2. **Task 2: useFetchAdminBrokerages imperative wrapper hook** - `b4d6835` (feat)
3. **Task 3: NoAccess + DashboardPlaceholder components** - `f783543` (feat)
4. **Task 4: portal route configuration** - `20d5477` (feat)

## Files Created/Modified

- `frontend/src/assets/types/adminBrokerageType.ts` — AdminBrokerage interface with id/name/role fields; named export
- `frontend/src/assets/api/account/fetchAdminBrokerages.ts` — Async fetcher for GET /v1/account/admin_brokerages; exports FetchAdminBrokeragesResponse type
- `frontend/src/store/hooks/Account/useFetchAdminBrokerages.ts` — Imperative wrapper hook returning fetchAdminBrokerages function
- `frontend/src/containers/portal/NoAccess.tsx` — Full-page no-access card; Amplify signOut + clearToken + hard redirect; signingOut guard
- `frontend/src/containers/portal/DashboardPlaceholder.tsx` — Static placeholder card; "Admin Portal" heading + "Your brokerage dashboard is being prepared." body
- `frontend/src/router/portal/portal.tsx` — Named exports portalDashboard (ProtectedRoute guard + index/wildcard children) and noAccess (bare route)

## Decisions Made

- **useFetchAdminBrokerages is imperative, not useQuery:** LoginSuccessful mounts → reads Cognito hash → fetches admin brokerages → navigates (unmounts). A useQuery wrapping a component that immediately unmounts would be orphaned. The imperative pattern preserves fire-once semantics while satisfying CLAUDE.md's "through a hook" rule.
- **noAccess route has no ProtectedRoute:** A ProtectedRoute on /no-access would redirect unauthenticated users to /auth/login; after login they'd redirect back to /no-access in a loop. The route is intentionally bare; MainDomainOnly (added in Plan 02) is its only guard.
- **Raw div card pattern:** Both portal components use the same div/class structure as LoginSuccessful (not shadcn Card) per UI-SPEC.md Card Pattern contract.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The tsconfig `--moduleResolution` error seen in `npx tsc` output is pre-existing and unrelated to new files (it does not affect the Vite build).

## Known Stubs

- `DashboardPlaceholder.tsx` — the entire component is an intentional static placeholder. Phase 18 replaces this file with the real brokerage selection UI. This stub is explicitly sanctioned by the plan and does not prevent Plan 01's goal (creating the foundation files for Plan 02 to wire up).

## User Setup Required

None — no external service configuration required. All 6 files are frontend-only additive changes.

## Next Phase Readiness

Plan 02 (16-02) can import all 6 files immediately:
- `useFetchAdminBrokerages` — for LoginSuccessful's main-domain branch
- `portalDashboard` / `noAccess` — for main.tsx router registration
- `NoAccess`, `DashboardPlaceholder` — already referenced by portal.tsx

No blockers. Existing application behavior is unchanged (no routes wired in this plan).

---
*Phase: 16-main-domain-routing-auth-guards*
*Completed: 2026-05-25*

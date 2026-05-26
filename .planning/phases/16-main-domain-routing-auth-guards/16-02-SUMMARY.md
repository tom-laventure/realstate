---
phase: 16-main-domain-routing-auth-guards
plan: 02
subsystem: ui
tags: [react, react-router, typescript, auth, cognito, domain-routing]

requires:
  - phase: 16-01
    provides: portalDashboard and noAccess route objects, useFetchAdminBrokerages hook, AdminBrokerage type

provides:
  - Domain-aware post-login routing in LoginSuccessful via useFetchAdminBrokerages hook
  - main.tsx restructured — auth promoted to top-level, portal routes wired under MainDomainOnly
  - /dashboard/* accessible on main domain with ProtectedRoute guard (AUTH-07)
  - /no-access accessible on main domain without ProtectedRoute (D-08, avoids redirect loop)
  - /auth/login reachable on both main domain and subdomains (D-01)
  - Post-login routing: ≥1 admin brokerage → /dashboard; 0 → /no-access; API failure → error card

affects: [17, 18]

tech-stack:
  added: []
  patterns:
    - Imperative hook call at component top level with effect-level invocation (Rules of Hooks compliance)
    - Auth route promoted to top-level router array for cross-domain accessibility
    - setToken before API call ordering (axios interceptor reads localStorage auth_token)

key-files:
  created: []
  modified:
    - frontend/src/containers/auth/LoginSuccessful.tsx
    - frontend/src/router/main.tsx

key-decisions:
  - "16-02-A: LoginSuccessful calls useFetchAdminBrokerages() at component top level and invokes the returned function inside useEffect — satisfies React Rules of Hooks while preserving fire-once semantics"
  - "16-02-B: setToken(token) placed before fetchAdminBrokerages() call — axios interceptor reads localStorage auth_token to attach Authorization header; reversed order causes 401"
  - "16-02-C: auth route is top-level in the createBrowserRouter array (not inside SubdomainOnly or MainDomainOnly) — enables /auth/login on both domains per D-01"

patterns-established:
  - "Domain-aware post-login routing: isMainDomain() branch inside LoginSuccessful with hook-based API call"
  - "Auth route at top level of router array for cross-domain accessibility"

requirements-completed: [PORTAL-01, AUTH-05, AUTH-06, AUTH-07]

duration: 1min
completed: 2026-05-25
---

# Phase 16 Plan 02: Router Wire-Up — auth promoted, portal routes integrated, domain-aware post-login routing via useFetchAdminBrokerages hook

**Domain-aware LoginSuccessful routes to /dashboard or /no-access after fetching admin brokerages via hook; main.tsx wires portalDashboard and noAccess under MainDomainOnly and promotes auth to top-level for cross-domain accessibility**

## Performance

- **Duration:** ~1 min (both files already correctly implemented by a prior execution)
- **Started:** 2026-05-26T01:19:46Z
- **Completed:** 2026-05-26T01:20:00Z
- **Tasks:** 2 auto tasks completed (Task 3 is checkpoint:human-verify — paused)
- **Files modified:** 2

## Accomplishments

- LoginSuccessful.tsx extended with isMainDomain() branch: on main domain, calls useFetchAdminBrokerages hook's returned function and routes to /dashboard (≥1 admin) or /no-access (0 admins), with existing error card on API failure (D-04)
- main.tsx restructured: dead LoginSuccessful import removed, portalDashboard and noAccess imported from ./portal/portal, auth promoted from SubdomainOnly.children to top-level array entry, portalDashboard and noAccess added to MainDomainOnly.children
- Full `npm run build` succeeded — 3815 modules compiled without errors
- All acceptance criteria passed for both tasks

## Task Commits

Each task was committed atomically (in the frontend sub-repo):

1. **Task 1: Extend LoginSuccessful with domain-aware post-token routing** - `2a04219` (feat)
2. **Task 2: Restructure main.tsx — promote auth, add portal routes, remove dead import** - `f8cb925` (feat)

Task 3 (checkpoint:human-verify) — pending human verification.

## Files Created/Modified

- `frontend/src/containers/auth/LoginSuccessful.tsx` — Added isMainDomain and useFetchAdminBrokerages imports; hook called at component top level; useEffect replaced with domain-branching logic: setToken → clear hash → subdomain: navigate(destination) / main domain: fetchAdminBrokerages() → /dashboard or /no-access; existing loading spinner and error card JSX preserved verbatim
- `frontend/src/router/main.tsx` — Removed dead LoginSuccessful import; added portalDashboard+noAccess import from ./portal/portal; removed auth from SubdomainOnly.children; added auth as top-level array entry; added portalDashboard and noAccess to MainDomainOnly.children; wildcard remains last

## Decisions Made

- **useFetchAdminBrokerages() called at component top level:** React Rules of Hooks require unconditional hook calls. Even though the returned function is only invoked on the main domain (inside the effect's `if (!isMainDomain())` branch), the hook itself is called once at the top of the component body on every render.
- **setToken before fetch:** The axios instance reads `auth_token` from localStorage to build the Authorization header. If fetchAdminBrokerages() fires before setToken(), the request goes out without credentials and gets a 401 — the global 401 interceptor then clears the token and redirects to login, breaking the flow entirely.
- **auth at top level (not inside MainDomainOnly):** Placing auth inside MainDomainOnly would prevent /auth/login from rendering on subdomains. The auth route must be domain-agnostic, accessible on both main domain and any brokerage subdomain.

## Deviations from Plan

None — both files were already correctly implemented by a prior execution of this plan. All acceptance criteria passed on initial verification. Build succeeded without modification.

## Issues Encountered

None. The pre-existing tsconfig `--moduleResolution` error (appearing in `npx tsc --noEmit` output) is unrelated to this plan's changes and does not affect the Vite build.

## Verification Results

All Task 1 acceptance criteria: PASS
- isMainDomain import present
- useFetchAdminBrokerages import present (hook, not API module directly)
- API module NOT imported directly in LoginSuccessful.tsx (count: 0)
- Hook called at component top level (line 11, before useEffect at line 13)
- isMainDomain() branch present
- fetchAdminBrokerages() invocation present
- data.adminBrokerages.length > 0 check present
- navigate('/dashboard', { replace: true }) present
- navigate('/no-access', { replace: true }) present
- .catch(() => { setError(true) }) present
- No camelcaseKeys calls
- Only 1 useState call in component body (error boolean, no new state added)
- Existing "Something went wrong" error JSX preserved
- Existing "Finalizing your sign-in" loading JSX preserved
- No TypeScript errors mentioning LoginSuccessful

All Task 2 acceptance criteria: PASS
- LoginSuccessful dead import removed (count: 0)
- portalDashboard and noAccess imported from ./portal/portal
- children: [createBrokerage, portalDashboard, noAccess] in MainDomainOnly block
- auth NOT inside SubdomainOnly.children
- auth IS a top-level router array entry
- auth NOT inside MainDomainOnly.children
- Wildcard path: '*' present exactly once (last entry)
- No TypeScript errors mentioning router/main
- `npm run build` exits 0

## Requirement Mapping

| Requirement | Verification Scenario | Status |
|-------------|----------------------|--------|
| PORTAL-01 | Scenario A: /dashboard/* renders portal placeholder on main domain | Pending human-verify (Task 3) |
| AUTH-05 | Scenario C: Main domain login with ≥1 admin role → /dashboard | Pending human-verify (Task 3) |
| AUTH-06 | Scenario D: Main domain login with 0 admin roles → /no-access | Pending human-verify (Task 3) |
| AUTH-07 | Scenario B: Unauthenticated /dashboard redirects to /auth/login | Pending human-verify (Task 3) |

## User Setup Required

None — no external service configuration required. Changes are frontend-only modifications to existing files.

## Next Phase Readiness

Pending Task 3 checkpoint verification. After human verification passes:
- All 4 requirements (PORTAL-01, AUTH-05, AUTH-06, AUTH-07) confirmed complete
- Phase 16 complete — ready for Phase 17 (brokerage selection screen replacing DashboardPlaceholder)
- Phase 18 (real portal shell) also unblocked

## Known Stubs

- `DashboardPlaceholder.tsx` (created in Plan 01) — the entire component is an intentional static placeholder rendering "Admin Portal — Your brokerage dashboard is being prepared." Phase 18 replaces this with the real brokerage selection and portal shell. The plan explicitly sanctions this stub as the Phase 16 deliverable per D-05.

---
*Phase: 16-main-domain-routing-auth-guards*
*Completed: 2026-05-25*

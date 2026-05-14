---
phase: 06-frontend-domain-routing-guards
plan: 01
subsystem: ui
tags: [react, react-router, domain-routing, guards, vite, vitest, typescript]

# Dependency graph
requires:
  - phase: 05-calendar-sync
    provides: frontend test infrastructure (vitest, renderWithProviders, vi.stubEnv pattern)
provides:
  - isMainDomain() pure utility function reading VITE_MAIN_DOMAIN vs window.location.hostname
  - SubdomainOnly guard (renders NotFound on main domain, Outlet on brokerage subdomains)
  - MainDomainOnly guard (redirects to / on brokerage subdomains, Outlet on main domain)
  - NotFound.tsx page per UI-SPEC (flex centering, design system tokens, no CTA)
  - Updated router with domain-aware route tree wrapping
  - .env.example documenting all required env vars including VITE_MAIN_DOMAIN
affects: [07-backend-domain-enforcement, any phase adding new routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain guard pattern: named exports SubdomainOnly/MainDomainOnly follow ProtectedRoute Outlet shape"
    - "isMainDomain() pure utility: hostname === import.meta.env.VITE_MAIN_DOMAIN — no React coupling"
    - "Guard tests use vi.stubEnv + vi.stubGlobal for environment and hostname control"
    - "VITE_MAIN_DOMAIN=localhost in .env for local dev (gitignored); documented in .env.example"

key-files:
  created:
    - frontend/src/helpers/domain.ts
    - frontend/src/helpers/domain.test.ts
    - frontend/src/components/common/guards/DomainGuard.tsx
    - frontend/src/components/common/guards/DomainGuard.test.tsx
    - frontend/src/containers/errorPage/NotFound.tsx
    - frontend/.env.example
  modified:
    - frontend/src/router/main.tsx
    - frontend/.env

key-decisions:
  - "D-01: DomainGuard as root guard components wrapping route subtrees — not a bootstrap-time router split"
  - "D-02: UX enforcement only — documented in DomainGuard source comments with Phase 7 as the real security boundary"
  - "D-03: Wildcard route uses NotFound (not ErrorPage) as final router entry"
  - "D-04: VITE_MAIN_DOMAIN=localhost for local dev (gitignored .env); .env.example has placeholder value"

patterns-established:
  - "Guard components: named exports only (no default), Outlet for pass-through, conditional render/Navigate for block"
  - "Test pattern: vi.stubEnv('VITE_MAIN_DOMAIN', ...) + vi.stubGlobal('location', { hostname: ... }) in afterEach cleanup"
  - "Router structure: domain guards wrap route subtrees before ProtectedRoute; wildcard NotFound is last"

requirements-completed: [DOM-01, DOM-02, DOM-03]

# Metrics
duration: 2min
completed: 2026-05-14
---

# Phase 6 Plan 01: Frontend Domain Routing Guards Summary

**React Router domain access control via SubdomainOnly/MainDomainOnly guards reading VITE_MAIN_DOMAIN, with dedicated NotFound page and 8 unit tests covering all guard behaviors**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-14T06:18:23Z
- **Completed:** 2026-05-14T06:20:39Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified in frontend sub-repo)

## Accomplishments
- isMainDomain() pure utility compares window.location.hostname to VITE_MAIN_DOMAIN (4 unit tests)
- SubdomainOnly guard blocks main-domain visitors with NotFound; SubdomainOnly passes through on brokerage subdomains
- MainDomainOnly guard silently redirects to / on brokerage subdomains; passes through on main domain
- NotFound.tsx matches UI-SPEC exactly: flex centering, text-foreground/text-muted-foreground design tokens, no CTA
- Router updated: domain guards wrap correct route subtrees, wildcard uses NotFound as final entry
- .env.example created documenting all required env vars

## Task Commits

Each task was committed atomically in the frontend sub-repo:

1. **Task 1: Create domain.ts utility and NotFound page** - `da08da6` (feat)
2. **Task 2: Create DomainGuard.tsx and wire into router** - `4e435b4` (feat)
3. **Task 3: Full test suite run and smoke verification** - no code changes (verification only)

**Plan metadata:** (committed with SUMMARY.md, STATE.md, ROADMAP.md)

## Files Created/Modified
- `frontend/src/helpers/domain.ts` - isMainDomain() pure utility, UX-only, no React coupling
- `frontend/src/helpers/domain.test.ts` - 4 unit tests (vi.stubEnv + vi.stubGlobal pattern)
- `frontend/src/components/common/guards/DomainGuard.tsx` - SubdomainOnly and MainDomainOnly named exports
- `frontend/src/components/common/guards/DomainGuard.test.tsx` - 4 integration tests for both guards
- `frontend/src/containers/errorPage/NotFound.tsx` - 404 page per UI-SPEC (no useRouteError, no CTA)
- `frontend/src/router/main.tsx` - Domain-aware router with guard-wrapped subtrees
- `frontend/.env` - Added VITE_MAIN_DOMAIN=localhost (gitignored, not committed)
- `frontend/.env.example` - All env vars documented with placeholder values

## Decisions Made
- Followed plan decisions D-01 through D-07 exactly as specified
- .env is gitignored so VITE_MAIN_DOMAIN=localhost was added locally but not committed; .env.example committed instead
- isMainDomain() import count in DomainGuard.tsx is 3 (1 import + 2 guard usages) — both guards correctly use it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures in `GoogleSignInButton.test.tsx` (2 tests) — these tests look for button text matching `/sign in with google/i` but the button renders "Continue with Google". This is a pre-existing mismatch introduced by a prior phase and is entirely unrelated to the domain routing work in this plan. Per scope boundary rules, these are not fixed here.

## User Setup Required

None for automated tests. For manual browser verification:
- `VITE_MAIN_DOMAIN=localhost` is set in `frontend/.env` — local dev treats localhost as main domain
- Visiting `http://localhost:3000/dashboard` will render "Page not found" (SubdomainOnly fires)
- Visiting `http://localhost:3000/create` will render the brokerage creation wizard (MainDomainOnly passes through)
- To test subdomain behavior: temporarily set `VITE_MAIN_DOMAIN=realtybase.ca` and restart dev server

## Next Phase Readiness
- Frontend UX domain routing guards are complete (DOM-01, DOM-02, DOM-03 satisfied)
- Phase 7 can add backend 403 enforcement — DomainGuard comments already document this as the pending security boundary
- Any new routes added to the router must be placed inside the appropriate guard wrapper (SubdomainOnly or MainDomainOnly)

---
*Phase: 06-frontend-domain-routing-guards*
*Completed: 2026-05-14*

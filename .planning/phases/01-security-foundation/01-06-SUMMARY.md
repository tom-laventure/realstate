---
phase: 01-security-foundation
plan: "06"
subsystem: ui
tags: [react, axios, security, toast, react-hot-toast, react-router]

# Dependency graph
requires:
  - phase: 01-02
    provides: Axios interceptor base with 401/403 no-access handlers already in place

provides:
  - Sign-in form with no hardcoded test credentials (SEC-02)
  - Sign-in form with no console.log leaking response data (DEBT-01 partial)
  - Generic 403 Axios interceptor branch: toast.error + router.navigate('/') (SEC-08)

affects: [01-07, any plan modifying axios.ts or sign-in flow]

# Tech tracking
tech-stack:
  added: [react-hot-toast (already present, now wired into axios interceptor), router from @/router/main]
  patterns:
    - "Generic 403 toast+redirect: toast.error before router.navigate — React tree stays mounted for toast to render"
    - "router.navigate('/') for client-side redirect — avoids full page reload that destroys toast queue"

key-files:
  created: []
  modified:
    - frontend/src/components/common/form/signIn/signIn.tsx
    - frontend/src/assets/axios/axios.ts

key-decisions:
  - "D-21: router.navigate('/') used instead of window.location.href for generic 403 redirect — preserves React tree so toast renders"
  - "D-22: Generic 403 branch comes AFTER no-access 403 branch — no-access redirect takes priority when next_step field is present"
  - "D-23: No clearToken() call on generic 403 — authorization failure does not invalidate identity; user stays logged in"

patterns-established:
  - "403 interceptor pattern: no-access branch first, generic branch second — order matters for branch priority"

requirements-completed: [SEC-02, SEC-08]

# Metrics
duration: 8min
completed: "2026-05-02"
---

# Phase 1 Plan 06: Credential Removal and Generic 403 Handler Summary

**Hardcoded test credentials and console.log removed from sign-in form; generic 403 Axios interceptor added with react-hot-toast notification and client-side router redirect**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-02T01:27:00Z
- **Completed:** 2026-05-02T01:35:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Removed `defaultValue="anthony@muller-schiller.test"` and `defaultValue="password123"` from sign-in inputs — credentials no longer appear in production HTML source
- Removed `console.log(response)` from sign-in form — login response details no longer leak to browser console
- Added generic 403 interceptor branch to axios.ts: shows `toast.error("You don't have permission to do that")` and calls `router.navigate('/')` for client-side navigation
- Preserved existing 403+no-access branch unchanged — `/auth/brokerage-contact` redirect behavior intact

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove defaultValue credentials and console.log from sign-in form** - `1116562` (fix)
2. **Task 2: Add generic 403 handler branch to Axios interceptor** - `33093db` (feat)

**Plan metadata:** (committed with SUMMARY/STATE/ROADMAP update)

## Files Created/Modified
- `frontend/src/components/common/form/signIn/signIn.tsx` - Removed 3 items: two defaultValue props (email + password) and console.log from responseFacebook handler
- `frontend/src/assets/axios/axios.ts` - Added toast + router imports; added generic 403 interceptor branch after existing no-access branch

## Decisions Made
- **D-21:** `router.navigate('/')` used instead of `window.location.href = '/'` for generic 403 redirect. Full page reload destroys the React tree including the Toaster component, so the toast would silently disappear. Client-side navigation keeps React mounted so the toast renders and persists.
- **D-22:** New generic 403 branch placed AFTER the existing `next_step=no-access` branch. This ensures that when `next_step: no-access` is present, the no-access redirect fires exclusively. The generic branch only fires when `next_step` is absent or set to something other than `no-access`.
- **D-23:** No `clearToken()` call in the generic 403 branch. A 403 is an authorization failure (insufficient permissions), not an authentication failure (invalid identity). Logging the user out would be incorrect UX.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SEC-02 and SEC-08 requirements satisfied
- Axios interceptor is ready for Plan 07 work on additional security concerns
- Toast infrastructure is now wired into the global error handling layer

---
*Phase: 01-security-foundation*
*Completed: 2026-05-02*

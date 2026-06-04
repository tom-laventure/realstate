---
phase: 26-root-route-fix
verified: 2026-06-03T23:16:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Unauthenticated user on main domain — navigate to /"
    expected: "Browser URL changes to /dashboard then immediately to /auth/login — NotFound page never appears"
    why_human: "React Router component-level navigation cannot be verified without a running browser; the logic trace confirms the code path but DOM rendering needs smoke test"
  - test: "Unauthenticated user on brokerage subdomain — navigate to /"
    expected: "Browser immediately shows /auth/login with no blank-screen flash (no observable delay from domain lookup)"
    why_human: "Timing of blank-screen elimination is a perceived UX behavior — cannot measure absence of flicker programmatically"
  - test: "Authenticated user on both domains — verify no regression"
    expected: "Authenticated user on subdomain at / renders Homepage; authenticated user on main domain at / is redirected to /dashboard (BrokerageSelection)"
    why_human: "Requires valid session token to test the authenticated code path"
  - test: "joinBrokerage invite link without auth — visit /invite/:token on subdomain"
    expected: "JoinBrokerage page renders without redirect to /auth/login"
    why_human: "Requires a real invite token and subdomain environment to confirm the no-ProtectedRoute path works end-to-end"
---

# Phase 26: Root Route Fix — Verification Report

**Phase Goal:** Fix two root-route edge cases so unauthenticated users always land on the login page — never a 404 or blank screen.
**Verified:** 2026-06-03T23:16:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unauthenticated user on main domain visiting / is redirected to /dashboard then /auth/login — no NotFound page | VERIFIED | `SubdomainOnly` (DomainGuard.tsx:16-18) checks `pathname === '/'` on main domain and returns `<Navigate to="/dashboard" replace />`. `/dashboard` route (`portal.tsx:7-16`) wraps in `<ProtectedRoute />`, which redirects unauthenticated users to `/auth/login`. DomainGuard test "redirects to /dashboard on main domain at /" passes. |
| 2 | Unauthenticated user on subdomain visiting / is redirected to /auth/login immediately — no blank-screen wait from domain lookup | VERIFIED | `PrimaryDomainRedirect` (line 23) short-circuits with `if (isMainDomain() \|\| !isAuthenticated())`, calls `setReady(true)` and returns without calling `lookupDomain`. `ProtectedRoute` then redirects to `/auth/login`. Dedicated test "skips lookup for unauthenticated users and renders Outlet immediately (ROUTE-02)" passes. |
| 3 | Authenticated users on both domains are unaffected | VERIFIED | `SubdomainOnly` redirect fires only at `pathname === '/'`; all other paths render `<NotFound />` as before. `PrimaryDomainRedirect` short-circuit only fires when `!isAuthenticated()` — authenticated users still exercise the full `lookupDomain` path. PrimaryDomainRedirect lookup tests (lines 60-105) all use `mockIsAuthenticated.mockReturnValue(true)` in `beforeEach` and pass. |
| 4 | joinBrokerage invite links on subdomains still work without authentication | VERIFIED | `joinBrokerage` (path `/invite`) is a sibling of `ProtectedRoute` inside `PrimaryDomainRedirect`'s children (main.tsx:28-35). When `!isAuthenticated()` fires `setReady(true)`, `<Outlet />` renders and React Router matches `/invite/:token` to `joinBrokerage` — which has no `ProtectedRoute` wrapper. No regression introduced. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/common/guards/DomainGuard.tsx` | ROUTE-01 fix — redirect / → /dashboard on main domain inside SubdomainOnly | VERIFIED | Contains `useLocation` import, `pathname` destructure, and `if (pathname === '/') return <Navigate to="/dashboard" replace />` inside `isMainDomain()` branch. 5 DomainGuard tests all pass. |
| `frontend/src/components/common/guards/PrimaryDomainRedirect.tsx` | ROUTE-02 fix — auth-aware early-return skipping domain lookup for unauthenticated users | VERIFIED | Contains `import { isAuthenticated } from '@/lib/auth'` and condition `if (isMainDomain() \|\| !isAuthenticated())` at line 23. 6 PrimaryDomainRedirect tests all pass including dedicated ROUTE-02 test. |

**Note on plan artifact deviation:** The PLAN specified `frontend/src/router/main.tsx` as the ROUTE-01 artifact. During execution, a code review identified the index route in `MainDomainOnly` (Block 2) as unreachable dead code — React Router selects Block 1 (`SubdomainOnly`) for URL `/` first. The correct fix was placed in `DomainGuard.tsx` (`SubdomainOnly` component). `main.tsx` was not modified. The SUMMARY.md documents this deviation explicitly. The alternative implementation achieves the same behavioral goal.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DomainGuard.tsx` (SubdomainOnly) | `/dashboard` redirect | `<Navigate to="/dashboard" replace />` inside `pathname === '/'` branch | WIRED | Navigate imported from react-router-dom (line 1); useLocation imported (line 1); pathname check at line 15-17 |
| `PrimaryDomainRedirect.tsx` | `@/lib/auth` | `isAuthenticated` import + call in useEffect | WIRED | Import at line 4; call at line 23 inside useEffect early-return condition |
| `portal.tsx` (portalDashboard) | Auth guard | `element: <ProtectedRoute />` wrapping children | WIRED | portalDashboard.element is `<ProtectedRoute />` (portal.tsx:9); ProtectedRoute redirects to `/auth/login` when `!isAuthenticated()` |
| `joinBrokerage` route | PrimaryDomainRedirect Outlet | Sibling of ProtectedRoute in PrimaryDomainRedirect children | WIRED | main.tsx:34 places `joinBrokerage` as a child of `PrimaryDomainRedirect` but outside `ProtectedRoute` |

### Data-Flow Trace (Level 4)

Not applicable — these are routing guards (navigation control), not data-rendering components. No dynamic data variables are rendered.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| DomainGuard ROUTE-01 tests | `npx vitest run DomainGuard.test.tsx` | 5/5 pass | PASS |
| PrimaryDomainRedirect ROUTE-02 tests | `npx vitest run PrimaryDomainRedirect.test.tsx` | 6/6 pass | PASS |
| TypeScript build | `npm run build` | exits 0, no errors | PASS |
| Pre-existing test failures | `npx vitest run` | 4 failures in RequireRole + GoogleSignInButton (pre-existing, unrelated to phase 26) | INFO |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ROUTE-01 | 26-01-PLAN.md | Unauthenticated user visiting `/` on main domain redirected to `/dashboard` → `/auth/login` | SATISFIED | DomainGuard.tsx SubdomainOnly: `pathname === '/' && isMainDomain()` → `<Navigate to="/dashboard" replace />`; portalDashboard wraps in ProtectedRoute |
| ROUTE-02 | 26-01-PLAN.md | Unauthenticated user visiting `/` on brokerage subdomain redirected immediately — no blank-screen flash | SATISFIED | PrimaryDomainRedirect.tsx: `!isAuthenticated()` early-return skips `lookupDomain` and sets `ready=true` immediately |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO, FIXME, placeholder, or stub patterns found in the modified files. No hardcoded empty arrays or empty returns in routing logic.

### Human Verification Required

#### 1. Main Domain Root Redirect — End-to-End

**Test:** Open a browser to the main domain URL (e.g., `https://realtybase.ca/`) while signed out.
**Expected:** Browser is redirected to `/dashboard` (no NotFound page visible), then immediately redirected to `/auth/login` (the login form appears). Total time on `/` and `/dashboard` should be imperceptible.
**Why human:** React Router's client-side navigation happens in-browser. The code logic is verified, but the actual DOM render sequence (no NotFound flash, correct final URL) requires visual confirmation.

#### 2. Subdomain Root — No Blank Screen Flash

**Test:** Open a browser to a brokerage subdomain at exactly `/` (e.g., `https://acme.realtybase.ca/`) while signed out. Observe loading behavior.
**Expected:** The page goes directly to `/auth/login` with no perceptible blank-screen pause. Previously, the blank screen would appear during the `lookupDomain` API call (~100-500ms network roundtrip).
**Why human:** Absence of a timing artifact (blank screen) cannot be verified programmatically from code inspection alone. Requires subjective perception of the redirect speed in a real browser.

#### 3. Authenticated User Regression Check

**Test:** Sign in to the app. Navigate to `/` on both the main domain and a brokerage subdomain.
**Expected:** Main domain `/` redirects to `/dashboard` (BrokerageSelection page). Subdomain `/` renders the brokerage homepage (Homepage component inside AppShell) without redirecting to login.
**Why human:** Requires a valid session token to exercise the authenticated code path through `isAuthenticated()=true`.

#### 4. joinBrokerage Invite Link Without Auth

**Test:** On a brokerage subdomain, visit `/invite` or `/invite/:token` while signed out.
**Expected:** The JoinBrokerage page renders (not the login page). The invite flow is accessible to unauthenticated users.
**Why human:** Requires a real invite token and subdomain environment. The code trace confirms `joinBrokerage` is outside `ProtectedRoute`, but the full flow (token validation, UI render) needs smoke testing.

### Gaps Summary

No automated gaps found. All 4 must-have truths are verified by code inspection and passing test suite. Four human verification items remain for smoke testing in a live environment — these are routine pre-release checks, not blockers.

---

_Verified: 2026-06-03T23:16:00Z_
_Verifier: Claude (gsd-verifier)_

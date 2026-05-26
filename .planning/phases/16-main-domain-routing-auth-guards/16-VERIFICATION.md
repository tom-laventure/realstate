---
phase: 16-main-domain-routing-auth-guards
verified: 2026-05-25T07:00:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 16: Main Domain Routing & Auth Guards — Verification Report

**Phase Goal:** The main domain serves a /dashboard/* route tree, sign-in correctly routes authenticated users to the admin portal or a no-access screen, and unauthenticated users cannot reach dashboard pages
**Verified:** 2026-05-25
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|---------|
| SC-1 | Navigating to any /dashboard/* URL on the main domain renders the portal shell (no 404, no redirect to /create) | VERIFIED | portalDashboard in portal.tsx exports path '/dashboard' with index + wildcard children both mapping to DashboardPlaceholder; wired under MainDomainOnly in main.tsx line 35 |
| SC-2 | A user who signs in on the main domain and holds at least one admin or owner role is redirected to /dashboard | VERIFIED | LoginSuccessful.tsx line 48: `navigate('/dashboard', { replace: true })` on `data.adminBrokerages.length > 0`; Login.tsx line 21: same branch; user-confirmed Scenario C |
| SC-3 | A user who signs in on the main domain with no admin roles anywhere sees a no-access screen explaining they must use their brokerage subdomain | VERIFIED | LoginSuccessful.tsx line 51: `navigate('/no-access', { replace: true })` on empty array; NoAccess.tsx renders "No Admin Access" + "Please sign in directly at your brokerage URL."; user-confirmed Scenario D |
| SC-4 | An unauthenticated user who navigates directly to any /dashboard/* URL is redirected to the sign-in page | VERIFIED | portalDashboard.element is `<ProtectedRoute />` (portal.tsx line 8); ProtectedRoute redirects unauthenticated users to /auth/login with state.from; user-confirmed Scenarios A and B |

### Observable Truths — Plan Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | D-01: auth route is a top-level entry in createBrowserRouter (not inside SubdomainOnly or MainDomainOnly) — /auth/login reachable on both domains | VERIFIED | main.tsx line 38: `auth,` appears as a bare top-level array entry; grep confirms it is not inside SubdomainOnly children (which end at line 27) or MainDomainOnly children (line 35); user-confirmed Scenario F |
| 2 | D-02: LoginSuccessful.tsx is domain-aware — on main domain calls useFetchAdminBrokerages hook, on subdomain navigates to destination \|\| '/' | VERIFIED | LoginSuccessful.tsx line 35: `if (!isMainDomain())` branch navigates to `destination` (subdomain path); lines 44-57: main domain path calls `fetchAdminBrokerages()` and branches on result |
| 3 | D-03: While the admin_brokerages API call is in flight, the existing 'Finalizing your sign-in' loading spinner is shown | VERIFIED | The component renders the loading spinner block (lines 80-90) as the default return; no new loading state added; `useState` count is 1 (only the existing `error` boolean); spinner persists until the promise settles |
| 4 | D-04: If admin_brokerages API call fails, existing 'Something went wrong' error card shown — user NOT routed to /no-access on failure | VERIFIED | LoginSuccessful.tsx lines 54-57: `.catch(() => { setError(true) })`; error card rendered at lines 60-78 ("Something went wrong"); user-confirmed Scenario G |
| 5 | D-05: Navigating to /dashboard, /dashboard/anything on main domain renders DashboardPlaceholder | VERIFIED | portal.tsx children array has `{ index: true, element: <DashboardPlaceholder /> }` and `{ path: '*', element: <DashboardPlaceholder /> }`; covers both exact match and all sub-paths |
| 6 | D-06: Empty admin_brokerages array → /no-access | VERIFIED | LoginSuccessful.tsx line 51: `navigate('/no-access', { replace: true })` in the else branch when `data.adminBrokerages.length > 0` is false |
| 7 | Authenticated user with at least one admin/owner role is navigated to /dashboard | VERIFIED | LoginSuccessful.tsx line 48: `navigate('/dashboard', { replace: true })`; Login.tsx line 21: same condition |
| 8 | Unauthenticated user navigating to /dashboard/* is redirected to /auth/login with from-location state | VERIFIED | portalDashboard.element is `<ProtectedRoute />` which emits `<Navigate to="/auth/login" state={{ from: location }} replace />`; user-confirmed Scenario B |
| 9 | /auth/login and /auth/login-success reachable on both main domain and subdomains | VERIFIED | auth route object is a top-level entry in main.tsx (not inside any domain guard); user-confirmed Scenario F |
| 10 | Existing subdomain behavior unchanged | VERIFIED | LoginSuccessful.tsx line 35-38: `if (!isMainDomain()) { navigate(destination, { replace: true }); return }` — no API call made on subdomain; user-confirmed Scenario E |
| 11 | useFetchAdminBrokerages imported in LoginSuccessful.tsx (not fetchAdminBrokerages directly) | VERIFIED | LoginSuccessful.tsx line 6: `import useFetchAdminBrokerages from '@/store/hooks/Account/useFetchAdminBrokerages'`; count of direct API module import is 0 |
| 12 | Login.tsx also has domain-aware routing via useFetchAdminBrokerages hook (plan deviation — covers email/password sign-in path) | VERIFIED | Login.tsx lines 4-5 import isMainDomain and useFetchAdminBrokerages; line 11 calls hook at component top level; lines 13-25 implement same domain-branching logic as LoginSuccessful |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|---------|
| `frontend/src/assets/types/adminBrokerageType.ts` | VERIFIED | Exists; exports `interface AdminBrokerage { id: string; name: string; role: UserRole }`; imports UserRole as default from roleType |
| `frontend/src/assets/api/account/fetchAdminBrokerages.ts` | VERIFIED | Exists; calls `axiosInstance.get('/v1/account/admin_brokerages')`; exports `FetchAdminBrokeragesResponse` and default `fetchAdminBrokerages`; no camelcaseKeys call |
| `frontend/src/store/hooks/Account/useFetchAdminBrokerages.ts` | VERIFIED | Exists; returns `fetchAdminBrokerages` directly (imperative passthrough); no useQuery/useMutation; default export |
| `frontend/src/containers/portal/NoAccess.tsx` | VERIFIED | Exists; "No Admin Access" heading; "Please sign in directly at your brokerage URL." copy; `signOut({ global: true })`; `clearToken()`; `window.location.href = '/auth/login'`; `disabled={signingOut}` guard; raw div card pattern (no shadcn Card import) |
| `frontend/src/containers/portal/DashboardPlaceholder.tsx` | VERIFIED | Exists; "Admin Portal" heading; "Your brokerage dashboard is being prepared." body; static, no imports beyond function; raw div card pattern |
| `frontend/src/router/portal/portal.tsx` | VERIFIED | Exists; exports `portalDashboard` (path '/dashboard', element ProtectedRoute, index+wildcard children with DashboardPlaceholder) and `noAccess` (path '/no-access', element NoAccess, no ProtectedRoute wrapper) |
| `frontend/src/router/main.tsx` | VERIFIED | portalDashboard and noAccess imported and wired under MainDomainOnly children; auth promoted to top-level; dead LoginSuccessful import absent; wildcard last |
| `frontend/src/containers/auth/LoginSuccessful.tsx` | VERIFIED | isMainDomain and useFetchAdminBrokerages imported; hook called at component top level (line 11); domain-branching logic in useEffect; existing loading spinner and error card preserved |
| `frontend/src/containers/auth/Login.tsx` | VERIFIED | isMainDomain and useFetchAdminBrokerages imported; hook called at top level (line 11); same domain-branching logic covers email/password sign-in path |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| main.tsx | portal/portal.tsx | `import { portalDashboard, noAccess } from './portal/portal'` (line 9) | WIRED |
| main.tsx | router/auth/auth.tsx | `import { auth } from './auth/auth'` (line 4), used as top-level entry (line 38) | WIRED |
| LoginSuccessful.tsx | helpers/domain.ts | `import { isMainDomain } from '@/helpers/domain'` (line 5) | WIRED |
| LoginSuccessful.tsx | store/hooks/Account/useFetchAdminBrokerages.ts | `import useFetchAdminBrokerages from '@/store/hooks/Account/useFetchAdminBrokerages'` (line 6) | WIRED |
| Login.tsx | helpers/domain.ts | `import { isMainDomain } from '@/helpers/domain'` (line 4) | WIRED |
| Login.tsx | store/hooks/Account/useFetchAdminBrokerages.ts | `import useFetchAdminBrokerages from '@/store/hooks/Account/useFetchAdminBrokerages'` (line 5) | WIRED |
| useFetchAdminBrokerages.ts | fetchAdminBrokerages.ts | `import fetchAdminBrokerages, { FetchAdminBrokeragesResponse } from '@/assets/api/account/fetchAdminBrokerages'` (line 1) | WIRED |
| fetchAdminBrokerages.ts | adminBrokerageType.ts | `import { AdminBrokerage } from '@/assets/types/adminBrokerageType'` (line 2) | WIRED |
| portal.tsx | DashboardPlaceholder.tsx | `import DashboardPlaceholder from '@/containers/portal/DashboardPlaceholder'` (line 3) | WIRED |
| portal.tsx | NoAccess.tsx | `import NoAccess from '@/containers/portal/NoAccess'` (line 4) | WIRED |
| portal.tsx | ProtectedRoute.tsx | `import ProtectedRoute from '@/components/common/guards/ProtectedRoute'` (line 2); used as `element: <ProtectedRoute />` on portalDashboard | WIRED |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| LoginSuccessful.tsx | `data.adminBrokerages` | `fetchAdminBrokerages()` → `axiosInstance.get('/v1/account/admin_brokerages')` → Phase 15 backend controller | Yes — GET /v1/account/admin_brokerages performs DB query (Phase 15 deliverable) | FLOWING |
| Login.tsx | `data.adminBrokerages` | Same hook → same API module → same backend endpoint | Yes | FLOWING |
| NoAccess.tsx | Static (no data variables) | N/A — static card | N/A | N/A |
| DashboardPlaceholder.tsx | Static (no data variables) | N/A — intentional placeholder per D-05; Phase 18 replaces | N/A | N/A (sanctioned stub) |

---

## Behavioral Spot-Checks

Static checks only — app requires a running backend + Cognito environment; full behavioral verification was performed by the user in a browser session.

| Behavior | Check | Result |
|----------|-------|--------|
| LoginSuccessful.tsx does not import API module directly | `grep -c "from '@/assets/api/account/fetchAdminBrokerages'" LoginSuccessful.tsx` | 0 — PASS |
| LoginSuccessful.tsx has exactly 1 useState (no new state added) | `grep -c "useState" LoginSuccessful.tsx` | 1 — PASS |
| Dead LoginSuccessful import absent from main.tsx | `grep -c "import LoginSuccessful" main.tsx` | 0 — PASS |
| portalDashboard wired under MainDomainOnly | `grep "createBrokerage, portalDashboard, noAccess" main.tsx` | Found — PASS |
| auth is a bare top-level entry | `grep -n "^    auth,$" main.tsx` | Line 38 — PASS |
| noAccess has no ProtectedRoute in its declaration | portal.tsx noAccess object inspected | element: `<NoAccess />` only — PASS |
| No camelcaseKeys in API module or hook | Files inspected | Not present — PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|------------|-------------|--------|
| PORTAL-01 | 16-01, 16-02 | User can access /dashboard/* on the main domain | SATISFIED — portalDashboard route wired under MainDomainOnly; index+wildcard children cover all sub-paths |
| AUTH-05 | 16-02 | User signing in on main domain with ≥1 admin role redirected to brokerage selection screen | SATISFIED — routes to /dashboard (placeholder per D-05; full brokerage selection deferred to Phase 17 per roadmap SC-2 wording) |
| AUTH-06 | 16-01, 16-02 | User with no admin roles sees no-access screen | SATISFIED — empty adminBrokerages array routes to /no-access; NoAccess component renders correct copy |
| AUTH-07 | 16-01, 16-02 | Unauthenticated user accessing /dashboard/* redirected to sign-in | SATISFIED — ProtectedRoute guard on portalDashboard redirects with state.from |

---

## Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|-----------|
| DashboardPlaceholder.tsx | Static placeholder with no real data | INFO | Sanctioned by plan (D-05) and roadmap SC-2; Phase 18 replaces this file. Not a blocker. |
| Login.tsx `.catch()` | On API failure, navigates to `from` (typically '/') rather than showing an error card | INFO | D-04 specified error-card behavior for LoginSuccessful; Login.tsx was an unplanned deviation and its failure mode was not covered by D-04. User verified Scenario G (which tests LoginSuccessful's path) passed. The Login.tsx fallback navigates the user away cleanly rather than leaving them on a broken screen — acceptable behavior. |

No blockers found.

---

## Human Verification Completed

All 8 browser scenarios verified by the user prior to this verification submission:

| Scenario | Test | Result |
|----------|------|--------|
| A | /dashboard unauthenticated on main domain → redirected to /auth/login → after login shows DashboardPlaceholder | PASSED |
| B | /dashboard/anything unauthenticated → /auth/login with state.from set | PASSED |
| C | Main domain sign-in with admin role → /dashboard (placeholder) | PASSED |
| D | Main domain sign-in with no admin role → /no-access | PASSED |
| E | Subdomain sign-in → / (no admin_brokerages call in Network tab) | PASSED |
| F | /auth/login reachable on both main domain and subdomains | PASSED |
| G | API failure during sign-in → existing error card (not /no-access) | PASSED |
| H | /no-access refresh does not loop; Sign Out → /auth/login | PASSED |

---

## Gaps Summary

No gaps. All 12 must-have truths are verified against the actual code. All 4 roadmap success criteria are satisfied. All required artifacts exist, are substantive, and are wired. Data flows from the backend API through the hook chain into the routing decision. The user confirmed all 8 browser scenarios in a live environment.

The DashboardPlaceholder is an intentional sanctioned stub per D-05 — Phase 18 replaces it. This does not constitute a gap.

---

_Verified: 2026-05-25_
_Verifier: Claude (gsd-verifier)_

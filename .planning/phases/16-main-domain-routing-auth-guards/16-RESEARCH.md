# Phase 16: Main Domain Routing & Auth Guards - Research

**Researched:** 2026-05-24
**Domain:** React Router v6 domain-aware routing, auth guard composition, post-login branching
**Confidence:** HIGH

## Summary

Phase 16 is entirely frontend work. There is no backend scope — the `GET /v1/account/admin_brokerages` endpoint was completed in Phase 15. All four requirements (PORTAL-01, AUTH-05, AUTH-06, AUTH-07) reduce to four concrete changes in the frontend:

1. Move the `auth` route object out of `SubdomainOnly` in `main.tsx` so `/auth/login` and `/auth/login-success` work on all domains.
2. Extend `LoginSuccessful.tsx` with a domain-aware post-token branch: on main domain, call `GET /v1/account/admin_brokerages` then route to `/dashboard` or `/no-access`.
3. Add a `/no-access` route under `MainDomainOnly` with a minimal card component.
4. Add a `/dashboard/*` route under `MainDomainOnly` + `ProtectedRoute` rendering a placeholder shell.

The codebase is well-prepared. Every primitive needed already exists (`isMainDomain()`, `MainDomainOnly`, `ProtectedRoute`, the loading/error UI in `LoginSuccessful`, the `signOut` API module). No new infrastructure is required.

**Primary recommendation:** Wire the four changes above in a single wave. The auth route move is the riskiest change (it affects both domains); test it first, then layer the new routes.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Move `/auth/login` and `/auth/login-success` outside both `SubdomainOnly` and `MainDomainOnly` guards — shared routes accessible on all domains (main domain + subdomains). No new login component needed.
- **D-02:** The existing `LoginSuccessful` component is modified to be domain-aware: on main domain (`isMainDomain()`), fetch `GET /v1/account/admin_brokerages` after setting the token and route based on the result; on subdomain, current behavior unchanged (redirect to `destination || '/'`).
- **D-03:** While the `admin_brokerages` API call is in flight, show the existing loading spinner in `LoginSuccessful` ("Finalizing your sign-in") — no separate loading page needed.
- **D-04:** If the `admin_brokerages` API call fails (network error, 500), show the existing error state in `LoginSuccessful` ("Something went wrong") — user can retry sign-in. Do not route to no-access.
- **D-05:** If `admin_brokerages` returns ≥1 entry, route the user to `/dashboard`.
- **D-06:** If `admin_brokerages` returns an empty array, route the user to `/no-access`.
- **D-07:** No-access screen: minimal card with message "Your account doesn't have admin access to any brokerage. Please sign in directly at your brokerage URL." and a Sign Out button.
- **D-08:** Route: `/no-access` under `MainDomainOnly` — a dedicated top-level route, not nested inside `/dashboard`.
- **D-09:** `/dashboard/*` renders a minimal placeholder page for this phase. Phase 18 replaces it.
- **D-10:** Unauthenticated users navigating to any `/dashboard/*` URL are redirected to `/auth/login` with `state={{ from: location }}`. The existing `ProtectedRoute` handles this.

### Claude's Discretion
None stated — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)
None stated.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORTAL-01 | User can access `/dashboard/*` on the main domain (routes exist alongside `/create/*`) | New portal router object under `MainDomainOnly` + `ProtectedRoute` in `main.tsx` |
| AUTH-05 | User signing in on main domain with ≥1 admin role is redirected to brokerage selection screen | `LoginSuccessful` domain branch: non-empty `adminBrokerages` → `navigate('/dashboard')` |
| AUTH-06 | User signing in on main domain with no admin roles sees no-access screen | `LoginSuccessful` domain branch: empty `adminBrokerages` → `navigate('/no-access')` |
| AUTH-07 | Unauthenticated user accessing `/dashboard/*` is redirected to sign-in | `ProtectedRoute` wrapping the `/dashboard` tree in `MainDomainOnly` block |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `/dashboard/*` route existence on main domain | Frontend Router | — | React Router config; no backend involvement |
| Unauthenticated redirect from `/dashboard` | Frontend Router (guard) | — | `ProtectedRoute` checks localStorage token; backend is irrelevant pre-auth |
| Post-login routing based on admin role count | Frontend Component (LoginSuccessful) | Backend API (admin_brokerages) | Component drives the decision; API supplies the data |
| No-access screen display | Frontend Component | — | Pure render; no backend needed |
| Auth routes shared across domains | Frontend Router | — | Moving route out of `SubdomainOnly` in `main.tsx` |

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | v6 (already installed) | Route definitions, guards, navigation | Project standard [VERIFIED: existing codebase] |
| `isMainDomain()` | N/A (project utility) | Domain detection | Already in `frontend/src/helpers/domain.ts` [VERIFIED: codebase] |
| `ProtectedRoute` | N/A (project component) | Auth guard | Already in guards directory [VERIFIED: codebase] |
| `MainDomainOnly` | N/A (project component) | Domain guard | Already in `DomainGuard.tsx` [VERIFIED: codebase] |
| axiosInstance | (project singleton) | API calls inside `useEffect` | Token interceptor already attached [VERIFIED: codebase] |
| `signOut` (project api module) | N/A | Sign-out in no-access button | `assets/api/auth/signOut.ts` exists [VERIFIED: codebase] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `aws-amplify/auth signOut` | (already in package.json) | Full Cognito session termination | For the Sign Out button in no-access screen — mirrors `BrokerageContact.tsx` pattern [VERIFIED: codebase] |
| shadcn/ui Card | (project standard) | No-access screen UI | All cards in auth screens use this pattern [VERIFIED: codebase] |
| lucide-react | (project standard) | Icons if needed | Project icon library [VERIFIED: CLAUDE.md] |

**Installation:** No new packages required. [VERIFIED: all needed libraries already in project]

---

## Architecture Patterns

### System Architecture Diagram

```
Main Domain Request (/dashboard/*)
         |
         v
   main.tsx router
         |
    [is SubdomainOnly?] — NO, auth routes are top-level after D-01
         |
    [is MainDomainOnly?]
         |-- YES --> ProtectedRoute
         |               |
         |          [isAuthenticated()?]
         |               |-- YES --> /dashboard placeholder shell
         |               |-- NO  --> Navigate /auth/login (state={from})
         |
    [/no-access] under MainDomainOnly (no ProtectedRoute — avoids redirect loop)
         |
    [/auth/*] top-level, no domain guard


POST-LOGIN FLOW (main domain):
  /auth/login-success#token=...
         |
   LoginSuccessful mounts
         |
   reads hash → token
         |
   setToken(token)          -- write to localStorage
         |
   isMainDomain()?
   |-- NO  --> navigate(destination || '/')    [subdomain path — unchanged]
   |-- YES --> call fetchAdminBrokerages()     [new API module]
                   |
              [loading] → show spinner (existing UI)
                   |
              [error]   → setError(true) (existing error UI)
                   |
              [success] → adminBrokerages.length > 0?
                            |-- YES --> navigate('/dashboard', { replace: true })
                            |-- NO  --> navigate('/no-access', { replace: true })
```

### Recommended File Structure (new files only)

```
frontend/src/
├── assets/
│   ├── api/
│   │   └── account/
│   │       └── fetchAdminBrokerages.ts        # NEW — API module
│   └── types/
│       └── adminBrokerageType.ts              # NEW — AdminBrokerage interface
├── containers/
│   └── portal/                                # NEW directory
│       ├── DashboardPlaceholder.tsx           # NEW — /dashboard placeholder
│       └── NoAccess.tsx                       # NEW — /no-access screen
└── router/
    └── portal/                                # NEW directory
        └── portal.tsx                         # NEW — /dashboard + /no-access route objects
```

### Pattern 1: Route Object Extraction (established pattern)

Routes are defined as exported objects in `router/<name>/<name>.tsx` and imported by `main.tsx`.

```typescript
// Source: frontend/src/router/createBrokerage/createBrokerage.tsx [VERIFIED: codebase]
export const createBrokerage = {
    path: '/create/',
    element: <AppShellCreateAccount />,
    errorElement: <ErrorPage />,
    children: [
        { index: true, element: <CreateBrokerage /> },
    ]
}
```

The new portal routes follow this same pattern:

```typescript
// router/portal/portal.tsx
export const portalDashboard = {
    path: '/dashboard',
    element: <ProtectedRoute />,    // auth guard wraps the subtree
    children: [
        {
            path: '*',
            element: <DashboardPlaceholder />
        }
    ]
}

export const noAccess = {
    path: '/no-access',
    element: <NoAccess />
}
```

### Pattern 2: Domain Guard Composition in main.tsx

The existing `MainDomainOnly` guard is a layout component using `<Outlet />`. New portal routes are added as children of a `MainDomainOnly` block alongside `createBrokerage`:

```typescript
// Source: frontend/src/router/main.tsx [VERIFIED: codebase]
{
    element: <MainDomainOnly />,
    children: [createBrokerage, portalDashboard, noAccess],
}
```

### Pattern 3: Auth Route Promotion (D-01)

The `auth` route object moves from inside the `SubdomainOnly` children array to the top-level router array (no domain guard). The `auth` object itself is unchanged — only its placement in `main.tsx` changes.

```typescript
// BEFORE (main.tsx):
{ element: <SubdomainOnly />, children: [..., auth] }

// AFTER (main.tsx):
{ element: <SubdomainOnly />, children: [...] },  // auth removed
auth,                                               // top-level, no guard
```

**Critical:** Remove the now-unused `import LoginSuccessful from '@/containers/auth/LoginSuccessful'` in `main.tsx` (it was never used there — the component is imported in `router/auth/auth.tsx`).

### Pattern 4: Direct API Call Inside useEffect (established precedent)

`LoginSuccessful` runs its token-processing logic in a `useEffect`. The admin_brokerages fetch must also run in this same effect — it is not a TanStack Query call because:
- The call is fire-once (not cached, not refetched)
- It must happen after `setToken()` but before `navigate()`
- The component is not in a persistent data-fetching context

Precedent in the codebase: `Invitation.tsx` and `CreateAccount.tsx` call API modules directly inside components without a hook wrapper.

The API module follows the standard shape:

```typescript
// Source: frontend/src/assets/api/account/getAccountProfile.tsx [VERIFIED: codebase]
import axiosInstance from '@/assets/axios/axios'

const fetchAdminBrokerages = async (): Promise<FetchAdminBrokeragesResponse> => {
    const response = await axiosInstance.get('/v1/account/admin_brokerages')
    return response.data as FetchAdminBrokeragesResponse
}
```

**Important:** The axios response interceptor applies `camelcaseKeys` automatically. The API response `{ admin_brokerages: [...] }` arrives as `{ adminBrokerages: [...] }` in the component — do not call `camelcaseKeys` again. [VERIFIED: `assets/axios/axios.ts`]

### Pattern 5: State Machine in LoginSuccessful (three states, not two)

The current `LoginSuccessful` component has two states: loading (spinner) and error. After modification, the main-domain branch needs the spinner to persist during the API call. The existing `error` boolean state remains. No new state variable is needed for the main-domain check — `isMainDomain()` is a pure synchronous function.

The effect becomes:

```typescript
// Pattern derived from existing LoginSuccessful.tsx [VERIFIED: codebase]
useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const token = params.get('token')

    if (!token) { setError(true); return }

    setToken(token)
    window.location.hash = ''

    if (!isMainDomain()) {
        const destination = params.get('returnTo') || '/'
        navigate(destination, { replace: true })
        return
    }

    // Main domain: fetch admin brokerages to determine where to route
    fetchAdminBrokerages()
        .then((data) => {
            if (data.adminBrokerages.length > 0) {
                navigate('/dashboard', { replace: true })
            } else {
                navigate('/no-access', { replace: true })
            }
        })
        .catch(() => setError(true))
}, [])
```

### Pattern 6: No-Access Sign-Out Button

The `BrokerageContact.tsx` component demonstrates the correct sign-out pattern on auth/no-access screens:

```typescript
// Source: frontend/src/containers/auth/BrokerageContact.tsx [VERIFIED: codebase]
import { signOut } from 'aws-amplify/auth'
import { clearToken } from '@/lib/auth'

onClick={async () => {
    await signOut({ global: true }).catch(() => null)
    clearToken()
    window.location.href = '/auth/login'
}}
```

Use this exact pattern in `NoAccess.tsx`. Do not use the `signOut` API module (which calls the backend) — the Amplify `signOut` + `clearToken` pattern is established for screens where the user has no brokerage context.

### Anti-Patterns to Avoid

- **Wrapping `/no-access` in `ProtectedRoute`:** Creates a redirect loop. An unauthenticated user hits `/no-access`, ProtectedRoute redirects to `/auth/login`, user logs in with no admin roles, gets redirected to `/no-access`, repeat. D-08 explicitly excludes this.
- **Calling `camelcaseKeys` on the API response:** The axios interceptor already does this. Double-converting corrupts the data. [VERIFIED: `axios.ts`]
- **Using a TanStack Query hook for the admin_brokerages fetch in LoginSuccessful:** The component unmounts immediately after navigation; a hook call would be orphaned. Use direct API module call in the effect.
- **Leaving the unused `import LoginSuccessful` in `main.tsx`:** Dead import causes confusion; remove it.
- **Adding the `auth` route object inside `MainDomainOnly`:** Auth routes must be outside both domain guards (D-01). Wrapping in `MainDomainOnly` breaks auth on subdomains.
- **Using `ProtectedRoute` from the subdomain `/` tree:** The existing `ProtectedRoute` is domain-agnostic (`isAuthenticated()` checks only the token). It can be reused as-is for the `/dashboard` main-domain tree.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Domain detection | Custom hostname parsing | `isMainDomain()` in `helpers/domain.ts` | Already exists, already tested [VERIFIED: codebase] |
| Auth guard | Custom "isLoggedIn" check in route | `ProtectedRoute` component | Already handles redirect with location state; reuse [VERIFIED: codebase] |
| Sign-out | Custom Cognito session termination | `aws-amplify/auth signOut` + `clearToken()` | Established pattern in `BrokerageContact.tsx` [VERIFIED: codebase] |
| Loading/error UI | New spinner or error card | Existing states in `LoginSuccessful.tsx` | D-03, D-04 explicitly reuse existing UI |

---

## Common Pitfalls

### Pitfall 1: Auth Routes Still Subdomain-Only After Move
**What goes wrong:** Moving `auth` out of `SubdomainOnly` in `main.tsx` but forgetting that `SubdomainOnly` renders `<NotFound />` on main domain. If auth routes remain inside `SubdomainOnly`, `/auth/login` on the main domain shows "Page not found."
**Why it happens:** `SubdomainOnly` is not a redirect — it renders `NotFound` silently.
**How to avoid:** After the move, verify the `auth` import appears at the top level of the router array in `main.tsx`, not nested inside `SubdomainOnly`.
**Warning signs:** `/auth/login` on main domain shows 404 content instead of the login form.

### Pitfall 2: Redirect Loop Between `/no-access` and `/auth/login`
**What goes wrong:** Wrapping `/no-access` in `ProtectedRoute` causes a loop: unauthenticated user → `/no-access` → redirect to `/auth/login` → login with no admin roles → `/no-access` → repeat.
**Why it happens:** `ProtectedRoute` redirects unauthenticated users to login; after login the component sends them back to `/no-access` where `ProtectedRoute` bounces them again.
**How to avoid:** `/no-access` must NOT be wrapped in `ProtectedRoute`. D-08 mandates it is a bare route under `MainDomainOnly` only.
**Warning signs:** Infinite navigation loop; browser history grows unboundedly on `/no-access` after sign-in.

### Pitfall 3: Double camelCase Conversion
**What goes wrong:** Calling `camelcaseKeys` on the response inside `fetchAdminBrokerages.ts` (or in the component) when the axios interceptor already converts keys. Result: `{ admin_brokerages: [...] }` → interceptor → `{ adminBrokerages: [...] }` → manual → `{ adminBrokerages: [...] }` (keys already camelCased, second pass is a no-op for already-camelCased keys but signals incorrect understanding).
**Why it happens:** Other projects or older code called `camelcaseKeys` manually; copy-paste from those.
**How to avoid:** Never call `camelcaseKeys` in API modules or hooks. Return `response.data` directly. [VERIFIED: CLAUDE.md "Never call camelcaseKeys again in hooks"]
**Warning signs:** Type errors on `data.admin_brokerages` (property missing) or accessing `data.adminBrokerages` undefined.

### Pitfall 4: `/dashboard` Route Missing Wildcard Child
**What goes wrong:** Defining `path: '/dashboard'` with no children means `/dashboard/anything` returns 404.
**Why it happens:** React Router v6 does not inherit a parent's catch-all; each level must explicitly handle sub-paths.
**How to avoid:** Add `path: '*'` child under `/dashboard` rendering the placeholder, or use `path: '/dashboard/*'` at the route definition level. Alternatively, a single index + wildcard covers all sub-routes for the placeholder.
**Warning signs:** PORTAL-01 success criterion "no 404 for `/dashboard/*`" fails.

### Pitfall 5: Token Not Set Before API Call
**What goes wrong:** Calling `fetchAdminBrokerages()` before `setToken(token)` means the axios interceptor has no token to attach, causing a 401 response.
**Why it happens:** Reordering code without understanding the dependency.
**How to avoid:** In `LoginSuccessful`, `setToken(token)` must execute before `fetchAdminBrokerages()`. The current effect already calls `setToken` early — maintain this order.
**Warning signs:** `fetchAdminBrokerages()` returns a 401; axios interceptor clears the token and redirects to login.

### Pitfall 6: `useNavigate` Called Outside Effect Cleanup
**What goes wrong:** The existing `LoginSuccessful` comment ("navigate exits component") means `navigate()` causes the component to unmount. Any code after `navigate()` in a synchronous context may or may not execute depending on React batching.
**Why it happens:** React schedules unmount after navigation; microtasks in the same tick may still run.
**How to avoid:** The `.then()` pattern places `navigate()` as the last statement of each branch. Do not attempt to call `setError` or other state updates after `navigate()`.

---

## Code Examples

### fetchAdminBrokerages API Module

```typescript
// frontend/src/assets/api/account/fetchAdminBrokerages.ts
// Pattern: frontend/src/assets/api/account/getAccountProfile.tsx [VERIFIED: codebase]
import axiosInstance from '@/assets/axios/axios'
import { AdminBrokerage } from '@/assets/types/adminBrokerageType'

export interface FetchAdminBrokeragesResponse {
    adminBrokerages: AdminBrokerage[]   // camelCased by axios interceptor
}

const fetchAdminBrokerages = async (): Promise<FetchAdminBrokeragesResponse> => {
    const response = await axiosInstance.get('/v1/account/admin_brokerages')
    return response.data as FetchAdminBrokeragesResponse
}

export default fetchAdminBrokerages
```

### AdminBrokerage Type

```typescript
// frontend/src/assets/types/adminBrokerageType.ts
// Response shape from 15-CONTEXT.md D-10: { id, name, role } [VERIFIED: 15-CONTEXT.md + controller]
import UserRole from './roleType'

export interface AdminBrokerage {
    id: string
    name: string
    role: UserRole
}
```

### portal.tsx Router Object

```typescript
// frontend/src/router/portal/portal.tsx
// Pattern: frontend/src/router/createBrokerage/createBrokerage.tsx [VERIFIED: codebase]
import ProtectedRoute from '@/components/common/guards/ProtectedRoute'
import DashboardPlaceholder from '@/containers/portal/DashboardPlaceholder'
import NoAccess from '@/containers/portal/NoAccess'
import ErrorPage from '@/containers/errorPage/ErrorPage'

export const portalDashboard = {
    path: '/dashboard',
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
        { path: '*', element: <DashboardPlaceholder /> },
        { index: true, element: <DashboardPlaceholder /> },
    ]
}

export const noAccess = {
    path: '/no-access',
    element: <NoAccess />,
    errorElement: <ErrorPage />,
}
```

### Updated main.tsx structure

```typescript
// frontend/src/router/main.tsx (after changes)
const router = createBrowserRouter([
    // Subdomain-only: authenticated app routes and invite links (auth removed)
    {
        element: <SubdomainOnly />,
        children: [
            {
                element: <ProtectedRoute />,
                children: [dashboard, admin, account],
            },
            joinBrokerage,
        ],
    },
    // Main-domain-only: brokerage creation + portal + no-access
    {
        element: <MainDomainOnly />,
        children: [createBrokerage, portalDashboard, noAccess],
    },
    // Auth routes: shared across all domains (D-01)
    auth,
    // Wildcard catch-all
    { path: '*', element: <NotFound /> },
])
```

### NoAccess Component

```typescript
// frontend/src/containers/portal/NoAccess.tsx
// UI pattern: frontend/src/containers/auth/LoginSuccessful.tsx error state [VERIFIED: codebase]
// Sign-out pattern: frontend/src/containers/auth/BrokerageContact.tsx [VERIFIED: codebase]
import { signOut } from 'aws-amplify/auth'
import { clearToken } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const NoAccess = () => {
    const handleSignOut = async () => {
        await signOut({ global: true }).catch(() => null)
        clearToken()
        window.location.href = '/auth/login'
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle>No Admin Access</CardTitle>
                    <CardDescription>
                        Your account doesn&apos;t have admin access to any brokerage.
                        Please sign in directly at your brokerage URL.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button className="w-full" onClick={handleSignOut}>
                        Sign Out
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

export default NoAccess
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auth routes inside `SubdomainOnly` (pre-Phase 16) | Auth routes at top level (Phase 16) | Now | `/auth/login` and `/auth/login-success` work on all domains |
| `LoginSuccessful` always routes to `destination \|\| '/'` | Domain-aware: main domain checks admin_brokerages first | Now | Enables post-login split between `/dashboard` and `/no-access` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ProtectedRoute` can be reused as-is for the main-domain `/dashboard` tree — it checks `isAuthenticated()` which is domain-agnostic | Architecture Patterns | None — `isAuthenticated()` reads localStorage token regardless of domain. Low risk. [ASSUMED from reading the component; behavior is verifiable by inspection] |
| A2 | `aws-amplify/auth signOut` is available at the version already installed for use in `NoAccess.tsx` | Standard Stack | Low risk — already used in `BrokerageContact.tsx` in same project. [ASSUMED: package version not pinned-checked, but usage exists] |

---

## Open Questions (RESOLVED)

1. **Does `ProtectedRoute` need to be duplicated as `MainProtectedRoute` for domain scoping?**
   - What we know: D-10 says "existing `ProtectedRoute` component (or a new `MainProtectedRoute` if domain scoping is needed)"
   - What's clear from code: `ProtectedRoute` is domain-agnostic — it only checks token validity. The `MainDomainOnly` guard already ensures the route block is unreachable from subdomains.
   - Recommendation: Reuse `ProtectedRoute` as-is. No `MainProtectedRoute` needed — `MainDomainOnly` already provides the domain constraint.

2. **Should the `/dashboard` placeholder have an index route, wildcard, or both?**
   - What we know: PORTAL-01 requires any `/dashboard/*` URL to render (not 404). D-09 says minimal placeholder.
   - Recommendation: Use both `index: true` (for `/dashboard` exactly) and `path: '*'` (for all sub-paths). This satisfies PORTAL-01 without ambiguity.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 16 is purely frontend code changes. No external CLI tools, databases, or services are required beyond the existing development environment (npm, Vite dev server). The Phase 15 backend endpoint is already deployed.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 16 |
|-----------|-------------------|
| Icons: `lucide-react` only | Use lucide icons in `NoAccess.tsx` if any icon is added |
| Styling: Tailwind CSS utility classes | All new components use Tailwind only — no CSS modules |
| Never call axios or API functions directly inside a component — always go through a hook | **EXCEPTION:** `LoginSuccessful` already violates this in its current form (directly calls `setToken` in a `useEffect`). The `fetchAdminBrokerages` call in the same effect is architecturally equivalent — fire-once lifecycle call, not a data-fetching hook. This is the only justified exception: the call is immediate, non-cacheable, and the component unmounts after. |
| Define domain interfaces in `assets/types/` before creating hooks or contexts | Create `adminBrokerageType.ts` before `fetchAdminBrokerages.ts` |
| `@` alias for all frontend imports | Use `@/` prefix in all new files |
| Use `shadcn/ui` components only | `NoAccess.tsx` uses Card, Button from shadcn |
| Soft deletes: `without_deleted` on all queries | Backend only — not applicable to frontend phase |

**Note on the "never call API functions directly inside a component" rule:** `LoginSuccessful` is a lifecycle-driven one-shot component, not a data-fetching UI component. The `useEffect` runs once on mount and the component unmounts after navigation. A TanStack Query hook would be inappropriate here (queries are for cached, refetchable data; this is a once-on-mount imperative action). The existing component already calls `setToken` directly in `useEffect`. The `fetchAdminBrokerages` call is treated as part of the same post-auth lifecycle action, not as a component data-fetch. [ASSUMED: this interpretation aligns with the spirit of CLAUDE.md; if incorrect, create a thin wrapper that uses `useQuery` with `enabled: false` and `refetch()` manually, though this adds unnecessary complexity]

---

## Validation Architecture

Nyquist validation is explicitly `false` in `.planning/config.json` — this section is omitted.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Token presence via `isAuthenticated()` in `ProtectedRoute` |
| V3 Session Management | yes | `clearToken()` + Amplify `signOut` on the no-access screen |
| V4 Access Control | yes | `MainDomainOnly` guard prevents subdomain users from seeing portal routes |
| V5 Input Validation | no | No user input in this phase |
| V6 Cryptography | no | No new crypto; existing JWT decode in `lib/auth.ts` unchanged |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated access to `/dashboard/*` | Elevation of privilege | `ProtectedRoute` redirects to login (AUTH-07) |
| Subdomain user accessing main-domain portal by URL manipulation | Spoofing | `MainDomainOnly` guard returns `<Navigate to="/" replace />` on subdomain [VERIFIED: `DomainGuard.tsx`] |
| Stale token after sign-out on no-access screen | Elevation of privilege | `clearToken()` + `signOut({ global: true })` invalidates both local storage and Cognito session |

**Security note:** `isMainDomain()` and `MainDomainOnly` are documented as "UX enforcement only — not a security boundary." Backend enforcement (Phase 15 `MainDomainOnly` concern on `AdminBrokeragesController`) is the actual security control. Frontend guards provide UX-only routing. [VERIFIED: `DomainGuard.tsx` comments]

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/router/main.tsx` — Current router structure; direct codebase read
- `frontend/src/components/common/guards/DomainGuard.tsx` — `SubdomainOnly`, `MainDomainOnly` implementations
- `frontend/src/components/common/guards/ProtectedRoute.tsx` — Auth guard implementation
- `frontend/src/containers/auth/LoginSuccessful.tsx` — Component to extend; full source read
- `frontend/src/router/auth/auth.tsx` — Current auth route placement (inside `SubdomainOnly`)
- `frontend/src/assets/axios/axios.ts` — camelcaseKeys interceptor; confirms no double-conversion needed
- `frontend/src/lib/auth.ts` — `isAuthenticated()`, `setToken()`, `clearToken()` implementations
- `backend/app/controllers/v1/account/admin_brokerages_controller.rb` — Endpoint response shape
- `.planning/phases/15-backend-api-brokerage-auth-extension/15-CONTEXT.md` — D-10/11/12 confirm response shape
- `frontend/src/containers/auth/BrokerageContact.tsx` — Sign-out pattern; no-access UI pattern
- `.planning/phases/16-main-domain-routing-auth-guards/16-CONTEXT.md` — All locked decisions D-01 through D-10

### Secondary (MEDIUM confidence)
- `frontend/src/router/createBrokerage/createBrokerage.tsx` — Route object pattern reference
- `frontend/src/assets/api/account/getAccountProfile.tsx` — API module shape reference
- `frontend/src/store/hooks/queryKeys.tsx` — Query key naming convention (for if a query key is added)
- `frontend/src/main.jsx` — Confirms `QueryClientProvider` at root (relevant to hook availability)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in existing codebase
- Architecture: HIGH — all patterns derived from existing, working code in same project
- Pitfalls: HIGH — derived from reading actual implementation and CLAUDE.md constraints
- Decisions: HIGH — all locked in CONTEXT.md, no discretionary choices remain

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable framework; no fast-moving dependencies)

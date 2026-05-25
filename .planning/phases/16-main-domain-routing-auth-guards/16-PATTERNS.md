# Phase 16: Main Domain Routing & Auth Guards - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 7 (5 new, 2 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/assets/types/adminBrokerageType.ts` | type definition | — | `frontend/src/assets/types/userType.ts` | exact |
| `frontend/src/assets/api/account/fetchAdminBrokerages.ts` | api module | request-response | `frontend/src/assets/api/account/getAccountProfile.tsx` | exact |
| `frontend/src/containers/portal/NoAccess.tsx` | component | sign-out action | `BrokerageContact.tsx` (sign-out only) + `LoginSuccessful.tsx` (raw div card markup) | role-match |
| `frontend/src/containers/portal/DashboardPlaceholder.tsx` | component | — | `frontend/src/containers/auth/LoginSuccessful.tsx` (loading state) | role-match |
| `frontend/src/router/portal/portal.tsx` | route config | — | `frontend/src/router/createBrokerage/createBrokerage.tsx` | exact |
| `frontend/src/containers/auth/LoginSuccessful.tsx` | component (modify) | request-response | self (extend in-place) | exact |
| `frontend/src/router/main.tsx` | router config (modify) | — | self (restructure in-place) | exact |

---

## Pattern Assignments

### `frontend/src/assets/types/adminBrokerageType.ts` (type definition)

**Analog:** `frontend/src/assets/types/userType.ts` and `frontend/src/assets/types/roleType.ts`

**Type definition pattern** (userType.ts lines 1-19 / roleType.ts lines 1-3):
```typescript
// userType.ts — interface shape convention
interface user {
    id: string
    name: string,
    firstName: string,
    // ...
}
export default user

// roleType.ts — shared union type imported by related interfaces
type UserRole = 'owner' | 'admin' | 'agent' | 'staff' | 'client'
export default UserRole
```

**Target file — copy this pattern:**
```typescript
// frontend/src/assets/types/adminBrokerageType.ts
import UserRole from './roleType'

export interface AdminBrokerage {
    id: string
    name: string
    role: UserRole
}
```

**Notes:**
- Import `UserRole` from the existing `roleType.ts` — do not redefine the union
- Use named export (`export interface`) consistent with other type files that export multiple things
- Must be created BEFORE `fetchAdminBrokerages.ts` (CLAUDE.md: define domain interfaces before hooks/api modules)

---

### `frontend/src/assets/api/account/fetchAdminBrokerages.ts` (api module, request-response)

**Analog:** `frontend/src/assets/api/account/getAccountProfile.tsx` (lines 1-13)

**Full analog source:**
```typescript
// frontend/src/assets/api/account/getAccountProfile.tsx — lines 1-13
import axiosInstance from '@/assets/axios/axios'
import user from '@/assets/types/userType'

interface GetAccountProfileResponse {
    user: user
}

const getAccountProfile = async (): Promise<GetAccountProfileResponse> => {
    const response = await axiosInstance.get('/v1/account/profile')
    return response.data as GetAccountProfileResponse
}

export default getAccountProfile
```

**Target file — copy this pattern:**
```typescript
// frontend/src/assets/api/account/fetchAdminBrokerages.ts
import axiosInstance from '@/assets/axios/axios'
import { AdminBrokerage } from '@/assets/types/adminBrokerageType'

export interface FetchAdminBrokeragesResponse {
    adminBrokerages: AdminBrokerage[]   // camelCased by axios interceptor — snake_case never arrives
}

const fetchAdminBrokerages = async (): Promise<FetchAdminBrokeragesResponse> => {
    const response = await axiosInstance.get('/v1/account/admin_brokerages')
    return response.data as FetchAdminBrokeragesResponse
}

export default fetchAdminBrokerages
```

**Critical:** Never call `camelcaseKeys` — the axios interceptor in `assets/axios/axios.ts` already converts `admin_brokerages` → `adminBrokerages`. Return `response.data` directly, matching the getAccountProfile pattern.

---

### `frontend/src/containers/portal/NoAccess.tsx` (component, no data flow — pure render + sign-out action)

**Analog (sign-out behavior):** `frontend/src/containers/auth/BrokerageContact.tsx` (lines 89-93) — borrow ONLY the sign-out action sequence.
**Analog (card markup):** `frontend/src/containers/auth/LoginSuccessful.tsx` (lines 50-60) — raw div card pattern per UI-SPEC.md Card Pattern (CRITICAL).

> **IMPORTANT — supersedes earlier drafts of this section:** UI-SPEC.md explicitly prohibits the shadcn `<Card>` component for NoAccess.tsx and DashboardPlaceholder.tsx. Use the raw div pattern from LoginSuccessful.tsx instead. The BrokerageContact.tsx component uses `<Card>` because it predates UI-SPEC.md; do not copy that markup here — only its sign-out handler is reused.

**Imports pattern (correct — no shadcn Card imports):**
```typescript
import { useState } from 'react'
import { signOut } from 'aws-amplify/auth'
import { clearToken } from '@/lib/auth'
import { Button } from '@/components/ui/button'
```

**Sign-out pattern** (BrokerageContact.tsx lines 89-93, wrapped with a `signingOut` state guard per UI-SPEC.md Interaction 1):
```typescript
const [signingOut, setSigningOut] = useState(false)

const handleSignOut = async () => {
    setSigningOut(true)
    await signOut({ global: true }).catch(() => null)
    clearToken()
    window.location.href = '/auth/login'
}
```

**Card layout pattern (raw div — matches LoginSuccessful.tsx lines 51-52):**
```typescript
<div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        ...
    </div>
</div>
```

**Target file — use this pattern:**
```typescript
// frontend/src/containers/portal/NoAccess.tsx
import { useState } from 'react'
import { signOut } from 'aws-amplify/auth'
import { clearToken } from '@/lib/auth'
import { Button } from '@/components/ui/button'

const NoAccess = () => {
    const [signingOut, setSigningOut] = useState(false)

    const handleSignOut = async () => {
        setSigningOut(true)
        await signOut({ global: true }).catch(() => null)
        clearToken()
        window.location.href = '/auth/login'
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div>
                    <div className="text-lg font-semibold text-foreground">No Admin Access</div>
                    <div className="text-sm text-muted-foreground">
                        Your account doesn&apos;t have admin access to any brokerage.
                        Please sign in directly at your brokerage URL.
                    </div>
                </div>
                <Button className="w-full" onClick={handleSignOut} disabled={signingOut}>
                    Sign Out
                </Button>
            </div>
        </div>
    )
}

export default NoAccess
```

**Notes:**
- Card markup is **raw divs**, not shadcn `<Card>`/`<CardHeader>`/`<CardTitle>`/`<CardDescription>`/`<CardContent>`. UI-SPEC.md Card Pattern explicitly prohibits the shadcn Card component here so this screen visually matches LoginSuccessful's loading and error states.
- Use `await signOut({ global: true }).catch(() => null)` — the `.catch(() => null)` swallow is established in BrokerageContact.tsx and intentional (network may be unavailable; local token clear must still happen).
- Use `window.location.href = '/auth/login'` (hard redirect) not `navigate()` — ensures Amplify session state is fully flushed before re-render.
- The `signingOut` state + `disabled={signingOut}` on the Button prevent double-tap during the async sign-out (UI-SPEC.md Interaction 1).
- No `ProtectedRoute` wraps this route (D-08) — a bare route avoids the redirect loop anti-pattern documented in RESEARCH.md Pitfall 2.
- No icon in this screen — UI-SPEC.md Screen 1 mandates message-only.

---

### `frontend/src/containers/portal/DashboardPlaceholder.tsx` (component, placeholder)

**Analog:** `frontend/src/containers/auth/LoginSuccessful.tsx` loading state (lines 51-61) — minimal centered card pattern

**Minimal card/loading pattern** (LoginSuccessful.tsx lines 51-60):
```typescript
return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <div>
                <div className="text-lg font-semibold text-foreground">Finalizing your sign-in</div>
                <div className="text-sm text-muted-foreground">Loading your profile and workspace…</div>
            </div>
        </div>
    </div>
)
```

**Target file — adapt this pattern (static placeholder, no spinner):**
```typescript
// frontend/src/containers/portal/DashboardPlaceholder.tsx
const DashboardPlaceholder = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div>
                    <div className="text-lg font-semibold text-foreground">Admin Portal</div>
                    <div className="text-sm text-muted-foreground">Coming soon — brokerage selection will be here.</div>
                </div>
            </div>
        </div>
    )
}

export default DashboardPlaceholder
```

**Notes:**
- Phase 18 replaces this file entirely — keep it minimal; no imports needed beyond React default
- Use the same `rounded-2xl border border-border bg-card p-8 shadow-sm` div pattern (not `<Card>`) matching LoginSuccessful's style — this is the raw div card variant established in the auth screens

---

### `frontend/src/router/portal/portal.tsx` (route config)

**Analog:** `frontend/src/router/createBrokerage/createBrokerage.tsx` (lines 1-13)

**Full analog source:**
```typescript
// frontend/src/router/createBrokerage/createBrokerage.tsx — lines 1-13
import ErrorPage from '@/containers/errorPage/ErrorPage'
import AppShellCreateAccount from '@/components/common/shells/appShellCreateAccount/appShellCreateAccount'
import CreateBrokerage from '@/containers/createBrokerage/CreateBrokerage'

export const createBrokerage = {
    path: '/create/',
    element: <AppShellCreateAccount />,
    errorElement: <ErrorPage />,
    children: [
        { index: true, element: <CreateBrokerage /> },
    ]
}
```

**Target file — copy this pattern:**
```typescript
// frontend/src/router/portal/portal.tsx
import ErrorPage from '@/containers/errorPage/ErrorPage'
import ProtectedRoute from '@/components/common/guards/ProtectedRoute'
import DashboardPlaceholder from '@/containers/portal/DashboardPlaceholder'
import NoAccess from '@/containers/portal/NoAccess'

export const portalDashboard = {
    path: '/dashboard',
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
        { index: true, element: <DashboardPlaceholder /> },
        { path: '*', element: <DashboardPlaceholder /> },
    ]
}

export const noAccess = {
    path: '/no-access',
    element: <NoAccess />,
    errorElement: <ErrorPage />,
}
```

**Notes:**
- `portalDashboard` uses `<ProtectedRoute />` as `element` (auth guard wraps the subtree via Outlet) — same composition as the subdomain `ProtectedRoute` block in `main.tsx`
- Both `index: true` and `path: '*'` children are needed: index handles `/dashboard` exactly; wildcard handles `/dashboard/anything` (PORTAL-01 requires no 404 on sub-paths)
- `noAccess` has NO `ProtectedRoute` wrapper — bare route under `MainDomainOnly` only (D-08, Pitfall 2)
- `errorElement: <ErrorPage />` on both — consistent with createBrokerage pattern

---

### `frontend/src/containers/auth/LoginSuccessful.tsx` (modify existing component)

**Analog:** self — extend in-place. Full current source is at lines 1-63.

**Current effect pattern** (lines 10-28):
```typescript
// LoginSuccessful.tsx — lines 10-28 (current effect)
useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const token = params.get('token')

    if (!token) {
        setError(true)
        return
    }

    const destination = params.get('returnTo') || '/'

    setToken(token)
    window.location.hash = ''
    navigate(destination, { replace: true })
}, [])
```

**New imports to add** (add after existing imports):
```typescript
import { isMainDomain } from '@/helpers/domain'
import fetchAdminBrokerages from '@/assets/api/account/fetchAdminBrokerages'
```

**Replacement effect** (replaces lines 10-28):
```typescript
useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const token = params.get('token')

    if (!token) {
        setError(true)
        return
    }

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

**Notes:**
- `setToken(token)` must remain BEFORE `fetchAdminBrokerages()` — the axios interceptor reads the token from localStorage; calling fetch before setToken causes 401 (Pitfall 5)
- The existing loading spinner (lines 51-60) and error state (lines 32-48) are reused unchanged — no new UI needed (D-03, D-04)
- The `destination` variable must be extracted BEFORE `setToken` in the subdomain branch; do not reference `params` after `window.location.hash = ''` (the hash clear doesn't affect the already-parsed `params` URLSearchParams object, but keep the order consistent with the current implementation)
- No state additions needed — the existing `error` boolean covers the API failure path

---

### `frontend/src/router/main.tsx` (modify existing router config)

**Analog:** self — restructure in-place. Full current source is at lines 1-43.

**Current structure** (lines 15-41):
```typescript
const router = createBrowserRouter([
    {
        element: <SubdomainOnly />,
        children: [
            {
                element: <ProtectedRoute />,
                children: [dashboard, admin, account],
            },
            joinBrokerage,
            auth,             // <-- auth is currently here (inside SubdomainOnly)
        ],
    },
    {
        element: <MainDomainOnly />,
        children: [createBrokerage],
    },
    {
        path: '*',
        element: <NotFound />,
    },
])
```

**New imports to add** (after existing imports):
```typescript
import { portalDashboard, noAccess } from './portal/portal'
```

**Import to remove** (line 8 — unused dead import):
```typescript
// REMOVE: import LoginSuccessful from '@/containers/auth/LoginSuccessful'
// LoginSuccessful is imported in router/auth/auth.tsx, never used directly in main.tsx
```

**Replacement router structure:**
```typescript
const router = createBrowserRouter([
    // Subdomain-only: authenticated app routes and invite links (auth moved out — D-01)
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
    // Main-domain-only: brokerage creation wizard + portal + no-access
    {
        element: <MainDomainOnly />,
        children: [createBrokerage, portalDashboard, noAccess],
    },
    // Auth routes: shared across all domains (D-01) — moved out of SubdomainOnly
    auth,
    // Wildcard catch-all — must remain last
    {
        path: '*',
        element: <NotFound />,
    },
])
```

**Notes:**
- `auth` moves from `SubdomainOnly.children` to top-level array — this is the only placement change; the `auth` object itself (`router/auth/auth.tsx`) is unchanged
- `portalDashboard` and `noAccess` are added to `MainDomainOnly.children` alongside `createBrokerage`
- The dead `import LoginSuccessful` on line 8 must be removed — it was never used in this file (LoginSuccessful is used in `router/auth/auth.tsx`)
- `auth` must NOT be inside `MainDomainOnly` — that would break login on subdomains (Pitfall 1)

---

## Shared Patterns

### Domain Detection
**Source:** `frontend/src/helpers/domain.ts` (line 5)
**Apply to:** `LoginSuccessful.tsx` (the new branch condition)
```typescript
import { isMainDomain } from '@/helpers/domain'
// Usage:
if (!isMainDomain()) { /* subdomain path */ }
```

### Auth Guard (ProtectedRoute)
**Source:** `frontend/src/components/common/guards/ProtectedRoute.tsx` (lines 1-14)
**Apply to:** `router/portal/portal.tsx` — wraps the `/dashboard` subtree
```typescript
// ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'

const ProtectedRoute = () => {
    const location = useLocation()
    if (!isAuthenticated()) {
        return <Navigate to="/auth/login" state={{ from: location }} replace />
    }
    return <Outlet />
}
```
Reused as-is. No `MainProtectedRoute` variant needed — `MainDomainOnly` already constrains the route block to the main domain.

### Sign-Out Pattern
**Source:** `frontend/src/containers/auth/BrokerageContact.tsx` (lines 89-93)
**Apply to:** `NoAccess.tsx`
```typescript
import { signOut } from 'aws-amplify/auth'
import { clearToken } from '@/lib/auth'

// In onClick handler:
await signOut({ global: true }).catch(() => null)
clearToken()
window.location.href = '/auth/login'
```

### Domain Guard Composition
**Source:** `frontend/src/components/common/guards/DomainGuard.tsx` (lines 24-27)
**Apply to:** `router/main.tsx` — `MainDomainOnly` wraps both existing and new portal routes
```typescript
export const MainDomainOnly = () => {
    if (!isMainDomain()) return <Navigate to="/" replace />
    return <Outlet />
}
// Usage in main.tsx:
{ element: <MainDomainOnly />, children: [createBrokerage, portalDashboard, noAccess] }
```

### API Module Shape
**Source:** `frontend/src/assets/api/account/getAccountProfile.tsx` (lines 1-13)
**Apply to:** `fetchAdminBrokerages.ts`
```typescript
import axiosInstance from '@/assets/axios/axios'
// No camelcaseKeys — interceptor handles it
const fn = async (): Promise<ResponseType> => {
    const response = await axiosInstance.get('/v1/path')
    return response.data as ResponseType
}
export default fn
```

### Route Object Pattern
**Source:** `frontend/src/router/createBrokerage/createBrokerage.tsx` (lines 1-13)
**Apply to:** `router/portal/portal.tsx`
```typescript
export const routeName = {
    path: '/path',
    element: <ShellOrGuard />,
    errorElement: <ErrorPage />,
    children: [
        { index: true, element: <Component /> },
    ]
}
```

---

## No Analog Found

All files have strong analogs. No entries.

---

## Metadata

**Analog search scope:** `frontend/src/router/`, `frontend/src/containers/auth/`, `frontend/src/assets/api/account/`, `frontend/src/assets/types/`, `frontend/src/components/common/guards/`, `frontend/src/helpers/`
**Files scanned:** 13
**Pattern extraction date:** 2026-05-24

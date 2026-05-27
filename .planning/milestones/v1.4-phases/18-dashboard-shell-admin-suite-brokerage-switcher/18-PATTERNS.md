# Phase 18: Dashboard Shell, Admin Suite & Brokerage Switcher — Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 4 (1 new, 3 modified)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/containers/portal/PortalNavBar.tsx` | component | request-response / event-driven | `frontend/src/components/navbar/NavBar.tsx` + `frontend/src/containers/portal/NoAccess.tsx` | role-match (NavBar for structure/dropdown; NoAccess for sign-out) |
| `frontend/src/containers/portal/PortalShell.tsx` | component | request-response | `frontend/src/containers/portal/BrokerageSelection.tsx` | exact (same portal shell pattern, same Redux slice, same raw div cards) |
| `frontend/src/assets/axios/axios.ts` | utility | request-response | `frontend/src/assets/axios/axios.ts` (self — surgical addition) | self-edit |
| `frontend/src/router/main.tsx` | config | — | `frontend/src/router/main.tsx` (self — surgical addition) | self-edit |

---

## Pattern Assignments

### `frontend/src/containers/portal/PortalNavBar.tsx` (component, new)

**Primary analog:** `frontend/src/components/navbar/NavBar.tsx`
**Secondary analog:** `frontend/src/containers/portal/NoAccess.tsx`

**Imports pattern** (from `NavBar.tsx` lines 1–9, `NoAccess.tsx` lines 1–4, `activeBrokerage.ts` lines 1–2):
```typescript
import { signOut } from 'aws-amplify/auth'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { clearToken } from '@/lib/auth'
import { useAppSelector, useAppDispatch } from '@/store/hooks/useDispatch'
import { setActiveBrokerage } from '@/store/reducers/activeBrokerage'
import type { AdminBrokerage } from '@/assets/types/adminBrokerageType'
```

**Redux read pattern** (from `PortalShell.tsx` lines 11 and `activeBrokerage.ts` slice shape):
```typescript
const activeBrokerage = useAppSelector((s) => s.activeBrokerage.activeBrokerage)
const adminBrokerages = useAppSelector((s) => s.activeBrokerage.adminBrokerages)
const dispatch = useAppDispatch()
const navigate = useNavigate()
```

**Null guard** (D-12 — safety net before any field access):
```typescript
if (!activeBrokerage) return null
```

**Sign-out pattern** (from `NoAccess.tsx` lines 9–13 — exact source of truth):
```typescript
const handleSignOut = async () => {
    await signOut({ global: true }).catch(() => null)
    clearToken()
    window.location.href = '/auth/login'
}
```
Note: Do NOT add `signingOut` state to `PortalNavBar` — `NoAccess.tsx` uses it to disable a full-page button; the nav bar sign-out is a small ghost button where disabling is not required per UI-SPEC.

**Outer nav structure** (from `NavBar.tsx` lines 30–32 — must match exactly):
```tsx
<header className="border-b border-sidebar-border bg-sidebar">
    <div className="flex h-16 items-center justify-between gap-3 px-4">
        <div>{/* left: brokerage switcher */}</div>
        <div className="flex items-center gap-2">{/* right: role badge + sign-out */}</div>
    </div>
</header>
```

**DropdownMenu trigger pattern** (from `NavBar.tsx` lines 55–57 + `DropdownMenuContent` at line 63 — use `align="start"` not `align="end"` for left-side trigger):
```tsx
<DropdownMenu>
    <DropdownMenuTrigger asChild>
        <Button
            variant="ghost"
            className="flex items-center gap-1.5 px-2 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
            {activeBrokerage.name}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-52">
        {adminBrokerages.map((b) => (
            <DropdownMenuItem
                key={b.id}
                onClick={() => handleSwitch(b)}
                className="flex items-center justify-between"
            >
                <span>{b.name}</span>
                {b.id === activeBrokerage.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
        ))}
    </DropdownMenuContent>
</DropdownMenu>
```

**Brokerage switch handler** (D-14 — dispatch first, then navigate):
```typescript
const handleSwitch = (b: AdminBrokerage) => {
    dispatch(setActiveBrokerage(b))
    navigate(`/dashboard/${b.id}`)
}
```

**Role badge pattern** (from `BrokerageSelection.tsx` lines 73–75 — copy exactly):
```tsx
<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
    {activeBrokerage.role}
</span>
```

**Sign-out button** (from `NavBar.tsx` line 112 — ghost variant + sidebar foreground classes):
```tsx
<Button
    variant="ghost"
    size="sm"
    onClick={handleSignOut}
    className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
>
    Sign Out
</Button>
```

---

### `frontend/src/containers/portal/PortalShell.tsx` (component, modify resolved state only)

**Analog:** `frontend/src/containers/portal/BrokerageSelection.tsx`

**Preserve untouched** (lines 1–74 of current `PortalShell.tsx`):
- All imports (lines 1–5)
- The component's state declarations (lines 8–13)
- The entire `useEffect` (lines 15–56) — Phase 17 brokerage validation logic; do NOT touch
- The loading return (lines 58–74) — spinner card; unchanged per UI-SPEC

**Replace only** (lines 76–88 of current `PortalShell.tsx` — the placeholder return):
```tsx
// REMOVE the placeholder div entirely and replace with:
return (
    <div className="flex min-h-screen flex-col bg-background">
        <PortalNavBar />
        <main className="flex flex-1 items-start justify-center px-6 py-8">
            <div className="flex w-full max-w-lg flex-col gap-6">
                {/* Heading block */}
                <div>
                    <div className="text-xl font-semibold text-foreground">Admin Dashboard</div>
                    <div className="text-sm text-muted-foreground mt-1">Manage your brokerage from one place.</div>
                </div>
                {/* Section cards grid — 2×2 */}
                <div className="grid grid-cols-2 gap-4">
                    {/* 4 section card buttons */}
                </div>
            </div>
        </main>
    </div>
)
```

**Section card button pattern** (from `BrokerageSelection.tsx` lines 63–78 — adapted to icon+label layout per UI-SPEC):
```tsx
<button
    className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 w-full"
    onClick={() => navigate('/admin/users')}
>
    <Users className="h-5 w-5 text-muted-foreground" />
    <div className="text-sm font-semibold text-foreground">Users</div>
</button>
```
Note: Raw `<button>` element — NOT shadcn `<Card>`. This matches the portal raw div card pattern from `BrokerageSelection.tsx`.

**New import to add** at the top of `PortalShell.tsx`:
```typescript
import PortalNavBar from './PortalNavBar'
import { Building2, Users, Layers, Settings } from 'lucide-react'
```

---

### `frontend/src/assets/axios/axios.ts` (utility, modify request interceptor)

**Analog:** Self-edit — add to existing interceptor at line 21.

**Existing request interceptor** (lines 21–27 — full current state, must be preserved):
```typescript
api.interceptors.request.use((config) => {
    const token = getToken()
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
}, (error) => Promise.reject(error))
```

**New import to add** (after existing imports at lines 1–5 — verified no circular dep):
```typescript
import { store } from '@/store/reducers'
import { isMainDomain } from '@/helpers/domain'
```

**Modified request interceptor** (replace lines 21–27 with):
```typescript
api.interceptors.request.use((config) => {
    const token = getToken()
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    // D-01/D-02: Inject X-Brokerage-Id for /v1/admin/** calls on main domain only.
    // D-03: Skip silently if activeBrokerage is null — backend returns 400, surfaces in UI.
    if (isMainDomain() && config.url?.includes('/v1/admin/')) {
        const activeBrokerage = store.getState().activeBrokerage.activeBrokerage
        if (activeBrokerage) {
            config.headers['X-Brokerage-Id'] = activeBrokerage.id
        }
    }
    return config
}, (error) => Promise.reject(error))
```

**Response interceptor** (lines 29–55 — must NOT be touched):
```typescript
// Preserve exactly as-is. The camelcaseKeys transform, 401 redirect,
// and 403 handling are Phase 14/15 concerns — do not modify.
```

**Circular import safety:** `store/reducers/index.tsx` imports only `./account`, `./createBrokerageWizard`, `./tempBrokerage`, `./activeBrokerage` — none import axios. Import is safe.

---

### `frontend/src/router/main.tsx` (config, modify MainDomainOnly children)

**Analog:** Self-edit — add `admin` to the `MainDomainOnly` children array.

**Current state** (lines 33–36 — the only section that changes):
```typescript
{
    element: <MainDomainOnly />,
    children: [createBrokerage, portalDashboard, noAccess],
},
```

**Modified state** (add `admin` — must be wrapped in ProtectedRoute per RESEARCH.md security note):
```typescript
{
    element: <MainDomainOnly />,
    children: [
        createBrokerage,
        portalDashboard,
        noAccess,
        {
            element: <ProtectedRoute />,
            children: [admin],
        },
    ],
},
```

**Existing imports** (lines 1–13 — the `admin` import already exists at line 6; no import changes needed):
```typescript
// Line 6 — already present, no change needed:
import { admin } from './admin/admin'
// Line 11 — already imported, needed for the ProtectedRoute wrapper:
import ProtectedRoute from '@/components/common/guards/ProtectedRoute'
```

Note on RequireRole pitfall: The RESEARCH.md identifies that `AppShellAdmin`'s `RequireRole` guard reads `account.membership?.role`, which is null on the main domain. The planner must decide the resolution strategy (bypass, suppress, or trigger `useGetCurrentUser`). The pattern above adds `ProtectedRoute` for authentication — the RequireRole question is a separate concern the plan must address explicitly.

---

## Shared Patterns

### Redux Read (useAppSelector) — applied to PortalNavBar
**Source:** `frontend/src/containers/portal/PortalShell.tsx` lines 11–12
```typescript
const activeBrokerage = useAppSelector((s) => s.activeBrokerage.activeBrokerage)
const adminBrokerages = useAppSelector((s) => s.activeBrokerage.adminBrokerages)
```
Apply to: `PortalNavBar.tsx`

### Redux Read (store.getState) — applied to axios interceptor (outside React tree)
**Source:** `frontend/src/store/reducers/index.tsx` line 15
```typescript
// store is a named export (not default):
import { store } from '@/store/reducers'
// Usage in interceptor:
const activeBrokerage = store.getState().activeBrokerage.activeBrokerage
```
Apply to: `axios.ts` request interceptor

### Sign-Out Pattern — applied to PortalNavBar
**Source:** `frontend/src/containers/portal/NoAccess.tsx` lines 9–13
```typescript
const handleSignOut = async () => {
    await signOut({ global: true }).catch(() => null)
    clearToken()
    window.location.href = '/auth/login'
}
```
Apply to: `PortalNavBar.tsx`

### Role Badge — applied to PortalNavBar
**Source:** `frontend/src/containers/portal/BrokerageSelection.tsx` lines 73–75
```tsx
<span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
    {brokerage.role}
</span>
```
Apply to: `PortalNavBar.tsx` (replace `brokerage.role` with `activeBrokerage.role`)

### Raw div card (button element) — applied to PortalShell section cards
**Source:** `frontend/src/containers/portal/BrokerageSelection.tsx` lines 63–79
```tsx
<button
    className="w-full rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
    onClick={...}
>
    {/* icon + label */}
</button>
```
Apply to: `PortalShell.tsx` section cards (adapted: `p-6`, `flex flex-col gap-3`, icon + label layout from UI-SPEC)

### Nav bar outer frame — applied to PortalNavBar
**Source:** `frontend/src/components/navbar/NavBar.tsx` lines 30–32
```tsx
<header className="border-b border-sidebar-border bg-sidebar">
    <div className="flex h-16 items-center justify-between gap-3 px-4">
```
Apply to: `PortalNavBar.tsx` outer wrapper — must be pixel-for-pixel identical

### DropdownMenu + ghost button sidebar classes — applied to PortalNavBar switcher trigger + sign-out
**Source:** `frontend/src/components/navbar/NavBar.tsx` lines 103–104
```tsx
<Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
```
Apply to: `PortalNavBar.tsx` brokerage switcher trigger and sign-out button

---

## No Analog Found

None. All four files have direct analogs or are self-edits with a clear existing pattern to follow.

---

## Critical Implementation Notes for Planner

1. **RequireRole blocking (RESEARCH.md open question 1):** The plan must choose a strategy. The simplest approach consistent with D-05 is to register `admin` under `MainDomainOnly` wrapped in `ProtectedRoute` (for auth), and accept that `RequireRole` inside `AppShellAdmin` will redirect to `/` (which maps to NotFound on main domain) — making admin panels unusable. A real fix is required. Options: (a) pass `disableAuth` prop to suppress `RequireRole`, (b) remove `RequireRole` from `AppShellAdmin` conditionally, (c) trigger `useGetCurrentUser` in `PortalShell` before enabling admin links. The planner must decide.

2. **PortalShell modification scope:** Only lines 76–88 (the placeholder return) change. Lines 1–74 are completely preserved. The import block at lines 1–5 gets two additions (`PortalNavBar` and lucide icons).

3. **axios.ts modification scope:** Only lines 21–27 (the request interceptor callback body) expand. Lines 1–19 (imports + `api` creation) and lines 29–57 (response interceptor + export) are completely preserved — two new import lines are added at the top.

4. **main.tsx modification scope:** Only the `MainDomainOnly` children array (line 35) changes. All imports stay as-is; `admin` is already imported at line 6.

5. **`store` import casing:** `store` is a **named export** from `@/store/reducers` (line 15 of `index.tsx`). Use `import { store } from '@/store/reducers'`, not a default import.

---

## Metadata

**Analog search scope:** `frontend/src/containers/portal/`, `frontend/src/components/navbar/`, `frontend/src/assets/axios/`, `frontend/src/store/reducers/`, `frontend/src/router/`, `frontend/src/helpers/`
**Files read:** 9 source files + 3 planning documents
**Pattern extraction date:** 2026-05-26

# Phase 17: Brokerage Selection & Post-Create Redirect — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 8 (3 new, 5 modified)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/store/reducers/activeBrokerage.ts` | store/reducer | CRUD | `frontend/src/store/reducers/tempBrokerage.tsx` | exact |
| `frontend/src/store/store.ts` (index.tsx) | config | — | `frontend/src/store/reducers/index.tsx` | exact |
| `frontend/src/containers/portal/BrokerageSelection.tsx` | component | request-response | `frontend/src/containers/portal/NoAccess.tsx` + `LoginSuccessful.tsx` | role-match |
| `frontend/src/containers/portal/PortalShell.tsx` | component | request-response | `frontend/src/containers/auth/LoginSuccessful.tsx` | role-match |
| `frontend/src/router/portal/portal.tsx` | route | — | `frontend/src/router/portal/portal.tsx` (self) | exact |
| `frontend/src/containers/auth/LoginSuccessful.tsx` | component | request-response | self — add dispatch before navigate | exact |
| `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` | component | request-response | self — change redirect target | exact |
| `frontend/src/test/renderWithProviders.tsx` | test utility | — | self — add reducer entry | exact |

---

## Pattern Assignments

### `frontend/src/store/reducers/activeBrokerage.ts` (store/reducer, CRUD)

**Analog:** `frontend/src/store/reducers/tempBrokerage.tsx`

**Full analog file** (lines 1–32):
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import BrokerageType from '@/assets/types/brokerageType'

export interface tempBrokerageState {
    tempLogoUrl: string | null
    tempFaviconUrl: string | null
}

export const tempBrokerageState: tempBrokerageState = {
    tempLogoUrl: null,
    tempFaviconUrl: null,
}

const tempBrokerageReducer = createSlice({
    name: 'tempBrokerage',
    initialState: tempBrokerageState,
    reducers: {
        setTempLogoUrl: (state, action: PayloadAction<string | null>) => {
            state.tempLogoUrl = action.payload
        },
        setTempFaviconUrl: (state, action: PayloadAction<string | null>) => {
            state.tempFaviconUrl = action.payload
        },
        clearTempBrokerage: (state) => {
            state.tempLogoUrl = null
            state.tempFaviconUrl = null
        }
    }
})

export const { setTempLogoUrl, setTempFaviconUrl, clearTempBrokerage } = tempBrokerageReducer.actions
export default tempBrokerageReducer.reducer
```

**Copy instructions:**
- Follow the exact file structure: interface declaration → `const initialState` → `createSlice(...)` → named action exports → default reducer export.
- The new slice has two fields: `activeBrokerage: AdminBrokerage | null` and `adminBrokerages: AdminBrokerage[]`.
- Three reducers: `setActiveBrokerage(state, action: PayloadAction<AdminBrokerage>)`, `setAdminBrokerages(state, action: PayloadAction<AdminBrokerage[]>)`, `clearActiveBrokerage(state)`.
- Import: `import { AdminBrokerage } from '@/assets/types/adminBrokerageType'` (not `brokerageType`).
- Note: `tempBrokerage.tsx` names both the interface and the `const` the same (`tempBrokerageState`). Follow the same pattern for the new slice: name the interface `ActiveBrokerageState` and the const `initialState` (or `activeBrokerageInitialState`).
- `createSlice` variable name: `activeBrokerageSlice`. Default export: `activeBrokerageSlice.reducer`.

**`AdminBrokerage` type** (from `frontend/src/assets/types/adminBrokerageType.ts`, lines 1–7):
```typescript
import UserRole from './roleType'

export interface AdminBrokerage {
    id: string
    name: string
    role: UserRole
}
```

---

### `frontend/src/store/reducers/index.tsx` (config — root store registration)

**Analog:** `frontend/src/store/reducers/index.tsx` (self)

**Full file** (lines 1–17):
```typescript
import accountReducer from './account'
import createBrokerageWizardReducer from './createBrokerageWizard'
import tempBrokerageReducer from './tempBrokerage'
import { configureStore } from '@reduxjs/toolkit'

const reducer = {
    account: accountReducer,
    createBrokerageWizard: createBrokerageWizardReducer,
    tempBrokerage: tempBrokerageReducer
}

export const store = configureStore({ reducer })

export default store
export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof store.getState>
```

**Change:** Add one import and one key to the `reducer` object:
```typescript
import activeBrokerageReducer from './activeBrokerage'

const reducer = {
    account: accountReducer,
    createBrokerageWizard: createBrokerageWizardReducer,
    tempBrokerage: tempBrokerageReducer,
    activeBrokerage: activeBrokerageReducer,   // NEW
}
```

---

### `frontend/src/containers/portal/BrokerageSelection.tsx` (component, request-response)

**Primary analog — layout:** `frontend/src/containers/portal/DashboardPlaceholder.tsx`

**Outer wrapper pattern** (lines 2–5 of DashboardPlaceholder):
```tsx
<div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {/* screen content */}
    </div>
</div>
```

**Secondary analog — Redux dispatch + navigate:** `frontend/src/containers/auth/LoginSuccessful.tsx`

**Redux + navigate pattern** (lines 1–11, 43–48 of LoginSuccessful):
```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useFetchAdminBrokerages from '@/store/hooks/Account/useFetchAdminBrokerages'

// Typed hooks pattern (from CreateBrokerageContext):
import { useAppDispatch, useAppSelector } from '@/store/hooks/useDispatch'

const navigate = useNavigate()
const dispatch = useAppDispatch()

// navigate with replace:true for auth/routing redirects:
navigate('/dashboard', { replace: true })
```

**Brokerage card (interactive button) pattern** (from UI-SPEC.md, verified against NoAccess.tsx + DashboardPlaceholder.tsx card structure):
```tsx
<button
    className="w-full rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
    onClick={() => {
        dispatch(setActiveBrokerage(brokerage))
        navigate(`/dashboard/${brokerage.id}`)
    }}
>
    <div className="text-lg font-semibold text-foreground">{brokerage.name}</div>
    <div className="mt-1">
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
            {brokerage.role}
        </span>
    </div>
</button>
```

**Auto-redirect guard pattern** (D-07, verified from UI-SPEC.md Interaction 2):
```tsx
// useEffect for auto-redirect
useEffect(() => {
    if (adminBrokerages.length === 1) {
        dispatch(setActiveBrokerage(adminBrokerages[0]))
        navigate(`/dashboard/${adminBrokerages[0].id}`, { replace: true })
    }
}, [adminBrokerages, dispatch, navigate])

// Early return to suppress flash during redirect
if (adminBrokerages.length === 1) return null
```

**Full component imports block:**
```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store/hooks/useDispatch'
import { setActiveBrokerage } from '@/store/reducers/activeBrokerage'
```

**Full card list structure:**
```tsx
<div className="flex flex-col gap-3 w-full">
    {adminBrokerages.map((brokerage) => (
        <button key={brokerage.id} ...>
            ...
        </button>
    ))}
</div>
```

---

### `frontend/src/containers/portal/PortalShell.tsx` (component, request-response)

**Primary analog — layout and spinner:** `frontend/src/containers/auth/LoginSuccessful.tsx`

**Spinner pattern** (LoginSuccessful lines 83):
```tsx
<div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
```

**Loading card state pattern** (LoginSuccessful lines 80–91):
```tsx
return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <div>
                <div className="text-lg font-semibold text-foreground">Loading your workspace</div>
                <div className="text-sm text-muted-foreground">Preparing your brokerage dashboard…</div>
            </div>
        </div>
    </div>
)
```

**Resolved (non-loading) placeholder pattern** (from DashboardPlaceholder.tsx lines 1–16):
```tsx
return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div>
                <div className="text-lg font-semibold text-foreground">Admin Portal</div>
                <div className="text-sm text-muted-foreground">
                    Your brokerage dashboard is being prepared.
                </div>
            </div>
        </div>
    </div>
)
```

**Imperative fetch hook pattern** (LoginSuccessful lines 11, 44–57 + useFetchAdminBrokerages.ts):
```tsx
// Hook returns the module-level fetchAdminBrokerages function — stable reference, empty deps safe:
const fetchAdminBrokerages = useFetchAdminBrokerages()

useEffect(() => {
    fetchAdminBrokerages()
        .then((data) => {
            // validate brokerageId against data.adminBrokerages
            // dispatch setAdminBrokerages + setActiveBrokerage on match
            // navigate('/dashboard', { replace: true }) on no match
        })
        .catch(() => {
            navigate('/dashboard', { replace: true })
        })
}, [brokerageId])  // include brokerageId so re-validation triggers on route param change
```

**useParams pattern** (from React Router v6, verified):
```tsx
import { useParams, useNavigate } from 'react-router-dom'

const { brokerageId } = useParams<{ brokerageId: string }>()
```

**Full imports block:**
```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store/hooks/useDispatch'
import { setActiveBrokerage, setAdminBrokerages } from '@/store/reducers/activeBrokerage'
import useFetchAdminBrokerages from '@/store/hooks/Account/useFetchAdminBrokerages'
```

**Accessibility addition (from UI-SPEC.md):**
```tsx
// Add to spinner div:
role="status" aria-label="Loading your workspace"
```

**D-13 logic flow:**
```tsx
const adminBrokerages = useAppSelector((s) => s.activeBrokerage.adminBrokerages)
const [isLoading, setIsLoading] = useState(false)

useEffect(() => {
    if (!brokerageId) {
        navigate('/dashboard', { replace: true })
        return
    }

    if (adminBrokerages.length > 0) {
        const match = adminBrokerages.find((b) => b.id === brokerageId)
        if (match) {
            dispatch(setActiveBrokerage(match))
        } else {
            navigate('/dashboard', { replace: true })
        }
        return
    }

    // Empty Redux — wizard redirect or direct URL — fetch first
    setIsLoading(true)
    fetchAdminBrokerages()
        .then((data) => {
            dispatch(setAdminBrokerages(data.adminBrokerages))
            const match = data.adminBrokerages.find((b) => b.id === brokerageId)
            if (match) {
                dispatch(setActiveBrokerage(match))
            } else {
                navigate('/dashboard', { replace: true })
            }
        })
        .catch(() => {
            navigate('/dashboard', { replace: true })
        })
        .finally(() => setIsLoading(false))
}, [brokerageId])
```

---

### `frontend/src/router/portal/portal.tsx` (route, —)

**Analog:** `frontend/src/router/portal/portal.tsx` (self)

**Full current file** (lines 1–21):
```tsx
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

**Target state after modification:**
```tsx
import ErrorPage from '@/containers/errorPage/ErrorPage'
import ProtectedRoute from '@/components/common/guards/ProtectedRoute'
import BrokerageSelection from '@/containers/portal/BrokerageSelection'
import PortalShell from '@/containers/portal/PortalShell'
import NoAccess from '@/containers/portal/NoAccess'

export const portalDashboard = {
    path: '/dashboard',
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
        { index: true, element: <BrokerageSelection /> },        // replaces DashboardPlaceholder
        { path: ':brokerageId', element: <PortalShell /> },      // NEW
        { path: '*', element: <BrokerageSelection /> },           // catch-all updated
    ]
}

export const noAccess = {
    path: '/no-access',
    element: <NoAccess />,
    errorElement: <ErrorPage />,
}
```

**Key notes:**
- `DashboardPlaceholder` import is replaced entirely — both children that referenced it change.
- `PortalShell` is a new import at `@/containers/portal/PortalShell`.
- Route order matters: `:brokerageId` before `*` (already correct in the pattern above).

---

### `frontend/src/containers/auth/LoginSuccessful.tsx` (component — modify)

**Analog:** self (lines 1–93)

**Current relevant section** (lines 1–7, 44–58):
```tsx
// Imports (lines 1–6):
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { setToken } from '@/lib/auth'
import { isMainDomain } from '@/helpers/domain'
import useFetchAdminBrokerages from '@/store/hooks/Account/useFetchAdminBrokerages'

// Inside component, fetchAdminBrokerages call (lines 44–57):
fetchAdminBrokerages()
    .then((data) => {
        if (data.adminBrokerages.length > 0) {
            navigate('/dashboard', { replace: true })
        } else {
            navigate('/no-access', { replace: true })
        }
    })
    .catch(() => {
        setError(true)
    })
```

**Additions required:**

1. New imports to add:
```tsx
import { useAppDispatch } from '@/store/hooks/useDispatch'
import { setAdminBrokerages } from '@/store/reducers/activeBrokerage'
```

2. Inside component body, after `const fetchAdminBrokerages = useFetchAdminBrokerages()`:
```tsx
const dispatch = useAppDispatch()
```

3. Inside `.then((data) => { ... })`, BEFORE `navigate('/dashboard', ...)`:
```tsx
dispatch(setAdminBrokerages(data.adminBrokerages))
navigate('/dashboard', { replace: true })
```

**`useAppDispatch` source** (from `CreateBrokerageContext.tsx` line 4 — established pattern):
```tsx
import { useAppDispatch, useAppSelector } from '@/store/hooks/useDispatch'
const dispatch = useAppDispatch()
```

---

### `frontend/src/containers/createBrokerage/steps/SuccessStep.tsx` (component — modify)

**Analog:** self (lines 1–136)

**Current redirect button** (lines 121–131):
```tsx
<Button
    className="w-full"
    onClick={() => {
        if (isSafeRedirectHost(subdomain)) {
            window.location.href = `https://${subdomain}`
        }
    }}
>
    Go to dashboard
</Button>
```

**Current `BASE_DOMAIN` declaration** (line 9):
```tsx
const BASE_DOMAIN = import.meta.env.VITE_APP_BASE_DOMAIN || 'realstate.ca'
```

**Key pitfall:** `VITE_APP_BASE_DOMAIN` is NOT defined in `.env` or `.env.example`. Only `VITE_MAIN_DOMAIN` exists. Do not use `VITE_APP_BASE_DOMAIN` for the new redirect.

**`state.result` shape** (from `createBrokerage.ts` lines 19–35):
```typescript
export type CreateBrokerageResponse = {
    brokerage?: {
        id: string | number   // CRITICAL: typed as string | number — use String() for URL
        name: string
        ...
    }
    ...
}
```

**New variable to add** (alongside existing `subdomain`, `customDomain` declarations at lines 23–26):
```tsx
const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'realstate.ca'
const brokerageId = state.result?.brokerage?.id
```

**Replacement primary CTA button:**
```tsx
<Button
    className="w-full"
    onClick={() => {
        if (MAIN_DOMAIN && brokerageId) {
            window.location.href = `https://${MAIN_DOMAIN}/dashboard/${String(brokerageId)}`
        }
    }}
>
    Go to dashboard
</Button>
```

**Preservation rule:** The existing `BASE_DOMAIN` / `isSafeRedirectHost` logic at lines 9–13 must stay intact — it guards the secondary CTA buttons (custom domain + subdomain) that remain unchanged.

---

### `frontend/src/test/renderWithProviders.tsx` (test utility — modify)

**Analog:** self (lines 1–47)

**Current reducer map** (lines 30–35):
```tsx
const store = configureStore({
    reducer: {
        account: accountReducer,
        createBrokerageWizard: createBrokerageWizardReducer,
        tempBrokerage: tempBrokerageReducer,
    },
    preloadedState,
})
```

**Additions required:**

1. New import after line 9:
```tsx
import activeBrokerageReducer from '@/store/reducers/activeBrokerage'
```

2. Add to `reducer` object:
```tsx
const store = configureStore({
    reducer: {
        account: accountReducer,
        createBrokerageWizard: createBrokerageWizardReducer,
        tempBrokerage: tempBrokerageReducer,
        activeBrokerage: activeBrokerageReducer,   // NEW
    },
    preloadedState,
})
```

**Why required:** `renderWithProviders.tsx` manually enumerates reducers — it is NOT derived from the root store. Tests for `BrokerageSelection` or `PortalShell` that call `useAppSelector((s) => s.activeBrokerage.*)` will throw "No reducer provided for key 'activeBrokerage'" without this update.

**`preloadedState` usage for tests** — the `activeBrokerage` slice can be pre-seeded:
```tsx
renderWithProviders(<BrokerageSelection />, {
    preloadedState: {
        activeBrokerage: {
            activeBrokerage: null,
            adminBrokerages: [{ id: '1', name: 'Acme Realty', role: 'owner' }]
        }
    }
})
```

---

## Shared Patterns

### Raw Div Card Outer Wrapper
**Source:** `frontend/src/containers/portal/DashboardPlaceholder.tsx` (lines 2–5) + `frontend/src/containers/portal/NoAccess.tsx` (lines 17–20) + `frontend/src/containers/auth/LoginSuccessful.tsx` (lines 62–64, 81–84)
**Apply to:** `BrokerageSelection.tsx`, `PortalShell.tsx`
```tsx
<div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {/* content */}
    </div>
</div>
```
Do NOT use `<Card>`, `<CardHeader>`, `<CardContent>`, or other shadcn Card components for any Phase 17 screen.

### Typography Scale
**Source:** `frontend/src/containers/portal/NoAccess.tsx` (lines 20–23) + `frontend/src/containers/auth/LoginSuccessful.tsx` (lines 84–87)
**Apply to:** `BrokerageSelection.tsx`, `PortalShell.tsx`
```tsx
<div className="text-lg font-semibold text-foreground">Heading text</div>
<div className="text-sm text-muted-foreground">Body / subtitle text</div>
```

### Typed Redux Hooks
**Source:** `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` (line 4)
**Apply to:** `BrokerageSelection.tsx`, `PortalShell.tsx`, `LoginSuccessful.tsx`
```tsx
import { useAppDispatch, useAppSelector } from '@/store/hooks/useDispatch'

const dispatch = useAppDispatch()
const someValue = useAppSelector((s) => s.sliceName.field)
```
Never import `useDispatch` or `useSelector` from `react-redux` directly — always use the typed wrappers.

### `navigate` with `{ replace: true }`
**Source:** `frontend/src/containers/auth/LoginSuccessful.tsx` (line 48)
**Apply to:** All routing redirects in `BrokerageSelection.tsx`, `PortalShell.tsx`
```tsx
navigate('/dashboard', { replace: true })
// Use replace:true for all auth/routing-decision redirects
// so Back button does not re-trigger the redirect
```

### Loading Spinner
**Source:** `frontend/src/containers/auth/LoginSuccessful.tsx` (line 83)
**Apply to:** `PortalShell.tsx` loading state
```tsx
<div
    className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
    role="status"
    aria-label="Loading your workspace"
/>
```

### Import Path Convention
**Source:** All frontend files
**Apply to:** All new files
- Use `@/` alias for all imports — never relative paths beyond same directory.
- Example: `@/store/reducers/activeBrokerage`, `@/assets/types/adminBrokerageType`, `@/store/hooks/useDispatch`

---

## No Analog Found

All 8 files have close analogs in the codebase. No files require fallback to external reference documentation.

---

## Metadata

**Analog search scope:** `frontend/src/store/reducers/`, `frontend/src/containers/portal/`, `frontend/src/containers/auth/`, `frontend/src/containers/createBrokerage/steps/`, `frontend/src/router/portal/`, `frontend/src/test/`, `frontend/src/assets/api/`, `frontend/src/assets/types/`
**Files read:** 16
**Pattern extraction date:** 2026-05-25

# Phase 21: Frontend — Redirect Guard & Domains Admin Page - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 15
**Analogs found:** 15 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/components/common/guards/PrimaryDomainRedirect.tsx` | guard/layout-route | request-response | `frontend/src/components/common/guards/DomainGuard.tsx` | exact |
| `frontend/src/assets/api/domains/lookupDomain.ts` | API module | request-response | `frontend/src/assets/api/admin/domains/verifyDomain.ts` | role-match (unauthenticated variant) |
| `frontend/src/assets/types/domainType.ts` | type definition | — | `frontend/src/assets/types/brokerageType.ts` | exact |
| `frontend/src/store/hooks/Admin/Domains/useUpdateSubdomain.ts` | mutation hook | request-response (CRUD) | `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` + `useCreateAdminUser.tsx` | exact |
| `frontend/src/store/hooks/Admin/Domains/useSetPrimaryDomain.ts` | mutation hook | request-response (CRUD) | same as above | exact |
| `frontend/src/store/hooks/Admin/Domains/useDecommissionDomain.ts` | mutation hook | request-response (CRUD) | same as above | exact |
| `frontend/src/store/hooks/Admin/Domains/useAddCustomDomain.ts` | mutation hook | request-response (CRUD) | same as above | exact |
| `frontend/src/store/hooks/Admin/Domains/useRemoveCustomDomain.ts` | mutation hook | request-response (CRUD) | same as above | exact |
| `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` | container | request-response (CRUD) | `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx` | exact |
| `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` | context/brain | request-response (CRUD) | `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` | exact |
| `frontend/src/components/sidenav/SideNav.tsx` | component (modify) | — | self | — |
| `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` | component (modify) | — | self | — |
| `frontend/src/router/main.tsx` | router config (modify) | — | self | — |
| `frontend/src/router/admin/admin.tsx` | router config (modify) | — | self | — |
| `frontend/src/assets/api/admin/domains/fetchDomains.ts` | API module (modify) | request-response | self | — |

---

## Pattern Assignments

### `frontend/src/components/common/guards/PrimaryDomainRedirect.tsx` (guard, request-response)

**Analog:** `frontend/src/components/common/guards/DomainGuard.tsx`

**Full analog** (lines 1–27):
```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { isMainDomain } from '@/helpers/domain'
import NotFound from '@/containers/errorPage/NotFound'

export const SubdomainOnly = () => {
    if (isMainDomain()) return <NotFound />
    return <Outlet />
}

export const MainDomainOnly = () => {
    if (!isMainDomain()) return <Navigate to="/" replace />
    return <Outlet />
}
```

**Key extractions for PrimaryDomainRedirect:**
- Import pattern: `import { Outlet } from 'react-router-dom'` + `import { isMainDomain } from '@/helpers/domain'`
- Layout route pattern: component renders `<Outlet />` (not `{children}`) — React Router v6 requirement
- Null-render while async: add `useState(false)` for `ready`; return `null` when not ready, `<Outlet />` when ready
- Skip condition using `isMainDomain()` — set ready immediately and return

**`isMainDomain()` source** (`frontend/src/helpers/domain.ts` lines 5–7):
```ts
export function isMainDomain(): boolean {
    return window.location.hostname === import.meta.env.VITE_MAIN_DOMAIN
}
```

**Core pattern to implement** (derived from analog + CONTEXT.md D-01 through D-04):
```tsx
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { isMainDomain } from '@/helpers/domain'
import lookupDomain from '@/assets/api/domains/lookupDomain'

const PrimaryDomainRedirect = () => {
    const [ready, setReady] = useState(false)

    useEffect(() => {
        if (isMainDomain()) { setReady(true); return }

        const hostname = window.location.hostname
        lookupDomain(hostname)
            .then((data) => {
                if (data.domain && data.domain !== hostname) {
                    const primaryUrl = `https://${data.domain}${window.location.pathname}${window.location.search}`
                    window.location.replace(primaryUrl)
                    // Do NOT setReady — page is navigating away
                } else {
                    setReady(true)
                }
            })
            .catch(() => {
                setReady(true)  // D-03: fail open
            })
    }, [])

    if (!ready) return null   // D-02: blank screen while in flight — no spinner
    return <Outlet />
}

export default PrimaryDomainRedirect
```

---

### `frontend/src/assets/api/domains/lookupDomain.ts` (API module, request-response, unauthenticated)

**Analog:** `frontend/src/assets/api/admin/domains/verifyDomain.ts`

**Analog pattern** (lines 1–15):
```ts
import api from '@/assets/axios/axios'

export type VerifyDomainResponse = { ... }

const verifyDomain = async (domainId: string | number): Promise<VerifyDomainResponse> => {
    const response = await api.post(`/v1/admin/domains/${domainId}/verify`)
    return response.data as VerifyDomainResponse
}

export default verifyDomain
```

**Critical deviation from analog:** Do NOT use `import api from '@/assets/axios/axios'`. The `api` instance injects `Authorization` and `X-Brokerage-Id` headers (verified from `axios.ts` lines 23–40). The lookup endpoint is public and fires before auth. Use base `axios` directly.

**`axios.ts` auth interceptor** (lines 23–40 — shows why `api` must not be used here):
```ts
api.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    if (isMainDomain()) {
        const activeBrokerage = store.getState().activeBrokerage.activeBrokerage
        if (activeBrokerage) config.headers['X-Brokerage-Id'] = activeBrokerage.id
    }
    return config
}, ...)
```

**Pattern to implement:**
```ts
import axios from 'axios'  // base axios — NOT the authenticated api instance

export interface LookupDomainResponse {
    domain: string
}

const lookupDomain = async (domain: string): Promise<LookupDomainResponse> => {
    const baseUrl = (import.meta.env.VITE_BE_ENDPOINT as string | undefined)?.trim() || window.location.origin
    const response = await axios.get<LookupDomainResponse>(`${baseUrl}/v1/domains/lookup`, {
        params: { domain },
    })
    return response.data
}

export default lookupDomain
```

**Note:** No camelcaseKeys call — the `api` interceptor applies it automatically, but plain `axios` does not. The response `{ domain: string }` is simple enough that no transformation is needed.

---

### `frontend/src/assets/types/domainType.ts` (type definition)

**Analog:** `frontend/src/assets/types/brokerageType.ts`

**Analog pattern** (lines 1–13):
```ts
export interface BrokerageType {
    id: string
    name: string
    address?: string | null
    website?: string | null
    contactEmail: string
    plan?: string
}

export default BrokerageType
```

**Pattern to implement** (all types for Phase 21; defined before any hooks or contexts per CLAUDE.md):
```ts
// RESERVED_SLUGS mirrors BrokerageDomain::RESERVED_SLUGS from backend model
export const RESERVED_SLUGS = [
    'admin', 'api', 'www', 'mail', 'smtp', 'ftp', 'staging',
    'dev', 'test', 'app', 'auth', 'login', 'signup', 'dashboard',
    'static', 'assets', 'cdn', 'docs', 'help', 'support', 'status',
] as const

export type DomainType = 'subdomain' | 'custom'
export type DomainStatus = 'active' | 'phasing_out' | 'decommissioned'

export interface BrokerageDomain {
    id: string | number
    domain: string
    domainType: DomainType       // camelCased from domain_type via interceptor
    status: DomainStatus
    isPrimary: boolean            // camelCased from is_primary via interceptor
    phaseOutAt: string | null     // camelCased from phase_out_at via interceptor
}

export interface PhaseOutWarning {
    earliestSlotAvailableAt: string  // camelCased from phase_out_warning.earliest_slot_available_at
}

export interface FetchDomainsResponse {
    domains: BrokerageDomain[]
}

export interface MutationDomainsResponse {
    domain: BrokerageDomain
    domains: BrokerageDomain[]
    phaseOutWarning?: PhaseOutWarning  // camelCased from phase_out_warning
}
```

---

### `frontend/src/store/hooks/Admin/Domains/useUpdateSubdomain.ts` (mutation hook, CRUD)

**Primary analog:** `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts`

**Analog full source** (lines 1–25):
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import verifyDomain from '@/assets/api/admin/domains/verifyDomain'
import { domainsKeys } from './useFetchDomains'

const useVerifyDomain = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (domainId: string | number) => verifyDomain(domainId),
        onSuccess: (data) => {
            if (data.verified) {
                toast.success('Domain verified successfully')
                queryClient.invalidateQueries({ queryKey: domainsKeys.all })
            } else {
                toast.error(data.error || 'Domain verification failed')
            }
        },
        onError: () => {
            toast.error('DNS check failed — ensure your DNS records are set correctly')
        },
    })
}

export default useVerifyDomain
```

**Secondary analog (for onError with AxiosErrorType):** `frontend/src/store/hooks/Admin/Users/useCreateAdminUser.tsx` (lines 1–32):
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosErrorType } from '@/assets/types/axiosErrorType'
import toast from 'react-hot-toast'
import createAdminUser, { CreateAdminUserPayload } from '@/assets/api/admin/users/createAdminUser'
import { brokerageUsersKeys } from '@/store/hooks/queryKeys'

const useCreateAdminUser = () => {
    const queryClient = useQueryClient()

    const { isLoading, mutate, isError, error, data } = useMutation({
        mutationFn: (body: CreateAdminUserPayload) => createAdminUser(body),
        retry: false,
        onSuccess: () => {
            toast.success('Invitation sent successfully')
            queryClient.invalidateQueries({ queryKey: brokerageUsersKeys.all })
        },
        onError: (err: AxiosErrorType) => {
            toast.error('Failed to create user')
            console.error('Failed to create user:', err)
        }
    })

    return { isLoading, mutate, isError, error, data }
}
```

**Pattern to implement for all five mutation hooks.** `useUpdateSubdomain` shown as reference; the others (`useSetPrimaryDomain`, `useDecommissionDomain`, `useAddCustomDomain`, `useRemoveCustomDomain`) follow the identical structure with different `mutationFn` and toast text:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import updateSubdomain from '@/assets/api/admin/domains/updateSubdomain'
import { domainsKeys } from './useFetchDomains'
import { MutationDomainsResponse, PhaseOutWarning } from '@/assets/types/domainType'

const useUpdateSubdomain = (onPhaseOutWarning?: (warning: PhaseOutWarning) => void) => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (slug: string) => updateSubdomain(slug),
        onSuccess: (data: MutationDomainsResponse) => {
            // D-18: update cache directly from domains array in response
            queryClient.setQueryData(domainsKeys.all, { domains: data.domains })
            toast.success('Subdomain updated.')
            if (data.phaseOutWarning && onPhaseOutWarning) {
                onPhaseOutWarning(data.phaseOutWarning)
            }
        },
        onError: () => {
            toast.error('Something went wrong. Please try again.')
        },
    })
}

export default useUpdateSubdomain
```

**Hook variations:**

| Hook | `mutationFn` | Success toast | Special behavior |
|------|-------------|---------------|-----------------|
| `useUpdateSubdomain` | `updateSubdomain(slug: string)` | `'Subdomain updated.'` | Pass `phaseOutWarning` via callback if present |
| `useSetPrimaryDomain` | `setPrimaryDomain(id: string \| number)` | `'Primary domain updated.'` | No warning callback |
| `useDecommissionDomain` | `removeDomain(id: string \| number)` | `'Domain decommissioned.'` | No warning callback |
| `useAddCustomDomain` | `addCustomDomain(domain: string)` | `'Custom domain added.'` | Pass `phaseOutWarning` if present |
| `useRemoveCustomDomain` | `removeDomain(id: string \| number)` | `'Domain removed.'` | No warning callback |

All use `queryClient.setQueryData(domainsKeys.all, { domains: data.domains })` on success. Return `useMutation(...)` directly (not destructured) — matches `useVerifyDomain.ts` pattern.

---

### `frontend/src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` (container, CRUD)

**Analog:** `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx`

**Full analog** (lines 1–58):
```tsx
import BrokerageInformation from '@/components/view/admin/brokerageView/BrokerageInformation'
import AdminBoard from '../AdminBoard'
import useBrokerageAdminBoardContext from './BrokerageAdminBoardContext'

const BrokerageAdminBoard = () => {
    const { state, actions } = useBrokerageAdminBoardContext()

    if (state.isLoading) {
        return (
            <AdminBoard>
                <div className="p-6 text-sm text-muted-foreground">Loading brokerage information...</div>
            </AdminBoard>
        )
    }

    if (state.error) {
        return (
            <AdminBoard>
                <div className="p-6 text-sm text-destructive">Error loading brokerage information</div>
            </AdminBoard>
        )
    }

    if (!state.brokerage) {
        return (
            <AdminBoard>
                <div className="p-6 text-sm text-destructive">No brokerage data available</div>
            </AdminBoard>
        )
    }

    return (
        <AdminBoard>
            <div className="w-full p-6">
                <BrokerageInformation
                    brokerage={state.brokerage}
                    onUpdateBrokerage={actions.handleUpdateBrokerage}
                />
            </div>
        </AdminBoard>
    )
}

export default BrokerageAdminBoard
```

**Pattern to implement:**
- Same three guard renders: `isLoading`, `error`, `!domains` (empty state falls through to normal render)
- Import `AdminBoard` from `'../AdminBoard'`
- Import context hook from `'./useDomainsAdminContext'`
- Render `<DomainsAdminView>` (view component) inside `<AdminBoard>` passing `state` and `actions` as props
- No business logic in the container — it is purely a context-to-view bridge

---

### `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` (context/brain, CRUD)

**Analog:** `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts`

**Full analog** (lines 1–57):
```ts
import { useCallback, useMemo, useState } from 'react'
import useFetchBrokerage from '@/store/hooks/Admin/Brokerage/useFetchBrokerage'
import useUpdateBrokerage from '@/store/hooks/Admin/Brokerage/useUpdateBrokerage'

const useBrokerageAdminBoardContext = () => {
    const [isConnectBoardOpen, setIsConnectBoardOpen] = useState(false)
    const { data: brokerageData, isLoading, error } = useFetchBrokerage()
    const { mutate: updateBrokerageData } = useUpdateBrokerage()

    const handleUpdateBrokerage = useCallback(async (data: Partial<BrokerageType>) => {
        updateBrokerageData(data)
    }, [updateBrokerageData])

    return useMemo(() => ({
        state: {
            brokerage: brokerageData,
            isLoading,
            error,
            isConnectBoardOpen
        },
        actions: {
            handleUpdateBrokerage,
            setIsConnectBoardOpen,
        }
    }), [brokerageData, isLoading, error, isConnectBoardOpen, handleUpdateBrokerage])
}

export default useBrokerageAdminBoardContext
```

**Pattern to implement:**
```ts
import { useCallback, useMemo, useState } from 'react'
import useFetchDomains from '@/store/hooks/Admin/Domains/useFetchDomains'
import useUpdateSubdomain from '@/store/hooks/Admin/Domains/useUpdateSubdomain'
import useSetPrimaryDomain from '@/store/hooks/Admin/Domains/useSetPrimaryDomain'
import useDecommissionDomain from '@/store/hooks/Admin/Domains/useDecommissionDomain'
import useAddCustomDomain from '@/store/hooks/Admin/Domains/useAddCustomDomain'
import useRemoveCustomDomain from '@/store/hooks/Admin/Domains/useRemoveCustomDomain'
import { BrokerageDomain, PhaseOutWarning } from '@/assets/types/domainType'

const useDomainsAdminContext = () => {
    const [slotWarning, setSlotWarning] = useState<PhaseOutWarning | null>(null)
    const { data, isLoading, error } = useFetchDomains()

    const { mutate: updateSubdomain } = useUpdateSubdomain(setSlotWarning)
    const { mutate: setPrimary } = useSetPrimaryDomain()
    const { mutate: decommission } = useDecommissionDomain()
    const { mutate: addCustom } = useAddCustomDomain(setSlotWarning)
    const { mutate: removeCustom } = useRemoveCustomDomain()

    // Slot block check per Pitfall 5 in RESEARCH.md — must be global, not per-card
    const subdomainSlotsBlocked = (data?.domains ?? [])
        .filter(d => d.domainType === 'subdomain' && d.status === 'phasing_out').length >= 2

    return useMemo(() => ({
        state: {
            domains: data?.domains ?? [],
            isLoading,
            error,
            slotWarning,
            subdomainSlotsBlocked,
        },
        actions: {
            updateSubdomain,
            setPrimary,
            decommission,
            addCustom,
            removeCustom,
        }
    }), [data, isLoading, error, slotWarning, subdomainSlotsBlocked,
         updateSubdomain, setPrimary, decommission, addCustom, removeCustom])
}

export default useDomainsAdminContext
```

**Key points:**
- `useMemo` wraps return value — matches analog exactly
- `useCallback` is used in analog for handlers; use it here too for any wrapper functions
- `slotWarning` is local ephemeral state — reset on page reload (D-12)
- `subdomainSlotsBlocked` is computed from query data, not stored separately

---

### `frontend/src/components/sidenav/SideNav.tsx` (modify — add Domains nav item)

**Self-analog** (lines 213–238 — the `{adminOpen && <div>}` block):
```tsx
{adminOpen && (
    <div className="mt-0.5 space-y-0.5">
        <NavButton
            label="Brokerage"
            icon={<Building className="h-4 w-4" />}
            path="/admin/brokerage"
            onNavigate={handleNavigate}
        />
        <NavButton
            label="Users"
            icon={<Users className="h-4 w-4" />}
            path="/admin/users"
            onNavigate={handleNavigate}
        />
        <NavButton
            label="Listing Groups"
            icon={<Layers3 className="h-4 w-4" />}
            path="/admin/groups"
            onNavigate={handleNavigate}
        />
        <NavButton
            label="Settings"
            icon={<Settings className="h-4 w-4" />}
            path="/admin/settings"
            exact
            onNavigate={handleNavigate}
        />
    </div>
)}
```

**Change required:**
1. Add `Globe` to lucide-react import (line 18 — existing multi-import block)
2. Insert after the "Listing Groups" `NavButton` (after line 231):
```tsx
<NavButton
    label="Domains"
    icon={<Globe className="h-4 w-4" />}
    path="/admin/domains"
    onNavigate={handleNavigate}
/>
```

---

### `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` (modify — add Domains nav item)

**Self-analog** (lines 1–10 — the `items` array):
```ts
import { Building2, Layers3, Settings, Users } from 'lucide-react'

const items = [
    { label: 'Board Registrations', icon: Building2, path: '/admin/brokerage' },
    { label: 'Users', icon: Users, path: '/admin/users' },
    { label: 'Groups', icon: Layers3, path: '/admin/groups' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
]
```

**Change required:**
1. Add `Globe` to lucide-react import (line 2)
2. Insert after the `Groups` entry (after line 8):
```ts
{ label: 'Domains', icon: Globe, path: '/admin/domains' },
```

---

### `frontend/src/router/main.tsx` (modify — add PrimaryDomainRedirect layout route)

**Self-analog** (lines 22–32 — the `SubdomainOnly` block):
```tsx
{
    element: <SubdomainOnly />,
    children: [
        {
            element: <ProtectedRoute />,
            children: [dashboard, account],
        },
        joinBrokerage,
    ],
},
```

**Change required:** Insert `PrimaryDomainRedirect` as a layout route wrapping the existing children. React Router v6 layout route pattern — `PrimaryDomainRedirect` uses `<Outlet />` internally:

```tsx
{
    element: <SubdomainOnly />,
    children: [
        {
            element: <PrimaryDomainRedirect />,
            children: [
                {
                    element: <ProtectedRoute />,
                    children: [dashboard, account],
                },
                joinBrokerage,
            ],
        },
    ],
},
```

Add import: `import PrimaryDomainRedirect from '@/components/common/guards/PrimaryDomainRedirect'`

---

### `frontend/src/router/admin/admin.tsx` (modify — add `/admin/domains` route)

**Self-analog** (lines 23–84 — children array pattern):
```ts
export const admin = {
    path: '/admin/',
    element: <AdminDomainShell />,
    errorElement: <ErrorPage />,
    children: [
        { element: <BrokerageAdminBoard />, path: 'brokerage' },
        { element: <UsersAdminBoard />, path: 'users' },
        // ...
        { element: <SettingsAdminBoard />, path: 'settings' }
    ]
}
```

**Change required:** Add to `children` array (logically after groups, before settings):
```ts
{ element: <DomainsAdminBoard />, path: 'domains' },
```

Add import: `import DomainsAdminBoard from '@/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard'`

---

### `frontend/src/assets/api/admin/domains/fetchDomains.ts` (modify — update BrokerageDomain type)

**Current state** (lines 1–20):
```ts
import api from '@/assets/axios/axios'

export type BrokerageDomain = {
    id: string | number
    domain: string
    verified: boolean
    verifiedAt: string | null
    verificationToken: string | null
}

export type FetchDomainsResponse = {
    domains: BrokerageDomain[]
}

const fetchDomains = async (): Promise<FetchDomainsResponse> => {
    const response = await api.get('/v1/admin/domains')
    return response.data as FetchDomainsResponse
}

export default fetchDomains
```

**Change required:** Remove the `BrokerageDomain` and `FetchDomainsResponse` type definitions. Import them from `domainType.ts` instead. Keep the `fetchDomains` function unchanged:
```ts
import api from '@/assets/axios/axios'
import { BrokerageDomain, FetchDomainsResponse } from '@/assets/types/domainType'

export type { BrokerageDomain, FetchDomainsResponse }  // re-export to preserve existing imports in useFetchDomains.ts

const fetchDomains = async (): Promise<FetchDomainsResponse> => {
    const response = await api.get('/v1/admin/domains')
    return response.data as FetchDomainsResponse
}

export default fetchDomains
```

**Note:** `useFetchDomains.ts` currently imports `FetchDomainsResponse` from `fetchDomains.ts` — the re-export keeps that import working without touching `useFetchDomains.ts`. If the planner prefers a clean break, update `useFetchDomains.ts` to import from `domainType.ts` directly and remove the re-export.

---

### New API modules for admin domain mutations

**Analog pattern:** `frontend/src/assets/api/admin/domains/verifyDomain.ts` (all lines):
```ts
import api from '@/assets/axios/axios'

export type VerifyDomainResponse = { ... }

const verifyDomain = async (domainId: string | number): Promise<VerifyDomainResponse> => {
    const response = await api.post(`/v1/admin/domains/${domainId}/verify`)
    return response.data as VerifyDomainResponse
}

export default verifyDomain
```

**Four new API modules to create** (all use `import api from '@/assets/axios/axios'` and `return response.data as MutationDomainsResponse`):

| File | HTTP method | URL | Param type |
|------|-------------|-----|-----------|
| `updateSubdomain.ts` | `api.patch` | `/v1/admin/domains/subdomain` | `slug: string` as body `{ slug }` |
| `setPrimaryDomain.ts` | `api.patch` | `/v1/admin/domains/${id}/set_primary` | `id: string \| number` in path |
| `removeDomain.ts` | `api.delete` | `/v1/admin/domains/${id}` | `id: string \| number` in path |
| `addCustomDomain.ts` | `api.post` | `/v1/admin/domains/custom` | `domain: string` as body `{ domain }` |

All return `Promise<MutationDomainsResponse>` imported from `@/assets/types/domainType`.

---

### New view components (DomainSlugInput.tsx — mirrors SubdomainInput.tsx)

**Analog:** `frontend/src/components/createBrokerage/SubdomainInput.tsx`

**Full analog** (lines 1–51):
```tsx
import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SubdomainInputProps {
    value: string
    onChange: (value: string) => void
    baseDomain?: string
    error?: string
}

const normalize = (raw: string): string =>
    raw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')

const SubdomainInput: React.FC<SubdomainInputProps> = ({
    value,
    onChange,
    baseDomain = 'realstate.ca',
    error,
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(normalize(e.target.value))
    }

    return (
        <div className="space-y-1.5">
            <Label htmlFor="subdomain">Subdomain</Label>
            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                <Input
                    id="subdomain"
                    value={value}
                    onChange={handleChange}
                    placeholder="your-brokerage"
                    className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    maxLength={63}
                />
                <span className="shrink-0 select-none pr-3 text-sm text-muted-foreground">
                    .{baseDomain}
                </span>
            </div>
            {value && (
                <p className="text-xs text-muted-foreground">
                    Your site: <span className="font-medium text-foreground">{value}.{baseDomain}</span>
                </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    )
}
```

**`DomainSlugInput.tsx` adapts this pattern with:**
- Remove `<Label>` — card already has a header; label not needed inside inline edit form
- Remove preview `<p>` ("Your site:") — card header already shows the domain name
- Keep the composite border focus-ring pattern exactly: outer `div` with `focus-within:ring-1` + inner `Input` with `border-0 shadow-none focus-visible:ring-0`
- Keep the `.realstate.app` suffix span (update default `baseDomain` prop to `'realstate.app'`)
- Add `disabled` prop for DUI-07 blocked state
- Validation (per D-11 order): (1) empty check, (2) pattern regex `/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/`, (3) `RESERVED_SLUGS` check, (4) unchanged check (disable Save, no error text)

---

## Shared Patterns

### Authentication / Axios instance
**Source:** `frontend/src/assets/axios/axios.ts` (lines 15–21, 23–40)
**Apply to:** All new API modules in `assets/api/admin/domains/` (use `api`), EXCEPT `lookupDomain.ts` (use base `axios`)

```ts
// All admin domain API modules — authenticated pattern
import api from '@/assets/axios/axios'
// ...
const response = await api.patch('/v1/admin/domains/...')
return response.data as MutationDomainsResponse
```

### Cache Invalidation / Update
**Source:** `frontend/src/store/hooks/Admin/Domains/useVerifyDomain.ts` (lines 10–18)
**Apply to:** All five new mutation hooks

Prefer `queryClient.setQueryData(domainsKeys.all, { domains: data.domains })` over `invalidateQueries` per D-18 — direct update from mutation response avoids a round-trip.

### useMemo return pattern (Context/Brain)
**Source:** `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` (lines 38–54)
**Apply to:** `useDomainsAdminContext.ts`

All contexts return `useMemo(() => ({ state: {...}, actions: {...} }), [deps])` — never return plain objects (prevents unnecessary re-renders).

### Toast pattern
**Source:** `frontend/src/store/hooks/Admin/Users/useCreateAdminUser.tsx` (lines 19–26)
**Apply to:** All mutation hooks — `toast.success(...)` in `onSuccess`, `toast.error(...)` in `onError`

```ts
import toast from 'react-hot-toast'
// onSuccess: toast.success('...')
// onError: toast.error('Something went wrong. Please try again.')
```

### Import path aliases
**Apply to:** All new files — use `@/` alias for all project imports. Verified from all read files.

```ts
import { BrokerageDomain } from '@/assets/types/domainType'
import { domainsKeys } from '@/store/hooks/Admin/Domains/useFetchDomains'
import api from '@/assets/axios/axios'
```

### Outlet pattern (layout routes)
**Source:** `frontend/src/components/common/guards/DomainGuard.tsx` (lines 14–15, 26–27)
**Apply to:** `PrimaryDomainRedirect.tsx`

React Router v6 layout routes always use `<Outlet />`, never `{children}` prop.

### Loading / error / empty guard renders in containers
**Source:** `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx` (lines 9–30)
**Apply to:** `DomainsAdminBoard.tsx`

```tsx
if (state.isLoading) return <AdminBoard><div className="p-6 text-sm text-muted-foreground">Loading...</div></AdminBoard>
if (state.error) return <AdminBoard><div className="p-6 text-sm text-destructive">Error loading domains</div></AdminBoard>
```

---

## No Analog Found

All files in Phase 21 have strong analogs. No files require fallback to RESEARCH.md patterns only.

However, two patterns are **new to this codebase** and have no prior art — they are derived from the existing patterns, not directly copied:

| File | Pattern | Derivation source |
|------|---------|-------------------|
| `DomainCard.tsx` (inline edit toggle) | Per-card `editingId` lifted to section level | React state pattern; no prior inline card edit in this codebase |
| `FreeSlotAccordion.tsx` | Radix/shadcn Accordion usage | Install `accordion` first via `npx shadcn add accordion`; follow shadcn docs pattern |

---

## File Creation Order (for planner)

Build bottom-up per CLAUDE.md architecture requirement ("types before hooks or contexts"):

1. `domainType.ts` — types and constants (no dependencies)
2. `lookupDomain.ts` — public API module (depends on: types)
3. `updateSubdomain.ts`, `setPrimaryDomain.ts`, `removeDomain.ts`, `addCustomDomain.ts` — admin API modules (depends on: types)
4. `useUpdateSubdomain.ts`, `useSetPrimaryDomain.ts`, `useDecommissionDomain.ts`, `useAddCustomDomain.ts`, `useRemoveCustomDomain.ts` — mutation hooks (depends on: types, API modules, `domainsKeys`)
5. Update `fetchDomains.ts` — type swap (depends on: types)
6. `useDomainsAdminContext.ts` — brain (depends on: hooks)
7. `PrimaryDomainRedirect.tsx` — guard (depends on: `lookupDomain.ts`, `isMainDomain`)
8. View components (`DomainsAdminView`, `DomainCard`, `DomainSlugInput`, `FreeSlotAccordion`) — pure UI
9. `DomainsAdminBoard.tsx` — container (depends on: context, view components)
10. Modifications: `SideNav.tsx`, `PortalAdminSideNav.tsx`, `admin.tsx`, `main.tsx`

---

## Metadata

**Analog search scope:** `frontend/src/` — guards, containers/adminBoard, store/hooks/Admin, assets/api/admin, assets/types, helpers, components/sidenav, router
**Files scanned:** 18 source files read directly
**Pattern extraction date:** 2026-05-28

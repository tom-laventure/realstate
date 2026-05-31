# Phase 25: Board Registrations Nav Separation - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 7 (2 new, 5 edited)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard.tsx` | container | request-response | `src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` | exact |
| `src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts` | hook/context | request-response | `src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` | exact (subset) |
| `src/router/admin/admin.tsx` | config | — | itself — add one route entry matching existing shape | self-analog |
| `src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx` | container | request-response | itself (trimmed) | self-analog |
| `src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` | hook/context | request-response | itself (trimmed) | self-analog |
| `src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx` | component | — | itself — insert one nav item | self-analog |
| `src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` | component | — | itself — rename item + insert one | self-analog |

---

## Pattern Assignments

### `src/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard.tsx` (container, request-response)

**Analog:** `src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx`

**Imports pattern** (lines 1-8):
```typescript
import { useState } from 'react'
import AdminBoard from '../AdminBoard'
import DomainCardList from '@/components/view/admin/domainsAdminView/DomainCardList'
import useDomainsAdminContext from './useDomainsAdminContext'
```

For `BoardsAdminBoard`, replace the domain-specific imports:
```typescript
import AdminBoard from '../AdminBoard'
import BoardRegistrations from '@/components/view/admin/brokerageView/BoardRegistrations'
import useBoardsAdminContext from './useBoardsAdminContext'
```

**Loading/error guard pattern** (DomainsAdminBoard lines 13-27):
```typescript
if (state.isLoading) {
    return (
        <AdminBoard>
            <div className="p-6 text-sm text-muted-foreground">Loading domains...</div>
        </AdminBoard>
    )
}

if (state.error) {
    return (
        <AdminBoard>
            <div className="p-6 text-sm text-destructive">Error loading domains. Please refresh the page.</div>
        </AdminBoard>
    )
}
```

**Core render pattern** (DomainsAdminBoard lines 29-58):
```typescript
const DomainsAdminBoard = () => {
    const { state, actions } = useDomainsAdminContext()

    if (state.isLoading) { ... }
    if (state.error) { ... }

    return (
        <AdminBoard>
            <DomainCardList domains={state.domains} actions={actions} onDelete={setDeletingDomain} />
            {/* dialogs as needed */}
        </AdminBoard>
    )
}

export default DomainsAdminBoard
```

For `BoardsAdminBoard`, the `<BoardRegistrations>` component receives all props from `state`/`actions` — mirror the exact prop names from `BrokerageAdminBoard.tsx` lines 46-53:
```typescript
<BoardRegistrations
    boardCredentials={state.boardCredentials}
    boards={state.boards}
    isConnectBoardOpen={state.isConnectBoardOpen}
    setIsConnectBoardOpen={actions.setIsConnectBoardOpen}
    onConnectBoard={actions.handleConnectBoard}
    onDeleteCredential={actions.handleDeleteCredential}
    onEditCredential={actions.handleEditCredential}
/>
```

No loading guard is strictly required (BoardRegistrations handles empty arrays with "No boards connected yet" message), but adding one for UX consistency with other containers is recommended. If added, derive `isLoading` from `useFetchBoardCredentials` in the context.

---

### `src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts` (hook/context, request-response)

**Analog:** `src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` — extract board-only slice.

**Imports pattern** (BrokerageAdminBoardContext.ts lines 1-10):
```typescript
import { useCallback, useMemo, useState } from 'react'
import useFetchBoardCredentials from '@/store/hooks/Admin/Boards/useFetchBoardCredentials'
import useFetchBoards from '@/store/hooks/Admin/Boards/useFetchBoards'
import useCreateBoardCredential from '@/store/hooks/Admin/Boards/useCreateBoardCredential'
import useDeleteBoardCredential from '@/store/hooks/Admin/Boards/useDeleteBoardCredential'
import useUpdateBoardCredential from '@/store/hooks/Admin/Boards/useUpdateBoardCredential'
import { CreateBoardCredentialPayload, UpdateBoardCredentialPayload } from '@/assets/types/boardType'
```

Do NOT import `useFetchBrokerage`, `useUpdateBrokerage`, or `BrokerageType`.

**State + hooks pattern** (BrokerageAdminBoardContext.ts lines 13-20):
```typescript
const [isConnectBoardOpen, setIsConnectBoardOpen] = useState(false)
const { data: boardCredentialsData } = useFetchBoardCredentials()
const { data: boardsData } = useFetchBoards()
const { mutateAsync: createCredential } = useCreateBoardCredential()
const { mutate: deleteCredential } = useDeleteBoardCredential()
const { mutateAsync: updateCredential } = useUpdateBoardCredential()
```

**Callbacks pattern** (BrokerageAdminBoardContext.ts lines 26-36):
```typescript
const handleConnectBoard = useCallback(async (payload: CreateBoardCredentialPayload) => {
    await createCredential(payload)
}, [createCredential])

const handleDeleteCredential = useCallback((id: string) => {
    deleteCredential(id)
}, [deleteCredential])

const handleEditCredential = useCallback(async (id: string, payload: UpdateBoardCredentialPayload) => {
    await updateCredential({ id, payload })
}, [updateCredential])
```

**Return shape pattern** (BrokerageAdminBoardContext.ts lines 38-54):
```typescript
return useMemo(() => ({
    state: {
        boardCredentials: boardCredentialsData?.boardCredentials || [],
        boards: boardsData?.boards || [],
        isConnectBoardOpen
    },
    actions: {
        setIsConnectBoardOpen,
        handleConnectBoard,
        handleDeleteCredential,
        handleEditCredential
    }
}), [boardCredentialsData, boardsData, isConnectBoardOpen, handleConnectBoard, handleDeleteCredential, handleEditCredential])
```

Note: No `brokerage`, `isLoading`, or `error` from brokerage — this context is boards-only.

---

### `src/router/admin/admin.tsx` (config — add one route entry)

**Analog:** itself — the existing children array in `admin.tsx` lines 24-89.

**Existing import block pattern** (admin.tsx lines 1-18): Every container is imported at the top, one import per line, using the `@/containers/adminBoard/` path prefix.

**New import to add** (after line 18, before `export const admin`):
```typescript
import BoardsAdminBoard from '@/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard'
```

**Route entry pattern** (admin.tsx lines 26-28 — existing brokerage route):
```typescript
{
    element: <BrokerageAdminBoard />,
    path: 'brokerage'
},
```

**New route to insert** (after the `brokerage` entry, before or after `domains` — between brokerage and users for logical grouping):
```typescript
{
    element: <BoardsAdminBoard />,
    path: 'boards'
},
```

---

### `src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx` (container — trim)

**Current file:** lines 1-59.

**Imports to remove** (line 3): `import BoardRegistrations from '@/components/view/admin/brokerageView/BoardRegistrations'`

**Render block to remove** (lines 45-53):
```typescript
<BoardRegistrations
    boardCredentials={state.boardCredentials}
    boards={state.boards}
    isConnectBoardOpen={state.isConnectBoardOpen}
    setIsConnectBoardOpen={actions.setIsConnectBoardOpen}
    onConnectBoard={actions.handleConnectBoard}
    onDeleteCredential={actions.handleDeleteCredential}
    onEditCredential={actions.handleEditCredential}
/>
```

**Target state after trim** (keep lines 1-2, 4-5, 7-44, 54-59, remove BoardRegistrations import and its render block):
```typescript
// Only imports: BrokerageInformation, BrokerageBranding, AdminBoard, useBrokerageAdminBoardContext
return (
    <AdminBoard>
        <div className="w-full p-6">
            <BrokerageInformation
                brokerage={state.brokerage}
                onUpdateBrokerage={actions.handleUpdateBrokerage}
            />
            <BrokerageBranding
                brokerage={state.brokerage}
                onUpdateBrokerage={actions.handleUpdateBrokerage}
            />
        </div>
    </AdminBoard>
)
```

The loading, error, and null-brokerage guards (lines 10-32) remain unchanged.

---

### `src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` (hook/context — trim)

**Current file:** lines 1-57.

**Lines to remove entirely:**
- Line 5: `import useFetchBoardCredentials from '@/store/hooks/Admin/Boards/useFetchBoardCredentials'`
- Line 6: `import useFetchBoards from '@/store/hooks/Admin/Boards/useFetchBoards'`
- Line 7: `import useCreateBoardCredential from '@/store/hooks/Admin/Boards/useCreateBoardCredential'`
- Line 8: `import useDeleteBoardCredential from '@/store/hooks/Admin/Boards/useDeleteBoardCredential'`
- Line 9: `import useUpdateBoardCredential from '@/store/hooks/Admin/Boards/useUpdateBoardCredential'`
- Line 10: `import { CreateBoardCredentialPayload, UpdateBoardCredentialPayload } from '@/assets/types/boardType'`
- Line 13: `const [isConnectBoardOpen, setIsConnectBoardOpen] = useState(false)`
- Lines 16-20: all board hooks (`useFetchBoardCredentials`, `useFetchBoards`, `useCreateBoardCredential`, `useDeleteBoardCredential`, `useUpdateBoardCredential`)
- Lines 26-36: `handleConnectBoard`, `handleDeleteCredential`, `handleEditCredential` callbacks
- From state object (lines 43-45): `boardCredentials`, `boards`, `isConnectBoardOpen`
- From actions object (lines 49-52): `setIsConnectBoardOpen`, `handleConnectBoard`, `handleDeleteCredential`, `handleEditCredential`
- From `useMemo` deps (line 54): `boardCredentialsData`, `boardsData`, `isConnectBoardOpen`, `handleConnectBoard`, `handleDeleteCredential`, `handleEditCredential`

**Target state after trim** (keep only brokerage fetch + update):
```typescript
import { useCallback, useMemo } from 'react'
import useFetchBrokerage from '@/store/hooks/Admin/Brokerage/useFetchBrokerage'
import useUpdateBrokerage from '@/store/hooks/Admin/Brokerage/useUpdateBrokerage'
import BrokerageType from '@/assets/types/brokerageType'

const useBrokerageAdminBoardContext = () => {
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
        },
        actions: {
            handleUpdateBrokerage,
        }
    }), [brokerageData, isLoading, error, handleUpdateBrokerage])
}

export default useBrokerageAdminBoardContext
```

Note: `useState` import can be removed since no local state remains.

---

### `src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx` (component — insert nav item)

**Current file:** lines 1-107.

**Imports line to update** (line 2): Add `ClipboardList` to the lucide-react import:
```typescript
import React from 'react'
import { Building2, ClipboardList, Users, Layers3, Settings, Activity } from 'lucide-react'
```

**navItems array to update** (lines 20-26 — current):
```typescript
const navItems: NavItem[] = [
    { label: 'Brokerage', icon: <Building2 className="h-4 w-4" />, path: '/admin/brokerage' },
    { label: 'Users', icon: <Users className="h-4 w-4" />, path: '/admin/users' },
    { label: 'Listing Groups', icon: <Layers3 className="h-4 w-4" />, path: '/admin/groups' },
    { label: 'Settings', icon: <Settings className="h-4 w-4" />, path: '/admin/settings' },
    { label: 'Activity', icon: <Activity className="h-4 w-4" />, path: '/admin/activity' }
]
```

**After edit — insert at index 1:**
```typescript
const navItems: NavItem[] = [
    { label: 'Brokerage', icon: <Building2 className="h-4 w-4" />, path: '/admin/brokerage' },
    { label: 'Board Registrations', icon: <ClipboardList className="h-4 w-4" />, path: '/admin/boards' },
    { label: 'Users', icon: <Users className="h-4 w-4" />, path: '/admin/users' },
    { label: 'Listing Groups', icon: <Layers3 className="h-4 w-4" />, path: '/admin/groups' },
    { label: 'Settings', icon: <Settings className="h-4 w-4" />, path: '/admin/settings' },
    { label: 'Activity', icon: <Activity className="h-4 w-4" />, path: '/admin/activity' }
]
```

**Active-state logic** (lines 60-62) — unchanged, already correct:
```typescript
const active = item.exact
    ? location.pathname === item.path
    : location.pathname.startsWith(item.path)
```

`/admin/boards` and `/admin/brokerage` do not overlap — no conflict with `startsWith`.

---

### `src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` (component — rename + insert)

**Current file:** lines 1-46.

**Imports line to update** (line 2): Add `ClipboardList` to the lucide-react import:
```typescript
import { Building2, ClipboardList, Globe, Layers3, Settings, Users } from 'lucide-react'
```

**items array current state** (lines 5-11 — BROKEN: first item has wrong label):
```typescript
const items = [
    { label: 'Board Registrations', icon: Building2, path: '/admin/brokerage' },  // WRONG LABEL
    { label: 'Users', icon: Users, path: '/admin/users' },
    { label: 'Groups', icon: Layers3, path: '/admin/groups' },
    { label: 'Domains', icon: Globe, path: '/admin/domains' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
]
```

**After edit — rename first item, insert Board Registrations at index 1:**
```typescript
const items = [
    { label: 'Brokerage', icon: Building2, path: '/admin/brokerage' },
    { label: 'Board Registrations', icon: ClipboardList, path: '/admin/boards' },
    { label: 'Users', icon: Users, path: '/admin/users' },
    { label: 'Groups', icon: Layers3, path: '/admin/groups' },
    { label: 'Domains', icon: Globe, path: '/admin/domains' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
]
```

**Active-state logic** (lines 21-22) — unchanged, correct for both new items:
```typescript
const active =
    location.pathname === path || location.pathname.startsWith(path + '/')
```

The `path + '/'` suffix prevents `/admin/boards` from matching as a prefix of `/admin/brokerage` or vice versa.

**Nav item render pattern** (lines 23-38) — unchanged:
```typescript
<button
    key={path}
    type="button"
    onClick={() => navigate(path)}
    className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition',
        active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    )}
    aria-current={active ? 'page' : undefined}
>
    <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
    <span className="truncate">{label}</span>
</button>
```

Note: `PortalAdminSideNav` uses `<Icon className="...">` (component reference pattern) while `AdminBoardSideNav` uses `<Icon className="..." />` as JSX in the array (React node pattern). Do not mix the two styles — each file keeps its own icon rendering convention.

---

## Shared Patterns

### Context hook shape — `{ state, actions }` via `useMemo`
**Source:** `src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` lines 38-54
**Apply to:** `useBoardsAdminContext.ts` (new file)
```typescript
return useMemo(() => ({
    state: { ... },
    actions: { ... }
}), [/* all deps listed explicitly */])
```

### Container loading/error guards
**Source:** `src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx` lines 13-27
**Apply to:** `BoardsAdminBoard.tsx` (new file)
```typescript
if (state.isLoading) {
    return (
        <AdminBoard>
            <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        </AdminBoard>
    )
}
if (state.error) {
    return (
        <AdminBoard>
            <div className="p-6 text-sm text-destructive">Error loading...</div>
        </AdminBoard>
    )
}
```

### Nav active-state matching
**Source:** `src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx` lines 60-62
**Apply to:** both nav files (pattern already in place — do not change)
```typescript
location.pathname.startsWith(item.path)   // AdminBoardSideNav style
location.pathname.startsWith(path + '/')  // PortalAdminSideNav style (stricter — preferred)
```

### Icon import convention
**Source:** `src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx` line 2 and `src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` line 2
**Apply to:** both nav files — add `ClipboardList` to existing lucide-react named import
```typescript
// AdminBoardSideNav — JSX node in array
{ label: 'Board Registrations', icon: <ClipboardList className="h-4 w-4" />, path: '/admin/boards' }

// PortalAdminSideNav — component reference in array
{ label: 'Board Registrations', icon: ClipboardList, path: '/admin/boards' }
```

---

## No Analog Found

All files have direct analogs — no entries in this section.

---

## Metadata

**Analog search scope:** `frontend/src/containers/adminBoard/`, `frontend/src/router/admin/`, `frontend/src/components/navbar/`, `frontend/src/components/common/shells/`
**Files scanned:** 9 (7 target files + 2 primary analogs)
**Pattern extraction date:** 2026-05-31

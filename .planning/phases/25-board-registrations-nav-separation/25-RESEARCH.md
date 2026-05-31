# Phase 25: Board Registrations Nav Separation - Research

**Researched:** 2026-05-31
**Domain:** React Router, React Context pattern, Frontend navigation refactor
**Confidence:** HIGH

## Summary

Phase 25 is a pure frontend refactor with no backend changes required. The goal is to extract the `BoardRegistrations` component and its data-fetching logic out of the Brokerage admin page and into a new dedicated `/admin/boards` route, and update both admin sidebars to show the new nav item.

All supporting infrastructure already exists: the board credential API calls, TanStack Query hooks, the `BoardRegistrations` component, the `ConnectBoardDialog`, `EditBoardCredentialDialog` — nothing new needs to be built from scratch. The task is surgical separation:

1. Create `BoardsAdminBoard` container (new page) + `useBoardsAdminContext` (new context hook) that mirrors the boards-only subset of the current `BrokerageAdminBoardContext`
2. Strip board credential state/hooks from `BrokerageAdminBoardContext` and `BrokerageAdminBoard`
3. Register the new `/admin/boards` route in the router
4. Add the "Board Registrations" nav item to `AdminBoardSideNav` (subdomain nav) and `PortalAdminSideNav` (portal nav) — in both cases, between "Brokerage" and "Users"

**Primary recommendation:** Copy the boards-only slice out of `BrokerageAdminBoardContext` into a new `useBoardsAdminContext`, wire `BoardsAdminBoard` to it, register the route, then trim the brokerage context. All in one phase, no backend work needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| New `/admin/boards` route | Frontend (React Router) | — | Route config lives in `src/router/admin/admin.tsx` |
| Board Registrations page | Frontend (container + context) | — | Container wraps view component; context owns data fetches |
| Nav item in AdminBoardSideNav | Frontend (subdomain shell) | — | `AdminBoardSideNav` is used by `AppShellAdmin` on subdomains |
| Nav item in PortalAdminSideNav | Frontend (portal shell) | — | `PortalAdminSideNav` is used by `PortalAdminShell` on main domain |
| Brokerage page trim | Frontend (container + context) | — | Remove board-related state and renders from existing files |
| Board credential API calls | API / Backend | — | Already implemented; no changes needed |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | New `/admin/boards` route exists and renders a dedicated Board Registrations page | Add route entry in `admin.tsx`; create `BoardsAdminBoard` container |
| NAV-02 | `AdminBoardSideNav` (subdomain) has "Board Registrations" between "Brokerage" and "Users" | Edit `navItems` array in `AdminBoardSideNav.tsx` |
| NAV-03 | `PortalAdminSideNav` has "Brokerage" pointing to `/admin/brokerage` and "Board Registrations" pointing to `/admin/boards`, both before "Users" | Edit `items` array in `PortalAdminSideNav.tsx`; note that current portal nav has a mis-labeled item ("Board Registrations" pointing to `/admin/brokerage`) that must be corrected |
| NAV-04 | `/admin/brokerage` renders Brokerage Information and Branding only | Remove `<BoardRegistrations>` from `BrokerageAdminBoard.tsx`; remove board state from `BrokerageAdminBoardContext.ts` |
| NAV-05 | `/admin/boards` renders the Realtor Board Registrations table with connect, edit, delete | New `BoardsAdminBoard` renders `<BoardRegistrations>`; new `useBoardsAdminContext` provides data |
| NAV-06 | `BoardsAdminBoardContext` has board credential fetches and mutations; not dependent on brokerage fetch | New context calls `useFetchBoardCredentials`, `useFetchBoards`, `useCreateBoardCredential`, `useDeleteBoardCredential`, `useUpdateBoardCredential` — no `useFetchBrokerage` |
| NAV-07 | `BrokerageAdminBoardContext` no longer fetches board credentials or boards | Remove `useFetchBoardCredentials`, `useFetchBoards`, and all board mutation hooks from the context |
</phase_requirements>

## Standard Stack

### Core (already in project — no installs required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Router v6 | in project | Route config via object notation | Established pattern — all routes in `src/router/` |
| TanStack Query | in project | Server state hooks | All admin data hooks already exist |
| lucide-react | in project | Icons | Project-wide icon library |
| Tailwind CSS | in project | Styling | All existing nav items use Tailwind utilities |

**No new dependencies required.** [VERIFIED: codebase grep]

## Architecture Patterns

### System Architecture Diagram

```
admin.tsx (route config)
    └── /admin/boards → BoardsAdminBoard
                            └── useBoardsAdminContext
                                    ├── useFetchBoardCredentials
                                    ├── useFetchBoards
                                    ├── useCreateBoardCredential
                                    ├── useDeleteBoardCredential
                                    └── useUpdateBoardCredential
                            └── <AdminBoard>
                                    └── <BoardRegistrations> (existing component, reused)

    └── /admin/brokerage → BrokerageAdminBoard (trimmed)
                            └── useBrokerageAdminBoardContext (trimmed)
                                    ├── useFetchBrokerage
                                    └── useUpdateBrokerage
                            └── <AdminBoard>
                                    ├── <BrokerageInformation>
                                    └── <BrokerageBranding>

AdminDomainShell
    ├── isMainDomain() → PortalAdminShell
    │       └── PortalAdminSideNav (updated: Brokerage + Board Registrations + Users + ...)
    └── !isMainDomain() → AppShellAdmin
            └── SideNav (has admin section)
            └── AdminBoardSideNav (updated: Brokerage + Board Registrations + Users + ...)
```

### Recommended Project Structure

New files to create:
```
src/containers/adminBoard/
├── boardsAdminBoard/
│   ├── BoardsAdminBoard.tsx          # new page container
│   └── useBoardsAdminContext.ts      # new context hook (boards only)
```

Files to edit:
```
src/router/admin/admin.tsx                                              # add boards route
src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx   # remove BoardRegistrations render
src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts  # remove board hooks
src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx   # add Board Registrations nav item
src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx    # fix + add nav items
```

### Pattern 1: Container + Context hook (existing pattern)

The `BoardsAdminBoard` must follow the exact same pattern as `DomainsAdminBoard`:

```typescript
// Source: src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx (verified)
const DomainsAdminBoard = () => {
    const { state, actions } = useDomainsAdminContext()

    if (state.isLoading) {
        return (
            <AdminBoard>
                <div className="p-6 text-sm text-muted-foreground">Loading...</div>
            </AdminBoard>
        )
    }

    return (
        <AdminBoard>
            {/* view components */}
        </AdminBoard>
    )
}
```

`BoardsAdminBoard` should mirror this: check loading state, then render `<BoardRegistrations>` inside `<AdminBoard>`.

### Pattern 2: Context hook returns `{ state, actions }` memoized

```typescript
// Source: src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts (verified)
return useMemo(() => ({
    state: { boardCredentials, boards, isConnectBoardOpen },
    actions: { setIsConnectBoardOpen, handleConnectBoard, handleDeleteCredential, handleEditCredential }
}), [boardCredentials, boards, isConnectBoardOpen, ...handlers])
```

`useBoardsAdminContext` should return the same shape, containing only board state/actions.

### Pattern 3: Nav item array addition

```typescript
// Source: src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx (verified)
const navItems: NavItem[] = [
    { label: 'Brokerage', icon: <Building2 className="h-4 w-4" />, path: '/admin/brokerage' },
    // INSERT HERE: Board Registrations
    { label: 'Users', icon: <Users className="h-4 w-4" />, path: '/admin/users' },
    ...
]
```

Insert the new item between index 0 (Brokerage) and index 1 (Users). The icon for Board Registrations should be `ClipboardList` or `KeyRound` from lucide-react — a distinct icon not already used in this nav. [ASSUMED — icon choice is aesthetic]

### Anti-Patterns to Avoid

- **Passing `brokerage` data into `BoardsAdminBoard`:** The boards page must be fully self-contained — `useBoardsAdminContext` must NOT call `useFetchBrokerage`. NAV-06 explicitly forbids this dependency.
- **Wrapping `BoardRegistrations` in its own loading guard that checks brokerage:** The existing `BoardRegistrations` component receives props; it does not fetch data itself. The loading/error guard lives in the container.
- **Moving the `BoardRegistrations` component file:** It lives at `src/components/view/admin/brokerageView/BoardRegistrations.tsx` and that location is fine — components do not need to move just because the container changed. The view component is reused across two contexts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Board credential fetching | Custom fetch logic | `useFetchBoardCredentials` + `useFetchBoards` (existing) | Already wraps TanStack Query with correct keys and staleTime |
| Board mutations | Custom mutation wiring | `useCreateBoardCredential`, `useDeleteBoardCredential`, `useUpdateBoardCredential` (existing) | Already has toast notifications and cache invalidation |
| Nav active state detection | Custom match logic | `location.pathname.startsWith(item.path)` (existing pattern) | Already consistent with all other nav items in the codebase |
| Route registration | Custom dynamic routing | React Router object config in `admin.tsx` (existing pattern) | Consistent with all other admin routes |

## Current State Analysis — What Needs to Change

### PortalAdminSideNav: Critical Discovery

[VERIFIED: src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx]

The current `PortalAdminSideNav` has a **mislabeled item**:

```typescript
const items = [
    { label: 'Board Registrations', icon: Building2, path: '/admin/brokerage' },  // WRONG: label says boards, path is brokerage
    { label: 'Users', icon: Users, path: '/admin/users' },
    ...
]
```

NAV-03 requires:
- A "Brokerage" item pointing to `/admin/brokerage`
- A "Board Registrations" item pointing to `/admin/boards`

The fix is to rename the existing item to "Brokerage" and add a new "Board Registrations" item after it pointing to `/admin/boards`.

### AdminBoardSideNav: Current Items

[VERIFIED: src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx]

```typescript
const navItems: NavItem[] = [
    { label: 'Brokerage', icon: <Building2 className="h-4 w-4" />, path: '/admin/brokerage' },
    { label: 'Users', icon: <Users className="h-4 w-4" />, path: '/admin/users' },
    { label: 'Listing Groups', icon: <Layers3 className="h-4 w-4" />, path: '/admin/groups' },
    { label: 'Settings', icon: <Settings className="h-4 w-4" />, path: '/admin/settings' },
    { label: 'Activity', icon: <Activity className="h-4 w-4" />, path: '/admin/activity' }
]
```

Insert "Board Registrations" at index 1, pushing "Users" to index 2.

### BrokerageAdminBoardContext: What to Remove

[VERIFIED: src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts]

Remove these imports and their usage:
- `useFetchBoardCredentials`
- `useFetchBoards`
- `useCreateBoardCredential`
- `useDeleteBoardCredential`
- `useUpdateBoardCredential`
- `CreateBoardCredentialPayload`, `UpdateBoardCredentialPayload` (from boardType)
- `isConnectBoardOpen` state
- `handleConnectBoard`, `handleDeleteCredential`, `handleEditCredential` callbacks

Keep:
- `useFetchBrokerage`
- `useUpdateBrokerage`
- `handleUpdateBrokerage`
- `brokerage`, `isLoading`, `error` state

### BrokerageAdminBoard: What to Remove

[VERIFIED: src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx]

Remove the `<BoardRegistrations>` render block and its destructured props from `state`/`actions`. The component should only render `<BrokerageInformation>` and `<BrokerageBranding>`.

### useBoardsAdminContext: What to Build

New file: `src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts`

This is a subset of the current `BrokerageAdminBoardContext`, keeping only the boards-related slice:

```typescript
// Pattern verified from BrokerageAdminBoardContext.ts
const useBoardsAdminContext = () => {
    const [isConnectBoardOpen, setIsConnectBoardOpen] = useState(false)
    const { data: boardCredentialsData } = useFetchBoardCredentials()
    const { data: boardsData } = useFetchBoards()
    const { mutateAsync: createCredential } = useCreateBoardCredential()
    const { mutate: deleteCredential } = useDeleteBoardCredential()
    const { mutateAsync: updateCredential } = useUpdateBoardCredential()

    // ... same handlers as BrokerageAdminBoardContext board handlers

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
    }), [...])
}
```

Note: No `isLoading` / `error` from brokerage. Board credential fetch does not have a loading guard in the original context — it uses optional chaining. The new context can add a basic `isLoading` from `useFetchBoardCredentials` if desired, but the existing `BoardRegistrations` component handles empty array gracefully (shows "No boards connected yet" message), so loading state is not strictly required. [ASSUMED — could add loading state for UX consistency]

## Common Pitfalls

### Pitfall 1: PortalAdminSideNav active-state matching after fix

**What goes wrong:** After fixing the portal nav, the "Brokerage" item (`/admin/brokerage`) uses `startsWith` matching. If the path logic matches `/admin/boards` as a prefix of `/admin/brokerage` — it doesn't, so this is safe — but need to verify the exact logic.

**Current logic in PortalAdminSideNav:**
```typescript
const active = location.pathname === path || location.pathname.startsWith(path + '/')
```

`/admin/boards` does NOT start with `/admin/brokerage/`, so both items will have independent active state. No conflict.

**How to avoid:** No action needed — the existing logic is already correct for the new items.

### Pitfall 2: SideNav.tsx has its own admin section (not AdminBoardSideNav)

**What goes wrong:** There are TWO nav components rendering admin links on the subdomain:
1. `AdminBoardSideNav` — the dedicated admin sidebar rendered via `AppShellAdmin` → `SideNav` wrapper
2. `SideNav` — the dashboard SideNav which has a collapsible "Admin" section with its own links

[VERIFIED: src/components/sidenav/SideNav.tsx lines 215-245]

The `SideNav` admin section shows: Brokerage, Users, Listing Groups, Domains, Settings. It does NOT include "Board Registrations". The requirements only say `AdminBoardSideNav` and `PortalAdminSideNav` must be updated (NAV-02, NAV-03). `SideNav.tsx` is not mentioned in the requirements.

**Resolution:** Update only `AdminBoardSideNav` per NAV-02. Do NOT update `SideNav.tsx` admin section unless explicitly in scope. Treat `SideNav.tsx`'s admin section as out-of-scope for this phase. [ASSUMED — planner should confirm whether SideNav.tsx admin section also needs updating, but requirements only reference AdminBoardSideNav and PortalAdminSideNav]

### Pitfall 3: `BoardRegistrations` component imports

**What goes wrong:** `BoardRegistrations.tsx` lives at `src/components/view/admin/brokerageView/BoardRegistrations.tsx`. Moving it would break imports. Don't move it.

**How to avoid:** `BoardsAdminBoard.tsx` imports `BoardRegistrations` from its current location. The path `@/components/view/admin/brokerageView/BoardRegistrations` remains valid.

### Pitfall 4: `ConnectBoardDialog` and `EditBoardCredentialDialog` location

These dialogs are defined in `src/components/view/admin/brokerageView/` and are rendered inside `BoardRegistrations.tsx` directly. Since `BoardRegistrations` is not moving, these dialogs are also unaffected. No changes needed.

## Code Examples

### New route entry in admin.tsx

```typescript
// Source: src/router/admin/admin.tsx (verified pattern)
import BoardsAdminBoard from '@/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard'

// Add to children array, after brokerage entry:
{
    element: <BoardsAdminBoard />,
    path: 'boards'
},
```

### New PortalAdminSideNav items array

```typescript
// Source: src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx (verified)
// Current (broken): label 'Board Registrations' → /admin/brokerage
// Required (NAV-03):
const items = [
    { label: 'Brokerage', icon: Building2, path: '/admin/brokerage' },
    { label: 'Board Registrations', icon: ClipboardList, path: '/admin/boards' },
    { label: 'Users', icon: Users, path: '/admin/users' },
    { label: 'Groups', icon: Layers3, path: '/admin/groups' },
    { label: 'Domains', icon: Globe, path: '/admin/domains' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
]
```

### New AdminBoardSideNav navItems array

```typescript
// Source: src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx (verified)
const navItems: NavItem[] = [
    { label: 'Brokerage', icon: <Building2 className="h-4 w-4" />, path: '/admin/brokerage' },
    { label: 'Board Registrations', icon: <ClipboardList className="h-4 w-4" />, path: '/admin/boards' },
    { label: 'Users', icon: <Users className="h-4 w-4" />, path: '/admin/users' },
    { label: 'Listing Groups', icon: <Layers3 className="h-4 w-4" />, path: '/admin/groups' },
    { label: 'Settings', icon: <Settings className="h-4 w-4" />, path: '/admin/settings' },
    { label: 'Activity', icon: <Activity className="h-4 w-4" />, path: '/admin/activity' }
]
```

### Trimmed BrokerageAdminBoardContext

```typescript
// After trim — keeps only brokerage fetch + update
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
```

### Trimmed BrokerageAdminBoard render

```typescript
// After trim — no BoardRegistrations render
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

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Icon choice for "Board Registrations" nav item: `ClipboardList` from lucide-react | Code Examples | Minor — only affects icon appearance; any unused lucide icon works |
| A2 | `SideNav.tsx` admin section does not need updating (not in NAV-02/NAV-03 scope) | Common Pitfalls | Low — requirements explicitly name only `AdminBoardSideNav` and `PortalAdminSideNav`; SideNav is the dashboard nav on subdomain, separate concern |
| A3 | No loading state guard needed in `useBoardsAdminContext` (BoardRegistrations handles empty gracefully) | Architecture Patterns | Low — adding `isLoading` is purely additive and does not break anything either way |

**Claims verified or cited in this session:** All structural claims above are verified by direct file reads.

## Open Questions (RESOLVED)

1. **Should SideNav.tsx admin section also add "Board Registrations"?**
   - What we know: `SideNav.tsx` has an "Admin" collapsible section with nav items including "Brokerage" — visible on the dashboard SideNav on subdomains
   - What's unclear: Requirements NAV-02 and NAV-03 name only `AdminBoardSideNav` and `PortalAdminSideNav`. `SideNav.tsx` is a separate component.
   - Recommendation: Treat as out of scope for this phase. The `SideNav.tsx` admin section can be a follow-up if desired.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure frontend refactor, no new packages, no services)

## Validation Architecture

`nyquist_validation: false` — validation section omitted per config.

## Security Domain

This phase involves no authentication, authorization changes, input handling, or data storage. All board credential mutations already exist and are unchanged. Security domain not applicable.

## Sources

### Primary (HIGH confidence)
- Direct file reads: `src/router/admin/admin.tsx`, `src/router/admin/AdminDomainShell.tsx`
- Direct file reads: `src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoard.tsx`, `BrokerageAdminBoardContext.ts`
- Direct file reads: `src/containers/adminBoard/domainsAdminBoard/DomainsAdminBoard.tsx`, `useDomainsAdminContext.ts`
- Direct file reads: `src/components/navbar/SideNav/AdminBoardSideNav/AdminBoardSideNav.tsx`
- Direct file reads: `src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx`, `PortalAdminShell.tsx`
- Direct file reads: `src/components/common/shells/appShellAdmin/AppShellAdmin.tsx`
- Direct file reads: `src/components/sidenav/SideNav.tsx`
- Direct file reads: `src/components/view/admin/brokerageView/BoardRegistrations.tsx`, `BrokerageInformation.tsx`, `BrokerageBranding.tsx`
- Direct file reads: `src/store/hooks/Admin/Boards/*`, `src/store/hooks/queryKeys.tsx`
- Direct file reads: `src/assets/types/boardType.ts`
- Direct file reads: `.planning/config.json` (nyquist_validation: false)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all hooks and components exist and were read directly
- Architecture: HIGH — exact file locations, import paths, and patterns confirmed from codebase
- Pitfalls: HIGH — discovered by reading actual file contents (PortalAdminSideNav mislabeled item, SideNav.tsx dual-nav situation)

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (stable codebase; short milestone)

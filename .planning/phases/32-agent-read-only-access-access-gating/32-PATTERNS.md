# Phase 32: Agent Read-Only Access & Access Gating - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 10 (modified) + 0 (new — this phase modifies existing files only)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` | component | request-response (mutation trigger) | `frontend/src/components/view/admin/brokerageView/BrokerageInformation.tsx` (already `manage_brokerage_settings`-gated save controls) | exact (same permission target, just swap the permission string) |
| `frontend/src/components/view/admin/usersAdminView/UsersListView.tsx` | component | CRUD (list + row actions) | `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` (dropdown item gating + row-actions gating with `<Can>`) | exact |
| `frontend/src/components/view/admin/usersAdminView/InvitationsView.tsx` | component | CRUD (row action) | `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` (row delete/edit action gated `<Can>`) | exact |
| `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx` | container/component | request-response (nav trigger button) | `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` (header action button gated `<Can>`) | role-match |
| `frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberGroupsList.tsx` | component | CRUD (conditional row action, prop-driven) | `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx` (parent controls prop it passes to child) — pattern: gate at the prop-passing call site | role-match |
| `frontend/src/components/sidenav/SideNav.tsx` | component (nav) | request-response (conditional render) | itself — remove `!state.isGroupsOnlyAdmin` guards, mirrors D-05/D-06 removal instructions directly | exact (self-modification, no external analog needed) |
| `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` | component (nav) | request-response (conditional render) | itself — remove `isGroupsOnlyRole(role)` filter | exact |
| `frontend/src/components/sidenav/useSideNavContext.ts` | hook | request-response (state provider) | itself — delete `isGroupsOnlyAdmin` derivation and export | exact |
| `frontend/src/assets/rbac/permissions.ts` | config/utility | N/A (RBAC config) | itself — delete `isGroupsOnlyRole` export | exact |
| `frontend/src/router/admin/admin.tsx` | route config | request-response (route guarding) | itself — split `ownerAdminOnly` into two `RequireRole` tiers | exact |

## Pattern Assignments

### `frontend/src/components/view/admin/domainsAdminView/DomainCard.tsx` (component, request-response)

**Analog:** `frontend/src/components/view/admin/brokerageView/BrokerageInformation.tsx` (lines 168, 224, 280) and the file's own existing `manage_brokerage_settings` gates (lines 163-172, 176-184)

**Current gating to fix** (lines 146-159 and 187-199):
```typescript
{/* Verify now: pending or phasing_out, gated admin+ */}
{(isPending || isPhasingOut) && (
    <Can permission="access_admin_panel">
        <Button size="sm" variant="default" disabled={isVerifying} onClick={() => actions.verify(domain.id)}>
            {isVerifying && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Verify now
        </Button>
    </Can>
)}
...
{/* Frozen: Upgrade plan CTA, gated admin+ */}
{isFrozen && (
    <Can permission="access_admin_panel">
        <Button size="sm" variant="outline" onClick={() => { window.location.href = '/admin/plan' }}>
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Upgrade plan
        </Button>
    </Can>
)}
```

**Fix (D-04):** change `permission="access_admin_panel"` to `permission="manage_brokerage_settings"` on both `<Can>` wrappers. The rest of the file (imports of `Can` at line 9, the two other buttons at lines 163 and 176 already gated `manage_brokerage_settings`) is unchanged and demonstrates the exact target pattern in the same file — no new import needed, `Can` is already imported.

---

### `frontend/src/components/view/admin/usersAdminView/UsersListView.tsx` (component, CRUD)

**Analog:** `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx`

**Import to add** (mirrors BoardRegistrations.tsx line 25):
```typescript
import Can from '@/components/common/guards/Can'
```

**Dropdown item gating pattern** — analog is BoardRegistrations' header button gate (lines 60-65):
```typescript
<Can permission="manage_brokerage_settings">
    <Button size="sm" onClick={() => setIsConnectBoardOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Connect Board
    </Button>
</Can>
```
Applied to current code (lines 92-99), wrap only "Add Admin to Brokerage" — "Add User to Group" stays unwrapped per D-01:
```typescript
<DropdownMenuContent align="end">
    <Can permission="manage_users">
        <DropdownMenuItem onClick={() => navigate('/admin/brokerage/add-agent')}>
            Add Admin to Brokerage
        </DropdownMenuItem>
    </Can>
    <DropdownMenuItem onClick={() => navigate('/admin/users/add-to-group')}>
        Add User to Group
    </DropdownMenuItem>
</DropdownMenuContent>
```
Note: `DropdownMenuItem` as a direct child of `<Can>` inside `DropdownMenuContent` — verify this doesn't break Radix's expected child structure; BoardRegistrations only wraps a top-level `<Button>`, not a `DropdownMenuItem`. If Radix requires direct `DropdownMenuItem` children of `DropdownMenuContent`, wrap the `onClick` handler/render logic instead of relying on structural nesting — React fragments render transparently so `<Can>` returning `children` directly (see `Can.tsx` line 13, `return <>{allowed ? children : fallback}</>`) should be safe since it returns the child directly without wrapper DOM.

**Row action gating pattern** — analog is BoardRegistrations' row actions dropdown gate (lines 108-130, `<Can permission="manage_brokerage_settings" fallback={<span />}>`):
```typescript
<Can permission="manage_brokerage_settings" fallback={<span />}>
    <div className="flex justify-end">
        <DropdownMenu>...</DropdownMenu>
    </div>
</Can>
```
Applied to current code (lines 203-224), wrap the entire action button group in `manage_users`:
```typescript
<Can permission="manage_users">
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Button type="button" variant="outline" size="icon" aria-label="Edit user" onClick={() => handleEditUser(u.id)}>
            <Pencil className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Delete user" onClick={() => handleDeleteUser(u.id)} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
        </Button>
    </div>
</Can>
```

---

### `frontend/src/components/view/admin/usersAdminView/InvitationsView.tsx` (component, CRUD)

**Analog:** `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` row-action gate (same pattern as above)

**Import to add:**
```typescript
import Can from '@/components/common/guards/Can'
```

**Current code to gate** (lines 134-147):
```typescript
<td className="px-3 py-2 text-right">
    {invite.status === 'pending' && (
        <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Revoke invitation"
            onClick={() => setConfirmInviteId(invite.id)}
            className="text-destructive hover:text-destructive"
        >
            <Trash2 className="h-4 w-4" />
        </Button>
    )}
</td>
```

**Fix:** wrap the `<Button>` in `<Can permission="manage_users">`:
```typescript
<td className="px-3 py-2 text-right">
    {invite.status === 'pending' && (
        <Can permission="manage_users">
            <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Revoke invitation"
                onClick={() => setConfirmInviteId(invite.id)}
                className="text-destructive hover:text-destructive"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </Can>
    )}
</td>
```

---

### `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx` (container, request-response)

**Analog:** `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` header button gate (lines 60-65)

**Import to add:**
```typescript
import Can from '@/components/common/guards/Can'
```

**Current code** (lines 39-42):
```typescript
<Button type="button" variant="card" onClick={handleManageAccount}>
    <Settings className="mr-2 h-4 w-4" />
    Manage Account
</Button>
```

**Fix:** wrap in `<Can permission="manage_users">`:
```typescript
<Can permission="manage_users">
    <Button type="button" variant="card" onClick={handleManageAccount}>
        <Settings className="mr-2 h-4 w-4" />
        Manage Account
    </Button>
</Can>
```

---

### `frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberGroupsList.tsx` (component, CRUD) + `MemberAdminBoard.tsx` prop wiring

**Pattern:** `MemberGroupsList` already conditionally renders its "Remove from group" column/button based on whether the `onRemoveUserFromGroup` prop is truthy (lines 78, 101-118 — `{onRemoveUserFromGroup && (...)}`). This is a **prop-driven visibility pattern**, distinct from the `<Can>` wrapper pattern used elsewhere. Per CONTEXT.md's "Claude's Discretion" note, gating can happen at the callback level (parent withholds the prop) rather than wrapping JSX inside `MemberGroupsList` itself.

**Current parent wiring** (`MemberAdminBoard.tsx` lines 51-60):
```typescript
<MemberGroupsList
    groups={state.groups}
    groupsCount={state.groupsMeta?.totalGroups || 0}
    paginationMeta={state.groupsMeta?.pagination}
    paginationControls={{
        setPage: actions.handlePageChange
    }}
    userId={memberId}
    onRemoveUserFromGroup={actions.handleRemoveUserFromGroup}
/>
```

**Fix option A (prop-level gate, preferred — matches existing conditional-render mechanism already built into `MemberGroupsList`):**
```typescript
import usePermission from '@/store/hooks/Auth/usePermission'
// ...
const canManageUsers = usePermission('manage_users')
// ...
<MemberGroupsList
    ...
    onRemoveUserFromGroup={canManageUsers ? actions.handleRemoveUserFromGroup : undefined}
/>
```
This requires no changes inside `MemberGroupsList.tsx` itself — the component's existing `{onRemoveUserFromGroup && (...)}` guards (lines 78, 101) already hide the column/button when the prop is `undefined`.

**Fix option B (wrap inside MemberGroupsList with `<Can>`):** would require restructuring the conditional table-header/cell rendering to check `<Can permission="manage_users">` instead of prop truthiness — more invasive, not recommended given Option A reuses the existing mechanism with zero changes to `MemberGroupsList.tsx`.

**usePermission hook reference** (`frontend/src/store/hooks/Auth/usePermission.ts`, full file, 11 lines):
```typescript
import { hasPermission, type Permission } from '@/assets/rbac/permissions'
import useRole from './useRole'

const usePermission = (permission: Permission): boolean => {
    const { role, isUserLoaded } = useRole()
    if (!isUserLoaded || !role) return false
    return hasPermission(role, permission)
}

export default usePermission
```

---

### `frontend/src/router/admin/admin.tsx` (route config, request-response)

**Analog:** itself — mechanical split of the existing `ownerAdminOnly` helper (lines 25-27) into two tiers, using `RequireRole` (`frontend/src/components/common/guards/RequireRole.tsx`, full file):
```typescript
import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import UserRole from '@/assets/types/roleType'
import useRole from '@/store/hooks/Auth/useRole'

interface RequireRoleProps {
    roles: UserRole[]
    redirectTo?: string
    children: ReactNode
}

const RequireRole = ({ roles, redirectTo = '/', children }: RequireRoleProps) => {
    const { role, isUserLoaded } = useRole()
    if (!isUserLoaded) return null
    if (!role || !roles.includes(role)) {
        return <Navigate to={redirectTo} replace />
    }
    return <>{children}</>
}

export default RequireRole
```

**Current route table** (lines 25-101) uses one helper for all non-Groups routes:
```typescript
const ownerAdminOnly = (element: React.ReactNode) => (
    <RequireRole roles={['owner', 'admin']}>{element}</RequireRole>
)

export const admin = {
    path: '/admin/',
    element: <AdminDomainShell />,
    errorElement: <ErrorPage />,
    children: [
        { element: ownerAdminOnly(<BrokerageAdminBoard />), path: 'brokerage' },
        { element: ownerAdminOnly(<AddAgentAdminBoard />), path: 'brokerage/add-agent' },
        { element: ownerAdminOnly(<BoardsAdminBoard />), path: 'boards' },
        { element: ownerAdminOnly(<UsersAdminBoard />), path: 'users' },
        { element: ownerAdminOnly(<AddUserToGroupSelectAdminBoard />), path: 'users/add-to-group' },
        { element: ownerAdminOnly(<MemberAdminBoard />), path: 'users/members/:memberId' },
        { element: ownerAdminOnly(<EditMemberAdminBoard />), path: 'users/members/:memberId/edit' },
        // ... unrestricted Groups routes ...
        { element: ownerAdminOnly(<DomainsAdminBoard />), path: 'domains' },
        { element: ownerAdminOnly(<SettingsAdminBoard />), path: 'settings' }
    ]
}
```

**Fix (mechanical, per CONTEXT.md "Route restructuring"):** introduce a second tier helper, e.g.:
```typescript
const readTierRoles = (element: React.ReactNode) => (
    <RequireRole roles={['owner', 'admin', 'agent']}>{element}</RequireRole>
)
const ownerAdminOnly = (element: React.ReactNode) => (
    <RequireRole roles={['owner', 'admin']}>{element}</RequireRole>
)
```
Apply `readTierRoles` to: `brokerage`, `boards`, `users`, `users/add-to-group` (per D-02), `users/members/:memberId` (detail only — NOT `/edit`), `domains`, `settings`.
Keep `ownerAdminOnly` on: `brokerage/add-agent`, `users/members/:memberId/edit`.
No change to the always-open Groups routes (they don't use either helper).

---

### `frontend/src/components/sidenav/SideNav.tsx` (component, nav)

**Current gating to remove** (lines 214-264, 5 occurrences of `{!state.isGroupsOnlyAdmin && (...)}`):
```typescript
{adminOpen && (
    <div className="mt-0.5 space-y-0.5">
        {!state.isGroupsOnlyAdmin && (
            <NavButton label="Brokerage" icon={<Building className="h-4 w-4" />} path="/admin/brokerage" onNavigate={handleNavigate} />
        )}
        {!state.isGroupsOnlyAdmin && (
            <NavButton label="Board Registrations" icon={<ClipboardList className="h-4 w-4" />} path="/admin/boards" onNavigate={handleNavigate} />
        )}
        {!state.isGroupsOnlyAdmin && (
            <NavButton label="Users" icon={<Users className="h-4 w-4" />} path="/admin/users" onNavigate={handleNavigate} />
        )}
        <NavButton label="Listing Groups" icon={<Layers3 className="h-4 w-4" />} path="/admin/groups" onNavigate={handleNavigate} />
        {!state.isGroupsOnlyAdmin && (
            <NavButton label="Domains" icon={<Globe className="h-4 w-4" />} path="/admin/domains" onNavigate={handleNavigate} />
        )}
        {!state.isGroupsOnlyAdmin && (
            <NavButton label="Settings" icon={<Settings className="h-4 w-4" />} path="/admin/settings" exact onNavigate={handleNavigate} />
        )}
    </div>
)}
```

**Fix (D-05):** remove all five `{!state.isGroupsOnlyAdmin && (...)}` wrappers, rendering all 6 `NavButton`s unconditionally (the `{state.canAccessAdmin && (...)}` outer gate at line 199 stays — that governs whether the whole Admin section shows at all, unrelated to D-05/D-06).

---

### `frontend/src/components/common/shells/portalAdminShell/PortalAdminSideNav.tsx` (component, nav)

**Current gating to remove** (lines 1-20):
```typescript
import { useLocation, useNavigate } from 'react-router-dom'
import { Building2, ClipboardList, Globe, Layers3, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import useRole from '@/store/hooks/Auth/useRole'
import { isGroupsOnlyRole } from '@/assets/rbac/permissions'

const items = [
    { label: 'Brokerage', icon: Building2, path: '/admin/brokerage' },
    { label: 'Board Registrations', icon: ClipboardList, path: '/admin/boards' },
    { label: 'Users', icon: Users, path: '/admin/users' },
    { label: 'Groups', icon: Layers3, path: '/admin/groups' },
    { label: 'Domains', icon: Globe, path: '/admin/domains' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
]

const PortalAdminSideNav = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const { role } = useRole()
    const visibleItems = isGroupsOnlyRole(role) ? items.filter(i => i.path === '/admin/groups') : items
    ...
```

**Fix (D-05/D-06):** remove the `useRole` import (unless used elsewhere in the file — confirm no other usage), remove the `isGroupsOnlyRole` import, delete `visibleItems` derivation, use `items` directly in the render (`.map` over `items` instead of `visibleItems`).

---

### `frontend/src/components/sidenav/useSideNavContext.ts` (hook)

**Current code to remove** (full file, 57 lines — relevant lines 6, 12-13, 38, 50):
```typescript
import { isGroupsOnlyRole } from '@/assets/rbac/permissions'
// ...
const { role } = useRole()
const isGroupsOnlyAdmin = isGroupsOnlyRole(role)
// ...
return useMemo(() => ({
    state: {
        groupId,
        hasGroupContext,
        selectedGroup,
        isLoadingSelectedGroup,
        canAccessAdmin,
        isGroupsOnlyAdmin,
    },
    ...
}), [
    groupId, hasGroupContext, selectedGroup, isLoadingSelectedGroup, canAccessAdmin, isGroupsOnlyAdmin,
    goToHome, navigateTo,
])
```

**Fix (D-06):** remove `isGroupsOnlyRole` import, remove `isGroupsOnlyAdmin` derivation line, remove `isGroupsOnlyAdmin` from the returned `state` object and from the `useMemo` dependency array. Confirm `useRole` import is still needed for other purposes in the file — it currently is used only for `role` to compute `isGroupsOnlyAdmin`; check if `role` is used elsewhere in the file before removing the `useRole` import entirely (grep shows only this one usage in this file, so the `useRole` import likely becomes removable too — verify at implementation time).

---

### `frontend/src/assets/rbac/permissions.ts` (config/utility)

**Current code to remove** (lines 20-23):
```typescript
// `agent` is scoped to Groups-only admin access this phase (see 31-CONTEXT.md
// D-03). Centralized here so nav components don't independently re-derive
// `role === 'agent'` and drift out of sync as this scope expands later.
export const isGroupsOnlyRole = (role: UserRole | null | undefined): boolean => role === 'agent'
```

**Fix (D-06):** delete this export and its comment block entirely. Also update `ROLE_PERMISSIONS.agent` (line 12) if the phase's other decisions imply new permissions for agent — re-check against D-03 of this phase (gates use `manage_users`, which agent still does NOT have — `ROLE_PERMISSIONS.agent = ['access_admin_panel', 'manage_groups']` stays unchanged; the `<Can permission="manage_users">` gates added in this phase correctly evaluate to `false` for agent without any `permissions.ts` change beyond the `isGroupsOnlyRole` deletion).

---

## Shared Patterns

### Hide-entirely gating (`<Can>`)
**Source:** `frontend/src/components/common/guards/Can.tsx` (full file, 17 lines):
```typescript
import { ReactNode } from 'react'
import { type Permission } from '@/assets/rbac/permissions'
import usePermission from '@/store/hooks/Auth/usePermission'

interface CanProps {
    permission: Permission
    children: ReactNode
    fallback?: ReactNode
}

const Can = ({ permission, children, fallback = null }: CanProps) => {
    const allowed = usePermission(permission)
    return <>{allowed ? children : fallback}</>
}

export default Can
```
**Apply to:** `UsersListView.tsx`, `InvitationsView.tsx`, `MemberAdminBoard.tsx`, `DomainCard.tsx` (permission swap only). This is the dominant pattern (also used in `BoardRegistrations.tsx`, `BrokerageInformation.tsx`, `BrokerageBranding.tsx`) — CONTEXT.md D-03 explicitly directs using this pattern over the disabled-button style.

### Disabled-button gating (NOT used this phase, but exists for reference/contrast)
**Source:** `frontend/src/components/view/admin/usersAdminView/memberAdminView/EditMemberView.tsx` lines 42, 88-94, 117, 131-138 — `const canManageUsers = usePermission('manage_users')` then `disabled={!canManageUsers}` on individual controls. This page (`EditMemberView.tsx` / the `/edit` route) is route-blocked for agent already and needs **no changes** — included here only to confirm `manage_users` is the correct, already-established permission string to reuse.

### Route-level blocking (`RequireRole`)
**Source:** `frontend/src/components/common/guards/RequireRole.tsx` (full file, shown above) + `frontend/src/router/admin/admin.tsx` `ownerAdminOnly`/new `readTierRoles` helpers.
**Apply to:** all `admin.tsx` route entries — split into two role-list tiers as described above.

### Permission/role plumbing
**Source:** `frontend/src/assets/rbac/permissions.ts` (full file, 26 lines):
```typescript
import UserRole from '@/assets/types/roleType'

export type Permission =
    | 'access_admin_panel'
    | 'manage_brokerage_settings'
    | 'manage_users'
    | 'manage_groups'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    owner: ['access_admin_panel', 'manage_brokerage_settings', 'manage_users', 'manage_groups'],
    admin: ['access_admin_panel', 'manage_users', 'manage_groups'],
    agent: ['access_admin_panel', 'manage_groups'],
    staff: [],
    client: [],
}

export const hasPermission = (role: UserRole, permission: Permission): boolean =>
    ROLE_PERMISSIONS[role]?.includes(permission) ?? false

export default ROLE_PERMISSIONS
```
No changes needed to `ROLE_PERMISSIONS` itself this phase — `agent` still lacks `manage_users` and `manage_brokerage_settings`, which is exactly what makes the new `<Can>` gates work correctly. Only the `isGroupsOnlyRole` export (below the `hasPermission` function, shown in the "no analog" removal section above) is deleted.

## No Analog Found

None — every file in scope either has a direct analog elsewhere in the codebase (`BoardRegistrations.tsx`, `BrokerageInformation.tsx`) or is self-modified via a documented, unambiguous mechanical change (nav files, router file, dead-code removal).

## Metadata

**Analog search scope:** `frontend/src/components/view/admin/`, `frontend/src/components/common/guards/`, `frontend/src/components/sidenav/`, `frontend/src/components/common/shells/portalAdminShell/`, `frontend/src/containers/adminBoard/usersAdminBoard/`, `frontend/src/router/admin/`, `frontend/src/assets/rbac/`, `frontend/src/store/hooks/Auth/`
**Files scanned:** 14 (10 target files + 4 analog/reference files: `BoardRegistrations.tsx`, `BrokerageInformation.tsx`, `EditMemberView.tsx`, `Can.tsx`/`RequireRole.tsx`/`usePermission.ts`)
**Pattern extraction date:** 2026-07-10

# Phase 34: Ownership Management UI — Settings Page & Add Owner - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 14 (11 new, 3 modified)
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `frontend/src/assets/types/ownerType.ts` | model (type) | CRUD | `frontend/src/assets/types/boardType.ts` | exact |
| `frontend/src/assets/api/admin/settings/owners/fetchOwners.ts` | service (api module) | request-response | `frontend/src/assets/api/admin/boards/fetchBoardCredentials.ts` | exact |
| `frontend/src/assets/api/admin/settings/owners/fetchEligibleOwnerUsers.ts` | service (api module) | request-response | `frontend/src/assets/api/admin/boards/fetchBoardCredentials.ts` | exact |
| `frontend/src/assets/api/admin/settings/owners/promoteOwner.ts` | service (api module) | request-response | `frontend/src/assets/api/admin/boards/createBoardCredential.ts` (pattern shown via `useCreateBoardCredential.ts`) | role-match |
| `frontend/src/store/hooks/Admin/Settings/Owners/useFetchOwners.ts` | hook | CRUD (read) | `frontend/src/store/hooks/Admin/Boards/useFetchBoardCredentials.ts` | exact |
| `frontend/src/store/hooks/Admin/Settings/Owners/useFetchEligibleOwnerUsers.ts` | hook | CRUD (read) | `frontend/src/store/hooks/Admin/Boards/useFetchBoardCredentials.ts` | exact |
| `frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts` | hook | CRUD (write) | `frontend/src/store/hooks/Admin/Boards/useCreateBoardCredential.ts` | exact |
| `frontend/src/store/hooks/queryKeys.tsx` (modify) | config | CRUD | existing `boardCredentialsKeys`/`boardsKeys` entries in same file | exact |
| `frontend/src/assets/rbac/permissions.ts` (modify) | config | CRUD | existing `Permission` union + `ROLE_PERMISSIONS` map in same file | exact |
| `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` (modify — replace stub) | controller (container) | request-response | `frontend/src/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard.tsx` | exact |
| `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` | provider (context/brain) | request-response | `frontend/src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts` | exact |
| `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` | component | request-response | `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` | exact |
| `frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx` | component | CRUD (display) | `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` (list-rendering portion) | role-match |
| `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx` | component | event-driven (modal + mutation) | `frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx` (combobox) + `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` (Dialog shell) + `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` (warning copy structure) | exact (composite) |

## Pattern Assignments

### `frontend/src/assets/types/ownerType.ts` (model)

**Analog:** `frontend/src/assets/types/boardType.ts` (full file, lines 1-31)

**Pattern to copy** — plain exported interfaces, no class, optional fields commented inline:
```typescript
export interface RealEstateBoardType {
    id: string
    name: string
    shortCode: string
    region: string | null
    active: boolean
    isTestBoard: boolean   // added Phase 13
    createdAt: string
}

export interface CreateBoardCredentialPayload {
    realEstateBoardId: string
    retsUsername?: string   // optional — omitted for test boards
    retsPassword?: string   // optional — omitted for test boards
}
```

**Apply as:**
```typescript
import UserRole from '@/assets/types/roleType'

export interface OwnerType {
    id: string
    name: string
    email: string
}

export interface EligibleOwnerUserType {
    id: string
    name: string
    email: string
    role: UserRole   // 'admin' | 'agent' only, per backend eligible scope
}

export interface PromoteOwnerPayload {
    user: { user_id: string }   // snake_case body key — matches backend contract verbatim (CLAUDE.md: snake_case params in API)
}
```
Note: backend responses use a single `name` field (`user.full_name`), NOT `firstName`/`lastName` — do not copy `userType.ts`'s split-name shape here; `boardType.ts`'s flat shape is the correct analog.

---

### `frontend/src/assets/api/admin/settings/owners/fetchOwners.ts` (service)

**Analog:** `frontend/src/assets/api/admin/boards/fetchBoardCredentials.ts` (full file, lines 1-13)

```typescript
import axiosInstance from '@/assets/axios/axios'
import { BoardCredentialType } from '@/assets/types/boardType'

export interface FetchBoardCredentialsResponse {
    boardCredentials: BoardCredentialType[]
}

const fetchBoardCredentials = async (): Promise<FetchBoardCredentialsResponse> => {
    const response = await axiosInstance.get('/v1/admin/board_credentials')
    return response.data
}

export default fetchBoardCredentials
```

**Apply as** (no-arg GET, no camelcaseKeys call — interceptor handles it):
```typescript
import axiosInstance from '@/assets/axios/axios'
import { OwnerType } from '@/assets/types/ownerType'

export interface FetchOwnersResponse {
    owners: OwnerType[]
}

const fetchOwners = async (): Promise<FetchOwnersResponse> => {
    const response = await axiosInstance.get('/v1/admin/settings/owners')
    return response.data
}

export default fetchOwners
```

Same structure applies to `fetchEligibleOwnerUsers.ts` (`GET /v1/admin/settings/owners/eligible`, response `{ eligibleUsers: EligibleOwnerUserType[] }` after camelCase interceptor — backend key is `eligible_users`).

**Mutation analog** for `promoteOwner.ts` — pattern confirmed via `useCreateBoardCredential.ts`'s `mutationFn` call shape (createBoardCredential itself not read, but its call signature `createBoardCredential(payload)` and axios POST convention is standard project-wide):
```typescript
const promoteOwner = async (userId: string): Promise<OwnerType> => {
    const response = await axiosInstance.post('/v1/admin/settings/owners', { user: { user_id: userId } })
    return response.data
}

export default promoteOwner
```

---

### `frontend/src/store/hooks/Admin/Settings/Owners/useFetchOwners.ts` (hook)

**Analog:** `frontend/src/store/hooks/Admin/Boards/useFetchBoardCredentials.ts` (full file, lines 1-14)

```typescript
import { useQuery } from '@tanstack/react-query'
import fetchBoardCredentials, { FetchBoardCredentialsResponse } from '@/assets/api/admin/boards/fetchBoardCredentials'
import { boardCredentialsKeys } from '@/store/hooks/queryKeys'

const useFetchBoardCredentials = () => {
    return useQuery<FetchBoardCredentialsResponse>({
        queryKey: boardCredentialsKeys.all,
        queryFn: fetchBoardCredentials,
        staleTime: 0
    })
}

export default useFetchBoardCredentials
```

**Apply as:**
```typescript
import { useQuery } from '@tanstack/react-query'
import fetchOwners, { FetchOwnersResponse } from '@/assets/api/admin/settings/owners/fetchOwners'
import { ownersKeys } from '@/store/hooks/queryKeys'

const useFetchOwners = () => {
    return useQuery<FetchOwnersResponse>({
        queryKey: ownersKeys.all,
        queryFn: fetchOwners,
        staleTime: 0
    })
}

export default useFetchOwners
```
Mirror this exactly for `useFetchEligibleOwnerUsers.ts` with `eligibleOwnerUsersKeys.all` / `fetchEligibleOwnerUsers`.

---

### `frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts` (hook, mutation)

**Analog:** `frontend/src/store/hooks/Admin/Boards/useCreateBoardCredential.ts` (full file, lines 1-19)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import createBoardCredential from '@/assets/api/admin/boards/createBoardCredential'
import { CreateBoardCredentialPayload } from '@/assets/types/boardType'
import { boardCredentialsKeys } from '@/store/hooks/queryKeys'
import toast from 'react-hot-toast'

const useCreateBoardCredential = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (payload: CreateBoardCredentialPayload) => createBoardCredential(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardCredentialsKeys.all })
            toast.success('Board connected successfully')
        }
    })
}

export default useCreateBoardCredential
```

**Apply as** (invalidate BOTH owners and eligible-users keys — see RESEARCH.md Pitfall 1):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import promoteOwner from '@/assets/api/admin/settings/owners/promoteOwner'
import { ownersKeys, eligibleOwnerUsersKeys } from '@/store/hooks/queryKeys'
import toast from 'react-hot-toast'

const usePromoteOwner = () => {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (userId: string) => promoteOwner(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ownersKeys.all })
            queryClient.invalidateQueries({ queryKey: eligibleOwnerUsersKeys.all })
            toast.success('Owner added successfully')
        }
    })
}

export default usePromoteOwner
```

---

### `frontend/src/store/hooks/queryKeys.tsx` (modify)

**Analog:** `boardCredentialsKeys` / `boardsKeys` in the same file (lines 182-188)

```typescript
export const boardsKeys = {
    all: ['boards'] as const,
}

export const boardCredentialsKeys = {
    all: ['board_credentials'] as const,
}
```

**Apply as** (append near the end of the file, alongside `calendarConnectionsKeys` at line 232):
```typescript
export const ownersKeys = {
    all: ['admin', 'settings', 'owners'] as const,
}

export const eligibleOwnerUsersKeys = {
    all: ['admin', 'settings', 'owners', 'eligible'] as const,
}
```
No `list(params)` variant needed — both endpoints are unpaginated/no-arg per Phase 33 D-06/D-07.

---

### `frontend/src/assets/rbac/permissions.ts` (modify)

**Current file (full, lines 1-20):**
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

**Apply as** (add `manage_ownership` ONLY to `owner` — see RESEARCH.md Pitfall 3, mirrors `manage_brokerage_settings`'s owner-exclusivity):
```typescript
export type Permission =
    | 'access_admin_panel'
    | 'manage_brokerage_settings'
    | 'manage_users'
    | 'manage_groups'
    | 'manage_ownership'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    owner: ['access_admin_panel', 'manage_brokerage_settings', 'manage_users', 'manage_groups', 'manage_ownership'],
    admin: ['access_admin_panel', 'manage_users', 'manage_groups'],
    agent: ['access_admin_panel', 'manage_groups'],
    staff: [],
    client: [],
}
```

---

### `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` (modify — replace stub)

**Current stub (full file, lines 1-15):**
```tsx
import React from 'react'
import classes from './SettingsAdminBoard.module.scss'
import AdminBoard from '../AdminBoard'

const SettingsAdminBoard = () => {


    return (
        <AdminBoard>
            Settings
        </AdminBoard>
    )
}

export default SettingsAdminBoard
```
Note: `SettingsAdminBoard.module.scss` is effectively empty (0 usable lines) — drop the scss import; per CLAUDE.md, styling is Tailwind utility classes, matching `BoardsAdminBoard.tsx` (which imports no scss module at all).

**Analog:** `frontend/src/containers/adminBoard/boardsAdminBoard/BoardsAdminBoard.tsx` (lines 1-20, 63-77 — header/loading shell and content-render tail; full file already quoted above)

**Core pattern to copy** — container reads context, handles loading, renders inside `AdminBoard`:
```tsx
import AdminBoard from '../AdminBoard'
import useBoardsAdminContext from './useBoardsAdminContext'

const BoardsAdminBoard = () => {
    const { state, actions } = useBoardsAdminContext()

    if (state.isLoading) {
        return (
            <AdminBoard>
                <div className="p-6 text-sm text-muted-foreground">Loading board registrations...</div>
            </AdminBoard>
        )
    }

    return (
        <AdminBoard>
            <div className="w-full p-6">
                {/* header block */}
                <BoardRegistrations {...props} />
            </div>
        </AdminBoard>
    )
}
```

**Apply as** (SET-01: page shell + Ownership Management as the only functional section; Billing stubbed as invisible `// TODO` comment — see D-08, Pitfall 5):
```tsx
import AdminBoard from '../AdminBoard'
import OwnershipManagementSection from '@/components/view/admin/settingsAdminView/OwnershipManagementSection'
import useSettingsAdminContext from './useSettingsAdminContext'

const SettingsAdminBoard = () => {
    const { state, actions } = useSettingsAdminContext()

    if (state.isLoading) {
        return (
            <AdminBoard>
                <div className="p-6 text-sm text-muted-foreground">Loading settings...</div>
            </AdminBoard>
        )
    }

    return (
        <AdminBoard>
            <div className="w-full p-6">
                <div className="mb-4">
                    <h1 className="text-xl font-semibold text-foreground">Settings</h1>
                </div>
                <OwnershipManagementSection
                    owners={state.owners}
                    eligibleUsers={state.eligibleUsers}
                    isAddOwnerOpen={state.isAddOwnerOpen}
                    setIsAddOwnerOpen={actions.setIsAddOwnerOpen}
                    onPromoteOwner={actions.handlePromoteOwner}
                    isPromoting={state.isPromoting}
                />
                {/* TODO: Add billing management section */}
            </div>
        </AdminBoard>
    )
}

export default SettingsAdminBoard
```

---

### `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` (provider/brain)

**Analog:** `frontend/src/containers/adminBoard/boardsAdminBoard/useBoardsAdminContext.ts` (full file, lines 1-46)

```typescript
import { useCallback, useMemo, useState } from 'react'
import useFetchBoardCredentials from '@/store/hooks/Admin/Boards/useFetchBoardCredentials'
import useFetchBoards from '@/store/hooks/Admin/Boards/useFetchBoards'
import useCreateBoardCredential from '@/store/hooks/Admin/Boards/useCreateBoardCredential'

const useBoardsAdminContext = () => {
    const [isConnectBoardOpen, setIsConnectBoardOpen] = useState(false)
    const { data: boardCredentialsData, isLoading } = useFetchBoardCredentials()
    const { data: boardsData } = useFetchBoards()
    const { mutateAsync: createCredential } = useCreateBoardCredential()

    const handleConnectBoard = useCallback(async (payload) => {
        await createCredential(payload)
    }, [createCredential])

    return useMemo(() => ({
        state: { boardCredentials: boardCredentialsData?.boardCredentials || [], boards: boardsData?.boards || [], isConnectBoardOpen, isLoading },
        actions: { setIsConnectBoardOpen, handleConnectBoard }
    }), [boardCredentialsData, boardsData, isConnectBoardOpen, isLoading, handleConnectBoard])
}

export default useBoardsAdminContext
```

**Apply as:**
```typescript
import { useCallback, useMemo, useState } from 'react'
import useFetchOwners from '@/store/hooks/Admin/Settings/Owners/useFetchOwners'
import useFetchEligibleOwnerUsers from '@/store/hooks/Admin/Settings/Owners/useFetchEligibleOwnerUsers'
import usePromoteOwner from '@/store/hooks/Admin/Settings/Owners/usePromoteOwner'

const useSettingsAdminContext = () => {
    const [isAddOwnerOpen, setIsAddOwnerOpen] = useState(false)
    const { data: ownersData, isLoading: isLoadingOwners } = useFetchOwners()
    const { data: eligibleData, isLoading: isLoadingEligible } = useFetchEligibleOwnerUsers()
    const { mutateAsync: promoteOwnerMutation, isPending: isPromoting } = usePromoteOwner()

    const handlePromoteOwner = useCallback(async (userId: string) => {
        await promoteOwnerMutation(userId)
        setIsAddOwnerOpen(false)
    }, [promoteOwnerMutation])

    return useMemo(() => ({
        state: {
            owners: ownersData?.owners || [],
            eligibleUsers: eligibleData?.eligibleUsers || [],
            isAddOwnerOpen,
            isLoading: isLoadingOwners || isLoadingEligible,
            isPromoting,
        },
        actions: {
            setIsAddOwnerOpen,
            handlePromoteOwner,
        }
    }), [ownersData, eligibleData, isAddOwnerOpen, isLoadingOwners, isLoadingEligible, isPromoting, handlePromoteOwner])
}

export default useSettingsAdminContext
```

---

### `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` (component)

**Analog:** `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` (lines 1-67 — imports, props, Card+CardHeader+Can-gated button shell)

**Imports pattern** (lines 1-25):
```tsx
import { useState } from 'react'
import { Plus, CheckCircle2, XCircle, MoreHorizontal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Can from '@/components/common/guards/Can'
```

**Auth/section-header pattern** (lines 56-66) — Card+CardHeader with `Can`-gated action button, exactly matching D-08's "own card/section header" requirement:
```tsx
<Card className="mt-6">
    <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">Realtor Board Registrations</CardTitle>
        <Can permission="manage_brokerage_settings">
            <Button size="sm" onClick={() => setIsConnectBoardOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Connect Board
            </Button>
        </Can>
    </CardHeader>
    <CardContent>
        {/* list or empty state */}
    </CardContent>
</Card>
```

**Apply as** (D-07: owners see action UI; admin/agent see `RolePermissions` instead — mutually exclusive via `Can`'s `fallback` prop):
```tsx
import { UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Can from '@/components/common/guards/Can'
import RolePermissions from '@/components/view/admin/common/RolePermissions'
import CurrentOwnersList from './CurrentOwnersList'
import AddOwnerDialog from './AddOwnerDialog'
import { OwnerType, EligibleOwnerUserType } from '@/assets/types/ownerType'

interface OwnershipManagementSectionProps {
    owners: OwnerType[]
    eligibleUsers: EligibleOwnerUserType[]
    isAddOwnerOpen: boolean
    setIsAddOwnerOpen: (open: boolean) => void
    onPromoteOwner: (userId: string) => Promise<void>
    isPromoting: boolean
}

const OwnershipManagementSection = ({ owners, eligibleUsers, isAddOwnerOpen, setIsAddOwnerOpen, onPromoteOwner, isPromoting }: OwnershipManagementSectionProps) => (
    <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">Ownership Management</CardTitle>
            <Can permission="manage_ownership">
                <Button size="sm" onClick={() => setIsAddOwnerOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Owner
                </Button>
            </Can>
        </CardHeader>
        <CardContent className="space-y-4">
            <CurrentOwnersList owners={owners} />
            <Can permission="manage_ownership" fallback={<RolePermissions roles={['owner', 'admin', 'agent']} />}>
                <span />
            </Can>
        </CardContent>
        <Can permission="manage_ownership">
            <AddOwnerDialog
                open={isAddOwnerOpen}
                onOpenChange={setIsAddOwnerOpen}
                eligibleUsers={eligibleUsers}
                onConfirm={onPromoteOwner}
                isSubmitting={isPromoting}
            />
        </Can>
    </Card>
)

export default OwnershipManagementSection
// TODO: Add billing management section
```
Note: `Can`'s `fallback` renders when the permission check FAILS — i.e., fallback shows for admin/agent (non-owners), which is exactly D-07's desired split. The `<span />` "children" branch is intentionally empty since owners get the dialog (rendered separately below, itself `Can`-gated) rather than the description card.

---

### `frontend/src/components/view/admin/settingsAdminView/CurrentOwnersList.tsx` (component)

**Analog:** `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` lines 68-134 (list-rendering + empty-state portion)

**Core list pattern** (empty state + divide-y stacked rows, lines 68-83 excerpted/adapted):
```tsx
{boardCredentials.length === 0 ? (
    <p className="py-4 text-center text-sm text-muted-foreground">
        No boards connected yet. Connect to a board to access its listings.
    </p>
) : (
    <div className="divide-y divide-border">
        {boardCredentials.map(credential => (
            <div key={credential.id} className="grid grid-cols-5 items-center py-3 text-sm">
                {/* row content */}
            </div>
        ))}
    </div>
)}
```

**Apply as** (D-01: plain stacked rows divided by subtle borders, NOT a table/cards; D-02: no self-indicator — every row renders identically, name + email only):
```tsx
import { OwnerType } from '@/assets/types/ownerType'

interface CurrentOwnersListProps {
    owners: OwnerType[]
}

const CurrentOwnersList = ({ owners }: CurrentOwnersListProps) => {
    if (owners.length === 0) {
        return (
            <p className="py-4 text-center text-sm text-muted-foreground">
                No owners found.
            </p>
        )
    }

    return (
        <div className="divide-y divide-border">
            {owners.map((owner) => (
                <div key={owner.id} className="flex flex-col py-3 text-sm">
                    <span className="font-medium text-foreground">{owner.name}</span>
                    <span className="text-muted-foreground">{owner.email}</span>
                </div>
            ))}
        </div>
    )
}

export default CurrentOwnersList
```

---

### `frontend/src/components/view/admin/settingsAdminView/AddOwnerDialog.tsx` (component — composite)

**Analog 1 (Dialog shell + step state):** `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` (lines 1-51, `handleOpenChange` reset pattern; lines 73-83, `Dialog`/`DialogContent`/`DialogHeader` shell)

```tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

const ConnectBoardDialog = ({ open, onOpenChange, boards, onSubmit }) => {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            // reset all local state
        }
        onOpenChange(nextOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Connect a Realtor Board</DialogTitle>
                    <DialogDescription>Select the real estate board you want to connect to.</DialogDescription>
                </DialogHeader>
                {/* step content */}
            </DialogContent>
        </Dialog>
    )
}
```

**Analog 2 (searchable combobox):** `frontend/src/components/view/admin/listingGroupsAdminView/addUserToGroupView/AddUserToGroupView.tsx` lines 172-218 (Popover+Command combobox — quoted verbatim, adapted field names):
```tsx
<Popover open={comboOpen} onOpenChange={setComboOpen}>
    <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={comboOpen} className="w-full justify-between font-normal">
            {selectedExistingUser
                ? `${selectedExistingUser.firstName} ${selectedExistingUser.lastName} — ${selectedExistingUser.email}`
                : 'Search users...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
            <CommandInput placeholder="Search by name or email..." />
            <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                    {selectableUsers.map((u) => (
                        <CommandItem key={u.id} value={`${u.firstName} ${u.lastName} ${u.email}`} onSelect={() => handleSelectExistingUser(u.id)}>
                            <Check className={cn('mr-2 h-4 w-4', selectedExistingUser?.id === u.id ? 'opacity-100' : 'opacity-0')} />
                            <span className="truncate">{u.firstName} {u.lastName}<span className="ml-1 text-muted-foreground">— {u.email}</span></span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </Command>
    </PopoverContent>
</Popover>
```
Note: owner backend fields are `{ id, name, email, role }` (single `name`, not `firstName`/`lastName`) — adapt the label interpolation to `${u.name} — ${u.email}` and `value={`${u.name} ${u.email}`}` for `CommandItem`'s search-match string.

**Analog 3 (warning-copy structure before confirm):** `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` (full file, lines 22-44) — shows the "computed dynamic warning text + Cancel/Confirm footer" shape, though this codebase's convention for embedding an interactive combobox inside a warning flow is `Dialog` (not `AlertDialog`) per RESEARCH.md Pattern 3/Anti-Patterns:
```tsx
<AlertDialogHeader>
    <AlertDialogTitle>{`Delete ${domain.domain}?`}</AlertDialogTitle>
    <AlertDialogDescription>
        {`This domain will enter a phase-out period. It will be decommissioned on ${decommissionDate}...`}
    </AlertDialogDescription>
</AlertDialogHeader>
<AlertDialogFooter>
    <AlertDialogCancel onClick={onCancel}>Keep domain</AlertDialogCancel>
    <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
        Begin phase-out
    </AlertDialogAction>
</AlertDialogFooter>
```

**Apply as** (composite — Dialog shell + combobox + D-04's 3-point warning + confirm button with loading spinner from `ConnectBoardDialog.tsx` lines 146-149):
```tsx
import { useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { EligibleOwnerUserType } from '@/assets/types/ownerType'

interface AddOwnerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    eligibleUsers: EligibleOwnerUserType[]
    onConfirm: (userId: string) => Promise<void>
    isSubmitting: boolean
}

const AddOwnerDialog = ({ open, onOpenChange, eligibleUsers, onConfirm, isSubmitting }: AddOwnerDialogProps) => {
    const [comboOpen, setComboOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<EligibleOwnerUserType | null>(null)

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) setSelectedUser(null)
        onOpenChange(nextOpen)
    }

    const handleConfirm = async () => {
        if (!selectedUser) return
        await onConfirm(selectedUser.id)
        setSelectedUser(null)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Owner</DialogTitle>
                    <DialogDescription>Promote an existing admin or agent to owner.</DialogDescription>
                </DialogHeader>

                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                    <PopoverTrigger asChild>
                        <Button type="button" variant="outline" role="combobox" aria-expanded={comboOpen} className="w-full justify-between font-normal">
                            {selectedUser ? `${selectedUser.name} — ${selectedUser.email}` : 'Search admins and agents...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search by name or email..." />
                            <CommandList>
                                <CommandEmpty>No eligible users found.</CommandEmpty>
                                <CommandGroup>
                                    {eligibleUsers.map((u) => (
                                        <CommandItem key={u.id} value={`${u.name} ${u.email}`} onSelect={() => { setSelectedUser(u); setComboOpen(false) }}>
                                            <Check className={cn('mr-2 h-4 w-4', selectedUser?.id === u.id ? 'opacity-100' : 'opacity-0')} />
                                            <span className="truncate">{u.name}<span className="ml-1 text-muted-foreground">({u.role}) — {u.email}</span></span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <p className="text-sm text-muted-foreground">Only admins and agents can be promoted to owner.</p>

                {selectedUser && (
                    <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-amber-900 text-sm space-y-2">
                        <p className="font-semibold">This will give {selectedUser.name} full owner access:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>They will be able to remove or demote other owners, including you.</li>
                            <li>They will gain full access to all brokerage data and settings — not just their current {selectedUser.role} scope.</li>
                            <li>They will also manage billing once that section becomes available.</li>
                        </ul>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!selectedUser || isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Add Owner
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default AddOwnerDialog
```
This satisfies OWN-03 (combobox + note copy), OWN-04 (D-04's three warning points, D-03's non-generic ownership-specific copy), and OWN-05 (confirm triggers the mutation passed down from context).

---

## Shared Patterns

### RBAC gating (`Can` + `manage_ownership`)
**Source:** `frontend/src/components/common/guards/Can.tsx` (full file, lines 1-16), `frontend/src/assets/rbac/permissions.ts`
**Apply to:** `OwnershipManagementSection.tsx` (Add Owner button + dialog visibility), any owner-only branch
```tsx
const Can = ({ permission, children, fallback = null }: CanProps) => {
    const allowed = usePermission(permission)
    return <>{allowed ? children : fallback}</>
}
```
Route-level access is already handled — `frontend/src/router/admin/admin.tsx` line 104 wires `path: 'settings'` to `readTierRoles(<SettingsAdminBoard />)` (owner/admin/agent only; client already blocked before this tree mounts). No router changes needed this phase.

### Card+CardHeader labeled section shell (D-08)
**Source:** `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` lines 56-67
**Apply to:** `OwnershipManagementSection.tsx` — establishes the pattern Billing will reuse later without restructuring `SettingsAdminBoard.tsx`.

### TanStack query + invalidation
**Source:** `frontend/src/store/hooks/Admin/Boards/useCreateBoardCredential.ts` (full file)
**Apply to:** All three new hooks (`useFetchOwners`, `useFetchEligibleOwnerUsers`, `usePromoteOwner`) — `useQuery`/`useMutation` + `queryClient.invalidateQueries` + `toast.success` is the uniform mutation-completion pattern across every existing Admin hook.

### Query key centralization
**Source:** `frontend/src/store/hooks/queryKeys.tsx` lines 182-188 (`boardsKeys`, `boardCredentialsKeys`)
**Apply to:** New `ownersKeys`/`eligibleOwnerUsersKeys` entries — must be added to this file, never inlined into hooks (CLAUDE.md explicit requirement).

### RolePermissions reuse (D-05/D-06/D-07)
**Source:** `frontend/src/components/view/admin/common/RolePermissions.tsx` (full file, lines 1-58)
**Apply to:** `OwnershipManagementSection.tsx`'s `Can` `fallback` branch — call site MUST pass `roles={['owner', 'admin', 'agent']}` explicitly (default prop includes `client`, which must never render on this page — see RESEARCH.md Pitfall 2).

## No Analog Found

None — every file in this phase has at least a role-match analog already read and excerpted above.

## Metadata

**Analog search scope:** `frontend/src/assets/`, `frontend/src/store/hooks/`, `frontend/src/containers/adminBoard/`, `frontend/src/components/view/admin/`, `frontend/src/router/admin/`
**Files scanned (read in full):** 17 — `fetchBoardCredentials.ts`, `useFetchBoardCredentials.ts`, `useCreateBoardCredential.ts`, `BoardsAdminBoard.tsx`, `useBoardsAdminContext.ts`, `DomainsAdminBoard.tsx`, `useDomainsAdminContext.ts`, `SettingsAdminBoard.tsx` (stub), `AddUserToGroupView.tsx`, `RolePermissions.tsx`, `BoardRegistrations.tsx`, `DeleteDomainDialog.tsx`, `ConnectBoardDialog.tsx`, `permissions.ts`, `Can.tsx`, `useRole.ts`, `queryKeys.tsx`, `admin.tsx` (router), `boardType.ts`, `usePermission.ts`, `AdminBoard.tsx`, `roleType.ts`, `owners_controller.rb` (backend contract confirmation)
**Pattern extraction date:** 2026-07-13

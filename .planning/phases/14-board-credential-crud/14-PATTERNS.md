# Phase 14: Board Credential CRUD - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 10 (2 backend, 8 frontend)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/config/routes.rb` | config | — | self (line 95) | exact — one-line change |
| `backend/app/controllers/v1/admin/board_credentials_controller.rb` | controller | request-response | `groups_controller.rb` (destroy) + self (create → update) | exact |
| `frontend/src/assets/types/boardType.ts` | types | — | self (CreateBoardCredentialPayload) | exact — additive |
| `frontend/src/assets/api/admin/boards/deleteBoardCredential.ts` | api-module | request-response | `createBoardCredential.ts` | role-match |
| `frontend/src/assets/api/admin/boards/updateBoardCredential.ts` | api-module | request-response | `createBoardCredential.ts` | exact |
| `frontend/src/store/hooks/Admin/Boards/useDeleteBoardCredential.ts` | hook | request-response | `useDeleteUserFromBrokerage.tsx` + `useCreateBoardCredential.ts` | exact |
| `frontend/src/store/hooks/Admin/Boards/useUpdateBoardCredential.ts` | hook | request-response | `useCreateBoardCredential.ts` | exact |
| `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` | context | request-response | self | exact — additive |
| `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` | component | request-response | self | exact — additive |
| `frontend/src/components/view/admin/brokerageView/EditBoardCredentialDialog.tsx` | component | request-response | `ConnectBoardDialog.tsx` | exact |

---

## Pattern Assignments

### `backend/config/routes.rb` (config)

**Analog:** self — line 95

**Current state** (line 95):
```ruby
resources :board_credentials, only: [:index, :create]
```

**Target state:**
```ruby
resources :board_credentials, only: [:index, :create, :destroy, :update]
```

---

### `backend/app/controllers/v1/admin/board_credentials_controller.rb` (controller, request-response)

**Analogs:**
- `destroy` pattern from `backend/app/controllers/v1/admin/groups_controller.rb` lines 73–81
- `update` pattern mirrors `create` in self (lines 22–70)

**Destroy analog** (`groups_controller.rb` lines 73–81):
```ruby
def destroy
  @group.destroy!
  render json: {message: "Group deleted successfully"}, status: :ok
rescue ActiveRecord::RecordNotDestroyed => e
  render json: {
    error: "Failed to delete group",
    details: e.record.errors.full_messages
  }, status: :unprocessable_entity
end
```

**Before-action / scoping pattern** (`groups_controller.rb` lines 97–103):
```ruby
def set_group
  @group = Current.brokerage.groups.includes(
    users: :current_brokerage_membership
  ).find_by!(uid: params[:id])
rescue ActiveRecord::RecordNotFound
  render json: {error: "Group not found"}, status: :not_found
end
```

**RETS branch pattern** (self `create`, lines 29–37):
```ruby
result = if board.is_test_board?
  RetsAuthService::Result.new(success: true, error: nil)
else
  RetsAuthService.new(board: board, username: username, password: password).call
end

unless result.success?
  return render json: {error: result.error}, status: :unprocessable_entity
end
```

**Attribute assignment + save pattern** (self `create`, lines 43–68):
```ruby
credential.rets_username = username
credential.rets_password = password
credential.assign_attributes(status: "active", last_verified_at: Time.current)

if credential.save
  render json: {
    board_credential: ActiveModelSerializers::SerializableResource.new(
      credential,
      serializer: BrokerageBoardCredentialSerializer,
      adapter: :attributes
    ).as_json
  }, status: :created
else
  render json: {errors: credential.errors.full_messages}, status: :unprocessable_entity
end
```

**Scope pattern** (self `index`, lines 6–9):
```ruby
credentials = Current.brokerage
  .brokerage_board_credentials
  .without_deleted
  .includes(:real_estate_board)
  .order(:created_at)
```

**Concrete `destroy` implementation for this controller:**
```ruby
# DELETE /v1/admin/board_credentials/:id
def destroy
  @credential = Current.brokerage
    .brokerage_board_credentials
    .without_deleted
    .find_by!(id: params[:id])
  @credential.destroy!
  render json: {message: "Board disconnected successfully"}, status: :ok
rescue ActiveRecord::RecordNotFound
  render json: {error: "Credential not found"}, status: :not_found
rescue ActiveRecord::RecordNotDestroyed => e
  render json: {error: "Failed to disconnect board", details: e.record.errors.full_messages}, status: :unprocessable_entity
end
```

**Concrete `update` implementation for this controller:**
```ruby
# PATCH /v1/admin/board_credentials/:id
def update
  @credential = Current.brokerage
    .brokerage_board_credentials
    .without_deleted
    .includes(:real_estate_board)
    .find_by!(id: params[:id])

  username = update_credential_params[:rets_username]
  password = update_credential_params[:rets_password]

  result = if @credential.real_estate_board.is_test_board?
    RetsAuthService::Result.new(success: true, error: nil)
  else
    RetsAuthService.new(board: @credential.real_estate_board, username: username, password: password).call
  end

  unless result.success?
    return render json: {error: result.error}, status: :unprocessable_entity
  end

  @credential.rets_username = username
  @credential.rets_password = password
  @credential.assign_attributes(status: "active", last_verified_at: Time.current)

  if @credential.save
    render json: {
      board_credential: ActiveModelSerializers::SerializableResource.new(
        @credential,
        serializer: BrokerageBoardCredentialSerializer,
        adapter: :attributes
      ).as_json
    }, status: :ok
  else
    render json: {errors: @credential.errors.full_messages}, status: :unprocessable_entity
  end
rescue ActiveRecord::RecordNotFound
  render json: {error: "Credential not found"}, status: :not_found
end

# Separate private method — do NOT reuse board_credential_params (it permits real_estate_board_id)
def update_credential_params
  params.require(:board_credential).permit(:rets_username, :rets_password)
end
```

**Critical notes:**
- Use `includes(:real_estate_board)` in the `update` find to avoid N+1 on `is_test_board?`
- Assign via `credential.rets_username = value` (encrypted column accessor) — never write `rets_username_ciphertext`
- Enum prefix is `credential_` — set status via string `"active"`, not symbol `:active`
- `without_deleted` required on every scope (CLAUDE.md constraint)

---

### `frontend/src/assets/types/boardType.ts` (types)

**Analog:** self — existing `CreateBoardCredentialPayload` (lines 21–25)

**Existing pattern to mirror** (lines 21–25):
```typescript
export interface CreateBoardCredentialPayload {
    realEstateBoardId: string
    retsUsername?: string   // optional — omitted for test boards
    retsPassword?: string   // optional — omitted for test boards
}
```

**Addition to append:**
```typescript
export interface UpdateBoardCredentialPayload {
    retsUsername?: string   // optional — omitted for test boards
    retsPassword?: string   // optional — omitted for test boards
}
```

---

### `frontend/src/assets/api/admin/boards/deleteBoardCredential.ts` (api-module, request-response)

**Analog:** `frontend/src/assets/api/admin/boards/createBoardCredential.ts` (lines 1–18)

**Analog imports pattern** (lines 1–3):
```typescript
import axiosInstance from '@/assets/axios/axios'
import snakecaseKeys from 'snakecase-keys'
import { BoardCredentialType, CreateBoardCredentialPayload } from '@/assets/types/boardType'
```

**Full delete module** (no snakecaseKeys needed — no body):
```typescript
import axiosInstance from '@/assets/axios/axios'

const deleteBoardCredential = async (id: string): Promise<void> => {
    await axiosInstance.delete(`/v1/admin/board_credentials/${id}`)
}

export default deleteBoardCredential
```

---

### `frontend/src/assets/api/admin/boards/updateBoardCredential.ts` (api-module, request-response)

**Analog:** `frontend/src/assets/api/admin/boards/createBoardCredential.ts` (lines 1–18)

**Pattern to replicate** (full file, 18 lines):
```typescript
import axiosInstance from '@/assets/axios/axios'
import snakecaseKeys from 'snakecase-keys'
import { BoardCredentialType, CreateBoardCredentialPayload } from '@/assets/types/boardType'

export interface CreateBoardCredentialResponse {
    boardCredential: BoardCredentialType
}

const createBoardCredential = async (
    payload: CreateBoardCredentialPayload
): Promise<CreateBoardCredentialResponse> => {
    const response = await axiosInstance.post('/v1/admin/board_credentials', {
        board_credential: snakecaseKeys(payload)
    })
    return response.data
}
```

**Full update module:**
```typescript
import axiosInstance from '@/assets/axios/axios'
import snakecaseKeys from 'snakecase-keys'
import { BoardCredentialType, UpdateBoardCredentialPayload } from '@/assets/types/boardType'

export interface UpdateBoardCredentialResponse {
    boardCredential: BoardCredentialType
}

const updateBoardCredential = async (
    id: string,
    payload: UpdateBoardCredentialPayload
): Promise<UpdateBoardCredentialResponse> => {
    const response = await axiosInstance.patch(`/v1/admin/board_credentials/${id}`, {
        board_credential: snakecaseKeys(payload)
    })
    return response.data
}

export default updateBoardCredential
```

**Note:** `response.data` is returned directly — Axios interceptor applies `camelcaseKeys` automatically. Never call `camelcaseKeys` again in hooks.

---

### `frontend/src/store/hooks/Admin/Boards/useDeleteBoardCredential.ts` (hook, request-response)

**Primary analog:** `frontend/src/store/hooks/Admin/Brokerage/useDeleteUserFromBrokerage.tsx` (lines 1–33) — has the `onError` toast pattern.
**Secondary analog:** `frontend/src/store/hooks/Admin/Boards/useCreateBoardCredential.ts` — has the `boardCredentialsKeys.all` invalidation pattern.

**onError pattern** (`useDeleteUserFromBrokerage.tsx` lines 24–27):
```typescript
onError: (err: AxiosErrorType) => {
    toast.error('Failed to delete user')
    console.error('Failed to delete user:', err)
}
```

**boardCredentialsKeys invalidation** (`useCreateBoardCredential.ts` lines 13–14):
```typescript
queryClient.invalidateQueries({ queryKey: boardCredentialsKeys.all })
toast.success('Board connected successfully')
```

**Full hook:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import deleteBoardCredential from '@/assets/api/admin/boards/deleteBoardCredential'
import { boardCredentialsKeys } from '@/store/hooks/queryKeys'
import { AxiosErrorType } from '@/assets/types/axiosErrorType'
import toast from 'react-hot-toast'

const useDeleteBoardCredential = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => deleteBoardCredential(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardCredentialsKeys.all })
            toast.success('Board disconnected.')
        },
        onError: (err: AxiosErrorType) => {
            toast.error('Failed to disconnect board. Please try again.')
            console.error('Failed to delete board credential:', err)
        }
    })
}

export default useDeleteBoardCredential
```

---

### `frontend/src/store/hooks/Admin/Boards/useUpdateBoardCredential.ts` (hook, request-response)

**Analog:** `frontend/src/store/hooks/Admin/Boards/useCreateBoardCredential.ts` (lines 1–19)

**Key difference from delete hook:** No `onError` callback — errors re-thrown to dialog's catch block for inline display. Context uses `mutateAsync` (not `mutate`) so the error propagates.

**Full hook:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import updateBoardCredential from '@/assets/api/admin/boards/updateBoardCredential'
import { UpdateBoardCredentialPayload } from '@/assets/types/boardType'
import { boardCredentialsKeys } from '@/store/hooks/queryKeys'

const useUpdateBoardCredential = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateBoardCredentialPayload }) =>
            updateBoardCredential(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardCredentialsKeys.all })
            // No toast.success here — callers (dialog) fire their own success toast
        }
        // No onError — errors re-thrown to dialog for inline serverError display
    })
}

export default useUpdateBoardCredential
```

**Note on toast responsibility:** The dialog's `handleSubmit` fires `toast.success(...)` after `await onEdit(...)` resolves. The hook itself does NOT fire a success toast, unlike `useCreateBoardCredential`. This keeps the toast message differentiated by path (test board vs real board copy).

---

### `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` (context, request-response)

**Analog:** self (lines 1–43) — additive extension

**Existing hook import pattern** (lines 1–8):
```typescript
import { useCallback, useMemo, useState } from 'react'
import useFetchBrokerage from '@/store/hooks/Admin/Brokerage/useFetchBrokerage'
import useCreateBoardCredential from '@/store/hooks/Admin/Boards/useCreateBoardCredential'
import { CreateBoardCredentialPayload } from '@/assets/types/boardType'
```

**Existing mutateAsync callback pattern** (lines 16, 22–24):
```typescript
const { mutateAsync: createCredential } = useCreateBoardCredential()

const handleConnectBoard = useCallback(async (payload: CreateBoardCredentialPayload) => {
    await createCredential(payload)
}, [createCredential])
```

**Existing useMemo return pattern** (lines 26–41):
```typescript
return useMemo(() => ({
    state: {
        brokerage: brokerageData,
        isLoading,
        error,
        boardCredentials: boardCredentialsData?.boardCredentials || [],
        boards: boardsData?.boards || [],
        isConnectBoardOpen
    },
    actions: {
        handleUpdateBrokerage,
        setIsConnectBoardOpen,
        handleConnectBoard
    }
}), [brokerageData, isLoading, error, boardCredentialsData, boardsData, isConnectBoardOpen, handleUpdateBrokerage, handleConnectBoard])
```

**Additions to make:**

New imports (add alongside existing hook imports):
```typescript
import useDeleteBoardCredential from '@/store/hooks/Admin/Boards/useDeleteBoardCredential'
import useUpdateBoardCredential from '@/store/hooks/Admin/Boards/useUpdateBoardCredential'
import { CreateBoardCredentialPayload, UpdateBoardCredentialPayload } from '@/assets/types/boardType'
```

New hook destructures (add after line 16):
```typescript
const { mutate: deleteCredential } = useDeleteBoardCredential()
const { mutateAsync: updateCredential } = useUpdateBoardCredential()
```

New callbacks (add after `handleConnectBoard`):
```typescript
const handleDeleteCredential = useCallback((id: string) => {
    deleteCredential(id)
}, [deleteCredential])

const handleEditCredential = useCallback(async (id: string, payload: UpdateBoardCredentialPayload) => {
    await updateCredential({ id, payload })
}, [updateCredential])
```

Extend `actions` in useMemo return:
```typescript
actions: {
    handleUpdateBrokerage,
    setIsConnectBoardOpen,
    handleConnectBoard,
    handleDeleteCredential,
    handleEditCredential    // add these two
}
```

Add `handleDeleteCredential, handleEditCredential, deleteCredential, updateCredential` to useMemo dependency array.

**Note:** `mutate` (fire-and-forget) for delete — AlertDialog closes immediately on confirm. `mutateAsync` for update — dialog's catch block must receive RETS validation errors for inline display.

---

### `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` (component, request-response)

**Analog:** self (lines 1–98) — additive extension

**Existing imports pattern** (lines 1–7):
```typescript
import { Plus, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RealEstateBoardType, BoardCredentialType, CreateBoardCredentialPayload } from '@/assets/types/boardType'
import ConnectBoardDialog from './ConnectBoardDialog'
import Can from '@/components/common/guards/Can'
```

**Existing Can pattern** (lines 35–39):
```typescript
<Can permission="manage_brokerage_settings">
    <Button size="sm" onClick={() => setIsConnectBoardOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Connect Board
    </Button>
</Can>
```

**Existing grid header** (lines 49–54):
```typescript
<div className="grid grid-cols-4 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
    <span>Board</span>
    <span>Region</span>
    <span>Status</span>
    <span>Connected</span>
</div>
```

**Existing row** (lines 55–83):
```typescript
{boardCredentials.map(credential => (
    <div
        key={credential.id}
        className="grid grid-cols-4 items-center py-3 text-sm"
    >
        <span className="font-medium truncate pr-4">
            {credential.realEstateBoard.name}
        </span>
        ...
        <span className="text-muted-foreground">
            {formatDate(credential.createdAt)}
        </span>
    </div>
))}
```

**DropdownMenu pattern** (`elipsis.tsx` lines 1–53):
```typescript
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

<DropdownMenu>
    <DropdownMenuTrigger asChild>
        <button type="button" aria-label="more">...</button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onSelect={() => el.func()}>
            {el.label}
        </DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
```

**Concrete additions:**

New imports to add:
```typescript
import { MoreHorizontal } from 'lucide-react'
import {
    DropdownMenu, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import EditBoardCredentialDialog from './EditBoardCredentialDialog'
import { UpdateBoardCredentialPayload } from '@/assets/types/boardType'
```

Interface additions:
```typescript
interface BoardRegistrationsProps {
    // ... existing props ...
    onDeleteCredential: (id: string) => void
    onEditCredential: (id: string, payload: UpdateBoardCredentialPayload) => Promise<void>
}
```

Grid changes:
- `"grid grid-cols-4 pb-2 ..."` → `"grid grid-cols-5 pb-2 ..."`
- `"grid grid-cols-4 items-center py-3 text-sm"` → `"grid grid-cols-5 items-center py-3 text-sm"`
- Add `<span>Actions</span>` as 5th header cell

Per-row actions cell (5th column):
```typescript
<Can permission="manage_brokerage_settings" fallback={<span />}>
    <div className="flex justify-end">
        <AlertDialog>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Row actions for ${credential.realEstateBoard.name}`}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditTarget(credential)}>
                        Edit credentials
                    </DropdownMenuItem>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={() => setDeleteTarget(credential)}>
                            Delete connection
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Delete {deleteTarget?.realEstateBoard.name} connection?
                    </AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button variant="destructive" onClick={() => onDeleteCredential(deleteTarget!.id)}>
                            Delete
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
</Can>
```

Local state needed in `BoardRegistrations`:
```typescript
const [deleteTarget, setDeleteTarget] = useState<BoardCredentialType | null>(null)
const [editTarget, setEditTarget] = useState<BoardCredentialType | null>(null)
```

**Critical:** `Can` must receive `fallback={<span />}` (not return null) to preserve `grid-cols-5` alignment when permission is absent.

---

### `frontend/src/components/view/admin/brokerageView/EditBoardCredentialDialog.tsx` (component, request-response)

**Analog:** `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` (lines 1–239)

**Dialog wrapper pattern** (`ConnectBoardDialog.tsx` lines 73–75):
```typescript
<Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogContent className="sm:max-w-md">
```

**Reset on close pattern** (`ConnectBoardDialog.tsx` lines 41–51):
```typescript
const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
        setStep('select')
        setSelectedBoardId('')
        setUsername('')
        setPassword('')
        setIsSubmitting(false)
        setServerError(null)
    }
    onOpenChange(nextOpen)
}
```

**Error display pattern** (`ConnectBoardDialog.tsx` line 134–136 and 194–196):
```typescript
{serverError && (
    <p className="text-sm text-destructive">{serverError}</p>
)}
```

**Error extraction pattern** (`ConnectBoardDialog.tsx` lines 65–68):
```typescript
} catch (err: unknown) {
    const axiosError = err as { response?: { data?: { error?: string } } }
    setServerError(axiosError?.response?.data?.error || 'Connection failed. Please try again.')
}
```

**Spinner pattern** (`ConnectBoardDialog.tsx` line 147):
```typescript
{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
```

**Blue info notice pattern** (`ConnectBoardDialog.tsx` lines 130–133):
```typescript
<div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800 flex items-start gap-2">
    <Info className="h-4 w-4 mt-0.5 shrink-0" />
    <span>This board contains sample listings for development — no real credentials required.</span>
</div>
```

**Credential fields pattern** (`ConnectBoardDialog.tsx` lines 173–192):
```typescript
<div className="space-y-2">
    <Label htmlFor="rets-username">RETS Username</Label>
    <Input
        id="rets-username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="Enter your RETS username"
        autoComplete="off"
    />
</div>
<div className="space-y-2">
    <Label htmlFor="rets-password">RETS Password</Label>
    <Input
        id="rets-password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Enter your RETS password"
        autoComplete="new-password"
    />
</div>
```

**Concrete interface for EditBoardCredentialDialog:**
```typescript
interface EditBoardCredentialDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    credential: BoardCredentialType | null
    onEdit: (id: string, payload: UpdateBoardCredentialPayload) => Promise<void>
}
```

**State machine** (single-step, no multi-step transitions):
```typescript
const [username, setUsername] = useState('')
const [password, setPassword] = useState('')
const [isSubmitting, setIsSubmitting] = useState(false)
const [serverError, setServerError] = useState<string | null>(null)

const isTestBoard = credential?.realEstateBoard.isTestBoard ?? false
```

**handleSubmit for edit dialog:**
```typescript
const handleSubmit = async () => {
    if (!credential) return
    if (!isTestBoard && (!username || !password)) return
    setIsSubmitting(true)
    setServerError(null)
    try {
        const payload: UpdateBoardCredentialPayload = isTestBoard
            ? {}
            : { retsUsername: username, retsPassword: password }
        await onEdit(credential.id, payload)
        toast.success(isTestBoard ? 'Board connection verified.' : 'Board credentials updated.')
        handleOpenChange(false)
    } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { error?: string } } }
        setServerError(axiosError?.response?.data?.error || 'Update failed. Please try again.')
    } finally {
        setIsSubmitting(false)
    }
}
```

**Dialog layout per UI-SPEC:**
- DialogTitle: "Edit Board Connection"
- DialogDescription (test board): "Manage connection to [Board Name]."
- DialogDescription (real board): "Re-enter RETS credentials for [Board Name]."
- Footer: `flex items-center justify-end` (no back button)
- Submit disabled: `isSubmitting` (test board) / `isSubmitting || !username || !password` (real board)
- Submit label: "Re-verify connection" (test board) / "Save credentials" (real board)
- `autoFocus` on: submit button (test board) / username input (real board)

---

## Shared Patterns

### Authentication / Authorization
**Source:** `backend/app/controllers/v1/admin/board_credentials_controller.rb` — inherits `V1::Admin::BaseController`
**Apply to:** Both new backend actions (destroy, update)
```ruby
# No explicit before_action needed — BaseController handles require_admin!
# Authorization boundary is the brokerage scope:
Current.brokerage.brokerage_board_credentials.without_deleted.find_by!(id: params[:id])
```

### Soft Delete Scoping
**Source:** CLAUDE.md constraint + `board_credentials_controller.rb` lines 6–9
**Apply to:** destroy action, update action
```ruby
# Every query on soft-deletable models must use .without_deleted
# When joining, guard each model explicitly
.without_deleted
```

### Cache Invalidation
**Source:** `useCreateBoardCredential.ts` lines 13–14, `queryKeys.tsx` lines 181–183
**Apply to:** `useDeleteBoardCredential`, `useUpdateBoardCredential`
```typescript
// boardCredentialsKeys.all invalidates the full credentials list
export const boardCredentialsKeys = {
    all: ['board_credentials'] as const,
}
// In hooks:
queryClient.invalidateQueries({ queryKey: boardCredentialsKeys.all })
```

### Error Propagation to Dialog
**Source:** `ConnectBoardDialog.tsx` lines 65–68 (catch pattern), RESEARCH.md Pattern 6
**Apply to:** `useUpdateBoardCredential` (no onError), `EditBoardCredentialDialog` (catch + setServerError)
- Update hook has NO `onError` — errors propagate via rejected `mutateAsync` promise
- Context uses `mutateAsync` for update so errors are re-thrown
- Dialog wraps `await onEdit(...)` in try/catch and sets `serverError` state

### Permission Guard
**Source:** `BoardRegistrations.tsx` lines 35–39 — existing `Can` usage
**Apply to:** Actions cell in extended `BoardRegistrations`
```typescript
<Can permission="manage_brokerage_settings" fallback={<span />}>
    {/* dropdown + alertdialog */}
</Can>
```
**Critical:** `fallback={<span />}` not `fallback={null}` — preserves grid column alignment.

### AxiosErrorType
**Source:** `frontend/src/assets/types/axiosErrorType.ts`
**Apply to:** `useDeleteBoardCredential` (onError), `EditBoardCredentialDialog` (catch)
```typescript
import { AxiosError } from "axios";
type AxiosErrorType = AxiosError<{ error?: string }>;
```

### snakecaseKeys for Request Payloads
**Source:** `createBoardCredential.ts` lines 2, 13
**Apply to:** `updateBoardCredential.ts` (has payload), `deleteBoardCredential.ts` (no payload — omit)
```typescript
import snakecaseKeys from 'snakecase-keys'
// Wrap payload before sending:
board_credential: snakecaseKeys(payload)
```

---

## No Analog Found

All files have close analogs in the codebase. No entries required here.

---

## Pre-Implementation Checklist for Planner

| Check | Detail |
|-------|--------|
| Wave 0: install alert-dialog | `cd frontend && npx shadcn@latest add alert-dialog` — confirmed absent from `src/components/ui/` |
| Routes change is one line | `only: [:index, :create]` → `only: [:index, :create, :destroy, :update]` at routes.rb line 95 |
| Two private methods in controller | `board_credential_params` (existing, for create) + `update_credential_params` (new, for update only) |
| `BoardRegistrations` needs local state | `deleteTarget` and `editTarget` useState for dialog targeting |
| Context useMemo deps | Add `handleDeleteCredential`, `handleEditCredential`, `deleteCredential`, `updateCredential` to dep array |

---

## Metadata

**Analog search scope:** `backend/app/controllers/v1/admin/`, `frontend/src/assets/api/admin/boards/`, `frontend/src/store/hooks/Admin/`, `frontend/src/components/view/admin/brokerageView/`, `frontend/src/containers/adminBoard/brokerageAdminBoard/`, `frontend/src/components/common/buttons/elipsis/`
**Files scanned:** 10 source files read directly
**Pattern extraction date:** 2026-05-24

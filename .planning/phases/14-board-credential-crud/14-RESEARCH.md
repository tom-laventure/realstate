# Phase 14: Board Credential CRUD - Research

**Researched:** 2026-05-24
**Domain:** Rails 7.1 JSON API (destroy/update actions) + React 18 / TanStack Query (mutation hooks, shadcn DropdownMenu + AlertDialog, new Dialog component)
**Confidence:** HIGH — all findings verified from source code

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use a `⋯` (MoreHorizontal) dropdown menu per row — `DropdownMenu` from shadcn/ui, `MoreHorizontal` icon from lucide-react.
- **D-02:** Add a 5th column "Actions" to the Board Registrations table — change `grid-cols-4` to `grid-cols-5`; dropdown button is right-aligned in the last cell. Header row also gets a 5th "Actions" column header.
- **D-03:** New `EditBoardCredentialDialog` component — separate from `ConnectBoardDialog`. Pre-populated with the board name and current credential fields.
- **D-04:** For test board credentials, the dialog shows the board name + a read-only notice ("Test board — no credentials required") with no editable fields. Submit re-PATCHes the record (re-verify + set status active). For real boards, show username/password fields pre-filled empty (user re-enters).
- **D-05:** PATCH payload follows the same shape as POST: `{ board_credential: { rets_username, rets_password } }`. Test boards submit with empty strings — model validation is skipped via `unless: -> { real_estate_board&.is_test_board? }`.
- **D-06:** Clicking "Delete" opens an `AlertDialog` confirmation: "Delete [Board Name] connection? This cannot be undone." with Cancel / Delete buttons. Only fires the DELETE request on confirm.
- **D-07:** Soft delete only on `BrokerageBoardCredential` via `acts_as_paranoid` `destroy!` — `BrokerageEstate` rows are NOT touched.
- **D-08:** Routes updated to `resources :board_credentials, only: [:index, :create, :destroy, :update]`.
- **D-09:** `destroy` action: `credential.destroy!` → 200 `{ message: "Board disconnected successfully" }`. Credential is scoped to `Current.brokerage`.
- **D-10:** `update` action: same RETS validation branch as `create` (bypass if `is_test_board?`, else `RetsAuthService`). On success: update `rets_username`, `rets_password`, `status: 'active'`, `last_verified_at: Time.current`.

### Claude's Discretion

None specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOARD-06 | Admin can delete a board credential (`DELETE /v1/admin/board_credentials/:id` — soft delete via `acts_as_paranoid`) | Groups controller destroy pattern verified; `acts_as_paranoid` on BrokerageBoardCredential verified |
| BOARD-07 | Admin can update credentials for an existing board registration (`PATCH /v1/admin/board_credentials/:id` — re-validates RETS for real boards, no-op for test boards) | BoardCredentialsController create action has exact RETS branch pattern to mirror; conditional validation in model verified |
| BOARD-08 | Board Registrations table displays delete and edit actions per row | BoardRegistrations.tsx grid structure verified; DropdownMenu already installed; AlertDialog NOT installed — Wave 0 gap |
</phase_requirements>

---

## Summary

Phase 14 adds DELETE and PATCH actions to `BoardCredentialsController` and surfaces per-row edit/delete actions in the Board Registrations table. The backend work is straightforward: two new actions that extend existing patterns (destroy mirrors `GroupsController#destroy`; update mirrors the RETS validation branch in `create`). The frontend work adds three artifacts: two new API modules, two new TanStack mutation hooks, and one new dialog component (`EditBoardCredentialDialog`), plus extensions to `BoardRegistrations.tsx` and `BrokerageAdminBoardContext.ts`.

One critical gap was found during research: **`alert-dialog` is not installed in `frontend/src/components/ui/`**. The UI-SPEC states it is "confirmed installed at src/components/ui/alert-dialog.tsx" but the directory does not contain that file. This must be installed in Wave 0 before any component code can import it. All other required shadcn components (`dropdown-menu`, `button`, `dialog`, `input`, `label`) are confirmed present.

The existing `DropdownMenu` usage pattern is well-established in the project (see `elipsis.tsx`, `UsersListView.tsx`). The `ConnectBoardDialog` provides the exact dialog markup, state machine, and error display pattern to replicate for `EditBoardCredentialDialog`. The `useCreateBoardCredential` hook provides the exact mutation + invalidate + toast pattern for the two new delete/update hooks.

**Primary recommendation:** Install `alert-dialog` in Wave 0, then implement backend first (routes → destroy → update), then frontend layers (types → API → hooks → dialog component → context + table extension).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Soft-delete credential | API / Backend | — | AR destroy! lives in controller; soft delete is server-authoritative |
| RETS re-validation on update | API / Backend | — | Credentials must not be validated client-side; RetsAuthService is backend-only |
| Brokerage-scoping of credential lookup | API / Backend | — | `Current.brokerage` is set by BrokerageAuth concern, unavailable in frontend |
| Row actions UI (dropdown, dialogs) | Browser / Client | — | Pure UI interaction; no SSR involved |
| Cache invalidation after mutation | Browser / Client | — | TanStack Query invalidation on `boardCredentialsKeys.all` |
| Permission guard (manage_brokerage_settings) | Browser / Client | — | `Can` component wraps actions; backend implicitly enforces via `require_admin!` in BaseController |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rails 7.1 JSON API | existing | destroy/update controller actions | Project standard |
| acts_as_paranoid | existing | Soft delete on BrokerageBoardCredential | Already on model [VERIFIED: source] |
| RetsAuthService | existing | RETS credential validation in update | Used identically in create [VERIFIED: source] |
| TanStack Query (useMutation) | existing | useDeleteBoardCredential, useUpdateBoardCredential | Established hook pattern [VERIFIED: source] |
| shadcn/ui DropdownMenu | existing | Per-row actions trigger | Already installed and used [VERIFIED: source] |
| shadcn/ui AlertDialog | **NOT installed** | Delete confirmation | Must be installed via Wave 0 [VERIFIED: source — absent from ui/] |
| shadcn/ui Dialog | existing | EditBoardCredentialDialog wrapper | Installed [VERIFIED: source] |
| lucide-react MoreHorizontal | existing | Row actions trigger icon | Available in lucide-react package |
| snakecase-keys | existing | Payload serialization in API modules | Used in createBoardCredential.ts [VERIFIED: source] |
| react-hot-toast | existing | Success/error toasts in mutation hooks | Used across all mutation hooks [VERIFIED: source] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AxiosErrorType | existing | Typed error in onError callbacks | `AxiosError<{ error?: string }>` — use in useUpdateBoardCredential |

### Alternatives Considered

None — all decisions are locked. No alternatives needed.

**Installation — Wave 0:**
```bash
cd frontend && npx shadcn@latest add alert-dialog
```

---

## Architecture Patterns

### System Architecture Diagram

```
Admin user clicks "⋯" on a credential row
       ↓
DropdownMenu (BoardRegistrations.tsx)
       ↓
  ┌────┴────┐
  │         │
"Edit"   "Delete"
  │         │
  ↓         ↓
EditBoard  AlertDialog
Credential (confirm?)
Dialog       │
  │          │ Yes
  ↓          ↓
handleEdit  handleDelete
(context)   (context)
  │          │
  ↓          ↓
useUpdate  useDelete
BoardCred  BoardCred
(mutation) (mutation)
  │          │
  ↓          ↓
PATCH /v1/  DELETE /v1/
admin/board admin/board
_credentials _credentials
/:id        /:id
  │          │
  ↓          ↓
BoardCred  BoardCred
Controller Controller
#update    #destroy
  │          │
  ↓          ↓
RetsAuth   destroy!
Service    (soft del)
(if real)
  │          │
  ↓          ↓
200 + serialized  200 { message }
credential
  │          │
  └────┬─────┘
       ↓
invalidateQueries(boardCredentialsKeys.all)
       ↓
BoardRegistrations re-renders with fresh data
```

### Recommended File Structure

New files to create:

```
backend/
└── app/controllers/v1/admin/
    └── board_credentials_controller.rb   [EXTEND — add destroy + update actions]

frontend/src/
├── assets/
│   ├── api/admin/boards/
│   │   ├── deleteBoardCredential.ts      [NEW]
│   │   └── updateBoardCredential.ts      [NEW]
│   └── types/
│       └── boardType.ts                  [EXTEND — add UpdateBoardCredentialPayload]
├── store/hooks/Admin/Boards/
│   ├── useDeleteBoardCredential.ts       [NEW]
│   └── useUpdateBoardCredential.ts       [NEW]
├── containers/adminBoard/brokerageAdminBoard/
│   └── BrokerageAdminBoardContext.ts     [EXTEND — add handleDeleteCredential + handleEditCredential]
└── components/view/admin/brokerageView/
    ├── BoardRegistrations.tsx            [EXTEND — 5th column + per-row dropdown]
    └── EditBoardCredentialDialog.tsx     [NEW]

backend/config/
└── routes.rb                             [EXTEND — add :destroy, :update to board_credentials]
```

### Pattern 1: Backend Destroy Action (from GroupsController)

**What:** Brokerage-scoped find + `destroy!` + 200 with message. Rescue `RecordNotDestroyed`.
**When to use:** Soft delete of brokerage-owned resource.

```ruby
# Source: backend/app/controllers/v1/admin/groups_controller.rb (verified)
# Pattern for board_credentials_controller.rb#destroy:

def destroy
  @credential = Current.brokerage.brokerage_board_credentials
    .without_deleted
    .find_by!(id: params[:id])
  @credential.destroy!
  render json: { message: "Board disconnected successfully" }, status: :ok
rescue ActiveRecord::RecordNotFound
  render json: { error: "Credential not found" }, status: :not_found
rescue ActiveRecord::RecordNotDestroyed => e
  render json: { error: "Failed to disconnect board", details: e.record.errors.full_messages }, status: :unprocessable_entity
end
```

### Pattern 2: Backend Update Action (mirrors create RETS branch)

**What:** Find credential, run RETS validation branch (bypass for test board), update attributes, save.
**When to use:** Re-validate and persist credentials for existing board connection.

```ruby
# Source: backend/app/controllers/v1/admin/board_credentials_controller.rb (verified)
# Pattern for #update:

def update
  @credential = Current.brokerage.brokerage_board_credentials
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
    return render json: { error: result.error }, status: :unprocessable_entity
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
    render json: { errors: @credential.errors.full_messages }, status: :unprocessable_entity
  end
rescue ActiveRecord::RecordNotFound
  render json: { error: "Credential not found" }, status: :not_found
end

private

def update_credential_params
  params.require(:board_credential).permit(:rets_username, :rets_password)
end
```

### Pattern 3: Frontend API Module (delete)

**What:** Thin axios wrapper returning void for DELETE endpoints.

```typescript
// Source: frontend/src/assets/api/dashboard/estates/deleteEstateDocument.ts (verified)
// Pattern for deleteBoardCredential.ts:

import axiosInstance from '@/assets/axios/axios'

const deleteBoardCredential = async (id: string): Promise<void> => {
    await axiosInstance.delete(`/v1/admin/board_credentials/${id}`)
}

export default deleteBoardCredential
```

### Pattern 4: Frontend API Module (update)

**What:** Thin axios wrapper with snakecaseKeys payload for PATCH endpoints.

```typescript
// Source: frontend/src/assets/api/admin/boards/createBoardCredential.ts (verified)
// Pattern for updateBoardCredential.ts:

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

### Pattern 5: Frontend Mutation Hook

**What:** useMutation → invalidate boardCredentialsKeys.all → toast. Import AxiosErrorType for onError.

```typescript
// Source: frontend/src/store/hooks/Admin/Boards/useCreateBoardCredential.ts (verified)
// and: frontend/src/store/hooks/Admin/Brokerage/useDeleteUserFromBrokerage.tsx (verified)

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

### Pattern 6: useUpdateBoardCredential — error propagated to dialog (not toast)

**What:** The update hook must NOT show a toast.error for RETS validation failures — these must appear inline in the dialog. The hook throws on error so the dialog's catch block handles it.

```typescript
// Pattern for useUpdateBoardCredential.ts:
// Use mutateAsync in context (not mutate) so the dialog can catch and display inline errors.
// The hook only fires toast.success on success; errors are re-thrown for the dialog to catch.

const useUpdateBoardCredential = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateBoardCredentialPayload }) =>
            updateBoardCredential(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardCredentialsKeys.all })
        },
        // No onError toast — errors re-thrown to dialog for inline display
    })
}
```

### Pattern 7: Context Extension

**What:** Add two new callback actions to BrokerageAdminBoardContext. Use `mutateAsync` for the update (dialog needs to catch errors); use `mutate` for delete (fire-and-forget per D-06 AlertDialog spec).

```typescript
// Source: frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts (verified)
// Extensions:

const { mutateAsync: updateCredential } = useUpdateBoardCredential()
const { mutate: deleteCredential } = useDeleteBoardCredential()

const handleDeleteCredential = useCallback((id: string) => {
    deleteCredential(id)
}, [deleteCredential])

const handleEditCredential = useCallback(async (id: string, payload: UpdateBoardCredentialPayload) => {
    await updateCredential({ id, payload })
}, [updateCredential])
```

### Pattern 8: BoardRegistrations Extension (5-column grid + dropdown)

**What:** Add 5th column header, wrap per-row dropdown in `Can`, render empty `<span />` when permission absent to preserve grid alignment.

```typescript
// Source: frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx (verified)
// Key changes:
// 1. "grid-cols-4" → "grid-cols-5" on header div and row div
// 2. Add "Actions" header cell
// 3. Add per-row <Can permission="manage_brokerage_settings"> wrapping DropdownMenu
//    with fallback={<span />}

// DropdownMenu import pattern (verified from elipsis.tsx):
import {
    DropdownMenu, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
```

### Pattern 9: AlertDialog — install + use

**What:** AlertDialog is NOT installed. Install it first, then use for delete confirmation.

```bash
# Wave 0: install alert-dialog
cd /path/to/frontend && npx shadcn@latest add alert-dialog
```

```typescript
// Import after install:
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'

// Per UI-SPEC: destructive button uses asChild pattern:
// <AlertDialogAction asChild>
//   <Button variant="destructive">Delete</Button>
// </AlertDialogAction>
```

### Pattern 10: EditBoardCredentialDialog state machine

**What:** Single-step dialog; state: `idle → submitting → success (close) | error (inline)`. Mirrors ConnectBoardDialog exactly for error display and reset-on-close.

```typescript
// Source: frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx (verified)
// Error display (both test and real board paths):
// {serverError && <p className="text-sm text-destructive">{serverError}</p>}

// Reset on close (handleOpenChange):
// setUsername(''); setPassword(''); setServerError(null); setIsSubmitting(false)

// Error extraction pattern:
// const axiosError = err as { response?: { data?: { error?: string } } }
// setServerError(axiosError?.response?.data?.error || 'Update failed. Please try again.')
```

### Anti-Patterns to Avoid

- **Toast-only error for RETS failures in update:** The RETS validation error must appear inline in the dialog (`serverError` state), not just as a toast. Use `mutateAsync` in the context so the dialog's catch block can set `serverError`.
- **Returning `null` in the Actions column when permission absent:** Returning `null` breaks `grid-cols-5` alignment. Return `<span />` instead.
- **Calling `credential.destroy!` without `.without_deleted` scope:** The index already uses `.without_deleted` — `destroy` must scope identically to prevent operating on already-soft-deleted records.
- **Omitting `includes(:real_estate_board)` in the update action's find:** The RETS branch checks `real_estate_board.is_test_board?` — this causes an N+1 or nil error without eager load.
- **Sending `real_estate_board_id` in `update_credential_params`:** The board association is not changeable — permit only `:rets_username` and `:rets_password`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Soft delete | Custom `deleted_at` setter | `acts_as_paranoid` `destroy!` | Already on model; handles `.without_deleted` scoping, timestamps |
| Delete confirmation modal | Custom modal from scratch | shadcn `AlertDialog` | Radix handles focus trap, aria-modal, role="alertdialog" semantics |
| Row action menu | Custom absolute-positioned div | shadcn `DropdownMenu` | Keyboard nav, escape handling, click-outside already wired |
| Error extraction from Axios | Re-implement response parsing | `AxiosErrorType` + response.data.error | Project-standard pattern used across all mutation hooks |
| RETS validation | Inline HTTP call in controller | `RetsAuthService` | Already handles all network error cases + timeout |

---

## Common Pitfalls

### Pitfall 1: AlertDialog Not Installed
**What goes wrong:** Import of `@/components/ui/alert-dialog` fails at build time or runtime.
**Why it happens:** UI-SPEC claimed it was "confirmed installed" but it is absent from `frontend/src/components/ui/`. [VERIFIED: directory listing]
**How to avoid:** Wave 0 task must run `npx shadcn@latest add alert-dialog` before any component code references it.
**Warning signs:** TypeScript error on import, build failure mentioning `alert-dialog`.

### Pitfall 2: Update Hook Error Not Propagated to Dialog
**What goes wrong:** RETS validation error shows as a toast and the dialog stays open with no feedback — or the dialog closes with no message.
**Why it happens:** Using `mutate` (fire-and-forget) instead of `mutateAsync` in the context — errors cannot be caught.
**How to avoid:** Context uses `mutateAsync` for `handleEditCredential`; dialog wraps `await onEdit(...)` in try/catch and sets `serverError`.
**Warning signs:** Dialog closes on RETS error instead of showing inline message.

### Pitfall 3: Grid Column Misalignment on Empty Actions
**What goes wrong:** Row with no permission shows 4-column layout while rows with permission show 5-column.
**Why it happens:** Returning `null` for the actions cell collapses the grid.
**How to avoid:** `Can` component has `fallback={<span />}` prop — always pass it.
**Warning signs:** Rows with restricted users have visually shifted columns.

### Pitfall 4: Scope Without `without_deleted` in Destroy/Update
**What goes wrong:** `find_by!` in destroy/update operates on soft-deleted records.
**Why it happens:** Forgetting `.without_deleted` in the lookup chain.
**How to avoid:** Mirror the index action's scope exactly: `Current.brokerage.brokerage_board_credentials.without_deleted.find_by!(id: params[:id])`.
**Warning signs:** DELETE succeeds on a credential the user cannot see in the table.

### Pitfall 5: `board_credential_params` Reuse for Update
**What goes wrong:** Update action accidentally permits `real_estate_board_id`, allowing board reassignment.
**Why it happens:** Reusing the `board_credential_params` private method from `create`.
**How to avoid:** Define a separate `update_credential_params` that permits only `:rets_username` and `:rets_password`.
**Warning signs:** Request with `real_estate_board_id` in PATCH body changes the credential's board association.

---

## Code Examples

### Type Extension (boardType.ts)

```typescript
// Source: frontend/src/assets/types/boardType.ts (verified — extend, don't replace)
// Add after existing CreateBoardCredentialPayload:

export interface UpdateBoardCredentialPayload {
    retsUsername?: string   // optional — omitted for test boards
    retsPassword?: string   // optional — omitted for test boards
}
```

### Route Extension (routes.rb)

```ruby
# Source: backend/config/routes.rb line 95 (verified)
# Change:
resources :board_credentials, only: [:index, :create]
# To:
resources :board_credentials, only: [:index, :create, :destroy, :update]
```

### BoardRegistrations Props Extension

The `BoardRegistrationsProps` interface needs three new props:

```typescript
interface BoardRegistrationsProps {
    // ... existing props ...
    onDeleteCredential: (id: string) => void
    onEditCredential: (id: string, payload: UpdateBoardCredentialPayload) => Promise<void>
}
```

And `BrokerageAdminBoard.tsx` passes `actions.handleDeleteCredential` and `actions.handleEditCredential` down to `BoardRegistrations`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom delete modals (ConfirmDeletePopup) | shadcn AlertDialog (D-06) | Phase 14 design | AlertDialog provides semantic role="alertdialog", aria-modal, focus trap |

**Existing ConfirmDeletePopup:** The project has a `ConfirmDeletePopup` component used in other admin views (UsersListView, FiltersSection). The CONTEXT.md decision (D-06) explicitly specifies shadcn `AlertDialog` for this phase — do not use the custom popup.

---

## Environment Availability

Step 2.6: External dependencies are all in the existing project stack. No new runtimes or services required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| shadcn/ui alert-dialog | Delete confirmation (BOARD-08) | ✗ — NOT installed | — | No fallback — must install |
| shadcn/ui dropdown-menu | Row actions (BOARD-08) | ✓ | installed | — |
| shadcn/ui dialog | EditBoardCredentialDialog (BOARD-07/08) | ✓ | installed | — |
| RetsAuthService | RETS validation in update (BOARD-07) | ✓ | existing | — |
| acts_as_paranoid | Soft delete (BOARD-06) | ✓ | on model | — |

**Missing dependencies with no fallback:**
- `alert-dialog` — must be installed via `npx shadcn@latest add alert-dialog` in Wave 0

---

## Project Constraints (from CLAUDE.md)

- **Soft deletes:** Always scope with `.without_deleted` on every model in query chains. Destroy action must use `Current.brokerage.brokerage_board_credentials.without_deleted.find_by!(id:)`.
- **AR Encryption:** `BrokerageBoardCredential` uses encrypted column accessors. Assign via `credential.rets_username = value` — do NOT write `rets_username_ciphertext` directly.
- **Authorization:** No declarative gem. Use `Current.brokerage` scope as the authorization boundary — credential lookup scoped to brokerage IS the authorization.
- **Frontend data flow:** Component → Context → TanStack Hook → API module → Axios. Never call API or hooks directly inside a component.
- **Interfaces in types/:** `UpdateBoardCredentialPayload` must be defined in `assets/types/boardType.ts`, not locally in a hook or component.
- **`@` alias:** Use `@/` for all frontend imports.
- **Icons:** `lucide-react` only. `MoreHorizontal` is the correct icon for the ⋯ button.
- **snakecase-keys:** Use in API modules for request payloads. Axios interceptor handles response camelCasing — never call `camelcaseKeys` again in hooks.
- **Senior UI/UX standard:** All UI must be polished. Ghost variant button for `⋯`, destructive variant for delete confirm, accessible aria-label on icon-only button.
- **`Can` component:** Must wrap actions cell. Use `fallback={<span />}` to preserve grid alignment when permission absent.
- **Enum prefix:** `BrokerageBoardCredential` status enum uses `prefix: :credential` — predicates are `credential_active?` / `credential_invalid?`. Setting status uses string: `status: "active"` (not `:active`).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims were verified from source code in this session. No ASSUMED claims.**

---

## Open Questions

1. **`useCreateBoardCredential` has no `onError` callback** — the hook shows no toast on connection failure (error propagates to ConnectBoardDialog's catch block instead). The `useDeleteBoardCredential` hook SHOULD add `onError` for a fire-and-forget toast since the AlertDialog closes immediately on confirm. This is consistent with the UI-SPEC ("Delete error toast: 'Failed to disconnect board...'"). The planner should include `onError` in the delete hook.

2. **`update` response shape** — the update action should return the updated credential serialized via `BrokerageBoardCredentialSerializer`. The serializer currently exposes `id, brokerage_id, real_estate_board_id, status, last_verified_at, created_at` plus the `real_estate_board` association. This is sufficient; the `UpdateBoardCredentialResponse` type can mirror `CreateBoardCredentialResponse`.

---

## Sources

### Primary (HIGH confidence)
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` — create action RETS branch, index scoping pattern
- `backend/app/controllers/v1/admin/groups_controller.rb` — destroy action pattern (exact template)
- `backend/app/models/brokerage_board_credential.rb` — acts_as_paranoid, encrypts accessors, conditional validations, enum prefix
- `backend/app/serializers/brokerage_board_credential_serializer.rb` — exposed attributes
- `backend/config/routes.rb` — current route (line 95: only: [:index, :create])
- `frontend/src/store/hooks/Admin/Boards/useCreateBoardCredential.ts` — mutation hook template
- `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` — context structure to extend
- `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` — 4-column grid, Can usage, badge colors
- `frontend/src/components/view/admin/brokerageView/ConnectBoardDialog.tsx` — dialog structure, error display, reset pattern
- `frontend/src/assets/types/boardType.ts` — existing types to extend
- `frontend/src/assets/api/admin/boards/createBoardCredential.ts` — API module pattern with snakecaseKeys
- `frontend/src/store/hooks/queryKeys.tsx` — boardCredentialsKeys location and shape
- `frontend/src/components/ui/` — directory listing confirming alert-dialog ABSENT
- `frontend/src/components/common/buttons/elipsis/elipsis.tsx` — DropdownMenu usage pattern
- `frontend/src/store/hooks/Admin/Brokerage/useDeleteUserFromBrokerage.tsx` — delete mutation with onError pattern
- `frontend/src/assets/types/axiosErrorType.ts` — AxiosErrorType definition
- `frontend/components.json` — shadcn new-york preset, zinc base, lucide iconLibrary

---

## Metadata

**Confidence breakdown:**
- Backend patterns: HIGH — all verified from source
- Frontend patterns: HIGH — all verified from source
- Missing alert-dialog: HIGH — verified by directory listing
- Type shapes: HIGH — verified from existing boardType.ts and serializer

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable stack — no fast-moving dependencies)

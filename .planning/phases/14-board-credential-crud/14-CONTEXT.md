# Phase 14: Board Credential CRUD - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add DELETE and PATCH endpoints to `BoardCredentialsController` and surface per-row edit/delete actions in the Board Registrations table. Admins can disconnect a board (soft delete credential) or update credentials (re-validates RETS for real boards, skips for test boards).

</domain>

<decisions>
## Implementation Decisions

### Row Actions UX
- **D-01:** Use a `⋯` (MoreHorizontal) dropdown menu per row — `DropdownMenu` from shadcn/ui, `MoreHorizontal` icon from lucide-react.
- **D-02:** Add a 5th column "Actions" to the Board Registrations table — change `grid-cols-4` to `grid-cols-5`; dropdown button is right-aligned in the last cell. Header row also gets a 5th "Actions" column header.

### Edit Credentials Flow
- **D-03:** New `EditBoardCredentialDialog` component — separate from `ConnectBoardDialog`. Pre-populated with the board name and current credential fields.
- **D-04:** For test board credentials, the dialog shows the board name + a read-only notice ("Test board — no credentials required") with no editable fields. Submit re-PATCHes the record (re-verify + set status active). For real boards, show username/password fields pre-filled empty (user re-enters).
- **D-05:** PATCH payload follows the same shape as POST: `{ board_credential: { rets_username, rets_password } }`. Test boards submit with empty strings — model validation is skipped via `unless: -> { real_estate_board&.is_test_board? }`.

### Delete Confirmation
- **D-06:** Clicking "Delete" opens an `AlertDialog` confirmation: "Delete [Board Name] connection? This cannot be undone." with Cancel / Delete buttons. Only fires the DELETE request on confirm.
- **D-07:** Soft delete only on `BrokerageBoardCredential` via `acts_as_paranoid` `destroy!` — `BrokerageEstate` rows are NOT touched (brokerage listing access is preserved after disconnect).

### Backend
- **D-08:** Routes updated to `resources :board_credentials, only: [:index, :create, :destroy, :update]`.
- **D-09:** `destroy` action: `credential.destroy!` → 200 `{ message: "Board disconnected successfully" }`. Credential is scoped to `Current.brokerage`.
- **D-10:** `update` action: same RETS validation branch as `create` (bypass if `is_test_board?`, else `RetsAuthService`). On success: update `rets_username`, `rets_password`, `status: 'active'`, `last_verified_at: Time.current`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Controller (extend, don't replace)
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` — `create` action has the RETS validation branch pattern to mirror in `update`; `index` has the scoping pattern

### Model & Serializer
- `backend/app/models/brokerage_board_credential.rb` — `acts_as_paranoid`, encrypted credential accessors, conditional validations for test boards
- `backend/app/serializers/brokerage_board_credential_serializer.rb` — current serialized attributes

### Frontend Table (extend, don't rewrite)
- `frontend/src/components/view/admin/brokerageView/BoardRegistrations.tsx` — 4-column grid to extend to 5-column
- `frontend/src/containers/adminBoard/brokerageAdminBoard/BrokerageAdminBoardContext.ts` — context orchestration; needs `handleDeleteCredential` and `handleEditCredential` actions
- `frontend/src/store/hooks/Admin/Boards/useCreateBoardCredential.ts` — pattern to follow for new delete/update mutation hooks
- `frontend/src/assets/types/boardType.ts` — `BoardCredentialType` and payload types; extend with `UpdateBoardCredentialPayload`

### Routes
- `backend/config/routes.rb` line 95 — `resources :board_credentials, only: [:index, :create]` → add `:destroy, :update`

### Requirements
- `.planning/REQUIREMENTS.md` — BOARD-06, BOARD-07, BOARD-08

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConnectBoardDialog` — reference for dialog structure and test-board detection pattern; do not modify, only reference
- `shadcn/ui DropdownMenu` — already used elsewhere in the project; import pattern established
- `shadcn/ui AlertDialog` — standard confirmation dialog; use for delete confirmation
- `useCreateBoardCredential.ts` — mutation hook template (useMutation → invalidate boardCredentialsKeys.all → toast)
- `boardCredentialsKeys` in `queryKeys.ts` — existing query key for cache invalidation

### Established Patterns
- Delete action: `resource.destroy!` → `render json: { message: "..." }, status: :ok` (see `groups_controller.rb:destroy`)
- Credential scoped to brokerage: `Current.brokerage.brokerage_board_credentials.without_deleted.find_by!(id: params[:id])` — raise 404 if not found
- `Can permission="manage_brokerage_settings"` guard — wrap dropdown/actions in this component (same as Connect Board button)
- Toast pattern: `toast.success(...)` / `toast.error(...)` in mutation hooks

### Integration Points
- `BrokerageAdminBoardContext.ts` must expose `handleDeleteCredential(id: string)` and `handleEditCredential(id: string, payload: UpdateBoardCredentialPayload)` via `actions`
- `BrokerageAdminBoard.tsx` passes these actions down to `BoardRegistrations`
- New API files: `deleteboardCredential.ts` + `updateBoardCredential.ts` in `frontend/src/assets/api/admin/boards/`
- New hooks: `useDeleteBoardCredential.ts` + `useUpdateBoardCredential.ts` in `frontend/src/store/hooks/Admin/Boards/`

</code_context>

<specifics>
## Specific Ideas

- Edit dialog for test boards: board name displayed as read-only + notice "Test board — no credentials required". Submit button label: "Re-verify connection" (or similar). No username/password fields shown.
- Delete confirmation copy: "Delete [Board Name] connection? This cannot be undone."
- The `⋯` button should be a ghost variant icon button to keep visual weight low.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-board-credential-crud*
*Context gathered: 2026-05-24*

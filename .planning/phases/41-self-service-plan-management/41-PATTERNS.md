# Phase 41: Self-Service Plan Management - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 10 (new/modified, backend + frontend)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/app/controllers/v1/admin/settings/plan_controller.rb` | controller | request-response (owner-gated mutation, job enqueue) | `backend/app/controllers/ops/plan_controller.rb` (exact validate/no-op/flip/enqueue sequence) + `backend/app/controllers/v1/admin/settings/owners_controller.rb` (owner-gate + brokerage-scoping idiom) | exact (two-analog composite) |
| `backend/config/routes.rb` (add `resource :plan` inside `namespace :settings`) | route | request-response | existing `namespace :settings do resources :owners ... end` block (lines 79-85) and `ops` `resource :plan, only: [:update, :create], controller: "plan"` (line 8) | exact |
| `backend/test/integration/admin_settings_plan_test.rb` (new, not explicitly listed but implied by controller) | test | request-response | `backend/test/integration/admin_settings_owners_test.rb` (auth_headers_for pattern) + `backend/test/integration/ops_plan_test.rb` (assert_enqueued_with pattern) | exact |
| `frontend/src/assets/api/admin/settings/plan/updatePlan.ts` | utility (Axios call) | request-response | `frontend/src/assets/api/admin/settings/owners/promoteOwner.ts` | exact |
| `frontend/src/store/hooks/Admin/Settings/Plan/useUpdatePlan.ts` | hook | request-response (mutation) | `frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts` + `frontend/src/store/hooks/Admin/Brokerage/useUpdateBrokerage.ts` (single-key invalidation) | exact (composite) |
| `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` (extend) | provider/hook (Brain) | request-response | itself, existing owners section state/actions (same file) | exact |
| `frontend/src/components/view/admin/settingsAdminView/PlanManagementSection.tsx` | component | request-response | `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` | exact |
| `frontend/src/components/view/admin/settingsAdminView/PlanSelector.tsx` | component | request-response | `frontend/src/components/ui/tabs.tsx` (primitive) — no existing selector component precedent, composed fresh from `Tabs`/`TabsList`/`TabsTrigger` | role-match (primitive-level, no component-level precedent) |
| `frontend/src/components/view/admin/settingsAdminView/DowngradeConfirmDialog.tsx` | component | request-response | `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` | exact |
| `frontend/src/assets/rbac/permissions.ts` (extend) | config | request-response | itself, existing `Permission` union + `ROLE_PERMISSIONS` map (same file) | exact |

## Pattern Assignments

### `backend/app/controllers/v1/admin/settings/plan_controller.rb` (controller, request-response)

**Analogs:** `backend/app/controllers/ops/plan_controller.rb` (job-invocation contract, byte-for-byte reference) + `backend/app/controllers/v1/admin/settings/owners_controller.rb` (owner-gating idiom, brokerage-scoping idiom)

**Owner-gate pattern** (from `owners_controller.rb` lines 4-6):
```ruby
module V1
  module Admin
    module Settings
      class OwnersController < V1::Admin::BaseController
        skip_before_action :require_agent_or_above!, only: [:create, :update]
        before_action :require_owner!, only: [:create, :update]
```
Since the new `PlanController` will likely have only one action (`update`), `require_owner!` can simply be declared as a blanket `before_action` — no `skip_before_action` needed unless a future read action is added to the same controller. `require_owner!` and `current_membership` come from `V1::Admin::BaseController` (`backend/app/controllers/v1/admin/base_controller.rb` lines 25-37):
```ruby
def require_owner!
  unless current_membership&.role == "owner"
    render json: {error: {code: "forbidden", message: "Owner access required."}},
      status: :forbidden
  end
end

def current_membership
  @current_membership ||= BrokerageMembership.without_deleted.find_by(
    user_id: Current.user.id,
    brokerage_id: Current.brokerage.id
  )
end
```

**Core validate → no-op-check → flip → enqueue pattern** (`backend/app/controllers/ops/plan_controller.rb` lines 14-36 — this is the byte-for-byte reference sequence to mirror):
```ruby
def update
  new_plan = params[:plan].to_s

  unless AppConstants::PLAN_TIERS.key?(new_plan)
    render json: {error: "Invalid plan"}, status: :unprocessable_entity
    return
  end

  old_plan = @brokerage.plan

  if old_plan == new_plan
    render json: {status: "noop", brokerage_id: @brokerage.id, plan: new_plan}, status: :ok
    return
  end

  @brokerage.update!(plan: new_plan)
  ApplyPlanTransitionJob.perform_later(@brokerage.id, old_plan, new_plan)
  render json: {status: "transitioning", brokerage_id: @brokerage.id, old_plan: old_plan, new_plan: new_plan}, status: :ok
rescue ActiveRecord::RecordInvalid => e
  render json: {error: e.message, details: e.record.errors.full_messages}, status: :unprocessable_entity
end
```
**Critical difference for the new controller:** replace `@brokerage` (set via `set_brokerage` / `params[:brokerage_id]` lookup in the Ops variant) with `Current.brokerage` — the new endpoint is brokerage-scoped to the authenticated caller only, never accepts an arbitrary `brokerage_id` param. Do not copy `Ops::PlanController`'s `set_brokerage` private method or its `skip_before_action :verify_authenticity_token` (that's specific to the Ops namespace's CSRF handling, not needed under `V1::Admin`).

**Error handling pattern:** `rescue ActiveRecord::RecordInvalid => e` → 422 with `e.record.errors.full_messages`, exactly as shown above. This matches the codebase convention of catching model-validation failures at the controller boundary rather than pre-validating every field.

---

### `backend/config/routes.rb` (route addition)

**Analog:** existing `namespace :settings do resources :owners, only: [:index, :create, :update] do ... end end` block (`backend/config/routes.rb` lines 79-85), and the `ops` namespace's own `resource :plan, only: [:update, :create], controller: "plan"` (line 8) as the singular-resource routing precedent.

**Pattern to add** (inside the existing `namespace :settings do ... end` block, sibling to `resources :owners`):
```ruby
namespace :settings do
  resources :owners, only: [:index, :create, :update] do
    collection do
      get :eligible
    end
  end
  resource :plan, only: [:update], controller: "plan"   # NEW — PATCH /v1/admin/settings/plan
end
```

---

### `backend/test/integration/admin_settings_plan_test.rb` (test, request-response)

**Analogs:** `backend/test/integration/admin_settings_owners_test.rb` (auth/forbidden pattern) + `backend/test/integration/ops_plan_test.rb` (job-enqueue assertion pattern)

**Auth setup + forbidden-response pattern** (`admin_settings_owners_test.rb` lines 1-49):
```ruby
require "test_helper"

class AdminSettingsOwnersTest < ActionDispatch::IntegrationTest
  setup do
    @brokerage = create(:brokerage)
    create(:brokerage_domain, brokerage: @brokerage, domain: "acme.example.com")
    @owner = create(:user)
    @admin = create(:user)
    create(:brokerage_membership, :owner, user: @owner, brokerage: @brokerage)
    create(:brokerage_membership, :admin, user: @admin, brokerage: @brokerage)
  end

  test "GET /v1/admin/settings/owners as client is forbidden" do
    get "/v1/admin/settings/owners", headers: auth_headers_for(@client, @brokerage)
    assert_response :forbidden
  end
```
`auth_headers_for(user, brokerage)` (in `backend/test/test_helper.rb`) mints a real HS256 JWT and sets the `Host` header — the standard auth mechanism for every controller test. No `Minitest::Mock`/`.stub` used anywhere in this file.

**Job-enqueue assertion pattern** (`backend/test/integration/ops_plan_test.rb` lines 24-35):
```ruby
test "POST /ops/brokerages/:id/plan with plan: free transitions a growth brokerage and enqueues the cascade job" do
  assert_enqueued_with(job: ApplyPlanTransitionJob, args: [@brokerage.id, "growth", "free"]) do
    post "/ops/brokerages/#{@brokerage.id}/plan", params: {plan: "free"}.to_json, headers: ops_headers
  end
  assert_response :ok
  body = JSON.parse(response.body)
  assert_equal "transitioning", body["status"]
  assert_equal "free", @brokerage.reload.plan
end
```
For the new endpoint's test, wrap the PATCH request in `assert_enqueued_with(job: ApplyPlanTransitionJob, args: [@brokerage.id, old_plan, new_plan])`, and add an explicit `assert_no_enqueued_jobs(only: ApplyPlanTransitionJob)` test for the same-plan (no-op) case, and a `:forbidden` test for non-owner callers (admin/agent/client) mirroring the owners-controller forbidden pattern above.

---

### `frontend/src/assets/api/admin/settings/plan/updatePlan.ts` (utility, request-response)

**Analog:** `frontend/src/assets/api/admin/settings/owners/promoteOwner.ts` (full file, 9 lines):
```typescript
import axiosInstance from '@/assets/axios/axios'
import { OwnerType } from '@/assets/types/ownerType'

const promoteOwner = async (userId: string): Promise<OwnerType> => {
    const response = await axiosInstance.post('/v1/admin/settings/owners', { user: { user_id: userId } })
    return response.data
}

export default promoteOwner
```
Also see `demoteOwner.ts` for the PATCH-with-payload-object shape:
```typescript
const demoteOwner = async ({ userId, role }: DemoteOwnerPayload): Promise<OwnerType> => {
    const response = await axiosInstance.patch(`/v1/admin/settings/owners/${userId}`, { user: { role } })
    return response.data
}
```
New `updatePlan.ts` should follow this exact shape: `axiosInstance.patch('/v1/admin/settings/plan', { plan: newPlan })`, returning `response.data` directly (the Axios interceptor already camelCases the response — do not call `camelcaseKeys` again per CLAUDE.md). Snake_case body key (`plan`) matches backend contract verbatim.

---

### `frontend/src/store/hooks/Admin/Settings/Plan/useUpdatePlan.ts` (hook, request-response mutation)

**Analog 1 (mutation + toast shape):** `frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts` (full file):
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
```

**Analog 2 (single-key invalidation, matching D-07's "only adminBrokerageKeys.all"):** `frontend/src/store/hooks/Admin/Brokerage/useUpdateBrokerage.ts` (full file):
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import updateBrokerage from '@/assets/api/admin/brokerage/updateBrokerage'
import BrokerageType from '@/assets/types/brokerageType'
import { useAppSelector } from '@/store/hooks/useDispatch'
import { adminBrokerageKeys } from '@/store/hooks/queryKeys'

const useUpdateBrokerage = () => {
    const queryClient = useQueryClient()
    const activeBrokerageId = useAppSelector(s => s.activeBrokerage.activeBrokerage?.id ?? null)

    return useMutation({
        mutationFn: (data: Partial<BrokerageType>) => updateBrokerage(data),
        onSuccess: (data) => {
            queryClient.setQueryData(adminBrokerageKeys.detail(activeBrokerageId), data)
            queryClient.invalidateQueries({ queryKey: adminBrokerageKeys.all })
        }
    })
}
```
The new `useUpdatePlan` should combine these two: `mutationFn: (plan: PlanTier) => updatePlan(plan)`, `onSuccess` invalidates **only** `adminBrokerageKeys.all` (no new query key needed — see "No Analog Found" / Pitfall 3 rationale, PLAN-22 reuses `useFetchBrokerage`), and fires `toast.success(\`Plan updated to ${tierLabel}\`)`. Per RESEARCH.md Pitfall 4, put the toast/optimistic-update/invalidation logic in this single mutation's `onSuccess` so both the direct-selection (upgrade/lateral) and dialog-confirm (downgrade) call sites share identical success handling — do not duplicate it per call site.

**Query key note:** No new query key file entry is required in `frontend/src/store/hooks/queryKeys.tsx` — reuse the existing `adminBrokerageKeys` (lines 14-17 of that file):
```typescript
export const adminBrokerageKeys = {
    all: ['brokerage'] as const,
    detail: (id: number | null) => ['brokerage', id] as const,
}
```

---

### `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` (provider/hook, extend)

**Analog:** itself — the existing owners section's state/actions in the same file (full current file, 79 lines) establishes the Brain pattern to extend:
```typescript
const useSettingsAdminContext = () => {
    const [isAddOwnerOpen, setIsAddOwnerOpen] = useState(false)
    const { data: ownersData, isLoading: isLoadingOwners, isError } = useFetchOwners()
    const { mutateAsync: promoteOwnerMutation, isPending: isPromoting } = usePromoteOwner()
    ...
    const handlePromoteOwner = useCallback(async (userId: string) => {
        try {
            await promoteOwnerMutation(userId)
            setIsAddOwnerOpen(false)
        } catch {
            toast.error(`...`)
        }
    }, [promoteOwnerMutation, eligibleUsers])

    return useMemo(() => ({
        state: { owners, eligibleUsers, isAddOwnerOpen, ... },
        actions: { setIsAddOwnerOpen, handlePromoteOwner, ... }
    }), [owners, eligibleUsers, isAddOwnerOpen, ... ])
}
```
Extend this same context with: `const { data: brokerage } = useFetchBrokerage()` (already imported/used elsewhere for `brokerage.plan`), `const { mutateAsync: updatePlanMutation, isPending: isUpdatingPlan } = useUpdatePlan()`, plus local state for the downgrade-confirm dialog (e.g. `pendingDowngradePlan: PlanTier | null`, mirroring the existing `demoteTarget: OwnerType | null` shape at lines 26/65/72). A `handlePlanChange` callback should branch: if the selected tier is `'free'` and current plan is paid, set `pendingDowngradePlan` (opens the dialog) instead of mutating immediately; otherwise call `updatePlanMutation` directly (D-05). Add all new state/action fields to the `useMemo` state/actions objects and dependency array, following the exact same additive pattern as the existing demote-owner fields.

---

### `frontend/src/components/view/admin/settingsAdminView/PlanManagementSection.tsx` (component)

**Analog:** `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` (full file, 101 lines):
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Can from '@/components/common/guards/Can'
...

const OwnershipManagementSection = ({ owners, eligibleUsers, ... }: OwnershipManagementSectionProps) => (
    <Card className="mt-6">
        <CardHeader className="space-y-2 pb-4">
            <div className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Ownership Management</CardTitle>
                <Can permission="manage_ownership">
                    <Button size="sm" onClick={() => setIsAddOwnerOpen(true)}>...</Button>
                </Can>
            </div>
            <CardDescription>
                Owners have full access to all brokerage settings and data, ...
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {isError ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Couldn't load owners. Try refreshing the page.</p>
            ) : isLoadingOwners ? (
                <div className="divide-y divide-border">{/* skeleton rows */}</div>
            ) : (
                <CurrentOwnersList owners={owners} onRemove={setDemoteTarget} />
            )}
        </CardContent>
        <Can permission="manage_ownership">
            <AddOwnerDialog ... />
        </Can>
        <Can permission="manage_ownership">
            <RemoveOwnerDialog ... />
        </Can>
    </Card>
)
```
Per UI-SPEC, `PlanManagementSection` mirrors this `Card` + `CardHeader`/`CardTitle` (`text-base font-semibold` override) + `CardDescription` + `CardContent` structure with `mt-6` margin, title `Plan`, description matching the Copywriting Contract. **Difference from the ownership analog:** the read-only variant is NOT a plain-text fallback (that pattern doesn't apply here) — instead render the *same* `PlanSelector` component in both owner and non-owner cases, toggling only its `disabled` prop, per D-04 (see UI-SPEC's explicit rejection of a `Badge`/plain-text swap). Use `<Can permission="manage_plan">` only to gate the *interactivity* (pass `disabled={!canManagePlan}` where `canManagePlan` comes from `usePermission('manage_plan')`, or gate via conditionally-rendered `PlanSelector` props, not by wrapping the whole selector in `<Can>`/fallback like `AddOwnerDialog` is). The `DowngradeConfirmDialog` should be wrapped in `<Can permission="manage_plan">` exactly like `AddOwnerDialog`/`RemoveOwnerDialog` are.

---

### `frontend/src/components/view/admin/settingsAdminView/PlanSelector.tsx` (component)

**Analog (primitive only — no existing component-level precedent for a 3-way segmented control):** `frontend/src/components/ui/tabs.tsx` (full file, 75 lines) — `variant="default"` styling:
```tsx
const tabsListVariants = cva('inline-flex items-center justify-center', {
    variants: {
        variant: {
            default: 'h-10 rounded-md bg-muted p-1 text-muted-foreground',
            ...
        },
    },
})

const tabsTriggerVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ... disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'rounded-sm px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                ...
            },
        },
    }
)
```
`TabsTrigger` natively forwards a `disabled` prop (Radix `TabsPrimitive.Trigger`), which the `tabsTriggerVariants`' `disabled:pointer-events-none disabled:opacity-50` classes already style — this covers D-04's read-only variant with zero new CSS. Per RESEARCH.md Pattern 4, use `Tabs`/`TabsList`/`TabsTrigger` with **no `TabsContent`** — `value`/`onValueChange` drive the mutation directly instead of switching panels:
```tsx
<Tabs value={currentPlan} onValueChange={(v) => handlePlanChange(v as PlanTier)}>
  <TabsList variant="default">
    <TabsTrigger value="free" disabled={!canManagePlan}>Free</TabsTrigger>
    <TabsTrigger value="independent" disabled={!canManagePlan}>Independent</TabsTrigger>
    <TabsTrigger value="growth" disabled={!canManagePlan}>Growth</TabsTrigger>
  </TabsList>
</Tabs>
```
Per the Interaction Contract in UI-SPEC: selecting Free while on a paid tier must NOT change the active tab visually until the downgrade dialog is confirmed — `value={currentPlan}` (the confirmed/server-known tier, not an intermediate selection) plus `onValueChange` calling out to the parent's branching handler (which opens the dialog for downgrades, without changing `currentPlan` state until confirm) achieves this correctly.

---

### `frontend/src/components/view/admin/settingsAdminView/DowngradeConfirmDialog.tsx` (component)

**Analog:** `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` (full file, 47 lines):
```tsx
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DeleteDomainDialogProps {
    open: boolean
    domain: BrokerageDomain
    onConfirm: () => void
    onCancel: () => void
}

const DeleteDomainDialog: React.FC<DeleteDomainDialogProps> = ({ open, domain, onConfirm, onCancel }) => (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{`Delete ${domain.domain}?`}</AlertDialogTitle>
                <AlertDialogDescription>{`This domain will enter a phase-out period...`}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={onCancel}>Keep domain</AlertDialogCancel>
                <AlertDialogAction
                    onClick={onConfirm}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >Begin phase-out</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
)
```
The new `DowngradeConfirmDialog` follows this exact shape and prop interface (`open`, `onConfirm`, `onCancel`), with copy from the UI-SPEC Copywriting Contract:
- Title: `Downgrade to Free?`
- Description: `Your custom domain will be frozen and real board credentials and client memberships will be suspended. You can restore everything by upgrading again.`
- Cancel button: `Keep current plan`
- Confirm button (destructive-styled, same `bg-destructive text-destructive-foreground hover:bg-destructive/90` override): `Downgrade to Free`

No itemized counts/preview data — per D-01, generic copy only, no new props for specifics.

---

### `frontend/src/assets/rbac/permissions.ts` (config, extend)

**Analog:** itself — the existing `Permission` union + `ROLE_PERMISSIONS` map (full current file, 22 lines):
```typescript
import UserRole from '@/assets/types/roleType'

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

export const hasPermission = (role: UserRole, permission: Permission): boolean =>
    ROLE_PERMISSIONS[role]?.includes(permission) ?? false
```
Add `'manage_plan'` to the `Permission` union and to `owner`'s array only in `ROLE_PERMISSIONS` (admin/agent/staff/client unchanged) — a clean, additive, non-breaking change. Do NOT reuse `'manage_ownership'` for the plan-change gate (RESEARCH.md Pitfall 2 — different capability, would silently couple unrelated access rules).

---

## Shared Patterns

### Owner-gated backend actions (DB-backed `current_membership`, never JWT role claim)
**Source:** `backend/app/controllers/v1/admin/base_controller.rb` lines 13-37 (`require_agent_or_above!`, `require_owner!`, `current_membership`)
**Apply to:** `plan_controller.rb`'s `update` action
```ruby
def require_owner!
  unless current_membership&.role == "owner"
    render json: {error: {code: "forbidden", message: "Owner access required."}}, status: :forbidden
  end
end

def current_membership
  @current_membership ||= BrokerageMembership.without_deleted.find_by(
    user_id: Current.user.id, brokerage_id: Current.brokerage.id
  )
end
```

### `Can` permission-gate component (frontend RBAC)
**Source:** `frontend/src/components/common/guards/Can.tsx` (full file, 17 lines)
```tsx
const Can = ({ permission, children, fallback = null }: CanProps) => {
    const allowed = usePermission(permission)
    return <>{allowed ? children : fallback}</>
}
```
**Apply to:** gating the `Add Owner`-equivalent interactive affordance — for this phase, gate the `DowngradeConfirmDialog`'s render and `PlanSelector`'s `disabled` prop with `<Can permission="manage_plan">` / `usePermission('manage_plan')`, exactly mirroring `OwnershipManagementSection`'s `<Can permission="manage_ownership">` usage.

### TanStack mutation → single-key invalidation → toast
**Source:** `frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts` + `frontend/src/store/hooks/Admin/Brokerage/useUpdateBrokerage.ts`
**Apply to:** `useUpdatePlan.ts` — invalidate only `adminBrokerageKeys.all` per D-07 (no Domains/Boards keys).

### Axios call — snake_case body, return `response.data` directly
**Source:** `frontend/src/assets/api/admin/settings/owners/promoteOwner.ts`, `demoteOwner.ts`
**Apply to:** `updatePlan.ts` — never call `camelcaseKeys` again in the API layer or hook (global interceptor already does it, per CLAUDE.md).

### Existing job cascade — enqueue, never reimplement
**Source:** `backend/app/jobs/apply_plan_transition_job.rb` (already proven, 12 tests)
**Apply to:** `plan_controller.rb`'s `update` action — call `ApplyPlanTransitionJob.perform_later(brokerage.id, old_plan, new_plan)` only; no cascade logic in the controller.

## No Analog Found

None. Every file in this phase's scope has at least a role-match analog (see `PlanSelector.tsx`'s primitive-level match above — the closest thing to "no analog" in this phase, since no existing component composes `Tabs` into a value-driven selector widget, but the underlying primitive and its `variant="default"`/`disabled` styling are fully proven and directly reusable).

## Metadata

**Analog search scope:** `backend/app/controllers/{ops,v1/admin/settings}/`, `backend/app/controllers/v1/admin/base_controller.rb`, `backend/config/routes.rb`, `backend/test/integration/{admin_settings_owners_test.rb,ops_plan_test.rb}`, `backend/app/jobs/apply_plan_transition_job.rb`, `backend/app/constants/plan_tiers.rb`, `frontend/src/containers/adminBoard/settingsAdminBoard/`, `frontend/src/components/view/admin/{settingsAdminView,domainsAdminView}/`, `frontend/src/components/common/guards/`, `frontend/src/components/ui/{tabs,alert-dialog}.tsx`, `frontend/src/store/hooks/Admin/{Settings/Owners,Brokerage}/`, `frontend/src/assets/api/admin/{settings/owners,brokerage}/`, `frontend/src/assets/rbac/permissions.ts`, `frontend/src/assets/types/ownerType.ts`, `frontend/src/store/hooks/queryKeys.tsx`
**Files scanned:** 24 (all read directly via Read tool, no re-reads of overlapping ranges)
**Pattern extraction date:** 2026-07-23

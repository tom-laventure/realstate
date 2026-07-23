# Phase 41: Self-Service Plan Management - Research

**Researched:** 2026-07-23
**Domain:** Rails owner-gated API endpoint + React admin-settings UI, wiring an existing async job cascade
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Downgrade Confirmation Flow
- **D-01:** Single warning dialog, generic copy — explains in general terms that the custom domain will be frozen and real board credentials/client memberships will be suspended (not itemized counts). No preview/specifics endpoint needed.
- **D-02:** Plain Confirm/Cancel buttons — no type-to-confirm friction. The change is reversible (re-upgrade restores exactly what was suspended, per Phase 38), so the lighter Remove-Owner-style warning dialog is sufficient.

#### 3-Way Selector UI
- **D-03:** Compact segmented control (Free | Independent | Growth), not the onboarding wizard's full price/feature cards. Current tier highlighted. Settings pages favor density over the onboarding wizard's marketing-card treatment.
- **D-04:** Admin/agent read-only view renders the *same* segmented control, disabled/non-interactive, with the current tier still highlighted — not a plain text/badge replacement. Keeps visual consistency between the owner and non-owner views.

#### Upgrade & Lateral-Change UX
- **D-05:** Only downgrades (paid → Free) show the confirmation dialog. Upgrades (Free → paid) and lateral paid ↔ paid changes (Independent ↔ Growth) apply immediately on selection, no confirmation step — matches the roadmap's literal scope and keeps the common-case interaction fast.

#### Async Job Feedback
- **D-06:** `ApplyPlanTransitionJob` runs via `perform_later` — the UI does not poll for job completion. On confirming a plan change, optimistically show the new tier as selected and fire a success toast (e.g. "Plan updated to Growth"), mirroring how `Ops::PlanController`'s synchronous-looking "transitioning" response already behaves and how Ownership Management's mutations are handled (no pending/spinner state, no polling infrastructure).
- **D-07:** After a plan change, invalidate only the plan/brokerage query — not Domains or Boards query keys. Those pages refresh independently on next visit/navigation; proactively invalidating them is out of this phase's scope.

### Claude's Discretion
- Exact query key names, hook file layout, and component decomposition within the "Plan" section are left to the planner/executor to match existing `useSettingsAdminContext` conventions.
- Whether the new backend endpoint lives under `V1::Admin::Settings::` (sibling to `OwnersController`) or a dedicated `V1::Admin::PlanController` is an implementation detail for the planner to resolve against existing routing conventions.

### Folded Todos
None — no pending todos matched this phase's scope.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| PLAN-22 | `/admin/settings` has a new "Plan" section showing the brokerage's current plan tier | `useFetchBrokerage()` already returns `brokerage.plan` (see Pitfall 3, Don't Hand-Roll table) — no new read endpoint needed, only a new component consuming existing data |
| PLAN-23 | Owner can change the brokerage's plan via a 3-way selector (Free/Independent/Growth); admin/agent see the current plan read-only, no change control | `Tabs` (`variant="default"`) segmented control + `Can permission="manage_plan"` gate (see Pattern 4, Pitfall 2) |
| PLAN-24 | Changing the plan calls a new brokerage-scoped, owner-gated backend endpoint that enqueues the existing `ApplyPlanTransitionJob` cascade — the real transition, not a stub | New `V1::Admin::Settings::PlanController#update` mirroring `Ops::PlanController`'s exact validate → no-op-check → flip → enqueue sequence (see Pattern 2, Architecture Patterns diagram) |
| PLAN-25 | Server-side enforcement rejects the plan-change request from any non-owner caller, regardless of frontend state | `require_owner!` re-validated against DB-backed `current_membership`, mirroring `OwnersController`/`BrokeragesController#update` (see Pattern 1, Security Domain) |
| PLAN-26 | Selecting a downgrade (paid → Free) shows a confirmation step before applying, since it freezes the custom domain and suspends real board credentials/client memberships | `AlertDialog`-based `DowngradeConfirmDialog`, mirroring `DeleteDomainDialog.tsx`'s single-warning/plain-Confirm-Cancel shape (see Code Examples, Standard Stack alternatives) |
</phase_requirements>

## Summary

This phase adds no new subsystem — it wires a UI selector and a thin, owner-gated controller action to a cascade (`ApplyPlanTransitionJob`) that already exists, is already tested, and is already invoked successfully by `Ops::PlanController` in production use (v1.12 Phases 37-39). The entire implementation surface is: one new Rails controller action (or a `create`/`update` pair mirroring `Ops::PlanController`'s shape) that (1) validates the plan value, (2) requires `current_membership.role == "owner"`, (3) flips `brokerage.plan` synchronously, (4) enqueues `ApplyPlanTransitionJob.perform_later(brokerage.id, old_plan, new_plan)` — plus a React "Plan" section that reads the already-fetched `brokerage.plan` (via the existing `useFetchBrokerage` hook, no new GET endpoint needed for PLAN-22) and renders a 3-way selector gated by a new `manage_plan` permission.

Every piece needed already has a proven analog in this codebase: `V1::Admin::Settings::OwnersController` for the owner-gated/brokerage-scoped controller pattern, `Ops::PlanController` for the exact job-invocation contract (including the `old_plan == new_plan` no-op guard that MUST be duplicated in the new controller, since the job's own no-op guard exists only as defense-in-depth, not as the primary "don't enqueue a no-op" mechanism), `useSettingsAdminContext.ts` + `usePromoteOwner`/`useDemoteOwner` for the TanStack Query mutation/invalidation/toast convention, and `DeleteDomainDialog.tsx` for the exact "single warning, plain Confirm/Cancel" `AlertDialog` shape that D-01/D-02 describe. The 3-way selector should use the existing `Tabs` primitive in its `default` variant (already styled as a segmented control — pill background, active item highlighted, native per-trigger `disabled` support), not `RadioGroup`.

**Primary recommendation:** Add `V1::Admin::Settings::PlanController#update` (sibling to `OwnersController` under `namespace :settings`) that duplicates `Ops::PlanController`'s exact validate → no-op-check → flip-plan → enqueue sequence, gated by `require_owner!`. On the frontend, extend `useSettingsAdminContext.ts` with a plan-change mutation that invalidates only `adminBrokerageKeys.all` (mirroring `useUpdateBrokerage`'s own invalidation), gate the interactive `Tabs` selector with a new owner-only `manage_plan` permission, and reuse `AlertDialog` (not `Dialog`) for the downgrade confirmation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Display current plan tier (PLAN-22) | Frontend Server (React component) | API / Backend (existing `GET /v1/admin/brokerage`) | `brokerage.plan` is already serialized by `BrokerageSerializer` and already fetched by `useFetchBrokerage` — no new read endpoint needed |
| 3-way plan selector UI, read-only for non-owners (PLAN-23) | Browser / Client | — | Pure client-side rendering + RBAC gate via existing `Can`/`usePermission` pattern |
| Plan-change request + cascade enqueue (PLAN-24) | API / Backend | — | New owner-gated controller action; enqueues existing `ApplyPlanTransitionJob` (Active Job / `solid_queue`) |
| Server-side owner enforcement (PLAN-25) | API / Backend | — | `before_action :require_owner!` reading DB-backed `current_membership`, never a JWT/client-supplied role claim |
| Downgrade confirmation dialog (PLAN-26) | Browser / Client | — | Pure UI gate in front of the same mutation; no separate backend "preview" endpoint per D-01 |
| Cascade side effects (domain freeze, credential/membership suspend, TEST-board purge, billing snapshot) | API / Backend (Active Job worker) | Database / Storage | Entirely pre-built in `ApplyPlanTransitionJob` — this phase must not reimplement any of it |

## Standard Stack

No new libraries, gems, or npm packages are required for this phase. Everything needed is already installed and used elsewhere in the codebase.

### Core (already installed, reused as-is)
| Component | Where it already lives | Purpose in this phase |
|-----------|------------------------|------------------------|
| `ApplyPlanTransitionJob` | `backend/app/jobs/apply_plan_transition_job.rb` | The cascade this phase enqueues, unmodified |
| `AppConstants::PLAN_TIERS` | `backend/app/constants/plan_tiers.rb` | Plan-value validity check (`PLAN_TIERS.key?(new_plan)`) |
| `@radix-ui/react-tabs` (via `components/ui/tabs.tsx`) | `frontend/src/components/ui/tabs.tsx` | 3-way segmented-control selector |
| `@radix-ui/react-alert-dialog` (via `components/ui/alert-dialog.tsx`) | `frontend/src/components/ui/alert-dialog.tsx` | Downgrade confirmation dialog |
| `@tanstack/react-query` | already project-wide | Plan-change mutation + cache invalidation |
| `react-hot-toast` | already project-wide | Success/error toast on plan change |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Tabs` (default variant) for the segmented control | `RadioGroup` (used in `RemoveOwnerDialog` for role selection) | `RadioGroup` renders as circular radio inputs + labels, not a pill-shaped segmented control — visually wrong for D-03's "compact segmented control" ask. `Tabs`'s `default` variant (`bg-muted` track, `data-[state=active]:bg-background` pill) is a closer match and Radix natively supports a `disabled` prop per `TabsTrigger` for the read-only variant (D-04). **[VERIFIED: read `frontend/src/components/ui/tabs.tsx` directly]** |
| `AlertDialog` for the downgrade confirmation | `Dialog` (used in `RemoveOwnerDialog`'s 3-step wizard) | `RemoveOwnerDialog`'s `Dialog` is the right primitive for its own multi-step flow, but D-01/D-02 explicitly want a *single*, plain Confirm/Cancel warning — `AlertDialog` is the shadcn-idiomatic primitive for exactly that, and `DeleteDomainDialog.tsx` already establishes this exact pattern in this codebase (single warning dialog, destructive-styled confirm action, plain cancel). **[VERIFIED: read `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` directly]** |
| New `V1::Admin::PlanController` (top-level) | `V1::Admin::Settings::PlanController` (nested under `namespace :settings`) | Both are viable (CONTEXT.md leaves this to planner discretion). The nested location keeps it structurally identical to `OwnersController` (same namespace, same `Current.brokerage` scoping, same `before_action` gating idiom) and reads naturally as "a Settings-page resource," matching where the UI actually lives (`/admin/settings`). Recommend nesting. **[VERIFIED: read `backend/config/routes.rb` lines 79-85]** |

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new packages (backend gems or npm packages) — every primitive/library used is already present in the dependency tree and already imported elsewhere in the codebase (see Standard Stack table above, each with a direct file citation). No `slopcheck`/registry verification step is required.

## Architecture Patterns

### System Architecture Diagram

```
Owner clicks a new tier in the 3-way selector (or confirms downgrade dialog)
        │
        ▼
Frontend: usePlanChange() mutation (mutateAsync)
        │  PATCH /v1/admin/settings/plan  { plan: "growth" }
        ▼
V1::Admin::Settings::PlanController#update
        │
        ├─ before_action chain: authenticate_cognito_user! → require_owner!
        │      (skip_before_action :require_agent_or_above!, only: [:update]
        │       before_action :require_owner!, only: [:update]  — mirrors OwnersController)
        │
        ├─ validate AppConstants::PLAN_TIERS.key?(new_plan)          ─── 422 if invalid
        ├─ old_plan = Current.brokerage.plan
        ├─ return early (no-op response) if old_plan == new_plan     ─── mirrors Ops::PlanController
        ├─ Current.brokerage.update!(plan: new_plan)                 ─── plan flips SYNCHRONOUSLY, before enqueue
        └─ ApplyPlanTransitionJob.perform_later(brokerage.id, old_plan, new_plan)
                │
                ▼
        Active Job (solid_queue) — async, no polling from the UI (D-06)
                │
                ├─ Free→paid:   TestBoardPurgeService.call! (+ restore! if previously downgraded)
                ├─ Paid→Free:   freeze_custom_domains! + suspend real-board credentials + suspend client memberships
                │                 + stamp plan_downgraded_at + DomainMailer.downgrade_notice (after commit)
                └─ Paid↔Paid:   recalculate_billing! → PlanBillingSnapshot.create!

Frontend (immediately, on HTTP 200 — no job-completion wait):
        │
        ├─ Optimistically render the new tier as selected
        ├─ toast.success("Plan updated to <Tier>")
        └─ queryClient.invalidateQueries({ queryKey: adminBrokerageKeys.all })   ─── ONLY this key (D-07)
                (Domains / Boards query keys are NOT invalidated — they refresh independently on next visit)
```

### Recommended Project Structure

Backend:
```
backend/app/controllers/v1/admin/settings/
├── owners_controller.rb        # existing — structural analog
└── plan_controller.rb          # NEW — owner-gated plan-change endpoint
```

Route (add inside the existing `namespace :settings do ... end` block, `backend/config/routes.rb:79-85`):
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

Frontend:
```
frontend/src/
├── assets/api/admin/settings/plan/
│   └── updatePlan.ts                         # NEW — Axios call, snake_case body { plan: "growth" }
├── store/hooks/Admin/Settings/Plan/
│   └── useUpdatePlan.ts                      # NEW — TanStack mutation, invalidates adminBrokerageKeys.all only
├── containers/adminBoard/settingsAdminBoard/
│   └── useSettingsAdminContext.ts            # EXTEND — add plan state/actions alongside owners state/actions
└── components/view/admin/settingsAdminView/
    ├── PlanManagementSection.tsx              # NEW — Card wrapper, mirrors OwnershipManagementSection.tsx
    ├── PlanSelector.tsx                       # NEW — Tabs-based 3-way control (interactive + disabled variants)
    └── DowngradeConfirmDialog.tsx             # NEW — AlertDialog, mirrors DeleteDomainDialog.tsx shape
```

### Pattern 1: Owner-gated action inside an otherwise agent-or-above controller
**What:** `skip_before_action :require_agent_or_above!, only: [:update]` followed immediately by `before_action :require_owner!, only: [:update]` — never gate the whole controller if some actions (like a future `index`/`show`) should stay readable by admin/agent.
**When to use:** Any controller mixing a read action (broader access) with a mutating action (owner-only).
**Example:**
```ruby
# Source: backend/app/controllers/v1/admin/settings/owners_controller.rb:5-6 (verified — read directly)
class OwnersController < V1::Admin::BaseController
  skip_before_action :require_agent_or_above!, only: [:create, :update]
  before_action :require_owner!, only: [:create, :update]
  # index / eligible inherit require_agent_or_above! from BaseController
```
Since PLAN-22/23 require the *read* of the current plan to stay visible to admin/agent (it already is, via the separate `BrokeragesController#show`), and only the *change* action is owner-only, the new `PlanController#update` action can simply inherit `require_agent_or_above!` from `V1::Admin::BaseController` by default and then layer `require_owner!` on top for the one mutating action — no `skip_before_action` even needed if the controller only ever has one action (`update`). Mirror the two-line pattern anyway for readability/consistency with `OwnersController` if more actions are added later.

### Pattern 2: Exact `ApplyPlanTransitionJob` invocation contract
**What:** The controller must (1) validate `new_plan` against `AppConstants::PLAN_TIERS.key?`, (2) capture `old_plan` **before** mutating, (3) no-op (without enqueuing) if `old_plan == new_plan`, (4) update `brokerage.plan` synchronously in the request, (5) THEN enqueue with `perform_later(brokerage.id, old_plan, new_plan)`.
**When to use:** This exact sequence, verbatim — do not reorder steps 4/5, and do not skip step 3's no-op check even though the job itself also has a no-op guard (`return if old_plan == new_plan` at `apply_plan_transition_job.rb:18`). The job's guard is documented defense-in-depth for a *future* direct-invocation caller (a billing webhook, v2) — the controller is still responsible for not enqueueing spurious jobs, and for not writing a duplicate `PlanBillingSnapshot`-triggering flip on every keystroke of a no-op selection.
**Example:**
```ruby
# Source: backend/app/controllers/ops/plan_controller.rb:14-36 (verified — read directly; this is the
# reference implementation this phase's new endpoint parallels per CONTEXT.md canonical_refs)
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
The new controller should use `Current.brokerage` (already resolved by `BrokerageAuth`) instead of `Ops::PlanController`'s `set_brokerage`/`params[:brokerage_id]` lookup — the new endpoint is scoped to the authenticated caller's own brokerage, never an arbitrary `brokerage_id` param (this is the core "brokerage-scoped" difference CONTEXT.md calls out).

### Pattern 3: TanStack mutation + single-key invalidation + toast (Ownership Management convention)
**What:** A `useMutation` wrapping the Axios call, invalidating exactly the query key(s) the mutation's own domain owns — never more.
**When to use:** Any settings-page mutation in this codebase.
**Example:**
```typescript
// Source: frontend/src/store/hooks/Admin/Settings/Owners/usePromoteOwner.ts (verified — read directly)
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
For this phase's plan-change mutation, the single key to invalidate is `adminBrokerageKeys.all` (`['brokerage']`, from `frontend/src/store/hooks/queryKeys.tsx:14-17`) — the same key `useUpdateBrokerage.ts` already invalidates after any brokerage-settings PATCH. Per D-07, do NOT also invalidate any Domains or Boards query keys.

### Pattern 4: Segmented-control `Tabs` used as a selector, not content tabs
**What:** Render `Tabs`/`TabsList`/`TabsTrigger` with `variant="default"` and no `TabsContent` — `value`/`onValueChange` drive the plan-change mutation directly instead of switching visible panels.
**Example (illustrative, based on verified `tabs.tsx` API):**
```tsx
<Tabs value={currentPlan} onValueChange={(v) => handlePlanChange(v as PlanTier)}>
  <TabsList variant="default">
    <TabsTrigger value="free" disabled={!canManagePlan}>Free</TabsTrigger>
    <TabsTrigger value="independent" disabled={!canManagePlan}>Independent</TabsTrigger>
    <TabsTrigger value="growth" disabled={!canManagePlan}>Growth</TabsTrigger>
  </TabsList>
</Tabs>
```
For the read-only (non-owner) variant per D-04, render the identical `Tabs` markup with every `TabsTrigger` `disabled` — do not swap in a plain text/badge component. `TabsTrigger`'s `disabled:pointer-events-none disabled:opacity-50` classes (already in `tabsTriggerVariants`) handle the visual/interaction disabling for free.

### Anti-Patterns to Avoid
- **Reimplementing any part of the cascade in the new controller:** The controller's only job is validate → no-op-check → flip → enqueue. Freeze/suspend/purge/restore/billing logic belongs exclusively in `ApplyPlanTransitionJob` and must not be duplicated or "previewed" synchronously in the controller.
- **Trusting a client-supplied role/permission to gate the mutation:** Server-side enforcement (PLAN-25) must re-check `current_membership.role == "owner"` from the DB on every request, exactly like `OwnersController`/`BrokeragesController#update` already do — never trust that the frontend only shows the interactive selector to owners.
- **Invalidating Domains/Boards query keys from the plan-change mutation:** Explicitly out of scope per D-07 — resist the temptation to "proactively refresh everything the plan might affect."
- **Polling for job completion:** D-06 explicitly rules out a pending/spinner state or polling infrastructure — the UI optimistically shows the new tier and toasts success on the synchronous HTTP 200, matching `Ops::PlanController`'s "transitioning" response semantics (the job runs after the response is already sent).
- **Reusing `manage_ownership` for the plan-change permission:** See Permission analysis below — these are different capabilities and conflating them would let an owner-only "plan" affordance leak visibility rules from an unrelated feature (or vice versa) the next time either permission's rule changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plan-transition side effects (domain freeze, credential/membership suspend, TEST-board purge, billing recalculation) | A new synchronous or async handler in the new controller | `ApplyPlanTransitionJob.perform_later(brokerage.id, old_plan, new_plan)` | Already built, already tested (12 tests in `apply_plan_transition_job_test.rb` covering idempotency, restore scoping, WR-01/WR-03 races) in Phases 37-39 |
| Segmented 3-way selector widget | A custom flex/button-group component | `Tabs` (`variant="default"`) from `components/ui/tabs.tsx` | Already styled as a pill segmented control; native Radix `disabled` support covers the read-only variant for free |
| Downgrade warning dialog | A custom modal | `AlertDialog` from `components/ui/alert-dialog.tsx` | Already the established single warning + Confirm/Cancel pattern (`DeleteDomainDialog.tsx`) |
| Owner-role authorization check | An inline `current_user.role == "owner"` or JWT-claim check | `current_membership` (DB-backed, `BrokerageMembership.without_deleted.find_by(...)`) + `require_owner!` from `V1::Admin::BaseController` | Established since v1.11 Phase 33 specifically to prevent stale-JWT-claim privilege bugs; reinforced every phase since |
| Current-plan display data fetch | A new `GET` endpoint under `/admin/settings/plan` | Existing `useFetchBrokerage()` (`GET /v1/admin/brokerage`, already returns `plan`) | `BrokerageSerializer` already includes `:plan` (verified: `backend/app/serializers/brokerage_serializer.rb`); building a second read endpoint would duplicate this data source |

**Key insight:** This phase is almost entirely "wiring," not "building." The single genuinely new piece of logic is the owner-gate + no-op-guard + enqueue sequence in the new controller action, and even that has a byte-for-byte reference implementation (`Ops::PlanController#update`) to mirror.

## Common Pitfalls

### Pitfall 1: Skipping the controller-level no-op guard because "the job already no-ops"
**What goes wrong:** A caller that flips `brokerage.plan` and enqueues the job even when `old_plan == new_plan` wastes a queue dispatch, and — worse — if a future code path skips the flip-then-enqueue ordering, could pass a `new_plan` that no longer matches the just-written `brokerage.plan`, confusing later WR-03 same-brokerage race handling in `recalculate_billing!`.
**Why it happens:** The job's own guard (`apply_plan_transition_job.rb:18`, explicitly commented as WR-01) makes it *look* safe to omit the controller's own check.
**How to avoid:** Duplicate `Ops::PlanController`'s exact no-op short-circuit (return an explicit "noop" JSON response, never enqueue) before touching `brokerage.plan`.
**Warning signs:** A test asserting `assert_no_enqueued_jobs(only: ApplyPlanTransitionJob)` for a same-plan PATCH fails.

### Pitfall 2: Reusing `manage_ownership` instead of adding `manage_plan`
**What goes wrong:** `manage_ownership` currently gates only the Add/Remove Owner controls (`OwnershipManagementSection.tsx`). Reusing it for plan-change would mean any future change to ownership-management's access rule (e.g., if a "co-owner with limited scope" role is ever introduced) silently changes who can also change the brokerage's billing plan — an unrelated, higher-stakes capability.
**Why it happens:** Both are "owner-only today," so they look interchangeable at a glance.
**How to avoid:** Add a new `manage_plan` entry to the `Permission` union and `ROLE_PERMISSIONS` map (owner-only), confirmed as a clean, non-breaking, additive change — `frontend/src/assets/rbac/permissions.ts` is a simple exhaustive union + `Record` map with no other consumers to break. **[VERIFIED: read `frontend/src/assets/rbac/permissions.ts` in full]**
```typescript
// frontend/src/assets/rbac/permissions.ts — additive change only
export type Permission =
    | 'access_admin_panel'
    | 'manage_brokerage_settings'
    | 'manage_users'
    | 'manage_groups'
    | 'manage_ownership'
    | 'manage_plan'   // NEW

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    owner: [..., 'manage_ownership', 'manage_plan'],
    admin: [...],  // unchanged — no manage_plan
    agent: [...],  // unchanged
    ...
}
```
**Warning signs:** None currently — this is a design recommendation, not a bug found in the codebase; flagged in the Assumptions Log as the one open judgment call.

### Pitfall 3: Building a second GET endpoint for "current plan"
**What goes wrong:** Duplicating brokerage-plan data behind a new `/admin/settings/plan` GET action creates two sources of truth for the same field and two query keys to keep in sync.
**Why it happens:** The phase description frames the "Plan" section as a self-contained new area, making a dedicated GET feel natural.
**How to avoid:** `useFetchBrokerage()` already returns `plan` (verified: `BrokerageType.plan?: string`, `BrokerageSerializer` includes `:plan`). The new Plan section should consume the existing `useFetchBrokerage()` query, not introduce a second one.
**Warning signs:** A new query key for "current plan" that always mirrors `adminBrokerageKeys` 1:1 — a sign the second endpoint was unnecessary.

### Pitfall 4: Forgetting the "paid ↔ paid, no confirmation" branch's UX still needs immediate optimistic feedback
**What goes wrong:** Because D-05 says lateral/upgrade changes skip the confirmation dialog, it's easy to wire the dialog-confirm path's toast/invalidation but forget the direct (no-dialog) path needs the *same* success toast + optimistic tier update + invalidation.
**Why it happens:** The downgrade path is the one with explicit UI (dialog) to build against; the "just fire the mutation" path has no intermediate component to hang the side-effect code off of.
**How to avoid:** Put the toast/optimistic-update/invalidation logic in the single `useUpdatePlan` mutation's `onSuccess`, and call that same mutation from both the direct-selection handler (upgrade/lateral) and the dialog's confirm handler (downgrade) — never duplicate the success-handling logic per call site.

### Pitfall 5: Pre-existing unrelated stale `plan === 'premium'` check (do not touch, but be aware)
**What goes wrong:** `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts:36` still has `const isPremium = brokerage?.plan === 'premium'` — a dead check against a retired plan value (post-Phase-40, valid values are only `free`/`independent`/`growth`). This is NOT in this phase's scope (Domains page is explicitly excluded from D-07's invalidation, and this variable appears unused for gating `customDomainAvailable`, which correctly uses `hasPlanCapability`).
**Why it matters here:** Don't copy this `=== 'premium'` pattern anywhere in the new Plan section's code, and don't feel obligated to fix it — it's a pre-existing, separate cleanup item outside PLAN-22–26's scope.
**How to avoid:** Only ever compare `brokerage.plan` against `'free' | 'independent' | 'growth'`, and prefer `hasPlanCapability`/`AppConstants::PLAN_TIERS` lookups over raw string equality where a capability (not a literal Free/Independent/Growth choice) is being checked.

## Code Examples

### Integration test pattern for owner-gated endpoints (Minitest, no mocks)
```ruby
# Source: backend/test/integration/admin_settings_owners_test.rb (verified — read directly)
# Structural analog for the new plan-change endpoint's test file:
#   backend/test/integration/admin_settings_plan_test.rb
test "POST /v1/admin/settings/owners as non-owner caller is forbidden" do
  post "/v1/admin/settings/owners",
    params: {user: {user_id: @agent.uid}},
    headers: auth_headers_for(@admin, @brokerage)
  assert_response :forbidden
  body = JSON.parse(response.body)
  assert_equal "forbidden", body.dig("error", "code")
end
```
`auth_headers_for(user, brokerage)` (defined in `backend/test/test_helper.rb`) mints a real HS256 JWT via `TokenService.issue` and sets the `Host` header to the brokerage's domain — this is the standard way every controller test in this codebase authenticates as a specific role. No `Minitest::Mock`/`.stub` is used anywhere in this file or in `ops_plan_test.rb`.

### Asserting the job enqueue contract (native ActiveJob test helpers, no FakeJob subclass needed)
```ruby
# Source: backend/test/integration/ops_plan_test.rb:24-37 (verified — read directly)
test "POST /ops/brokerages/:id/plan with plan: free transitions a growth brokerage and enqueues the cascade job" do
  assert_enqueued_with(job: ApplyPlanTransitionJob, args: [@brokerage.id, "growth", "free"]) do
    post "/ops/brokerages/#{@brokerage.id}/plan", params: {plan: "free"}.to_json, headers: ops_headers
  end
  assert_response :ok
  assert_equal "free", @brokerage.reload.plan
end
```
This is the exact pattern to replicate for the new endpoint's integration test: `assert_enqueued_with(job:, args:)` wrapping the request, then asserting the response body and `brokerage.reload.plan`. No `FakeJob` subclass or job double is needed — this is Rails' built-in `ActiveJob::TestHelper`, already in use, already satisfies CLAUDE.md's "no `Minitest::Mock`/`.stub`" constraint.

### Downgrade confirmation dialog shape (AlertDialog, single warning, plain Confirm/Cancel)
```tsx
// Source: frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx (verified — read directly)
// Structural analog for the new DowngradeConfirmDialog.tsx:
<AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{`Downgrade to Free?`}</AlertDialogTitle>
      <AlertDialogDescription>
        {`Your custom domain will be frozen and real board credentials and client memberships will be suspended. You can restore everything by upgrading again.`}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
        Downgrade to Free
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```
Per D-01, the copy stays generic ("real board credentials and client memberships will be suspended") — no itemized counts, no preview endpoint.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | New permission should be named `manage_plan` (not a reuse of `manage_ownership` or another name) | Don't Hand-Roll / Pitfall 2 | Low — purely a naming choice; renaming later is a single-file, additive/rename change in `permissions.ts` with no runtime data implications |
| A2 | New route should be `resource :plan, only: [:update], controller: "plan"` nested under `namespace :settings` (vs. a top-level `V1::Admin::PlanController`) | Standard Stack / Architecture Patterns | Low — CONTEXT.md explicitly leaves this to planner discretion; either location works functionally, this is a structural/consistency recommendation only |
| A3 | Exact downgrade-dialog copy text shown in the Code Examples section is illustrative, not a locked requirement | Code Examples | Low — D-01 only specifies "generic, explains freeze/suspend in general terms," the exact wording is left to implementation |

Note: all three items above are design-judgment recommendations, not unverified factual claims — every factual/behavioral claim about existing code (job contract, controller pattern, hook conventions, component shapes) was verified by direct file reads, not assumed from training data.

## Open Questions

All open questions CONTEXT.md flagged for the planner have been resolved by direct codebase investigation in this research:

1. **Should the new endpoint reuse `manage_ownership` or add `manage_plan`?**
   - What we know: `permissions.ts` is a simple, exhaustive `Permission` union + `Record<UserRole, Permission[]>` map with no other consumers.
   - Resolution: Add `manage_plan` (owner-only) — confirmed clean, non-breaking, additive change (Pitfall 2).

2. **Which shadcn primitive fits the 3-way selector?**
   - Resolution: `Tabs` (`variant="default"`), not `RadioGroup` — confirmed by reading `tabs.tsx`'s styling (Pattern 4).

3. **Does PLAN-22 need a new read endpoint?**
   - Resolution: No — `useFetchBrokerage()` already returns `plan` (Pitfall 3).

No unresolved open questions remain for planning purposes.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V4 Access Control | Yes | `require_owner!` re-validated against DB-backed `current_membership` on every request (never a JWT/client-claim shortcut) — mirrors `OwnersController`/`BrokeragesController#update` |
| V5 Input Validation | Yes | `AppConstants::PLAN_TIERS.key?(new_plan)` inclusion check before any mutation (mirrors `Ops::PlanController` and `Brokerage`'s own `validates :plan, inclusion:` model validator as a second layer) |
| V2 Authentication | No (unchanged) | Existing Cognito JWT auth (`authenticate_cognito_user!`) applies unchanged; this phase adds no new auth surface |
| V6 Cryptography | No | Not applicable — no new crypto/secrets handling introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Non-owner (admin/agent/client) forging a plan-change request directly against the API, bypassing a disabled frontend control | Elevation of Privilege | Server-side `require_owner!` check against DB-backed `current_membership.role` — PLAN-25's explicit requirement, already the established pattern for every owner-gated action in this codebase |
| Cross-brokerage plan tampering (a caller passing another brokerage's ID) | Tampering | New endpoint uses `Current.brokerage` (resolved from request host via `BrokerageAuth`), never accepts a `brokerage_id` param — cannot target another tenant's brokerage by construction |
| Race between two rapid plan-change requests for the same brokerage (double-click, retry) | — (data integrity, not strictly STRIDE) | Already handled by the job's WR-03 guard (`recalculate_billing!` skips writing a stale snapshot if `brokerage.plan != new_plan` by execution time) — no additional mitigation needed in the controller beyond the existing no-op check |

## Sources

### Primary (HIGH confidence — direct file reads in this repository)
- `backend/app/jobs/apply_plan_transition_job.rb` — full job contract, idempotency guarantees, branch logic
- `backend/test/jobs/apply_plan_transition_job_test.rb` — 12 tests covering no-op, idempotency, restore-scoping, WR-03 races
- `backend/app/controllers/ops/plan_controller.rb` — reference invocation sequence
- `backend/test/integration/ops_plan_test.rb` — `assert_enqueued_with`/`assert_no_enqueued_jobs` test pattern
- `backend/app/controllers/v1/admin/settings/owners_controller.rb` — owner-gated controller pattern
- `backend/app/controllers/v1/admin/base_controller.rb` — `require_owner!`, `current_membership`, `require_agent_or_above!`
- `backend/test/integration/admin_settings_owners_test.rb` — Minitest integration test structure/helpers
- `backend/test/test_helper.rb` — `auth_headers_for` helper (real JWT, Host header)
- `backend/config/routes.rb` — existing `namespace :settings do resources :owners ... end` and `ops` `resource :plan` nesting
- `backend/app/controllers/v1/admin/brokerages_controller.rb` — confirms `plan` already serialized via `BrokerageSerializer`
- `backend/app/serializers/brokerage_serializer.rb` — confirms `:plan` attribute included
- `backend/app/models/brokerage.rb` — `plan` validation, `plan_config`, `billable_seat_count`, freeze/unfreeze methods
- `backend/app/constants/plan_tiers.rb` — `AppConstants::PLAN_TIERS` structure
- `frontend/src/containers/adminBoard/settingsAdminBoard/useSettingsAdminContext.ts` — Brain pattern to extend
- `frontend/src/containers/adminBoard/settingsAdminBoard/SettingsAdminBoard.tsx` — insertion point (TODO comment, line 30)
- `frontend/src/components/view/admin/settingsAdminView/OwnershipManagementSection.tsx` — component-level analog, `Can` gating
- `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx` — multi-step `Dialog` pattern (NOT recommended for this phase, but read for contrast)
- `frontend/src/components/view/admin/domainsAdminView/DeleteDomainDialog.tsx` — recommended `AlertDialog` pattern
- `frontend/src/components/common/guards/Can.tsx` — permission-gate component
- `frontend/src/assets/rbac/permissions.ts` — `Permission` union + `ROLE_PERMISSIONS` map (full read)
- `frontend/src/assets/rbac/planPermissions.ts` — `hasPlanCapability`/`PLAN_CAPABILITIES` mirror (calendar-sync caveat)
- `frontend/src/components/ui/tabs.tsx` — Tabs primitive styling (segmented-control variant)
- `frontend/src/components/ui/radio-group.tsx` — RadioGroup primitive (alternative considered, not recommended)
- `frontend/src/components/ui/alert-dialog.tsx` — AlertDialog primitive (recommended)
- `frontend/src/store/hooks/Admin/Settings/Owners/{useFetchOwners,usePromoteOwner,useDemoteOwner}.ts` — query key + invalidation + toast convention
- `frontend/src/store/hooks/Admin/Brokerage/{useFetchBrokerage,useUpdateBrokerage}.ts` — confirms `plan` already fetched; invalidation convention for brokerage-settings mutations
- `frontend/src/store/hooks/queryKeys.tsx` — `adminBrokerageKeys`, `ownersKeys`, `eligibleOwnerUsersKeys` definitions
- `frontend/src/assets/types/brokerageType.ts` — `plan?: string` already present on `BrokerageType`
- `frontend/src/store/reducers/createBrokerageWizard.ts` — `CreateBrokeragePlan` union type precedent (`'free' | 'independent' | 'growth'`)
- `frontend/src/containers/adminBoard/domainsAdminBoard/useDomainsAdminContext.ts` — pre-existing stale `=== 'premium'` check (out of scope, flagged as Pitfall 5)
- `.planning/PLAN-TIERS.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/41-self-service-plan-management/41-CONTEXT.md` — phase-defining documents

### Secondary / Tertiary
None used — this phase required zero external research; every claim is grounded in a direct read of this repository's own code, tests, and planning documents.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every component cited is an existing, in-repo file read directly
- Architecture: HIGH — controller/route/hook/component patterns all have byte-for-byte reference implementations already in the codebase
- Pitfalls: HIGH — every pitfall is grounded in a specific, cited line of existing code or test behavior, not speculation

**Research date:** 2026-07-23
**Valid until:** No expiry concern — this research depends entirely on this repository's own code, not third-party library versions or external API behavior. Re-verify only if `apply_plan_transition_job.rb`, `owners_controller.rb`, or `permissions.ts` are modified by an intervening phase before Phase 41 executes.

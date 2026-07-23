# Phase 40: Onboarding Plan Alignment - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 12 (3 new, 9 modified)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/app/controllers/v1/onboarding/plan_tiers_controller.rb` (NEW) | controller | request-response (read-only, non-AR) | `backend/app/controllers/v1/onboarding/domains_controller.rb` (`#check` action) | exact |
| `backend/config/routes.rb` (MODIFIED — add `resources :plan_tiers, only: [:index]`) | route | request-response | same file, `namespace :onboarding` block (domains/brokerage/user entries) | exact |
| `backend/app/controllers/v1/onboarding/brokerages_controller.rb` (MODIFIED — delete lines 34-36) | controller | CRUD (create) | itself (surgical deletion, no analog needed) | n/a |
| `frontend/src/assets/types/planTierType.ts` (NEW) | type | transform (API response shape) | `frontend/src/assets/types/domainType.ts` | exact |
| `frontend/src/assets/api/onboarding/getPlanTiers.ts` (NEW) | service (pure axios) | request-response (GET) | `frontend/src/assets/api/onboarding/checkDomain.ts` | exact |
| `frontend/src/store/hooks/Auth/useFetchPlanTiers.ts` (NEW) | hook | request-response (GET, useQuery) | `frontend/src/store/hooks/Auth/useCheckDomainAvailability.ts` | exact |
| `frontend/src/store/reducers/createBrokerageWizard.ts` (MODIFIED — widen `CreateBrokeragePlan`) | store | CRUD (local state) | itself (type widening only) | n/a |
| `frontend/src/assets/api/onboarding/createBrokerage.ts` (MODIFIED — widen `CreateBrokeragePlan`, sync with reducer) | service | request-response (POST) | itself (type widening only, see Pitfall 1) | n/a |
| `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` (MODIFIED — `submit()` line 97) | provider/context | request-response (mutation orchestration) | itself; loading/error pattern borrowed from `frontend/src/containers/auth/BrokerageContact.tsx` | role-match |
| `frontend/src/containers/createBrokerage/steps/PlanSelectionStep.tsx` (MODIFIED — fetch + 3 cards + loading/error) | component (page step) | request-response (GET on mount) | itself for structure; loading/error states from `frontend/src/components/dashboard/general/GroupMapPanel.tsx` and `frontend/src/containers/auth/BrokerageContact.tsx` | role-match |
| `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` (MODIFIED — 3-way gating + Yes/No toggle) | component (page step) | request-response (form + debounced GET) | itself for structure; toggle pattern from `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx` | role-match |
| `frontend/src/components/createBrokerage/PlanCard.tsx` (MOSTLY UNCHANGED) | component | transform (presentational) | itself — type widens automatically via import | exact |
| `frontend/src/components/createBrokerage/PlanBadge.tsx` (MODIFIED — 3-way label lookup) | component | transform (presentational) | itself — replace binary `isPremium` with a lookup map | exact |

## Pattern Assignments

### `backend/app/controllers/v1/onboarding/plan_tiers_controller.rb` (controller, request-response)

**Analog:** `backend/app/controllers/v1/onboarding/domains_controller.rb`

**Imports/header pattern** (lines 1-7):
```ruby
module V1
  module Onboarding
    class DomainsController < ApplicationController
      include MainDomainOnly
      include CognitoAuth

      before_action :authenticate_cognito_user!
```
Copy this exact module nesting + concern-include + before_action header for `PlanTiersController`.

**Core pattern — plain hash render for non-AR data** (lines 9-26, `#check` action):
```ruby
      # GET /v1/onboarding/domains/check?subdomain=foo&custom_domain=bar.com
      def check
        base_domain = ENV.fetch("APP_BASE_DOMAIN", "realtybase.ca")
        result = {}
        subdomain = params[:subdomain].to_s.strip.downcase
        if subdomain.present?
          full_host = "#{subdomain}.#{base_domain}"
          result[:subdomain] = !BrokerageDomain.exists?(domain: full_host)
        end
        ...
        render json: result, status: :ok
      end
```
Adapt for `#index`: no params, iterate `AppConstants::PLAN_TIERS`, `render json: {plan_tiers: tiers}, status: :ok`. Do **not** wrap in an `ActiveModel::Serializer` class — this codebase's serializers (`BrokerageSerializer`, `BrokerageDomainSerializer`) are all AR-instance-shaped; `PlanTier` is a plain `Struct`. Use a private hash-builder method instead, matching this file's style of building `result` inline.

**Data source** (`backend/app/constants/plan_tiers.rb` lines 17-48):
```ruby
PLAN_TIERS = {
  "free" => PlanTier.new(seat_cap: nil, base_price_cents: 0, ..., real_boards: false, clients: false, custom_domain: false, calendar_sync: false).freeze,
  "independent" => PlanTier.new(seat_cap: 1, base_price_cents: 2000, ..., real_boards: true, clients: true, custom_domain: true, calendar_sync: true).freeze,
  "growth" => PlanTier.new(seat_cap: 5, base_price_cents: 7900, ..., real_boards: true, clients: true, custom_domain: true, calendar_sync: true).freeze
}.freeze
```
Insertion order is already `free, independent, growth` — `.map` over this hash naturally yields correct display order (no explicit sort needed). Convert `base_price_cents / 100.0` to dollars per D-01 (frontend displays `$0`, `$20`, `$79`).

**No error handling needed** — this action takes no params and touches no DB/external service; there is no failure branch to handle (unlike `#verify`, which has 404/403/422 branches — not applicable here).

---

### `backend/config/routes.rb` (route, request-response)

**Analog:** same file, `namespace :onboarding` block (lines 24-35)

**Pattern to extend**:
```ruby
namespace :onboarding do
  resource :brokerage, only: [:create]
  resource :user, only: [:update]
  resources :domains, only: [] do
    collection do
      get :check
    end
    member do
      post :verify
    end
  end
end
```
Add `resources :plan_tiers, only: [:index]` as a new line inside this block (produces `GET /v1/onboarding/plan_tiers`).

---

### `backend/app/controllers/v1/onboarding/brokerages_controller.rb` (surgical deletion)

**Verified exact block to delete** (lines 33-36):
```ruby
custom_domain = params[:custom_domain].to_s.strip.downcase
if plan == "growth" && custom_domain.blank?
  return render json: {error: "Custom domain is required for this plan"}, status: :unprocessable_entity
end
```
Delete only the `if plan == "growth" && custom_domain.blank? ... end` block (3 lines). Keep the `custom_domain = params[:custom_domain].to_s.strip.downcase` assignment — it's used later at line 77 (`if custom_domain.present?`). Do **not** touch the plan-validity check at lines 15-18 (`unless AppConstants::PLAN_TIERS.key?(plan)`) — that is the real security boundary and must remain untouched.

---

### `frontend/src/assets/types/planTierType.ts` (type, NEW)

**Analog:** `frontend/src/assets/types/domainType.ts`

**Pattern** (full file structure, lines 1-24):
```typescript
export type DomainType = 'subdomain' | 'custom'
export type DomainStatus = 'active' | 'phasing_out' | 'decommissioned' | 'pending' | 'frozen'

export interface BrokerageDomain {
    id: string | number
    domain: string
    domainType: DomainType       // camelCased from domain_type via Axios interceptor
    status: DomainStatus
    isPrimary: boolean            // camelCased from is_primary via Axios interceptor
    ...
}

export interface FetchDomainsResponse {
    domains: BrokerageDomain[]
}
```
Follow this exact shape for the new file: a `PlanTierKey = 'free' | 'independent' | 'growth'` union, a `PlanTier` interface (`key`, `pricePerMonth`, `seatCap: number | null`, `realBoards`, `clients`, `customDomain`, `calendarSync` — all camelCased, annotated with `// camelCased from X via Axios interceptor` comments matching this file's convention), and a `FetchPlanTiersResponse { planTiers: PlanTier[] }` wrapper interface.

---

### `frontend/src/assets/api/onboarding/getPlanTiers.ts` (service, NEW)

**Analog:** `frontend/src/assets/api/onboarding/checkDomain.ts`

**Full pattern** (lines 1-18):
```typescript
import api from '@/assets/axios/axios'

export interface CheckDomainParams {
    subdomain?: string
    custom_domain?: string
}

export interface CheckDomainResult {
    subdomain?: boolean
    customDomain?: boolean
}

const checkDomain = async (params: CheckDomainParams): Promise<CheckDomainResult> => {
    const response = await api.get('/v1/onboarding/domains/check', { params })
    return response.data
}

export default checkDomain
```
Adapt directly: no params needed for `getPlanTiers` (GET with no query string), import the `PlanTier` type from `@/assets/types/planTierType` instead of declaring the interface inline, return `response.data.planTiers` (unwrap the `plan_tiers` key, camelCased by the global interceptor to `planTiers`). **Never call `camelcaseKeys` manually** — the axios instance already deep-camelCases (CLAUDE.md rule); this file, like its analog, returns `response.data` (or an unwrapped field of it) directly.

---

### `frontend/src/store/hooks/Auth/useFetchPlanTiers.ts` (hook, NEW)

**Analog:** `frontend/src/store/hooks/Auth/useCheckDomainAvailability.ts`

**Full pattern** (lines 1-14):
```typescript
import { useQuery } from '@tanstack/react-query'
import checkDomain, { CheckDomainParams } from '@/assets/api/onboarding/checkDomain'

const useCheckDomainAvailability = (params: CheckDomainParams, enabled: boolean) => {
    return useQuery({
        queryKey: ['checkDomain', params],
        queryFn: () => checkDomain(params),
        enabled,
        staleTime: 10_000,
        retry: false,
    })
}

export default useCheckDomainAvailability
```
Adapt: no params/`enabled` flag needed (fetches unconditionally on mount), `queryKey: ['planTiers']`, `queryFn: getPlanTiers`, `staleTime: 5 * 60_000` (plan config changes rarely — longer stale time than the debounced availability check). Model this hook on the **query** shape here, not the **mutation** shape of `useCreateBrokerage.ts` — `plan_tiers` is a read, not a write.

---

### `frontend/src/store/reducers/createBrokerageWizard.ts` (store, type widening)

**Exact line to change** (line 3):
```typescript
export type CreateBrokeragePlan = 'basic' | 'premium'
```
becomes:
```typescript
export type CreateBrokeragePlan = 'free' | 'independent' | 'growth'
```
No other reducer logic changes — `setPlan`, `defaultCreateBrokerageWizardState` (`plan: null`), and `replaceWizard` all reference the type generically and require no edits.

---

### `frontend/src/assets/api/onboarding/createBrokerage.ts` (service, type widening — Pitfall 1)

**Exact duplicate declaration to fix** (line 3):
```typescript
export type CreateBrokeragePlan = 'basic' | 'premium'
```
This is a **second, independent** declaration of the same type name — not imported from the reducer. Per RESEARCH.md Pitfall 1, either:
1. Change this line's literal union to `'free' | 'independent' | 'growth'` in lockstep with the reducer file, or
2. (cleaner) Replace with `import { CreateBrokeragePlan } from '@/store/reducers/createBrokerageWizard'` and drop the local re-declaration.

Either fix must be applied — widening only the reducer file leaves `CreateBrokerageRequest.plan` rejecting `'growth'`/`'independent'` at the `createMutation.mutateAsync(payload)` call site in `CreateBrokerageContext.tsx`.

---

### `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` (provider, `submit()`)

**Exact line to change** (line 97, inside `submit`, lines 88-130):
```typescript
const payload = {
    plan: wizard.plan,
    subdomain: domain.subdomain,
    ...(wizard.plan === 'premium' && domain.customDomain
        ? { custom_domain: domain.customDomain }
        : {}),
    ...
```
becomes (per CONTEXT.md Integration Points): send `custom_domain` whenever present **and** `plan !== 'free'`:
```typescript
...(wizard.plan !== 'free' && domain.customDomain
    ? { custom_domain: domain.customDomain }
    : {}),
```
No other part of `submit()` (error handling, `toast.error`, `dispatch(reset())`) needs to change — this file's existing try/catch-then-toast pattern (lines 111-120) is the established error-handling convention for mutation calls and should be left as-is.

---

### `frontend/src/containers/createBrokerage/steps/PlanSelectionStep.tsx` (component, GET-on-mount + 3 cards)

**Current structure to replace** (lines 1-53, in full) — hardcoded `BASIC_FEATURES`/`PREMIUM_FEATURES` arrays and a static 2-card grid:
```tsx
import PlanCard from '@/components/createBrokerage/PlanCard'
import { useCreateBrokerageContext } from '@/containers/createBrokerage/CreateBrokerageContext'

const BASIC_FEATURES = [ ... ]
const PREMIUM_FEATURES = [ ... ]

const PlanSelectionStep: React.FC = () => {
    const { actions } = useCreateBrokerageContext()
    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-10">
            <div className="mb-8 text-center">...</div>
            <div className="grid gap-6 sm:grid-cols-2">
                <PlanCard plan="basic" ... />
                <PlanCard plan="premium" ... recommended ... />
            </div>
        </div>
    )
}
```
Replace hardcoded arrays with `const { data, isLoading, isError, refetch } = useFetchPlanTiers()`, derive feature-list bullets per tier from the fetched `PlanTier` flags + D-02's seat-cap wording (do not hardcode the feature text either — build it from `data.planTiers` flags + a small per-tier label map), and change grid to `sm:grid-cols-3` for 3 cards.

**Loading state pattern** (analog: `frontend/src/components/dashboard/general/GroupMapPanel.tsx` lines 133-139):
```tsx
if (isLoading && coordinates.length === 0) {
    return (
        <PanelShell>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </PanelShell>
    )
}
```
Adapt: no `PanelShell` (that's a map-specific wrapper) — instead follow UI-SPEC.md's exact directive: `<Loader2 className="h-5 w-5 animate-spin" /> Loading plan details…` centered below the page heading, replacing the 3-card grid region.

**Error state + retry pattern** (analog: `frontend/src/containers/auth/BrokerageContact.tsx` lines 33-40):
```tsx
{contactQuery.isError && (
    <div className="space-y-2">
        <div className="text-sm text-destructive" role="alert">
            Unable to load brokerage contact info.
        </div>
        <Button variant="outline" onClick={() => contactQuery.refetch()}>
            Retry
        </Button>
    </div>
)}
```
Adapt copy per UI-SPEC.md: heading "Couldn't load plan details", body "We couldn't load pricing information. Check your connection and try again.", `Retry` button calling `refetch()` from `useFetchPlanTiers()`.

---

### `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` (component, 3-way gating + Yes/No toggle)

**Analog:** itself (structural reference) + `RemoveOwnerDialog.tsx` for the toggle

**All `isPremium` occurrences to re-scope** (verified 5 sites — grep before considering the refactor complete, per RESEARCH.md Pitfall 4):
- Line 15: `const isPremium = state.plan === 'premium'` → replace with a plan-based check, e.g. `const showCustomDomain = state.plan !== 'free'`
- Line 35: `const customDomainCheckEnabled = isPremium && ...` → `showCustomDomain && ownsCustomDomain && ...`
- Line 59-61: required-field validation block → **delete entirely** (no tier requires custom domain per D-05; anti-pattern explicitly called out in RESEARCH.md)
- Line 80: `const isDomainError = isPremium && (message.toLowerCase()...)` → re-scope to `showCustomDomain && (...)` — **this line is not in CONTEXT.md's explicit line list and is easy to miss**
- Line 95-98: description copy `isPremium ? '...' : '...'` → 3-way copy (or 2-way: free vs. not-free, matching D-04's free/paid split)

**New Yes/No toggle pattern** (analog: `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx` lines 95-102):
```tsx
<RadioGroup value={selectedRole} onValueChange={(v) => setSelectedRole(v as DemoteTargetRole)}>
    {ROLE_OPTIONS.map((role) => (
        <div key={role} className="flex items-center space-x-2">
            <RadioGroupItem value={role} id={`role-${role}`} />
            <Label htmlFor={`role-${role}`} className="capitalize font-normal">{role}</Label>
        </div>
    ))}
</RadioGroup>
```
Adapt to a fixed Yes/No pair (per UI-SPEC.md copy contract):
```tsx
<RadioGroup value={ownsCustomDomain ? 'yes' : 'no'} onValueChange={(v) => setOwnsCustomDomain(v === 'yes')}>
    <div className="flex items-center space-x-2">
        <RadioGroupItem value="yes" id="owns-domain-yes" />
        <Label htmlFor="owns-domain-yes" className="font-normal">Yes, I own one</Label>
    </div>
    <div className="flex items-center space-x-2">
        <RadioGroupItem value="no" id="owns-domain-no" />
        <Label htmlFor="owns-domain-no" className="font-normal">No, not yet</Label>
    </div>
</RadioGroup>
```
Default `ownsCustomDomain` state to `false` (No/collapsed) per D-05 + UI-SPEC.md. When `true`, reveal the existing `Input`/`Label`/error/availability-check block (lines 120-143, structurally unchanged — same `SubdomainInput`-style Input + `useCheckDomainAvailability` wiring, just now gated on `ownsCustomDomain` instead of always-rendered-when-`isPremium`). When `false`, show the reassurance line ("That's alright — you can add a custom domain anytime from Settings.") per UI-SPEC.md copy contract instead of the input.

**Reused as-is (no changes needed):** the `SubdomainInput` component, the `useCheckDomainAvailability` hook wiring (lines 37-43), the debounce `useEffect` pattern (lines 24-32), and the domain-format regex validator.

---

### `frontend/src/components/createBrokerage/PlanCard.tsx` (component, mostly unchanged)

**No changes required to logic** — the component already generically accepts any `CreateBrokeragePlan` value via its `plan: CreateBrokeragePlan` prop (line 14) and `onSelect: (plan: CreateBrokeragePlan) => void` (line 19). Once the type widens in the reducer, this component automatically supports the 3rd tier. Full existing pattern (lines 22-59) — feature-list rendering with `CheckCircle`/`line-through` for excluded features, `recommended` badge positioning (lines 25-29), `Select {title}` button copy (line 53) — is reused verbatim for the `growth` card; only the call site (`PlanSelectionStep.tsx`) changes what data it passes in.

---

### `frontend/src/components/createBrokerage/PlanBadge.tsx` (component, 3-way label lookup)

**Current binary pattern to replace** (full file, lines 1-23):
```tsx
import { Badge } from '@/components/ui/badge'
import { CreateBrokeragePlan } from '@/store/reducers/createBrokerageWizard'

interface PlanBadgeProps {
    plan: CreateBrokeragePlan
}

const PlanBadge: React.FC<PlanBadgeProps> = ({ plan }) => {
    const isPremium = plan === 'premium'
    return (
        <Badge variant={isPremium ? 'default' : 'secondary'} className="mb-2 w-fit">
            {isPremium ? 'Premium Brokerage Creation' : 'Basic Brokerage Creation'}
        </Badge>
    )
}
```
Replace the binary `isPremium` check with a lookup map keyed by the 3-way `CreateBrokeragePlan` union, e.g.:
```tsx
const PLAN_LABELS: Record<CreateBrokeragePlan, string> = {
    free: 'Free Brokerage Creation',
    independent: 'Independent Brokerage Creation',
    growth: 'Growth Brokerage Creation',
}
const PLAN_VARIANTS: Record<CreateBrokeragePlan, 'default' | 'secondary'> = {
    free: 'secondary',
    independent: 'secondary',
    growth: 'default',
}
```
Keeps the `Badge` primitive and `className="mb-2 w-fit"` styling identical — only the derivation of `variant`/label text changes from a boolean check to a keyed lookup.

## Shared Patterns

### Onboarding controller guard header (backend)
**Source:** `backend/app/controllers/v1/onboarding/domains_controller.rb` lines 1-7, reinforced by `backend/app/controllers/concerns/main_domain_only.rb`
**Apply to:** `plan_tiers_controller.rb` (new)
```ruby
module V1
  module Onboarding
    class PlanTiersController < ApplicationController
      include MainDomainOnly
      include CognitoAuth

      before_action :authenticate_cognito_user!
```
`MainDomainOnly` rejects non-main-domain `Origin`/`Host` with 403 (frontend-guard-is-UX-only, backend-403-is-real-boundary — per the concern's own doc comment). `CognitoAuth#authenticate_cognito_user!` verifies the JWT. Every sibling `onboarding` controller (`DomainsController`, `BrokeragesController`) uses this exact two-concern header — no deviation for the new controller.

### Data-flow chain (frontend)
**Source:** CLAUDE.md, reinforced by `checkDomain.ts` → `useCheckDomainAvailability.ts` → `DomainStep.tsx`
**Apply to:** all 3 new frontend files (`planTierType.ts`, `getPlanTiers.ts`, `useFetchPlanTiers.ts`) plus `PlanSelectionStep.tsx`
```
assets/types/planTierType.ts (interfaces)
  -> assets/api/onboarding/getPlanTiers.ts (pure axios GET, returns response.data.planTiers)
  -> store/hooks/Auth/useFetchPlanTiers.ts (useQuery wrapper)
  -> containers/createBrokerage/steps/PlanSelectionStep.tsx (consumes hook directly — no context-level state needed, since plan-tier data has no cross-step lifetime requirement)
```
Never call `camelcaseKeys` in `getPlanTiers.ts` — the global Axios interceptor (`assets/axios/axios.ts`) already deep-camelCases every response.

### Loading/error state for GET-on-mount (frontend)
**Source:** `frontend/src/containers/auth/BrokerageContact.tsx` lines 29-42 (isLoading/isError/refetch) and `frontend/src/components/dashboard/general/GroupMapPanel.tsx` lines 133-148 (Loader2 spinner + retry copy)
**Apply to:** `PlanSelectionStep.tsx` (new network dependency — see RESEARCH.md Pitfall 3)
```tsx
{contactQuery.isLoading && (
    <div className="text-sm text-muted-foreground">Loading brokerage contact info…</div>
)}
{contactQuery.isError && (
    <div className="space-y-2">
        <div className="text-sm text-destructive" role="alert">Unable to load brokerage contact info.</div>
        <Button variant="outline" onClick={() => contactQuery.refetch()}>Retry</Button>
    </div>
)}
```
No `skeleton.tsx` primitive exists in this codebase — use the `Loader2`/`animate-spin` spinner convention (also used in `SuccessStep.tsx` line 73, `RemoveOwnerDialog.tsx` line 131), not a new skeleton component, per UI-SPEC.md's explicit instruction.

### RadioGroup as binary/small-set choice (frontend)
**Source:** `frontend/src/components/ui/radio-group.tsx` (primitive) + `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx` lines 95-102 (usage)
**Apply to:** `DomainStep.tsx`'s new Yes/No custom-domain-ownership toggle
No new shadcn primitive needed — `RadioGroup`/`RadioGroupItem` already installed and already used for an identical "pick one of a small fixed set" UX in this repo.

## No Analog Found

None — every file in this phase's scope has a direct, verified in-repo analog. This phase is disciplined reuse/type-widening, not new construction (per RESEARCH.md's explicit framing).

## Metadata

**Analog search scope:** `backend/app/controllers/v1/onboarding/`, `backend/app/constants/`, `backend/config/routes.rb`, `frontend/src/assets/{types,api,axios}/`, `frontend/src/store/{hooks,reducers}/`, `frontend/src/containers/createBrokerage/`, `frontend/src/components/createBrokerage/`, `frontend/src/components/ui/radio-group.tsx`, `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx`, `frontend/src/components/dashboard/general/GroupMapPanel.tsx`, `frontend/src/containers/auth/BrokerageContact.tsx`
**Files scanned:** 20 (all read in full via targeted single-pass Read calls; no file exceeded 300 lines, no re-reads)
**Pattern extraction date:** 2026-07-22

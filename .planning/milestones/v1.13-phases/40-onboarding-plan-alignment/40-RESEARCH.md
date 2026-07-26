# Phase 40: Onboarding Plan Alignment - Research

**Researched:** 2026-07-22
**Domain:** Rails JSON API (thin GET endpoint over a code constant) + React/TanStack Query wizard step rebuild
**Confidence:** HIGH

## Summary

This phase is a pure "wire up existing config to existing UI shape" job — no new libraries, no new architectural patterns, no new backend model. `AppConstants::PLAN_TIERS` (shipped in v1.12 Phase 36) is already the single source of truth for pricing/seat caps/capability flags, and `Brokerage#plan` already validates against `%w[free independent growth]` — the *only* things still emitting or requiring the retired `basic`/`premium` strings are three frontend files (`createBrokerageWizard.ts`, `PlanSelectionStep.tsx`, `PlanBadge.tsx`, `DomainStep.tsx`, `CreateBrokerageContext.tsx`, `createBrokerage.ts`) and one backend validation line (`brokerages_controller.rb:34-36`). Every claim in CONTEXT.md's `<code_context>` was verified directly against the current files and matches (line numbers are off by 1-3 in a couple of spots due to comment lines, noted below, but the described logic is accurate).

The new backend surface is a single `GET /v1/onboarding/plan_tiers` action. The codebase already has a precedent for rendering a plain hash with no model/serializer class for a non-AR, non-persisted read (`V1::Onboarding::DomainsController#check`) — that is the pattern to follow, not a full `ActiveModel::Serializer` class. The frontend fetch follows the established `assets/api` → `store/hooks` → Context/Component pipeline exactly as CONTEXT.md describes, and there is a directly-analogous read-only GET+TanStack-`useQuery` pair already in the same `onboarding` namespace (`checkDomain.ts` / `useCheckDomainAvailability.ts`) to model the new hook after, rather than the mutation-shaped `useCreateBrokerage.ts`.

For the Yes/No custom-domain-ownership toggle (D-05), the codebase has no `Switch`/`Toggle` shadcn primitive installed — only `radio-group.tsx` exists, and it's already used for exactly this kind of binary/few-option choice (`RemoveOwnerDialog.tsx`). Recommendation: build the toggle with the existing `RadioGroup`/`RadioGroupItem` (styled as two side-by-side pill buttons or a plain two-item radio list) rather than introducing a new shadcn component for a single use site.

**Primary recommendation:** Follow the existing `onboarding` GET-endpoint pattern (plain hash render, no serializer class) for `plan_tiers`; widen `CreateBrokeragePlan` to a 3-value union in one place (`createBrokerageWizard.ts`) and let TypeScript's compiler flag every other file that needs updating; build the Yes/No toggle with `RadioGroup`, not a new primitive.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Plan-tier data (price, seat cap, feature flags) | API / Backend | — | `AppConstants::PLAN_TIERS` is the single source of truth per D-01; frontend must never hardcode a mirrored copy |
| Plan-selection UI (cards, feature lists, recommended badge) | Browser / Client | — | Pure presentational rendering of the fetched plan-tier data; no server-side rendering in this SPA |
| Custom-domain-ownership toggle UX (Yes/No, reveal/hide input) | Browser / Client | — | Client-only UI state; the field was already optional server-side pre-phase for non-Growth tiers, now uniformly optional |
| Plan validity + custom-domain requirement enforcement | API / Backend | — | `brokerages_controller.rb#create` is the real security/business-rule boundary (frontend guards are UX-only per existing `MainDomainOnly` doc comment precedent) |
| Brokerage creation transaction (brokerage + domains + membership) | API / Backend | Database / Storage | Already implemented, untouched by this phase except removing the Growth-requires-domain check |

## User Constraints

<user_constraints>
### Locked Decisions

- **D-01:** Add a new public (Cognito-authenticated, main-domain-only — same guards as the existing `onboarding` namespace) `GET /v1/onboarding/plan_tiers` endpoint that serializes `AppConstants::PLAN_TIERS` (price/mo, seat cap, and capability flags per tier). The frontend fetches this on mount of the plan-selection step rather than hardcoding a mirrored TS constant — single source of truth stays in the backend config, no risk of the two drifting.
  - Route lives under the existing `namespace :onboarding` block in `backend/config/routes.rb` (alongside `resource :brokerage` and `resources :domains`), e.g. `resources :plan_tiers, only: [:index]`.
  - No new controller pattern needed beyond a thin serializer over `AppConstants::PLAN_TIERS` — return price in dollars (not cents) for direct frontend display.
- **D-02:** Feature list bullets mirror the flags already defined in `AppConstants::PlanTier` (real_boards, clients, custom_domain, calendar_sync) plus seat-cap wording: "1 seat" (Independent), "5 seats" (Growth), "Unlimited seats" (Free — since Free has no seat cap per `PLAN-TIERS.md`).
- **D-03:** Growth is the visually "Recommended" tier (replaces Premium's current badge position) — it's the flagship paid tier per `PLAN-TIERS.md`.
  - Card copy should draw from `.planning/PLAN-TIERS.md`'s tier descriptions (Free = acquisition funnel / TEST board, Independent = entry paid tier, Growth = team tier) rather than inventing new marketing copy.
- **D-04:** Free shows no custom domain field at all (unchanged region of `DomainStep.tsx`, just re-gated on `plan !== 'free'` instead of `plan === 'premium'`).
- **D-05:** For Independent/Growth, add a Yes/No toggle: **"Do you currently own a custom domain?"** with a subheader mentioning where to get one if they don't (e.g., domain broker examples — GoDaddy, Namecheap, Google Domains; final wording is Claude's discretion per user).
  - Clicking **Yes** reveals the existing custom domain input (still optional to actually fill in and submit — no required-field validation).
  - Clicking **No** hides the input and shows a reassuring line, e.g. "That's alright — you can add a custom domain later from Settings."
  - This replaces the current `isPremium`-gated required-field pattern in `DomainStep.tsx` (lines 59-62 validation, line 96-98 description copy) entirely — no tier requires a custom domain to complete signup.

### Claude's Discretion

- Exact wording of the domain-broker subheader/examples and the "no" reassurance message — user explicitly delegated this ("use your own wording").
- Whether the Yes/No toggle defaults to Yes or No on first render (recommend defaulting to No/collapsed, since most signups won't have a domain ready yet).
- Internal naming for the new plan-tier serializer/service object.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

Phase boundary explicitly excludes: annual billing toggle, Phase 41's admin/settings plan-change UI, real payment processing (BILL-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONB-05 | Plan-selection step shows Free/Independent/Growth, each with price/mo, seat cap, and feature list sourced from `AppConstants::PLAN_TIERS` | New `GET /v1/onboarding/plan_tiers` endpoint (pattern below) + `PlanCard.tsx`/`PlanSelectionStep.tsx` rewrite consuming it via new hook |
| ONB-06 | Custom domain field optional for Independent/Growth, absent for Free; backend growth-requires-domain check removed | `DomainStep.tsx` Yes/No toggle rebuild (D-05) + one-line removal in `brokerages_controller.rb:34-36` |
| ONB-07 | Wizard submits correct plan value (`free`/`independent`/`growth`) and creates brokerage end-to-end for all three tiers | `CreateBrokeragePlan` type widening in `createBrokerageWizard.ts` propagated through `CreateBrokerageContext.tsx`, `createBrokerage.ts`, `PlanCard.tsx`, `PlanBadge.tsx` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Data flow:** `Component → Context (Brain) → TanStack Hook → API module → Axios instance`. The new plan-tiers fetch must follow this exact chain: `assets/api/onboarding/getPlanTiers.ts` → `store/hooks/Auth/useFetchPlanTiers.ts` (or a new `store/hooks/Onboarding/` — see Open Questions) → consumed in `PlanSelectionStep.tsx` (which today has no context-level state for plan-tier data; it currently only reads `actions.selectPlan` from `CreateBrokerageContext`).
- **Never call `camelcaseKeys` in hooks** — the global Axios interceptor already deep-camelCases every response. The new endpoint should be designed so its Ruby response keys (`snake_case`) convert cleanly to camelCase (e.g. `base_price_cents` → `basePriceCents`, or better, pre-convert to dollars server-side per D-01 so the frontend never touches cents).
- **Domain interfaces belong in `assets/types/` before hooks/contexts reference them** — a new `assets/types/planTierType.ts` is required before writing the hook, per the existing pattern in `domainType.ts`/`brokerageType.ts`.
- **Icons:** `lucide-react` only — `PlanCard.tsx` already uses `CheckCircle` from `lucide-react`; reuse for the 3rd card.
- **Styling:** Tailwind utility classes; shadcn/ui components only. No new shadcn primitive needs to be added for this phase (see Standard Stack — RadioGroup already covers the Yes/No toggle).
- **Never call axios/API functions directly inside a component** — always through a hook. `PlanSelectionStep.tsx` currently violates nothing (it has no direct fetch), but the rewrite must route the new plan-tiers fetch through `useFetchPlanTiers`, not inline `axios`/`api` calls.
- **Frontend UI/UX standard (project-wide directive, also reinforced by user's auto-memory `feedback_frontend_uiux_standard.md`):** loading/error/empty states must be deliberate. The new plan-selection step needs an explicit loading skeleton/spinner state while `GET /plan_tiers` is in flight (currently there is zero network dependency on this step — this is new), and an error state if the fetch fails (e.g. retry affordance — the wizard has no existing error-state precedent for a GET-on-mount, only for mutations via `toast.error`).
- **Backend soft-delete rule (`acts_as_paranoid`)** — not directly relevant here since `AppConstants::PLAN_TIERS` is a Ruby constant, not an ActiveRecord model; no `.without_deleted` scoping applies to this endpoint.
- **Pagination rule (Pagy, cap at 100)** — not applicable; `plan_tiers` returns exactly 3 fixed records, no pagination needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Ruby on Rails | 7.1 (existing) | `GET /v1/onboarding/plan_tiers` controller action | Already the framework; no new gem needed — `render json:` on a plain Hash is sufficient, matching `DomainsController#check` |
| active_model_serializers | existing (per CLAUDE.md) | Not required for this endpoint — see Architecture Patterns | Existing serializers (`BrokerageSerializer`, `BrokerageDomainSerializer`) all wrap ActiveRecord instances; `PLAN_TIERS` is a plain `Struct` hash, and the codebase's own precedent (`DomainsController#check`) renders a hand-built hash directly, bypassing AMS entirely for non-AR data |
| @tanstack/react-query | existing (already used repo-wide) | `useFetchPlanTiers` query hook | Already the established data-fetching layer per CLAUDE.md |
| React 18 / TypeScript | existing | Component rewrite | No version change needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui `radio-group` | existing (`components/ui/radio-group.tsx`) | Yes/No custom-domain-ownership toggle | Already installed and already used for a structurally identical "pick one of a small fixed set" UI in `RemoveOwnerDialog.tsx` |
| lucide-react | existing | `CheckCircle` icon on feature list rows (existing `PlanCard.tsx` usage), optionally a `Loader2` spinner for the new fetch-loading state (already used elsewhere, e.g. `RemoveOwnerDialog.tsx`) | Icons only via this package per CLAUDE.md |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `render json:` hash for `plan_tiers` | A dedicated `PlanTierSerializer < ActiveModel::Serializer` | AMS serializers in this codebase are designed around ActiveRecord instances (`object.attribute`); `PlanTier` is a plain `Struct`, not an AR model, so AMS adds indirection with no benefit. A plain hash-builder (private method or small PORO) matches the `DomainsController#check` precedent and is simpler to test. |
| shadcn `radio-group` for Yes/No toggle | Two `Button` components with pressed/active styling (a manual segmented control) | RadioGroup is more accessible out of the box (native radio semantics, keyboard nav) and has a direct precedent in this repo; a manual button-pair would need bespoke ARIA work for no visual benefit, since RadioGroup can be styled as pills via Tailwind if the default radio-dot look is undesired. |
| Widening `CreateBrokeragePlan` union type | Adding a `PlanTier` string literal type duplicated across files | CONTEXT.md's Integration Points already identify all 6 files touching this type; a single source-of-truth union in `createBrokerageWizard.ts` (already imported everywhere it's used) avoids drift, consistent with the "domain interfaces in `assets/types/`" rule — though this specific union is a reducer-owned type, not a domain type, so it correctly stays in the reducer file per existing convention (`CreateBrokeragePlan` is already defined there, not in `assets/types/`). |

**Installation:** No new packages required — every library used is already a dependency in both `backend/Gemfile` and `frontend/package.json`.

**Version verification:** N/A — no new package versions to verify (see Package Legitimacy Audit below).

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new external dependencies on either the Rails or npm side — it exclusively reuses already-installed gems (`active_model_serializers`, `activesupport`) and already-installed npm packages (`@tanstack/react-query`, `lucide-react`, shadcn `radio-group`/`badge`/`card`/`button`/`input`/`label`). No `slopcheck`/registry verification step is required.

## Architecture Patterns

### System Architecture Diagram

```
[Browser: PlanSelectionStep mounts]
        |
        v
useFetchPlanTiers() (TanStack useQuery, GET, no params)
        |
        v
getPlanTiers.ts  --GET /v1/onboarding/plan_tiers-->  [Axios instance, attaches Cognito idToken]
                                                              |
                                                              v
                                          V1::Onboarding::PlanTiersController#index
                                          (MainDomainOnly + CognitoAuth guards, same as sibling onboarding controllers)
                                                              |
                                                              v
                                          AppConstants::PLAN_TIERS.map { |key, tier| {...} }
                                          (price in dollars, seat_cap, capability flags)
                                                              |
                                                              v
                                          render json: { plan_tiers: [...] }
        |
        v
Response deep-camelCased by global Axios interceptor
        |
        v
PlanSelectionStep renders 3x PlanCard (Free / Independent / Growth)
        |
        v
User clicks "Select {tier}" --> actions.selectPlan('free'|'independent'|'growth')
        |
        v
CreateBrokerageWizard reducer: setPlan(payload)  [Redux, unchanged mechanism]
        |
        v
... branding -> info -> domain steps (existing flow, DomainStep now gates on plan !== 'free') ...
        |
        v
CreateBrokerageContext#submit() -> POST /v1/onboarding/brokerage
        |
        v
V1::Onboarding::BrokeragesController#create
  - plan validity check (unchanged, already accepts any AppConstants::PLAN_TIERS key)
  - "Growth requires custom_domain" check REMOVED (ONB-06 / success criterion 4)
  - transaction: Brokerage.create! -> BrokerageDomain (subdomain) -> BrokerageDomain (custom, if present) -> BrokerageMembership (owner)
        |
        v
201 Created -> SuccessStep -> dashboard redirect (existing, unchanged)
```

### Recommended Project Structure

Backend (new files only; everything else already exists):
```
backend/app/controllers/v1/onboarding/
└── plan_tiers_controller.rb      # NEW — GET #index, MainDomainOnly + CognitoAuth, renders AppConstants::PLAN_TIERS
backend/config/routes.rb          # MODIFIED — add `resources :plan_tiers, only: [:index]` inside namespace :onboarding
backend/app/controllers/v1/onboarding/brokerages_controller.rb  # MODIFIED — delete lines 34-36 (Growth custom_domain check)
```

Frontend (new + modified):
```
frontend/src/assets/types/
└── planTierType.ts               # NEW — PlanTierKey union + PlanTier interface (price, seatCap, flags)
frontend/src/assets/api/onboarding/
└── getPlanTiers.ts                # NEW — pure axios GET, mirrors checkDomain.ts shape
frontend/src/store/hooks/Auth/     # (existing dir — CONTEXT.md's canonical_refs location for the new hook)
└── useFetchPlanTiers.ts          # NEW — useQuery wrapper, mirrors useCheckDomainAvailability.ts
frontend/src/store/reducers/
└── createBrokerageWizard.ts      # MODIFIED — CreateBrokeragePlan = 'free' | 'independent' | 'growth'
frontend/src/containers/createBrokerage/
├── CreateBrokerageContext.tsx    # MODIFIED — submit() sends custom_domain whenever present && plan !== 'free'
└── steps/
    ├── PlanSelectionStep.tsx     # MODIFIED — fetch plan tiers, render 3 cards, loading/error states
    └── DomainStep.tsx            # MODIFIED — isPremium -> plan-based gating + new Yes/No toggle (RadioGroup)
frontend/src/components/createBrokerage/
├── PlanCard.tsx                  # MOSTLY UNCHANGED — CreateBrokeragePlan type widens automatically via import
└── PlanBadge.tsx                 # MODIFIED — 3-way plan-label lookup instead of isPremium boolean
frontend/src/assets/api/onboarding/
└── createBrokerage.ts            # MODIFIED — CreateBrokeragePlan re-exported type widens (imports from reducer, or re-declares — verify which; currently re-declares independently, see Common Pitfalls)
```

### Pattern 1: Non-AR "config as endpoint" controller (backend)

**What:** A GET action that serializes a plain Ruby constant/Struct collection with no ActiveRecord model or AMS serializer class, following the exact precedent already in the same namespace.

**When to use:** Any onboarding endpoint whose data source is a code-level constant, not a database row (this is the `plan_tiers` case).

**Example (pattern to follow, adapted from the actual `DomainsController#check` in this repo):**
```ruby
# Source: backend/app/controllers/v1/onboarding/domains_controller.rb (existing, verified)
module V1
  module Onboarding
    class PlanTiersController < ApplicationController
      include MainDomainOnly
      include CognitoAuth

      before_action :authenticate_cognito_user!

      # GET /v1/onboarding/plan_tiers
      def index
        tiers = AppConstants::PLAN_TIERS.map do |key, tier|
          {
            key: key,
            price_per_month: tier.base_price_cents / 100.0,
            seat_cap: tier.seat_cap, # nil for Free = unlimited
            real_boards: tier.real_boards,
            clients: tier.clients,
            custom_domain: tier.custom_domain,
            calendar_sync: tier.calendar_sync
          }
        end

        render json: {plan_tiers: tiers}, status: :ok
      end
    end
  end
end
```

**Verified against actual file:** `backend/app/controllers/v1/onboarding/domains_controller.rb` lines 1-27 use the identical `include MainDomainOnly` / `include CognitoAuth` / `before_action :authenticate_cognito_user!` header and a bare `render json: result, status: :ok` for non-AR data — confirms this is the established convention, not a hypothesis.

### Pattern 2: Read-only GET query hook (frontend)

**What:** `assets/api` pure-axios function + `store/hooks` `useQuery` wrapper, for a GET endpoint with no mutation side effects.

**When to use:** `useFetchPlanTiers` — model directly on `useCheckDomainAvailability`, not on `useCreateBrokerage` (which is a `useMutation` for the POST).

**Example (verified pattern from actual repo files):**
```typescript
// Source: frontend/src/assets/api/onboarding/checkDomain.ts (existing, verified) — adapt shape for getPlanTiers.ts
import api from '@/assets/axios/axios'
import { PlanTier } from '@/assets/types/planTierType'

const getPlanTiers = async (): Promise<PlanTier[]> => {
    const response = await api.get('/v1/onboarding/plan_tiers')
    return response.data.planTiers // camelCased by global interceptor from plan_tiers
}

export default getPlanTiers
```
```typescript
// Source: frontend/src/store/hooks/Auth/useCheckDomainAvailability.ts (existing, verified) — adapt for useFetchPlanTiers.ts
import { useQuery } from '@tanstack/react-query'
import getPlanTiers from '@/assets/api/onboarding/getPlanTiers'

const useFetchPlanTiers = () => {
    return useQuery({
        queryKey: ['planTiers'],
        queryFn: getPlanTiers,
        staleTime: 5 * 60_000, // plan config changes rarely; avoid refetch-per-mount thrash
    })
}

export default useFetchPlanTiers
```

### Pattern 3: RadioGroup as a binary toggle (frontend)

**What:** Two-option `RadioGroup`/`RadioGroupItem` pair, verified in active use in `RemoveOwnerDialog.tsx` for role selection.

**Example (verified pattern from actual repo file, adapted for Yes/No):**
```tsx
// Source: frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx lines 95-102 (existing, verified)
<RadioGroup value={ownsDomain ? 'yes' : 'no'} onValueChange={(v) => setOwnsDomain(v === 'yes')}>
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

### Anti-Patterns to Avoid

- **Hardcoding a mirrored TS plan-tier constant:** D-01 explicitly rejects this — always fetch from `GET /v1/onboarding/plan_tiers`. A hardcoded frontend copy of price/seat-cap text is exactly the drift risk `AppConstants::PLAN_TIERS` (v1.12 Phase 36) was built to eliminate.
- **Wrapping `AppConstants::PLAN_TIERS` in an `ActiveModel::Serializer`:** adds a class that expects `object.method_name` AR-style access for no benefit over a plain hash-map in the controller (see Pattern 1 and Alternatives Considered).
- **Required-field validation on custom domain for any tier:** D-04/D-05 explicitly make it optional everywhere; the removed backend check (`brokerages_controller.rb:34-36`) must not be replaced by an equivalent frontend-only required-field rule — none should exist anywhere in the new `DomainStep.tsx`.
- **Per-record DB queries in the new endpoint:** not applicable here (no persisted records), but worth noting since `AssociationLoader`/N+1 rules are a project-wide convention — the new endpoint should never touch the DB at all, since `PLAN_TIERS` is an in-memory Ruby constant.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Binary Yes/No toggle UI | A custom `<Switch>`/toggle button component from scratch | Existing `RadioGroup`/`RadioGroupItem` (`components/ui/radio-group.tsx`) | Already installed, already accessible, already has a repo precedent for an identical "pick one of N" UX (`RemoveOwnerDialog.tsx`) — adding a new shadcn primitive for one call site is unnecessary surface area |
| Plan-tier price/seat-cap values in the frontend | A second, hand-maintained TS constant mirroring `AppConstants::PLAN_TIERS` | The new `GET /v1/onboarding/plan_tiers` endpoint (D-01) | Two independently-maintained copies of pricing/seat-cap data is exactly the kind of drift bug this phase exists to prevent — the whole point of D-01 |
| Domain-format / availability validation | New regex or new debounce logic in `DomainStep.tsx` | Existing `useCheckDomainAvailability` hook + existing regex validator already in `DomainStep.tsx` (lines 61, unchanged) | These are explicitly called out in CONTEXT.md as reused-as-is; only the *gating condition* (isPremium → plan !== 'free') and the *required-ness* change, not the validation/availability-check mechanics themselves |

**Key insight:** Every piece of infrastructure this phase needs already exists somewhere in the repo (a GET-endpoint pattern, a useQuery-hook pattern, a RadioGroup binary-choice pattern, a plan-tier config constant). The task is disciplined reuse and type-widening, not new construction.

## Common Pitfalls

### Pitfall 1: `CreateBrokeragePlan` is declared independently in two files, not imported from one source

**What goes wrong:** `frontend/src/store/reducers/createBrokerageWizard.ts` line 3 declares `export type CreateBrokeragePlan = 'basic' | 'premium'`, and `frontend/src/assets/api/onboarding/createBrokerage.ts` line 3 **re-declares its own separate** `export type CreateBrokeragePlan = 'basic' | 'premium'` — these are two independent type declarations that happen to have the same name and value today, not one type imported in two places. Widening only one of them leaves the other silently stale (TypeScript won't complain about two same-shaped-but-differently-sourced union types matching, but the `CreateBrokerageRequest.plan` field in `createBrokerage.ts` would still reject `'growth'` as literal type mismatch would surface at the `createMutation.mutateAsync(payload)` call site in `CreateBrokerageContext.tsx` — likely caught by TS, but worth flagging explicitly since it's easy to fix only the reducer file and assume the API module inherited the change).

**Why it happens:** The two files were written independently rather than one importing the other's type.

**How to avoid:** Widen **both** declarations to `'free' | 'independent' | 'growth'` (either by having `createBrokerage.ts` import `CreateBrokeragePlan` from the reducer instead of re-declaring it — the cleaner fix — or by updating both literals in lockstep if keeping them separate is intentional for module-boundary reasons).

**Warning signs:** TypeScript compile error at `createMutation.mutateAsync(payload)` in `CreateBrokerageContext.tsx` if only one of the two type declarations is updated.

### Pitfall 2: `npx tsc --noEmit` is pre-broken repo-wide (documented in STATE.md)

**What goes wrong:** STATE.md's Blockers/Concerns section documents that `tsc --noEmit` fails repo-wide due to a `moduleResolution: "bundler"` vs. installed TypeScript `^4.9.4` mismatch — unrelated to this phase. Don't treat a `tsc` failure during this phase's work as a regression caused by the plan-tier changes; verify by running `tsc` on a clean checkout first if a type error appears, to distinguish pre-existing noise from a real widening bug.

**How to avoid:** Rely on `vitest` (existing test runner) and manual/visual verification of the wizard flow for the three tiers rather than `tsc --noEmit` as a gate, or scope any `tsc` check narrowly to the touched files if the tool supports it.

### Pitfall 3: The plan-tiers GET fetch is a brand-new "loading" dependency for a step that previously had none

**What goes wrong:** `PlanSelectionStep.tsx` today renders instantly from two hardcoded arrays (`BASIC_FEATURES`/`PREMIUM_FEATURES`) with zero network dependency — it's the very first screen after auth. Naively adding `useFetchPlanTiers()` without a loading/error UI means a slow or failed network request either flashes an empty/broken card grid or throws an unhandled promise state, which directly violates the CLAUDE.md UI/UX standard ("never ship a state that looks broken or unfinished") and the project's own `feedback_frontend_uiux_standard.md` convention.

**Why it happens:** Easy to focus on the "happy path" 3-card render and skip the loading/error branches since the existing step never needed them.

**How to avoid:** Explicit `isLoading` skeleton (e.g. 3 skeleton cards or a spinner) and `isError` state (retry button or fallback message) in `PlanSelectionStep.tsx`, following the same care already given to `DomainStep.tsx`'s `checkingAvailability` states.

### Pitfall 4: Backend "Growth requires custom_domain" check removal must not leave orphaned frontend logic

**What goes wrong:** CONTEXT.md correctly scopes the backend removal to `brokerages_controller.rb:34-36` (verified: `if plan == "growth" && custom_domain.blank?` at lines 34-36). But the *frontend* `DomainStep.tsx` also currently branches error-handling around `isPremium` at line 80 (`const isDomainError = isPremium && (message.toLowerCase().includes('domain') ...`) to decide whether a generic backend error should be attributed to the custom-domain field vs. subdomain field. Once the required-domain check is gone and `isPremium` is replaced by a 3-way plan check, this error-attribution logic needs re-scoping too (e.g. to `plan !== 'free'`) or it will misattribute Independent/Growth errors, or fail to attribute them at all once `isPremium` is undefined post-refactor.

**Why it happens:** This line isn't mentioned explicitly in CONTEXT.md's Integration Points list (which calls out lines 15, 59-62, 95-98 but not line 80) — easy to miss during the isPremium-removal pass.

**How to avoid:** Grep for every `isPremium` occurrence in `DomainStep.tsx` (there are 5: lines 15, 35, 59, 61, 80, 95, 119 — verified) before considering the refactor complete, not just the 3 line-ranges CONTEXT.md names.

### Pitfall 5: `custom_domain_record` creation logic in the backend already handles "optional for everyone" correctly — don't touch it

**What goes wrong:** It's tempting to also modify the `if custom_domain.present?` block (lines 77-84) when removing the Growth-required check, but this block already correctly creates a `BrokerageDomain` record whenever `custom_domain` is present, for *any* plan — it was never plan-gated. Only the validation-rejection block (lines 34-36) needs to go.

**How to avoid:** Diff carefully — the fix is a 3-line deletion, not a larger rewrite of the `create` action.

## Code Examples

### Verified: current `brokerages_controller.rb` lines to delete (ONB-06 / success criterion 4)
```ruby
# Source: backend/app/controllers/v1/onboarding/brokerages_controller.rb lines 34-36 (verified exact text)
if plan == "growth" && custom_domain.blank?
  return render json: {error: "Custom domain is required for this plan"}, status: :unprocessable_entity
end
```
Delete this block entirely. No replacement logic needed — `custom_domain` is already optional-and-handled everywhere else in the action.

### Verified: plan validity check that needs NO change
```ruby
# Source: backend/app/controllers/v1/onboarding/brokerages_controller.rb lines 15-18 (verified exact text)
plan = params[:plan].to_s
unless AppConstants::PLAN_TIERS.key?(plan)
  return render json: {error: "Invalid plan"}, status: :unprocessable_entity
end
```
Already generically accepts any of `free`/`independent`/`growth` — confirms CONTEXT.md's claim.

### Verified: `Brokerage` model plan validation (already correct, no phase-40 change needed)
```ruby
# Source: backend/app/models/brokerage.rb line 19 (verified exact text)
validates :plan, inclusion: {in: %w[free independent growth]}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `basic`/`premium` binary plan enum, frontend hardcoded feature arrays | `free`/`independent`/`growth` three-tier model, backend-driven `AppConstants::PLAN_TIERS` config | v1.12 Phase 36 (backend model/constant) — frontend wizard never followed up until this phase | The frontend wizard has been submitting retired values that the backend model validation already rejects (`inclusion: {in: %w[free independent growth]}`), meaning **every signup attempt through the current wizard fails outright** — this phase fixes a fully broken, not just stale, user-facing path |
| "Growth requires custom_domain" (backend-enforced) | Custom domain optional for all paid tiers | Reversed during v1.13 requirements definition (per REQUIREMENTS.md Out of Scope table: "Growth requiring a custom domain at signup... Reversed during requirements definition") | Confirms this is an intentional, already-decided reversal, not a new judgment call for the planner |

**Deprecated/outdated:**
- `basic`/`premium` plan values: fully retired at the model layer already; only frontend wizard code and two `ops/brokerages` admin-tool ERB views (`_form.html.erb`, `show.html.erb`) still reference them as select-option labels. The ops views are **out of scope for this phase** (internal testing tool, not part of ONB-05/06/07's wizard-only boundary per CONTEXT.md) but are noted in Open Questions below since they will silently submit invalid `plan` values if ever used, post this phase's model-layer changes (which already validate against the 3-tier list — so those ops forms are *already* broken today too, independent of this phase).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended internal file names (`plan_tiers_controller.rb`, `getPlanTiers.ts`, `useFetchPlanTiers.ts`, `planTierType.ts`) | Recommended Project Structure | Low — D-01/D-05 explicitly delegate naming to Claude's discretion; these are suggestions, not locked requirements, and the plan-checker/planner is free to rename |
| A2 | Recommending `store/hooks/Auth/` as the location for `useFetchPlanTiers.ts` (mirroring CONTEXT.md's canonical_refs pointer) rather than a new `store/hooks/Onboarding/` directory | Recommended Project Structure | Low — purely organizational; existing `Auth/` dir already holds all onboarding-flow hooks (`useCreateBrokerage`, `useCheckDomainAvailability`, `useUpdateOnboardingProfile`), so this is consistent with current (if slightly misnamed) convention, not a new pattern |
| A3 | `staleTime: 5 * 60_000` for the plan-tiers query cache | Pattern 2 code example | Low — cosmetic performance choice; wrong value doesn't break functionality, only refetch frequency |

**If this table is empty:** N/A — see entries above; all are low-risk implementation-detail suggestions explicitly delegated to Claude's discretion per CONTEXT.md, not load-bearing technical or compliance claims.

## Open Questions (RESOLVED)

1. **Should the two `ops/brokerages` ERB admin-tool views (`_form.html.erb`, `show.html.erb`) that still hardcode `[["Basic", "basic"], ["Premium", "premium"]]` select options be fixed in this phase?**
   - What we know: They are already broken today, independent of this phase — `Brokerage` model validation only accepts `free`/`independent`/`growth`, so submitting "Basic"/"Premium" via these ops forms already fails at the model layer.
   - What's unclear: Whether fixing them is in scope. CONTEXT.md's Phase Boundary describes the target as "the brokerage-creation wizard" and explicitly lists Phase 41 (admin/settings) and BILL-01 (payments) as out of scope, but doesn't mention the internal `/ops` tool either way.
   - Recommendation: Treat as out of scope for Phase 40 (it's a pre-existing, unrelated internal-tooling bug, not part of ONB-05/06/07's wizard-only success criteria) — flag it as a carry-forward item for STATE.md's Deferred Items table if the planner agrees, rather than silently expanding this phase's scope.
   - RESOLVED: Planner excluded `ops/brokerages` from Phase 40 scope; carried forward as a Deferred Item candidate rather than folded in.

2. **Endpoint response shape: flat array vs. keyed-by-tier-name object?**
   - What we know: D-01 says "serializes `AppConstants::PLAN_TIERS`" without specifying JSON shape.
   - What's unclear: Whether the frontend prefers `{ plan_tiers: [{key: "free", ...}, ...] }` (array, ordered `free, independent, growth`) or `{ plan_tiers: { free: {...}, independent: {...}, growth: {...} } }` (object keyed by tier, matching the Ruby constant's own shape).
   - Recommendation: Array — the frontend needs a stable render order (Free, Independent, Growth left-to-right) for the 3-card grid, and Ruby hash insertion order (`free, independent, growth` — verified in `plan_tiers.rb`) already matches the desired display order, so `AppConstants::PLAN_TIERS.map { |key, tier| ... }` naturally produces the correct array order without an explicit sort.
   - RESOLVED: Plans 40-01/40-02/40-03 implement the array shape.

## Environment Availability

No external tools, services, or runtimes beyond the existing Rails/Postgres/Vite dev stack are required for this phase — skipping this section per the "no external dependencies" condition (code/config-only changes to already-running services).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (unchanged) | New `plan_tiers` endpoint reuses existing `CognitoAuth#authenticate_cognito_user!` — no new auth mechanism introduced |
| V3 Session Management | No | No session-state change in this phase |
| V4 Access Control | Yes (unchanged) | New endpoint reuses existing `MainDomainOnly` concern (rejects non-main-domain `Origin`/`Host` with 403) — same guard as sibling `onboarding` controllers, appropriate since plan-tier data is read-only, non-sensitive, and pre-tenant (no brokerage-scoped data leak risk) |
| V5 Input Validation | Yes (unchanged) | `plan_tiers#index` takes no params, so no new input surface. The existing `plan` param validation in `brokerages_controller.rb#create` (`AppConstants::PLAN_TIERS.key?(plan)`) is untouched and already correctly rejects invalid tier values |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Read-only config-leak (plan pricing exposed to unauthenticated or cross-domain callers) | Information Disclosure | Already mitigated by reusing `MainDomainOnly` + `CognitoAuth` — plan pricing is not sensitive (it's public marketing info shown pre-signup on the plan-selection card anyway), so this is a low-severity concern, but the guard reuse keeps the endpoint consistent with its sibling `onboarding` routes rather than being an unguarded outlier |
| Removing the "Growth requires custom_domain" server-side check — regression risk of accidentally removing the plan-validity check alongside it | Tampering | Verified these are two textually separate blocks (lines 15-18 vs. 34-36 in `brokerages_controller.rb`) — the planner/executor must delete only lines 34-36, leaving the `AppConstants::PLAN_TIERS.key?(plan)` check at lines 15-18 fully intact, since that check is the actual security-relevant guard against arbitrary `plan` string injection |

## Sources

### Primary (HIGH confidence — direct file reads in this repo, this session)
- `backend/app/constants/plan_tiers.rb` — `AppConstants::PLAN_TIERS` full definition, verified field names and tier keys
- `backend/app/controllers/v1/onboarding/brokerages_controller.rb` — full current implementation, verified line numbers for both the plan-validity check (15-18) and the Growth-requires-domain check (34-36)
- `backend/app/controllers/v1/onboarding/domains_controller.rb` — verified precedent for plain-hash `render json:` on non-AR data
- `backend/app/controllers/concerns/main_domain_only.rb` — verified guard mechanics
- `backend/app/controllers/ops/plan_controller.rb` — verified existing internal (non-brokerage-owner) plan-transition tool, confirming Phase 41 will need a *new* endpoint per STATE.md's decision log (out of scope for Phase 40, informational only)
- `backend/app/models/brokerage.rb` — verified `plan` validation already restricted to the 3-tier list
- `backend/config/routes.rb` — verified `namespace :onboarding` block structure
- `backend/test/integration/onboarding_domain_guard_test.rb` — verified test pattern for `MainDomainOnly`-guarded onboarding routes (uses `independent` as a valid test-fixture plan value already, confirming test infra is aware of the 3-tier model even though the wizard controller test itself doesn't exist yet)
- `frontend/src/store/reducers/createBrokerageWizard.ts` — verified `CreateBrokeragePlan` type location and reducer shape
- `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` — verified `submit()` logic, line 97 `plan === 'premium'` gate
- `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` — verified all `isPremium` occurrences (lines 15, 35, 59, 61, 80, 95, 119)
- `frontend/src/containers/createBrokerage/steps/PlanSelectionStep.tsx` — verified current hardcoded `BASIC_FEATURES`/`PREMIUM_FEATURES` arrays
- `frontend/src/components/createBrokerage/PlanCard.tsx`, `PlanBadge.tsx` — verified current prop shapes
- `frontend/src/assets/api/onboarding/createBrokerage.ts`, `checkDomain.ts` — verified both the mutation and query API-module patterns
- `frontend/src/store/hooks/Auth/useCreateBrokerage.ts`, `useCheckDomainAvailability.ts`, `useUpdateOnboardingProfile.ts` — verified hook patterns
- `frontend/src/components/ui/radio-group.tsx` + `frontend/src/components/view/admin/settingsAdminView/RemoveOwnerDialog.tsx` — verified RadioGroup usage precedent
- `frontend/src/components/view/admin/domainsAdminView/DomainCard.test.tsx` — verified vitest + RTL test convention
- `.planning/PLAN-TIERS.md` — full tier design rationale, verified pricing table and Key Decisions
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json` — verified requirement IDs, decision log, and `nyquist_validation: false` config

### Secondary (MEDIUM confidence)
None used — all findings verified directly against repo files in this session; no external web research was needed since this phase is entirely internal-codebase wiring with no new libraries.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every pattern cited is a verified, already-in-use precedent in this exact repo
- Architecture: HIGH — endpoint pattern, hook pattern, and toggle pattern are all copied from working sibling code, not inferred from general framework knowledge
- Pitfalls: HIGH — each pitfall was found by direct diffing against actual file contents (e.g., the `CreateBrokeragePlan` dual-declaration and the untracked `isPremium` occurrence at line 80), not speculative

**Research date:** 2026-07-22
**Valid until:** No expiry driver — this is internal-codebase research, not a fast-moving external library; valid until the underlying files change (i.e., through the remainder of this phase's planning/execution window)

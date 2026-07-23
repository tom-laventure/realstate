# Phase 40: Onboarding Plan Alignment - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild the brokerage-creation wizard's plan-selection and domain steps around the real three-tier model (`free`/`independent`/`growth`), replacing the retired `basic`/`premium` values the frontend currently submits (and the backend already rejects). Covers: plan cards sourced from `AppConstants::PLAN_TIERS`, custom domain field behavior per tier, and removing the backend's "Growth requires custom_domain" validation. Requirements: ONB-05, ONB-06, ONB-07.

Not in scope: annual billing toggle (wizard shows monthly price only per roadmap success criteria), Phase 41's admin/settings plan-change UI, real payment processing (BILL-01).

</domain>

<decisions>
## Implementation Decisions

### Plan-tier data source
- **D-01:** Add a new public (Cognito-authenticated, main-domain-only — same guards as the existing `onboarding` namespace) `GET /v1/onboarding/plan_tiers` endpoint that serializes `AppConstants::PLAN_TIERS` (price/mo, seat cap, and capability flags per tier). The frontend fetches this on mount of the plan-selection step rather than hardcoding a mirrored TS constant — single source of truth stays in the backend config, no risk of the two drifting.
- Route lives under the existing `namespace :onboarding` block in `backend/config/routes.rb` (alongside `resource :brokerage` and `resources :domains`), e.g. `resources :plan_tiers, only: [:index]`.
- No new controller pattern needed beyond a thin serializer over `AppConstants::PLAN_TIERS` — return price in dollars (not cents) for direct frontend display.

### Plan card content
- **D-02:** Feature list bullets mirror the flags already defined in `AppConstants::PlanTier` (real_boards, clients, custom_domain, calendar_sync) plus seat-cap wording: "1 seat" (Independent), "5 seats" (Growth), "Unlimited seats" (Free — since Free has no seat cap per `PLAN-TIERS.md`).
- **D-03:** Growth is the visually "Recommended" tier (replaces Premium's current badge position) — it's the flagship paid tier per `PLAN-TIERS.md`.
- Card copy should draw from `.planning/PLAN-TIERS.md`'s tier descriptions (Free = acquisition funnel / TEST board, Independent = entry paid tier, Growth = team tier) rather than inventing new marketing copy.

### Custom domain step UX
- **D-04:** Free shows no custom domain field at all (unchanged region of `DomainStep.tsx`, just re-gated on `plan !== 'free'` instead of `plan === 'premium'`).
- **D-05:** For Independent/Growth, add a Yes/No toggle: **"Do you currently own a custom domain?"** with a subheader mentioning where to get one if they don't (e.g., domain broker examples — GoDaddy, Namecheap, Google Domains; final wording is Claude's discretion per user).
  - Clicking **Yes** reveals the existing custom domain input (still optional to actually fill in and submit — no required-field validation).
  - Clicking **No** hides the input and shows a reassuring line, e.g. "That's alright — you can add a custom domain later from Settings."
- This replaces the current `isPremium`-gated required-field pattern in `DomainStep.tsx` (lines 59-62 validation, line 96-98 description copy) entirely — no tier requires a custom domain to complete signup.

### Claude's Discretion
- Exact wording of the domain-broker subheader/examples and the "no" reassurance message — user explicitly delegated this ("use your own wording").
- Whether the Yes/No toggle defaults to Yes or No on first render (recommend defaulting to No/collapsed, since most signups won't have a domain ready yet).
- Internal naming for the new plan-tier serializer/service object.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plan tier design & rationale
- `.planning/PLAN-TIERS.md` — full tier design rationale (pricing, seat overage formula, feature-per-tier reasoning, Key Decisions table). Use this for card copy and feature-list wording, not just the raw booleans in the constant.
- `backend/app/constants/plan_tiers.rb` — `AppConstants::PLAN_TIERS` single source of truth for seat caps, pricing, capability flags. The new endpoint must serialize this, not duplicate its values.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — ONB-05, ONB-06, ONB-07 (v1.13 section)
- `.planning/ROADMAP.md` — Phase 40 goal, success criteria, and UI hint

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/createBrokerage/PlanCard.tsx` — existing card component (title, description, feature list, recommended badge, select button); needs its 3rd card added and `CreateBrokeragePlan` type widened, but structure is reusable as-is.
- `frontend/src/components/createBrokerage/PlanBadge.tsx` — badge shown on later wizard steps; needs its binary `isPremium` check replaced with a 3-way plan lookup.
- `frontend/src/components/createBrokerage/SubdomainInput.tsx` — unaffected by this phase, reused as-is.
- `useCheckDomainAvailability` hook (`frontend/src/store/hooks/Auth/`) — existing debounced availability check, reused as-is for the (now-optional) custom domain field.

### Established Patterns
- `src/assets/api/` (pure axios) → `src/store/hooks/` (TanStack wrapper) → Context → Component is the standing data-flow pattern (CLAUDE.md); the new plan-tiers fetch should follow it: a new `assets/api/onboarding/getPlanTiers.ts` + `store/hooks/Auth/useFetchPlanTiers.ts` (or similar), consumed by `PlanSelectionStep.tsx`.
- Domain interfaces belong in `assets/types/` before hooks/contexts reference them (CLAUDE.md) — the plan-tier response shape (price, seat cap, feature flags per tier) needs a type there.

### Integration Points
- `frontend/src/store/reducers/createBrokerageWizard.ts` — `CreateBrokeragePlan = 'basic' | 'premium'` type must widen to `'free' | 'independent' | 'growth'`; used by the reducer, `CreateBrokerageContext.tsx`, `PlanCard.tsx`, `PlanBadge.tsx`, and the API request type in `frontend/src/assets/api/onboarding/createBrokerage.ts`.
- `frontend/src/containers/createBrokerage/CreateBrokerageContext.tsx` `submit()` (line 97) — currently only sends `custom_domain` `if wizard.plan === 'premium'`; must change to send it whenever present and `plan !== 'free'`.
- `frontend/src/containers/createBrokerage/steps/DomainStep.tsx` — `isPremium` gate (line 15), required-field validation (lines 59-62), and description copy (lines 95-98) all need to become 3-way (free/independent/growth) plus the new Yes/No toggle for paid tiers.
- `backend/app/controllers/v1/onboarding/brokerages_controller.rb` lines 33-36 — the "Growth requires custom_domain" check to delete entirely (ONB-06/success criterion 4). Plan validity check at line 15-18 already accepts any `AppConstants::PLAN_TIERS.key?` value, so no change needed there.
- `backend/config/routes.rb` `namespace :onboarding` block (line 24) — where the new `plan_tiers` route is added.

</code_context>

<specifics>
## Specific Ideas

- The custom-domain Yes/No toggle ("Do you currently own a custom domain?") is a specific UX flow the user asked for, replacing a plain optional-field approach — see D-05.
- Growth tier gets the "Recommended" visual treatment (badge/border), matching how Premium is highlighted today.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
- "Rethink listing access model — BrokerageEstate vs board credential JOIN" (`arch-brokerage-listing-access.md`) — surfaced by todo-matching on generic keyword overlap ("model", "dashboard", "brokerage") but is an unrelated architecture item already tracked for v1.14+ in STATE.md. Not folded — no connection to onboarding/plan-selection scope.

</deferred>

---

*Phase: 40-onboarding-plan-alignment*
*Context gathered: 2026-07-22*

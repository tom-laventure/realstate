# Phase 20: Backend Domain API - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-only phase. Rebuild `V1::Admin::DomainsController` with the full domain management API: list domains (DMOD-06), edit subdomain with phase-out of old (DMOD-07), add custom domain Pro-only (DMOD-08), remove custom domain (DMOD-09), set primary (DMOD-10), phase-out warning/blocking (DMOD-11, DMOD-12), immediate decommission of phasing-out domain (DMOD-14), Pro-tier gating (DMOD-05). Add public `GET /v1/domains/lookup` endpoint (DMOD-13). Update `InvitationMailer` to use `is_primary: true` domain (DINT-02). Remove the legacy DNS `verify` action.

Requirements in scope: DMOD-05, DMOD-06, DMOD-07, DMOD-08, DMOD-09, DMOD-10, DMOD-11, DMOD-12, DMOD-13, DMOD-14, DINT-02.

</domain>

<decisions>
## Implementation Decisions

### Domain Response Format
- **D-01:** Introduce `BrokerageDomainSerializer` using AMS (consistent with project pattern — `BrokerageSerializer`, `GroupSerializer`, etc.). No inline hash in the controller.
- **D-02:** Serializer exposes lifecycle fields only: `id`, `domain`, `domain_type`, `status`, `is_primary`, `phase_out_at`. No verification fields (`verified`, `verified_at`, `verification_token`) — DNS verification is deferred to v1.6.
- **D-03:** Collection response uses root-key wrapping: `{ domains: [...] }`. Matches `:json` AMS adapter convention used across the project.
- **D-04:** Mutation responses (PATCH /subdomain, POST /custom, PATCH /set_primary, DELETE) return `{ domain: <updated_record>, domains: <all_active_and_phasing_out> }`. Allows frontend to refresh the full list in one round trip without a subsequent GET.

### Phase-out Lifecycle Logic
- **D-05:** Slot-counting, blocking, warning, and phase-out transition logic lives as **model methods on `BrokerageDomain`** (fat model, lean controller). Examples: `brokerage.phasing_out_count_for(type)`, `domain.phase_out!`. No separate service object.
- **D-06:** `phase_out_at` is set to `30.days.from_now` (exact time — no rounding to end of day). Simple and sufficient; Phase 21 UI shows a day countdown, not an hour countdown.
- **D-07:** Immediate decommission (`DELETE` on a phasing-out domain, DMOD-14) sets **both** `status: decommissioned` AND `deleted_at: Time.current`. Matches the REQUIREMENTS spec exactly and consistent with `BrokerageDomain`'s manual soft-delete pattern.
- **D-08:** `set_primary` (PATCH /admin/domains/:id/set_primary) executes the old-primary demotion and new-primary promotion in a **single DB transaction** (`ApplicationRecord.transaction do ... end`). Prevents any window with 0 or 2 primaries.

### Existing DNS Verify Action
- **D-09:** **Remove** the existing `verify` DNS action (Resolv::DNS CNAME/A-record checking) and its route (`post :verify, on: :member`) from the admin domains controller. It is dead code — DNS verification is deferred to v1.6 and `verified` is no longer the routing gate. Clean slate for Phase 20.

### Auth Gating
- **D-10:** `GET /v1/admin/domains` (index) is accessible to **any admin** (`require_admin!` — the default in `V1::Admin::BaseController`). Read-only; admins may need to see domain status for support/debugging.
- **D-11:** All mutation actions (PATCH /subdomain, POST /custom, DELETE /:id, PATCH /:id/set_primary) require **owner role** (`before_action :require_owner!` on those actions). Domain changes are high-impact and irreversible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §DMOD-05 through DMOD-14, DINT-02 — Full requirement text for all Phase 20 requirements

### Model (foundation from Phase 19)
- `backend/app/models/brokerage_domain.rb` — lifecycle columns, enums (`domain_type`, `status`), scopes (`.routable`, `.status_active`, `.status_phasing_out`, `.status_decommissioned`), validations (uniqueness partial index, slug, status_requires_verified), `RESERVED_SLUGS` constant
- `backend/app/models/brokerage.rb` — `plan` column (`basic`/`premium`) used for Pro-tier gating (DMOD-05)

### Controllers (being rebuilt/extended)
- `backend/app/controllers/v1/admin/domains_controller.rb` — controller being fully rebuilt (current state has old index + DNS verify; both will be replaced)
- `backend/app/controllers/v1/admin/base_controller.rb` — base with `require_admin!`, `require_owner!`, `BrokerageAuth`, `CognitoAuth`
- `backend/app/controllers/v1/domains_controller.rb` — public controller; `GET /v1/domains/lookup` goes here alongside the existing `check` action

### Routing
- `backend/config/routes.rb` — current `resources :domains, only: [:index]` + `post :verify` (to be replaced with new routes)

### Mailer
- `backend/app/mailers/invitation_mailer.rb` — `primary_domain` helper using `verified.first` → update to `where(is_primary: true).first` (DINT-02)

### Reference Serializer
- `backend/app/serializers/brokerage_serializer.rb` — example of AMS serializer structure to follow for `BrokerageDomainSerializer`

### Tests
- `backend/test/integration/brokerage_auth_main_domain_test.rb` — must continue to pass after controller rebuild
- `backend/test/integration/tenant_isolation_test.rb` — must continue to pass

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BrokerageDomain` enums: `.status_active`, `.status_phasing_out`, `.status_decommissioned`, `.domain_type_subdomain`, `.domain_type_custom` — use for scope chaining in controller queries
- `BrokerageDomain.routable` scope — `where(status: [:active, :phasing_out])` — use for index filtering
- `V1::Admin::BaseController#require_owner!` — already implemented; skip `require_admin!` and call `require_owner!` on mutation actions via `before_action`
- `Brokerage#plan` — `brokerage.plan == 'premium'` or `Current.brokerage.plan == 'premium'` for Pro gate

### Established Patterns
- AMS serializer pattern: `class BrokerageSerializer < ActiveModel::Serializer; attributes :id, :name, ...`. New `BrokerageDomainSerializer` follows the same structure.
- Controller response pattern: `render json: serializer_instance, status: :ok` — project uses AMS adapter `:json` (root-key wrapping enabled)
- `Current.brokerage` scoping: all queries scope to `Current.brokerage.brokerage_domains` — never query `BrokerageDomain` globally in admin controllers
- Manual soft-delete on `BrokerageDomain`: `deleted_at` is a plain column (not `acts_as_paranoid`). Set `deleted_at: Time.current` manually on decommission.
- Auth gate split via `before_action`: `skip_before_action :require_admin!, only: [...]` + `before_action :require_owner!, only: [...]` — already used in the existing controller

### Integration Points
- Routes: add `destroy`, `set_primary` member actions and `subdomain`, `custom` collection actions to `resources :domains` in the `namespace :admin` block
- Public controller: add `lookup` action to `V1::DomainsController` (already skips authenticity token; `lookup` needs no auth); add `get :lookup, on: :collection` to `resources :domains` in the public `namespace :v1` block
- `InvitationMailer#primary_domain`: one-line change from `where(verified: true).where.not(...).first` to `where(is_primary: true).where.not(domain: 'localhost').first`

</code_context>

<specifics>
## Specific Ideas

- Mutation response shape `{ domain: <updated>, domains: <all active+phasing_out> }` — avoids a follow-up GET from the frontend and lets Phase 21 refresh all cards in one response.
- Phase-out model methods to implement: `BrokerageDomain.phasing_out_count_for(brokerage, type)` (or as an instance method on Brokerage), `domain.phase_out!` (sets `status: phasing_out, phase_out_at: 30.days.from_now`), `domain.decommission!` (sets `status: decommissioned, deleted_at: Time.current`).
- `earliest_slot_available_at` computation: find the phasing-out domain with the earliest `phase_out_at` among the 2 phasing-out domains of the same type and return that value in the 422 response body.
- `phase_out_warning` in DMOD-11 success response: when action results in exactly 2 phasing-out domains of the same type, include `phase_out_warning: { earliest_slot_available_at: <date> }` in the response alongside `domain` and `domains`.

</specifics>

<deferred>
## Deferred Ideas

- DNS verification for custom domains — explicitly deferred to v1.6 (the `verify` action and its Resolv::DNS logic is being removed in this phase; v1.6 will implement it properly)
- `verified` column UI exposure — not surfaced in Phase 20 serializer; DNS verification milestone will handle it
- Ops namespace domain management — the `ops/brokerage_domains_controller.rb` is left as-is; Phase 20 only touches the user-facing `v1/admin/` controller

</deferred>

---

*Phase: 20-backend-domain-api*
*Context gathered: 2026-05-27*

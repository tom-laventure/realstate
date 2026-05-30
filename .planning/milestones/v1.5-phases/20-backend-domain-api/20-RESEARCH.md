# Phase 20: Backend Domain API - Research

**Researched:** 2026-05-27
**Domain:** Rails 7.1 / ActiveRecord / AMS / multi-tenant API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Introduce `BrokerageDomainSerializer` using AMS. No inline hash in the controller.
**D-02:** Serializer exposes lifecycle fields only: `id`, `domain`, `domain_type`, `status`, `is_primary`, `phase_out_at`. No verification fields.
**D-03:** Collection response uses root-key wrapping: `{ domains: [...] }`.
**D-04:** Mutation responses return `{ domain: <updated_record>, domains: <all_active_and_phasing_out> }`.
**D-05:** Slot-counting, blocking, warning, and phase-out transition logic lives as model methods on `BrokerageDomain`. No service object.
**D-06:** `phase_out_at` is set to `30.days.from_now`.
**D-07:** Immediate decommission sets both `status: decommissioned` AND `deleted_at: Time.current`.
**D-08:** `set_primary` executes in a single DB transaction.
**D-09:** Remove the existing `verify` DNS action and its route.
**D-10:** `GET /v1/admin/domains` is accessible to any admin (`require_admin!`).
**D-11:** All mutation actions require owner role (`before_action :require_owner!` on those actions).

### Claude's Discretion

No discretion areas specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- DNS verification for custom domains — deferred to v1.6
- `verified` column UI exposure — not surfaced in Phase 20 serializer
- Ops namespace domain management — left as-is
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DMOD-05 | Custom domain endpoints require `plan == 'premium'`; basic-tier receives HTTP 403 | `Brokerage#plan` column confirmed: `default: "basic"`, validates `%w[basic premium]`. Gate with `Current.brokerage.plan == "premium"` |
| DMOD-06 | `GET /v1/admin/domains` returns all active + phasing-out domains | Use `Current.brokerage.brokerage_domains.routable.order(:created_at)` + `BrokerageDomainSerializer` |
| DMOD-07 | `PATCH /v1/admin/domains/subdomain` — transition old subdomain to phasing-out, create new active subdomain; blocked at 2 phasing-out subdomains | Phase-out slot check + `domain.phase_out!` + `BrokerageDomain.create!(verified: true, ...)` |
| DMOD-08 | `POST /v1/admin/domains/custom` — add custom domain (Pro only); phase-out existing active custom domain; blocked at 2 phasing-out custom domains | Pro gate + slot check + phase-out + create |
| DMOD-09 | `DELETE /v1/admin/domains/:id` on active custom domain — transition to 30-day phase-out; blocked at 2 phasing-out custom domains | Slot check + `domain.phase_out!` |
| DMOD-10 | `PATCH /v1/admin/domains/:id/set_primary` — designate active domain as primary; reject phasing-out/decommissioned | Transaction-wrapped demotion + promotion; status guard |
| DMOD-11 | When action lands at exactly 2 phasing-out domains of same type, include `phase_out_warning` in response | Post-action count check; if == 2, compute `earliest_slot_available_at` and include in response |
| DMOD-12 | When 2 phasing-out domains of same type already exist before action, return HTTP 422 with `earliest_slot_available_at` | Pre-action slot count check; render 422 with error body |
| DMOD-13 | `GET /v1/domains/lookup?domain=X` — public, unauthenticated; returns primary domain for brokerage owning domain X | Add `lookup` action to `V1::DomainsController`; no auth required (already skips authenticity token) |
| DMOD-14 | `DELETE /v1/admin/domains/:id` on phasing-out domain — immediately decommissions (`status: decommissioned`, `deleted_at: now`) | `domain.decommission!` sets both fields manually |
| DINT-02 | `InvitationMailer#primary_domain` updated to query `is_primary: true` instead of `first` | One-line change: `where(is_primary: true).where.not(domain: 'localhost').first` |
</phase_requirements>

---

## Summary

Phase 20 is a pure backend phase that rebuilds `V1::Admin::DomainsController` from scratch and adds one public endpoint. The foundation from Phase 19 is fully in place: the `brokerage_domains` table has all lifecycle columns (`domain_type`, `status`, `is_primary`, `phase_out_at`), the model has enum scopes (`.routable`, `.status_active`, `.status_phasing_out`, `.status_decommissioned`), and `BrokerageAuth` already uses `.routable` for tenant resolution.

The controller rebuild follows a well-established pattern in this codebase: AMS serializer for responses, `require_owner!` for mutations, `Current.brokerage` scoping for all queries, and model-layer business logic. The most important cross-cutting concern is the `status_requires_verified` model validation — any new domain record created with `status: active` must also set `verified: true, verified_at: Time.current, verification_token: nil`, exactly as the onboarding controller does. Custom domains (which cannot be auto-verified) are created with `verified: false` and a non-active status; they are deferred to v1.6 for DNS verification.

The phase also touches `InvitationMailer` (one-line fix for DINT-02) and adds one collection route to the public `V1::DomainsController` for the lookup endpoint. The legacy `verify` DNS action and its route are removed as dead code.

**Primary recommendation:** Implement model methods first (`phase_out!`, `decommission!`, slot-counting helpers on `Brokerage`), then the serializer, then the controller actions, then routes, then mailer fix. Write integration tests in the same wave as each controller action.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Domain CRUD (list, create, update, delete) | API / Backend | — | Multi-tenant data; owner-only mutations |
| Phase-out slot logic | API / Backend (model layer) | — | Business rule enforced server-side; D-05 locked |
| Pro-tier gating | API / Backend | — | Server-side enforcement; client cannot bypass |
| Primary domain lookup | API / Backend | — | Public unauthenticated read from DB |
| Invitation email canonicalization | API / Backend (mailer) | — | Mailer resolves domain at send time |
| DNS verification | DEFERRED | — | Out of scope for v1.5 |

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rails 7.1 | 7.1.x | Framework | Project standard [VERIFIED: schema.rb] |
| active_model_serializers | 0.10.x | AMS serialization | Project-wide pattern; `:json` adapter configured [VERIFIED: config/initializers/active_model_serializers.rb] |
| Pagy | installed | Pagination | Project standard; used in all admin controllers [VERIFIED: base_controller.rb] |

No new gems required. [VERIFIED: codebase grep]

---

## Architecture Patterns

### Serializer: BrokerageDomainSerializer

New file: `backend/app/serializers/brokerage_domain_serializer.rb`

```ruby
# Source: project pattern (brokerage_serializer.rb, invitation_serializer.rb)
class BrokerageDomainSerializer < ActiveModel::Serializer
  attributes :id, :domain, :domain_type, :status, :is_primary, :phase_out_at
end
```

No `AssociationLoader` needed — all fields are scalar columns. [VERIFIED: brokerage_serializer.rb, invitation_serializer.rb patterns]

### Render Pattern for Collections

AMS with `:json` adapter (globally configured) wraps a single record under its root key. For collections, the project uses explicit hash construction:

```ruby
# Source: invitations_controller.rb index pattern
render json: {
  domains: ActiveModelSerializers::SerializableResource.new(
    domains,
    each_serializer: BrokerageDomainSerializer,
    adapter: :attributes
  ).as_json
}, status: :ok
```

Note: `adapter: :attributes` is used for the collection sub-resource to avoid double-wrapping. The outer `domains:` key provides the root. [VERIFIED: invitations_controller.rb index action]

### Render Pattern for Mutations (D-04)

```ruby
# Mutation response: updated domain + full refreshed list
brokerage = Current.brokerage
all_domains = brokerage.brokerage_domains.routable.order(:created_at)
render json: {
  domain: ActiveModelSerializers::SerializableResource.new(
    updated_domain,
    serializer: BrokerageDomainSerializer,
    adapter: :attributes
  ).as_json,
  domains: ActiveModelSerializers::SerializableResource.new(
    all_domains,
    each_serializer: BrokerageDomainSerializer,
    adapter: :attributes
  ).as_json
}, status: :ok
```

[ASSUMED] The `adapter: :attributes` on individual record is consistent with how `users_controller.rb` uses `SerializableResource.new(..., adapter: :attributes).as_json` inline.

### Controller Auth Split Pattern

Existing pattern from multiple admin controllers:

```ruby
# Source: current domains_controller.rb, invitations_controller.rb
class DomainsController < V1::Admin::BaseController
  # require_admin! is default from BaseController

  before_action :require_owner!, only: %i[subdomain custom destroy set_primary]
end
```

Index uses `require_admin!` (default); mutations use `require_owner!` (D-10, D-11). [VERIFIED: base_controller.rb]

### Model Methods to Add to BrokerageDomain

```ruby
# Source: D-05, D-06, D-07 decisions

def phase_out!
  update!(status: :phasing_out, phase_out_at: 30.days.from_now)
end

def decommission!
  update!(status: :decommissioned, deleted_at: Time.current)
end
```

### Phase-Out Slot Counter (on Brokerage model or BrokerageDomain class method)

Decision D-05 says "fat model, lean controller." The context suggests `brokerage.phasing_out_count_for(type)` — implement as instance method on `Brokerage` or as a class method on `BrokerageDomain`. Either approach is valid; Brokerage instance method is more readable in controller:

```ruby
# On Brokerage model:
def phasing_out_count_for(type)
  brokerage_domains.status_phasing_out.where(domain_type: type).count
end

# Or on BrokerageDomain:
def self.phasing_out_count_for(brokerage, type)
  brokerage.brokerage_domains.status_phasing_out.where(domain_type: type).count
end
```

[ASSUMED] Either location is consistent with D-05; recommend Brokerage instance method for cleaner controller code.

### CRITICAL: verified Flag Required When Creating Active Domains

The `status_requires_verified` model validation blocks `status: active` if `verified: false`:

```ruby
# In BrokerageDomain model:
def status_requires_verified
  return unless status_active?
  unless verified?
    errors.add(:status, "cannot be set to active unless the domain is verified")
  end
end
```

The onboarding controller solves this by setting `verified: true, verified_at: Time.current, verification_token: nil` explicitly on create. Phase 20 MUST do the same for new subdomains:

```ruby
# Source: v1/onboarding/brokerages_controller.rb
Current.brokerage.brokerage_domains.create!(
  domain: full_subdomain_host,
  domain_type: :subdomain,
  status: :active,
  is_primary: false,
  verified: true,               # REQUIRED — bypasses status_requires_verified
  verified_at: Time.current,
  verification_token: nil
)
```

For custom domains (which cannot be auto-verified), create with `status: :phasing_out` (NOT `:active`) — this avoids the validation entirely since `status_requires_verified` only fires on `status_active?`. [VERIFIED: brokerage_domain.rb#status_requires_verified + onboarding/brokerages_controller.rb]

### Set Primary Transaction Pattern

```ruby
# Source: D-08 decision
def set_primary
  domain = Current.brokerage.brokerage_domains.find(params[:id])
  return render json: {error: "Domain not found"}, status: :not_found unless domain
  unless domain.status_active?
    return render json: {error: "Only active domains can be set as primary", code: "invalid_status"}, status: :unprocessable_entity
  end

  ApplicationRecord.transaction do
    Current.brokerage.brokerage_domains
      .where(is_primary: true)
      .update_all(is_primary: false)
    domain.update!(is_primary: true)
  end
  # render mutation response
end
```

[VERIFIED: ApplicationRecord.transaction pattern confirmed used in codebase; D-08 locks this approach]

### Phase-Out Warning Logic (DMOD-11)

After a successful action, check if the brokerage is now at exactly 2 phasing-out domains for that type. If so, include `phase_out_warning` in the response:

```ruby
# Inline in controller after successful mutation:
phasing_out_count = Current.brokerage.phasing_out_count_for(domain_type)
if phasing_out_count == 2
  earliest = Current.brokerage.brokerage_domains
    .status_phasing_out
    .where(domain_type: domain_type)
    .order(:phase_out_at)
    .first
    .phase_out_at
  # Include phase_out_warning: { earliest_slot_available_at: earliest } in response
end
```

[VERIFIED: DMOD-11 requirement text; CONTEXT.md specifics section]

### Phase-Out Blocking Logic (DMOD-12)

Before executing a mutation that adds a phasing-out domain:

```ruby
if Current.brokerage.phasing_out_count_for(domain_type) >= 2
  earliest = Current.brokerage.brokerage_domains
    .status_phasing_out
    .where(domain_type: domain_type)
    .order(:phase_out_at)
    .first
    .phase_out_at
  return render json: {
    error: "Phase-out slot limit reached",
    earliest_slot_available_at: earliest
  }, status: :unprocessable_entity
end
```

[VERIFIED: DMOD-12 requirement text]

### Public Lookup Endpoint (DMOD-13)

Add to `V1::DomainsController` (which already exists at `backend/app/controllers/v1/domains_controller.rb`):

```ruby
# GET /v1/domains/lookup?domain=X
def lookup
  domain_param = params[:domain].to_s.strip.downcase
  return render json: {error: "domain param required"}, status: :bad_request if domain_param.blank?

  domain_record = BrokerageDomain.routable.find_by(domain: domain_param)
  return render json: {error: "not found"}, status: :not_found unless domain_record

  primary = domain_record.brokerage.brokerage_domains
    .routable
    .find_by(is_primary: true)
  return render json: {error: "no primary domain"}, status: :not_found unless primary

  render json: {domain: primary.domain}, status: :ok
end
```

No authentication needed — `V1::DomainsController` already skips `verify_authenticity_token`. [VERIFIED: domains_controller.rb]

### InvitationMailer Fix (DINT-02)

```ruby
# Before (current code):
def primary_domain(brokerage)
  brokerage.brokerage_domains
    .where(verified: true)
    .where.not(domain: "localhost")
    .first&.domain || brokerage.brokerage_domains.first&.domain
end

# After:
def primary_domain(brokerage)
  brokerage.brokerage_domains
    .where(is_primary: true)
    .where.not(domain: "localhost")
    .first&.domain || brokerage.brokerage_domains.first&.domain
end
```

[VERIFIED: invitation_mailer.rb]

### Routing Changes

```ruby
# In routes.rb, replace:
resources :domains, only: [:index] do
  member do
    post :verify
  end
end

# With:
resources :domains, only: [:index] do
  collection do
    patch :subdomain
    post  :custom
  end
  member do
    delete :destroy  # implicit in resources destroy, but needs custom logic
    patch  :set_primary
  end
end
```

Wait — the subdomain and custom actions are NOT member actions on a specific domain id. They are collection actions. The `destroy` is a member action. Let me be precise:

```ruby
# namespace :admin block:
resources :domains, only: [:index, :destroy] do
  collection do
    patch :subdomain   # DMOD-07: PATCH /v1/admin/domains/subdomain
    post  :custom      # DMOD-08: POST /v1/admin/domains/custom
  end
  member do
    patch :set_primary  # DMOD-10: PATCH /v1/admin/domains/:id/set_primary
  end
end

# namespace :v1, resources :domains block (public):
resources :domains, only: [] do
  collection do
    get :check
    get :lookup      # DMOD-13: GET /v1/domains/lookup?domain=X
  end
end
```

The `destroy` (DMOD-09, DMOD-14) maps to the standard RESTful `DELETE /v1/admin/domains/:id` via `resources :domains, only: [:index, :destroy]`. [VERIFIED: routes.rb current state + requirements]

### Recommended Project Structure

```
backend/
├── app/
│   ├── models/
│   │   ├── brokerage_domain.rb        # Add phase_out!, decommission!
│   │   └── brokerage.rb               # Add phasing_out_count_for(type)
│   ├── serializers/
│   │   └── brokerage_domain_serializer.rb  # NEW
│   ├── controllers/
│   │   └── v1/
│   │       ├── domains_controller.rb      # Add lookup action
│   │       └── admin/
│   │           └── domains_controller.rb  # Full rebuild
│   └── mailers/
│       └── invitation_mailer.rb        # Fix primary_domain method
└── config/
    └── routes.rb                       # Update admin and public domain routes
```

### Anti-Patterns to Avoid

- **Querying BrokerageDomain globally in the admin controller:** Always scope to `Current.brokerage.brokerage_domains`. Never `BrokerageDomain.where(...)` directly in admin controller actions.
- **Using acts_as_paranoid destroy on BrokerageDomain:** The model uses manual soft-delete (`deleted_at` plain column, NOT paranoid). Use `update!(deleted_at: Time.current)` not `.destroy`.
- **Creating active domains without `verified: true`:** The `status_requires_verified` validation blocks it. Always pass `verified: true, verified_at: Time.current, verification_token: nil` when creating a subdomain with `status: active`.
- **Using `.active` scope (acts_as_paranoid) on BrokerageDomain:** The model does not use paranoid. Use `.status_active` (the enum scope) instead.
- **Two primaries or zero primaries:** The `set_primary` transaction must atomically demote the old primary before promoting the new one. `update_all` on the old primary set, then `update!` on the new one, inside a transaction.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON serialization with root keys | Custom `as_json` hash in controller | `BrokerageDomainSerializer` + AMS `:json` adapter | Consistent with all other endpoints; handles root key automatically |
| Pagination | Manual `offset`/`limit` | Pagy (already in BaseController) | Already included; `GET /v1/admin/domains` index doesn't need pagination (domains per brokerage is always small) |
| Transaction safety for set_primary | Application-level locking | `ApplicationRecord.transaction` | Atomic; prevents 0-or-2 primary windows |

**Key insight:** The domain model is low-cardinality per brokerage (max ~5 records). No pagination needed on the index endpoint.

---

## Common Pitfalls

### Pitfall 1: status_requires_verified Blocks New Active Subdomain Creation

**What goes wrong:** Creating a new `BrokerageDomain` with `status: :active` without setting `verified: true` causes a validation failure: "Status cannot be set to active unless the domain is verified."
**Why it happens:** The model has a custom validation that gates active status behind the `verified` boolean. Subdomains on the platform's base domain are "self-verified" by the platform, but the model doesn't know that automatically.
**How to avoid:** Always pass `verified: true, verified_at: Time.current, verification_token: nil` when creating new subdomains with `status: active`. The onboarding controller does this as the established pattern.
**Warning signs:** `ActiveRecord::RecordInvalid` with "Status cannot be set to active" in tests or logs.

### Pitfall 2: Treating BrokerageDomain as acts_as_paranoid

**What goes wrong:** Calling `.destroy` on a `BrokerageDomain` record triggers paranoid destroy, but the model doesn't use `acts_as_paranoid` — it has a raw `deleted_at` column that must be set manually.
**Why it happens:** `Brokerage` uses paranoid; `BrokerageDomain` does NOT. The field exists but is unmanaged by the gem.
**How to avoid:** For decommission (DMOD-14), use `update!(status: :decommissioned, deleted_at: Time.current)`. Never call `.destroy` or `.paranoid_destroy`.
**Warning signs:** Records still appearing in queries after a delete call; `deleted_at` not being set.

### Pitfall 3: routes.rb Collision Between `subdomain` and `:id` Routes

**What goes wrong:** Rails may interpret `PATCH /v1/admin/domains/subdomain` as a member route with `id = "subdomain"` rather than the custom collection action.
**Why it happens:** If `subdomain` is added as a member action, Rails routes `PATCH /domains/subdomain` to the `:id` member path. It must be a `collection` action.
**How to avoid:** Use `collection do; patch :subdomain; end` in routes.rb. Verify with `rails routes | grep domain`.
**Warning signs:** Controller action receives `params[:id] = "subdomain"` instead of routing to the `subdomain` action.

### Pitfall 4: Phase-Out Warning vs Blocking — Counts Off by One

**What goes wrong:** DMOD-11 (warning at exactly 2) and DMOD-12 (block at 2 already existing) are different:
- DMOD-12: Count is checked BEFORE the action. If already >= 2, block with 422.
- DMOD-11: Count is checked AFTER the action succeeds. If now == 2, append warning to response.
**Why it happens:** Both reference "2 phasing-out domains" but at different points in time.
**How to avoid:** Always check before (pre-guard) for blocking; check after (post-action) for warning. The post-action count includes the domain just phased out.
**Warning signs:** Warning never fires; or action is blocked when it shouldn't be.

### Pitfall 5: DMOD-09 vs DMOD-14 — Same Route, Different Logic

**What goes wrong:** `DELETE /v1/admin/domains/:id` has two distinct behaviors depending on the current status of the target domain:
- Active custom domain → phase it out (DMOD-09)
- Phasing-out domain → immediately decommission (DMOD-14)
**Why it happens:** Both use the same HTTP verb and route; the controller must branch on `domain.status`.
**How to avoid:** In the `destroy` action, check `domain.status_active?` vs `domain.status_phasing_out?` and call the appropriate method. Reject decommissioned or subdomain records with 422 or 404 as appropriate.
**Warning signs:** A phasing-out domain being moved to another phase-out instead of decommissioned.

### Pitfall 6: auth_headers_for Uses brokerage.brokerage_domains.first

**What goes wrong:** Integration tests using `auth_headers_for` set the `Host` header to `brokerage.brokerage_domains.first.domain`. After Phase 20 creates new domain records (particularly in test setup), `.first` may resolve to a non-routable or unexpected domain.
**Why it happens:** The test helper uses `.first` on the association.
**How to avoid:** In integration tests for Phase 20, create the primary domain first in `setup`. Ensure it has `status: active` and `is_primary: true` (the factory defaults do this). Verify `auth_headers_for` resolves correctly.
**Warning signs:** Unexpected 404 responses on requests where the Host no longer maps to a routable domain.

---

## Code Examples

### Verified pattern: Creating a new active subdomain (bypassing status_requires_verified)

```ruby
# Source: backend/app/controllers/v1/onboarding/brokerages_controller.rb
BrokerageDomain.create!(
  brokerage_id: brokerage.id,
  domain: full_subdomain_host,
  verified: true,
  verified_at: Time.current,
  verification_token: nil
)
```

### Verified pattern: AMS collection serialization with adapter: :attributes

```ruby
# Source: backend/app/controllers/v1/admin/invitations_controller.rb
render json: {
  invitations: ActiveModelSerializers::SerializableResource.new(
    invitations,
    each_serializer: InvitationSerializer,
    adapter: :attributes
  ).as_json,
  meta: pagy_metadata(@pagy)
}, status: :ok
```

### Verified pattern: BrokerageSerializer (reference for new BrokerageDomainSerializer)

```ruby
# Source: backend/app/serializers/brokerage_serializer.rb
class BrokerageSerializer < ActiveModel::Serializer
  attributes :id, :name, :address, :mls_id, :website, :logo_url, :favicon_url,
             :contact_email, :contact_phone, :plan, :color_scheme, :created_at, :updated_at
end
```

### Verified pattern: require_owner! on mutation actions

```ruby
# Source: backend/app/controllers/v1/admin/base_controller.rb
def require_owner!
  membership = BrokerageMembership.without_deleted.find_by(
    user_id: Current.user.id,
    brokerage_id: Current.brokerage.id
  )
  unless membership&.role == "owner"
    render json: { error: { code: "forbidden", message: "Owner access required." } },
           status: :forbidden
  end
end
```

### Verified pattern: routable scope (Phase 19 output)

```ruby
# Source: backend/app/models/brokerage_domain.rb
scope :routable, -> { where(status: [:active, :phasing_out]) }
```

### Verified pattern: Integration test structure

```ruby
# Source: backend/test/integration/admin_authorization_test.rb
class DomainsApiTest < ActionDispatch::IntegrationTest
  setup do
    @brokerage = create(:brokerage)
    create(:brokerage_domain, brokerage: @brokerage, domain: "test.example.com")
    @owner = create(:user)
    create(:brokerage_membership, :owner, user: @owner, brokerage: @brokerage)
    @admin = create(:user)
    create(:brokerage_membership, :admin, user: @admin, brokerage: @brokerage)
  end

  test "GET /v1/admin/domains returns 200 for admin" do
    get "/v1/admin/domains", headers: auth_headers_for(@admin, @brokerage)
    assert_response :ok
    body = JSON.parse(response.body)
    assert body.key?("domains")
  end
end
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `where(verified: true)` for routing | `.routable` scope (`status: active or phasing_out`) | Phase 19 | BrokerageAuth now uses lifecycle status, not DNS verification |
| `where(deleted_at: nil)` in index | `.routable` scope | Phase 20 (this phase) | Index no longer shows decommissioned domains |
| `POST /:id/verify` (DNS check) | Removed | Phase 20 (this phase) | Dead code eliminated; DNS verification deferred to v1.6 |
| `verified.first` in mailer | `where(is_primary: true).first` | Phase 20 (this phase) | Invitation URL uses the canonical primary domain |

---

## Open Questions

1. **Custom domain create (DMOD-08) — should the new custom domain be created as `status: :phasing_out` or `status: :active`?**
   - What we know: Custom domains cannot be auto-verified (verified: false by default), and `status_requires_verified` blocks `status: active` for unverified domains.
   - What's unclear: The REQUIREMENTS say "adds a custom domain" — it should presumably be active once added (to be usable for routing). But without DNS verification, it can't be `active`.
   - Recommendation: Create with `status: :active, verified: true` (same as subdomain pattern — the platform "trusts" the user owns their custom domain for now, deferring DNS verification to v1.6). ALTERNATIVELY, since it's a custom domain the user is self-asserting, create with `verified: true` to satisfy the validator. Document the gap. The context.md says "DNS verification is deferred to v1.6" — for now, treat custom domain adds as pre-verified. Clarify with user if needed before implementing DMOD-08.

2. **`destroy` action — what happens when an active SUBDOMAIN is deleted?**
   - What we know: DMOD-09 specifies DELETE on an "active custom domain" transitions to phase-out. DMOD-14 specifies DELETE on a "phasing-out domain" decommissions immediately.
   - What's unclear: If a user tries DELETE on an active SUBDOMAIN, should it be rejected (you can't delete your only routing mechanism) or handled?
   - Recommendation: Reject DELETE on a subdomain with 422 "Cannot remove subdomain directly; use PATCH /subdomain to change it." Only custom domains can be deleted.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is pure backend Ruby/Rails code changes. No external tools, CLIs, or services beyond the existing Rails application.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | CognitoAuth (already in BaseController) |
| V3 Session Management | no | JWT-based, existing pattern |
| V4 Access Control | yes | `require_admin!` for index, `require_owner!` for mutations |
| V5 Input Validation | yes | ActiveRecord validations (domain format, slug, uniqueness) |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant cross-contamination | Spoofing | Always scope to `Current.brokerage.brokerage_domains` |
| Privilege escalation on mutations | Elevation of Privilege | `require_owner!` before_action on all write endpoints |
| Pro-tier bypass | Tampering | Server-side `Current.brokerage.plan == "premium"` check; client cannot influence |
| Domain squatting via concurrent creates | Tampering | DB-level unique index on non-decommissioned domains (`index_brokerage_domains_on_domain_active_unique`) |
| Decommission of last active domain | Denial of Service | Reject DELETE on subdomains; custom domain phase-out preserves routing |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | New custom domains should be created with `verified: true` to satisfy `status_requires_verified` validation (since DNS verification is deferred to v1.6) | Open Questions #1 | If wrong, custom domain creates will always fail validation or must use non-active status |
| A2 | `adapter: :attributes` on inline `SerializableResource.new` prevents double root-key wrapping when embedding in an outer hash | Architecture Patterns (Render Pattern) | If wrong, response shape will have unexpected nesting like `{ domains: { domains: [...] } }` |
| A3 | Brokerage instance method `phasing_out_count_for(type)` is the preferred location per D-05 "fat model" | Architecture Patterns (slot counter) | If wrong, could put it on BrokerageDomain class method instead; functionally equivalent |

---

## Sources

### Primary (HIGH confidence)

- `backend/app/models/brokerage_domain.rb` — enum definitions, validations, scopes [VERIFIED: file read]
- `backend/app/models/brokerage.rb` — plan column, validates inclusion [VERIFIED: file read]
- `backend/app/controllers/v1/admin/base_controller.rb` — require_admin!, require_owner! [VERIFIED: file read]
- `backend/app/controllers/v1/admin/domains_controller.rb` — current state to rebuild [VERIFIED: file read]
- `backend/app/controllers/v1/domains_controller.rb` — public controller where lookup goes [VERIFIED: file read]
- `backend/app/controllers/v1/onboarding/brokerages_controller.rb` — BrokerageDomain.create! with verified: true pattern [VERIFIED: file read]
- `backend/app/serializers/brokerage_serializer.rb` — AMS serializer reference [VERIFIED: file read]
- `backend/app/mailers/invitation_mailer.rb` — DINT-02 target [VERIFIED: file read]
- `backend/config/routes.rb` — current routing [VERIFIED: file read]
- `backend/db/schema.rb` — brokerage_domains table, brokerage plan column [VERIFIED: file read]
- `backend/test/factories/brokerage_domains.rb` — factory defaults [VERIFIED: file read]
- `backend/test/integration/admin_authorization_test.rb` — integration test pattern [VERIFIED: file read]
- `.planning/phases/20-backend-domain-api/20-CONTEXT.md` — all locked decisions [VERIFIED: file read]
- `.planning/REQUIREMENTS.md` — DMOD-05 through DMOD-14, DINT-02 [VERIFIED: file read]

### Secondary (MEDIUM confidence)

- AMS `:json` adapter root-key wrapping behavior — confirmed via `config/initializers/active_model_serializers.rb` and observed usage in multiple controllers [VERIFIED: codebase grep]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries verified in codebase
- Architecture: HIGH — all patterns directly verified from existing controller/serializer files
- Pitfalls: HIGH — verified from model source code (status_requires_verified, missing paranoid, route collision)
- Open questions: LOW — require clarification before implementing DMOD-08 custom domain create

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable Rails codebase; no fast-moving external dependencies)

# Phase 20: Backend Domain API - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 9 (6 modified, 1 new, 2 pattern references)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/models/brokerage_domain.rb` | model | CRUD | `backend/app/models/brokerage.rb` | role-match |
| `backend/app/models/brokerage.rb` | model | CRUD | `backend/app/models/brokerage_domain.rb` | role-match |
| `backend/app/serializers/brokerage_domain_serializer.rb` (NEW) | serializer | request-response | `backend/app/serializers/brokerage_serializer.rb` | exact |
| `backend/app/controllers/v1/admin/domains_controller.rb` | controller | CRUD | `backend/app/controllers/v1/admin/invitations_controller.rb` | exact |
| `backend/app/controllers/v1/domains_controller.rb` | controller | request-response | existing file (`check` action) | exact |
| `backend/config/routes.rb` | config | — | `backend/config/routes.rb` (current state) | exact |
| `backend/app/mailers/invitation_mailer.rb` | mailer | request-response | existing file (one-line fix) | exact |

---

## Pattern Assignments

### `backend/app/serializers/brokerage_domain_serializer.rb` (NEW serializer, request-response)

**Analog:** `backend/app/serializers/brokerage_serializer.rb`

**Core AMS serializer pattern** (lines 1-3 of brokerage_serializer.rb):
```ruby
class BrokerageSerializer < ActiveModel::Serializer
  attributes :id, :name, :address, :mls_id, :website, :logo_url, :favicon_url, :contact_email, :contact_phone, :plan, :color_scheme, :created_at, :updated_at
end
```

**New file to create** — copy the structure above, swapping attributes per D-02:
```ruby
class BrokerageDomainSerializer < ActiveModel::Serializer
  attributes :id, :domain, :domain_type, :status, :is_primary, :phase_out_at
end
```

No `AssociationLoader` needed — all six attributes are scalar columns on `brokerage_domains`.

**Secondary reference:** `backend/app/serializers/invitation_serializer.rb` — shows when `include AssociationLoader` and computed `attribute` blocks ARE needed (not the case here).

---

### `backend/app/controllers/v1/admin/domains_controller.rb` (controller, CRUD — full rebuild)

**Analog:** `backend/app/controllers/v1/admin/invitations_controller.rb`

**Class declaration + auth split pattern** (invitations_controller.rb lines 1-7):
```ruby
module V1
  module Admin
    class InvitationsController < V1::Admin::BaseController
      skip_before_action :require_admin!, only: [:accept_invitation, :decline_invitation, :validate_token]
      skip_before_action :authenticate_cognito_user!, only: [:validate_token]
      before_action :set_invitation, only: [:destroy]
```

**For domains controller**, the auth split is per D-10 and D-11 (no `skip_before_action :require_admin!` — index keeps it; mutations add `require_owner!`):
```ruby
module V1
  module Admin
    class DomainsController < V1::Admin::BaseController
      # require_admin! is the default from BaseController — index inherits it
      before_action :require_owner!, only: %i[subdomain custom destroy set_primary]
```

**AMS collection render pattern** (invitations_controller.rb lines 21-28):
```ruby
render json: {
  invitations: ActiveModelSerializers::SerializableResource.new(
    invitations,
    each_serializer: InvitationSerializer,
    adapter: :attributes
  ).as_json,
  meta: pagy_metadata(@pagy)
}, status: :ok
```

**For index action** (no pagination — low cardinality per D-04 note):
```ruby
render json: {
  domains: ActiveModelSerializers::SerializableResource.new(
    domains,
    each_serializer: BrokerageDomainSerializer,
    adapter: :attributes
  ).as_json
}, status: :ok
```

**Mutation response pattern — dual key (D-04):**
Both the updated record and the refreshed full list in one response:
```ruby
all_domains = Current.brokerage.brokerage_domains.routable.order(:created_at)
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

**RecordNotFound / RecordInvalid error handling** (invitations_controller.rb lines 237-239):
```ruby
rescue ActiveRecord::RecordInvalid => e
  render json: {error: "Failed to revoke invitation", details: e.record.errors.full_messages}, status: :unprocessable_entity
end
```

**find_by! with explicit not_found rescue** (invitations_controller.rb lines 243-247):
```ruby
def set_invitation
  @invitation = Invitation.pending.find_by!(id: params[:id], brokerage_id: Current.brokerage.id)
rescue ActiveRecord::RecordNotFound
  render json: {error: "Invitation not found"}, status: :not_found
end
```

**Transaction pattern for set_primary (D-08):**
```ruby
ApplicationRecord.transaction do
  Current.brokerage.brokerage_domains
    .where(is_primary: true)
    .update_all(is_primary: false)
  domain.update!(is_primary: true)
end
```
Source: `backend/app/controllers/v1/onboarding/brokerages_controller.rb` lines 66-89 (uses `ActiveRecord::Base.transaction` — use `ApplicationRecord.transaction` per D-08 per onboarding precedent).

**Creating new active subdomain — CRITICAL verified flag** (onboarding/brokerages_controller.rb lines 69-75):
```ruby
BrokerageDomain.create!(
  brokerage_id: brokerage.id,
  domain: full_subdomain_host,
  verified: true,
  verified_at: Time.current,
  verification_token: nil
)
```
Must include `domain_type: :subdomain, status: :active, is_primary: false` in the Phase 20 version. Without `verified: true`, `status_requires_verified` validation raises `ActiveRecord::RecordInvalid`.

**Current brokerage scoping** (domains_controller.rb current, line 11):
```ruby
domains = Current.brokerage.brokerage_domains.where(deleted_at: nil).order(:created_at)
```
Replace with `.routable` scope (D-06 column, Phase 19 output):
```ruby
domains = Current.brokerage.brokerage_domains.routable.order(:created_at)
```

**Pro-tier gate pattern** (brokerage.rb line 14 — `plan` validates inclusion `%w[basic premium]`):
```ruby
unless Current.brokerage.plan == "premium"
  return render json: {error: "Custom domains require a premium plan", code: "plan_required"}, status: :forbidden
end
```

**Phase-out blocking guard (DMOD-12) — pre-action check:**
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

**Phase-out warning (DMOD-11) — post-action check:**
```ruby
phasing_out_count = Current.brokerage.phasing_out_count_for(domain_type)
phase_out_warning = if phasing_out_count == 2
  earliest = Current.brokerage.brokerage_domains
    .status_phasing_out
    .where(domain_type: domain_type)
    .order(:phase_out_at)
    .first
    .phase_out_at
  {earliest_slot_available_at: earliest}
end
# Include in render json hash: phase_out_warning: phase_out_warning (omit if nil)
```

**destroy action branching (DMOD-09 vs DMOD-14):**
The same route `DELETE /v1/admin/domains/:id` handles two behaviors; branch on status:
```ruby
def destroy
  domain = Current.brokerage.brokerage_domains.find_by(id: params[:id])
  return render json: {error: "Domain not found"}, status: :not_found unless domain

  if domain.domain_type_subdomain?
    return render json: {error: "Cannot remove subdomain directly; use PATCH /subdomain to change it", code: "subdomain_not_deletable"}, status: :unprocessable_entity
  end

  if domain.status_active?
    # DMOD-09: phase it out
    # slot check before...
    domain.phase_out!
  elsif domain.status_phasing_out?
    # DMOD-14: immediately decommission
    domain.decommission!
  else
    return render json: {error: "Domain cannot be deleted in its current state"}, status: :unprocessable_entity
  end
  # render mutation response
end
```

---

### `backend/app/models/brokerage_domain.rb` (model — adding instance methods)

**Analog:** existing file at same path (adding to it)

**Existing instance method pattern** (brokerage_domain.rb lines 27-29):
```ruby
def verify!
  update!(verified: true, verified_at: Time.current, verification_token: nil)
end
```

**New methods follow the same pattern** (D-05, D-06, D-07):
```ruby
def phase_out!
  update!(status: :phasing_out, phase_out_at: 30.days.from_now)
end

def decommission!
  update!(status: :decommissioned, deleted_at: Time.current)
end
```

Note: `decommission!` sets `deleted_at` manually — BrokerageDomain does NOT use `acts_as_paranoid` (confirmed: no `acts_as_paranoid` declaration in model). Do NOT call `.destroy`.

**Existing enum scopes to use** (brokerage_domain.rb lines 9-10, 23):
```ruby
enum :status, {active: "active", phasing_out: "phasing_out", decommissioned: "decommissioned"}, prefix: :status
scope :routable, -> { where(status: [:active, :phasing_out]) }
# Gives: .status_active, .status_phasing_out, .status_decommissioned, .routable
```

---

### `backend/app/models/brokerage.rb` (model — adding instance method)

**Analog:** `backend/app/models/brokerage_domain.rb` (slot-counting method to add per D-05)

**Existing association to leverage** (brokerage.rb line 7):
```ruby
has_many :brokerage_domains, dependent: :destroy
```

**New method** — D-05 specifies Brokerage instance method for cleaner controller code:
```ruby
def phasing_out_count_for(type)
  brokerage_domains.status_phasing_out.where(domain_type: type).count
end
```

Note: `Brokerage` uses `acts_as_paranoid` (line 3) but `brokerage_domains` association does not — the `has_many` will not automatically scope for soft-delete on the association side. The `status_phasing_out` enum scope is sufficient to filter active business records here.

---

### `backend/app/controllers/v1/domains_controller.rb` (controller — adding lookup action)

**Analog:** existing file at same path — `check` action is the direct pattern

**Existing check action pattern** (domains_controller.rb lines 9-21):
```ruby
# GET /v1/domains/check?domain=example.com
def check
  domain = params[:domain].to_s.strip.downcase
  if domain.blank?
    return render json: {error: "domain param required"}, status: :bad_request
  end

  exists = BrokerageDomain.status_active.exists?(domain: domain)
  if exists
    render json: {ok: true}, status: :ok
  else
    render json: {error: "unknown domain"}, status: :not_found
  end
end
```

**New lookup action** (DMOD-13 — same file, same class, follows same pattern):
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

No auth needed — `skip_before_action :verify_authenticity_token, raise: false` already declared at class level (line 6).

---

### `backend/config/routes.rb` (config — route changes)

**Analog:** existing file at same path

**Current admin domains block** (routes.rb lines 60-64):
```ruby
resources :domains, only: [:index] do
  member do
    post :verify
  end
end
```

**Replace with** (removing `verify`, adding `destroy`, collection actions, `set_primary` member action):
```ruby
resources :domains, only: [:index, :destroy] do
  collection do
    patch :subdomain   # PATCH /v1/admin/domains/subdomain (DMOD-07)
    post  :custom      # POST /v1/admin/domains/custom (DMOD-08)
  end
  member do
    patch :set_primary  # PATCH /v1/admin/domains/:id/set_primary (DMOD-10)
  end
end
```

**Current public domains block** (routes.rb lines 52-56):
```ruby
resources :domains, only: [] do
  collection do
    get :check
  end
end
```

**Replace with** (adding lookup action):
```ruby
resources :domains, only: [] do
  collection do
    get :check
    get :lookup  # GET /v1/domains/lookup?domain=X (DMOD-13)
  end
end
```

**Pitfall:** `subdomain` and `custom` MUST be declared as `collection` actions, not `member` actions. If declared as member, `PATCH /v1/admin/domains/subdomain` routes with `params[:id] = "subdomain"` instead of dispatching to the `subdomain` action.

---

### `backend/app/mailers/invitation_mailer.rb` (mailer — one-line fix, DINT-02)

**Analog:** existing file at same path — no structural change, single method update

**Current `primary_domain` method** (invitation_mailer.rb lines 23-27):
```ruby
def primary_domain(brokerage)
  brokerage.brokerage_domains
    .where(verified: true)
    .where.not(domain: "localhost")
    .first&.domain || brokerage.brokerage_domains.first&.domain
end
```

**Replace line 24 only** — change `where(verified: true)` to `where(is_primary: true)`:
```ruby
def primary_domain(brokerage)
  brokerage.brokerage_domains
    .where(is_primary: true)
    .where.not(domain: "localhost")
    .first&.domain || brokerage.brokerage_domains.first&.domain
end
```

All surrounding method structure (setup, mail calls, instance variable assignment) stays unchanged.

---

## Shared Patterns

### Authentication — require_admin! and require_owner!
**Source:** `backend/app/controllers/v1/admin/base_controller.rb` (lines 13-33)
**Apply to:** `V1::Admin::DomainsController`

```ruby
# BaseController already provides both methods:
def require_admin!
  membership = BrokerageMembership.without_deleted.find_by(
    user_id: Current.user.id,
    brokerage_id: Current.brokerage.id
  )
  unless membership && %w[owner admin].include?(membership.role)
    render json: { error: { code: "forbidden", message: "You do not have permission to perform this action." } },
           status: :forbidden
  end
end

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

Index uses inherited `require_admin!`. Mutation actions (`subdomain`, `custom`, `destroy`, `set_primary`) get `before_action :require_owner!` declared at top of the controller.

### Tenant Scoping
**Source:** All admin controllers (pattern from `V1::Admin::DomainsController` current index, line 11)
**Apply to:** Every query in `V1::Admin::DomainsController`

```ruby
# Always scope to Current.brokerage — never query BrokerageDomain globally
Current.brokerage.brokerage_domains.routable.order(:created_at)
# NOT: BrokerageDomain.where(brokerage_id: Current.brokerage.id)
```

### AMS Collection Serialization
**Source:** `backend/app/controllers/v1/admin/invitations_controller.rb` (lines 21-28)
**Apply to:** Index action and the `domains:` key in mutation responses

```ruby
ActiveModelSerializers::SerializableResource.new(
  collection,
  each_serializer: BrokerageDomainSerializer,
  adapter: :attributes
).as_json
```

Use `adapter: :attributes` on inline `SerializableResource.new` calls to prevent double root-key wrapping when the collection is embedded inside an outer hash.

### Error Handling for RecordInvalid
**Source:** `backend/app/controllers/v1/admin/invitations_controller.rb` (lines 237-239)
**Apply to:** All mutation actions in `V1::Admin::DomainsController`

```ruby
rescue ActiveRecord::RecordInvalid => e
  render json: {error: "Failed to ...", details: e.record.errors.full_messages}, status: :unprocessable_entity
end
```

### Manual Soft-Delete on BrokerageDomain
**Source:** `backend/app/models/brokerage_domain.rb` (no `acts_as_paranoid` declaration)
**Apply to:** `decommission!` model method and any destroy logic

```ruby
# BrokerageDomain does NOT use acts_as_paranoid
# Set deleted_at manually — never call .destroy or .paranoid_destroy
update!(status: :decommissioned, deleted_at: Time.current)
```

---

## No Analog Found

All files have direct codebase analogs. No file in this phase requires falling back to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `backend/app/controllers/v1/admin/`, `backend/app/serializers/`, `backend/app/models/`, `backend/app/mailers/`, `backend/config/`
**Files scanned:** 11 (domains_controller x2, base_controller, invitations_controller, brokerage_serializer, invitation_serializer, brokerage_domain.rb, brokerage.rb, invitation_mailer.rb, onboarding/brokerages_controller.rb, routes.rb)
**Pattern extraction date:** 2026-05-27

# Phase 22: DNS Verification & Health Monitoring Backend - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 14 new/modified files
**Analogs found:** 13 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/db/migrate/YYYYMMDD_add_domain_health_columns.rb` | migration | batch | `backend/db/migrate/20260527000001_add_lifecycle_columns_to_brokerage_domains.rb` | exact |
| `backend/app/models/brokerage_domain.rb` (update) | model | CRUD | self (existing file) | exact |
| `backend/app/models/brokerage.rb` (update) | model | CRUD | `backend/app/models/brokerage_domain.rb` (phase_out!/decommission! pattern) | role-match |
| `backend/app/jobs/domain_verification_job.rb` | job | batch | `backend/app/jobs/resync_stale_photos_job.rb` | exact |
| `backend/app/jobs/domain_health_job.rb` | job | batch | `backend/app/jobs/resync_stale_photos_job.rb` | exact |
| `backend/config/recurring.yml` (update) | config | — | self (existing file) | exact |
| `backend/app/mailers/domain_mailer.rb` | mailer | request-response | `backend/app/mailers/invitation_mailer.rb` | exact |
| `backend/app/views/domain_mailer/health_failure.html.erb` | view | — | `backend/app/views/invitation_mailer/invite_brokerage.html.erb` | exact |
| `backend/app/views/domain_mailer/health_failure.text.erb` | view | — | `backend/app/views/invitation_mailer/invite_brokerage.text.erb` | exact |
| `backend/app/views/domain_mailer/downgrade_notice.html.erb` | view | — | `backend/app/views/invitation_mailer/invite_brokerage.html.erb` | exact |
| `backend/app/views/domain_mailer/downgrade_notice.text.erb` | view | — | `backend/app/views/invitation_mailer/invite_brokerage.text.erb` | exact |
| `backend/app/views/domain_mailer/unverified_warning.html.erb` | view | — | `backend/app/views/invitation_mailer/invite_brokerage.html.erb` | exact |
| `backend/app/views/domain_mailer/unverified_warning.text.erb` | view | — | `backend/app/views/invitation_mailer/invite_brokerage.text.erb` | exact |
| `backend/app/controllers/ops/plan_controller.rb` | controller | request-response | `backend/app/controllers/ops/brokerage_domains_controller.rb` | role-match |
| `backend/app/controllers/v1/admin/domains_controller.rb` (update) | controller | CRUD | self (existing file) | exact |
| `backend/app/serializers/brokerage_domain_serializer.rb` (update) | serializer | — | self (existing file) | exact |
| `backend/config/routes.rb` (update) | config | — | self (existing file) | exact |

---

## Pattern Assignments

### `backend/db/migrate/YYYYMMDD_add_domain_health_columns.rb` (migration, batch)

**Analog:** `backend/db/migrate/20260527000001_add_lifecycle_columns_to_brokerage_domains.rb`

**Migration structure pattern** (lines 1-7):
```ruby
class AddLifecycleColumnsToBrokerageDomains < ActiveRecord::Migration[7.1]
  def up
    add_column :brokerage_domains, :domain_type, :string, null: false, default: "subdomain"
    add_column :brokerage_domains, :status,      :string, null: false, default: "active"
    add_column :brokerage_domains, :is_primary,  :boolean, null: false, default: false
    add_column :brokerage_domains, :phase_out_at, :datetime, null: true
```

**New columns for Phase 22** — use simple `change` (both new columns are additive):
```ruby
class AddDomainHealthColumnsToBrokerageDomains < ActiveRecord::Migration[7.1]
  def change
    add_column :brokerage_domains, :consecutive_failures, :integer, null: false, default: 0
    add_column :brokerage_domains, :last_checked_at, :datetime, null: true
  end
end
```

NOTE: `status` is a Rails string enum (type `t.string`), NOT a PostgreSQL native enum. Adding `pending` and `frozen` to the enum hash in the model requires NO `ALTER TYPE` migration — model-only change.

---

### `backend/app/models/brokerage_domain.rb` (model update — enum + lifecycle methods)

**Analog:** self (lines 1-91)

**Existing enum pattern** (line 10) — extend with two new values:
```ruby
# Before:
enum :status, {active: "active", phasing_out: "phasing_out", decommissioned: "decommissioned"}, prefix: :status

# After Phase 22:
enum :status, {active: "active", phasing_out: "phasing_out", decommissioned: "decommissioned", pending: "pending", frozen: "frozen"}, prefix: :status
```

**Existing lifecycle method pattern** (lines 35-41) — new `freeze!`/`unfreeze!` follow the same `update!` form:
```ruby
def phase_out!
  update!(status: :phasing_out, phase_out_at: 30.days.from_now)
end

def decommission!
  update!(status: :decommissioned, deleted_at: Time.current)
end
```

New methods to add (following same pattern):
```ruby
def freeze_domain!
  update!(status: :frozen)
end

def unfreeze_domain!
  update!(status: :active)
end
```

**DHLT-05 constant extraction:** The existing `phase_out!` at line 36 uses `30.days.from_now` inline. Replace with `PHASE_OUT_DURATION` constant defined at model level:
```ruby
PHASE_OUT_DURATION = 30.days

def phase_out!
  update!(status: :phasing_out, phase_out_at: PHASE_OUT_DURATION.from_now)
end
```

**Existing validation guard** (lines 85-90) — already covers `pending`/`frozen` correctly (only fires on `status_active?`):
```ruby
def status_requires_verified
  return unless status_active?
  unless verified?
    errors.add(:status, "cannot be set to active unless the domain is verified")
  end
end
```

---

### `backend/app/models/brokerage.rb` (model update — freeze service methods)

**Analog:** `backend/app/models/brokerage_domain.rb` for transaction + update! pattern; `backend/app/models/brokerage.rb` lines 1-27 for association pattern.

**Existing association pattern** (lines 6-8):
```ruby
has_many :brokerage_domains, dependent: :destroy
has_many :brokerage_memberships, dependent: :destroy
has_many :users, through: :brokerage_memberships
```

**Existing service method pattern** (lines 24-26):
```ruby
def phasing_out_count_for(type)
  brokerage_domains.status_phasing_out.where(domain_type: type).count
end
```

**New service methods follow transaction + `update_all` for bulk + `update!` for individual:**
```ruby
def freeze_custom_domains!
  ApplicationRecord.transaction do
    brokerage_domains.domain_type_custom
                     .where(status: [:active, :pending, :phasing_out])
                     .update_all(status: "frozen")
    brokerage_domains.update_all(is_primary: false)
    brokerage_domains.domain_type_subdomain
                     .status_active
                     .first
                     &.update!(is_primary: true)
  end
end

def unfreeze_custom_domains!
  brokerage_domains.domain_type_custom
                   .status_frozen
                   .update_all(status: "active")
end
```

NOTE: `update_all` is safe here for `frozen` transition because `status_requires_verified` only fires on `status_active?` — bulk freeze bypasses no relevant validation. For unfreeze (frozen → active), the `status_requires_verified` validation would normally require `verified: true`, but previously-active domains were already verified. Use `update_all` (bypasses validation) with care — or ensure domains being unfrozen already have `verified: true`.

---

### `backend/app/jobs/domain_verification_job.rb` (job, batch)

**Analog:** `backend/app/jobs/resync_stale_photos_job.rb` (lines 1-57)

**Job class skeleton pattern** (lines 1-4):
```ruby
class ResyncStalePhotosJob < ApplicationJob
  queue_as :background
  retry_on StandardError, wait: :exponentially_longer, attempts: 5
```

**`in_batches` iteration pattern** (lines 22-55):
```ruby
stale_scope.in_batches(of: BATCH_SIZE) do |batch|
  break if batches_processed >= MAX_BATCHES
  # ... per-record processing
end
```

**DomainVerificationJob skeleton** following this pattern exactly:
```ruby
class DomainVerificationJob < ApplicationJob
  queue_as :background
  retry_on StandardError, wait: :polynomially_longer, attempts: 5

  VERIFICATION_EXPIRY_DAYS = 7
  WARNING_EMAIL_DAYS = 5

  def perform
    # Pending domains: verify CNAME
    BrokerageDomain.without_deleted
                   .domain_type_custom
                   .status_pending
                   .in_batches do |batch|
      batch.each { |domain| process_pending(domain) }
    end

    # Phasing-out domains: rescue opportunity (DLCX-01)
    BrokerageDomain.without_deleted
                   .domain_type_custom
                   .status_phasing_out
                   .where("phase_out_at > ?", Time.current)
                   .in_batches do |batch|
      batch.each { |domain| process_phasing_out(domain) }
    end
  end
end
```

**DVER-05 pessimistic lock pattern** — wrap promotion in transaction + lock:
```ruby
def promote_to_active!(domain)
  ApplicationRecord.transaction do
    locked = BrokerageDomain.lock.find(domain.id)
    return if locked.status_active? # already promoted by another worker
    locked.update!(
      status: :active,
      verified: true,
      verified_at: Time.current,
      consecutive_failures: 0,
      last_checked_at: Time.current
    )
  end
end
```

**DNS resolution pattern** — use `getresources` (plural, returns `[]` on miss) per D-01, NOT `getresource` (singular, raises on miss as used in the onboarding controller at line 65):
```ruby
# Onboarding controller (DO NOT copy): uses getresource which raises
resolver = Resolv::DNS.new
cname = resolver.getresource(domain, Resolv::DNS::Resource::IN::CNAME)

# Phase 22 pattern (D-01): use getresources which returns [] on miss
def cname_resolves_to_subdomain?(custom_domain_str, target_subdomain_str)
  Resolv::DNS.open do |dns|
    records = dns.getresources(custom_domain_str, Resolv::DNS::Resource::IN::CNAME)
    records.any? { |r| r.name.to_s.chomp(".") == target_subdomain_str.chomp(".") }
  end
rescue Resolv::ResolvError, Resolv::ResolvTimeout
  false
end
```

Target subdomain lookup per D-02:
```ruby
target = domain.brokerage.brokerage_domains
                         .domain_type_subdomain
                         .status_active
                         .first
                         &.domain
return false if target.nil?
```

---

### `backend/app/jobs/domain_health_job.rb` (job, batch)

**Analog:** `backend/app/jobs/resync_stale_photos_job.rb` (lines 1-57)

Identical skeleton to `DomainVerificationJob`. Constants live in whichever job/model is most appropriate — RESEARCH.md recommends `PHASE_OUT_DURATION` in `BrokerageDomain` (since `phase_out!` lives there) and `HEALTH_CHECK_INTERVAL = 30.minutes` in `DomainHealthJob`:

```ruby
class DomainHealthJob < ApplicationJob
  queue_as :background
  retry_on StandardError, wait: :polynomially_longer, attempts: 5

  HEALTH_CHECK_INTERVAL = 30.minutes

  def perform
    BrokerageDomain.without_deleted
                   .domain_type_custom
                   .status_active
                   .in_batches do |batch|
      batch.each { |domain| process_health_check(domain) }
    end
  end
end
```

Email dispatch pattern (from `send_invitation_email_job.rb` line 9) — use `deliver_now!` inside the job, not `deliver_later`:
```ruby
DomainMailer.health_failure(domain).deliver_now!
```

---

### `backend/config/recurring.yml` (config update)

**Analog:** self (line 1-4, entire current file)

**Existing entry format:**
```yaml
resync_stale_photos:
  class: ResyncStalePhotosJob
  queue: background
  schedule: every day at 3am
```

**New entries to append** (flat structure, no environment keys, natural-language schedule strings):
```yaml
domain_verification:
  class: DomainVerificationJob
  queue: background
  schedule: every 30 minutes

domain_health:
  class: DomainHealthJob
  queue: background
  schedule: every 30 minutes
```

---

### `backend/app/mailers/domain_mailer.rb` (mailer, new)

**Analog:** `backend/app/mailers/invitation_mailer.rb` (lines 1-29)

**ApplicationMailer base** (lines 1-4 of `application_mailer.rb`):
```ruby
class ApplicationMailer < ActionMailer::Base
  default from: "noreply@notifications.realtybase.ca"
  layout "mailer"
end
```

**InvitationMailer pattern** (lines 1-29) — private `setup` method + `primary_domain` helper:
```ruby
class InvitationMailer < ApplicationMailer
  def invite_brokerage(invitation)
    setup(invitation)
    mail(to: invitation.email, subject: "You've been invited to join #{@brokerage.name}")
  end

  private

  def setup(invitation)
    @invitation = invitation
    @brokerage = invitation.brokerage
    @inviter = invitation.inviter
    @domain = primary_domain(@brokerage)
    @invitation_url = "https://#{@domain}/invite/#{invitation.token}"
  end

  def primary_domain(brokerage)
    brokerage.brokerage_domains
      .where(is_primary: true)
      .where.not(domain: "localhost")
      .first&.domain || brokerage.brokerage_domains.first&.domain
  end
end
```

**DomainMailer skeleton** — copy `primary_domain` helper directly; owner recipient resolution per D-13 (always use `.without_deleted`):
```ruby
class DomainMailer < ApplicationMailer
  def health_failure(domain)
    @domain = domain
    @brokerage = domain.brokerage
    @dashboard_url = "https://#{primary_domain(@brokerage)}/admin/domains"
    mail(to: owner_emails(@brokerage), subject: "Domain health check failed: #{domain.domain}")
  end

  def downgrade_notice(brokerage)
    @brokerage = brokerage
    @dashboard_url = "https://#{primary_domain(@brokerage)}/admin/domains"
    mail(to: owner_emails(@brokerage), subject: "Your custom domains have been paused")
  end

  def unverified_warning(domain)
    @domain = domain
    @brokerage = domain.brokerage
    @dashboard_url = "https://#{primary_domain(@brokerage)}/admin/domains"
    mail(to: owner_emails(@brokerage), subject: "Action required: domain #{domain.domain} expires in 2 days")
  end

  private

  def owner_emails(brokerage)
    BrokerageMembership.without_deleted
                       .where(brokerage: brokerage, role: "owner")
                       .includes(:user)
                       .map { |m| m.user.email }
  end

  def primary_domain(brokerage)
    brokerage.brokerage_domains
      .where(is_primary: true)
      .where.not(domain: "localhost")
      .first&.domain || brokerage.brokerage_domains.first&.domain
  end
end
```

---

### `backend/app/views/domain_mailer/*.html.erb` + `*.text.erb` (6 view files)

**Analog:** `backend/app/views/invitation_mailer/invite_brokerage.html.erb` (lines 1-84) and `invite_brokerage.text.erb` (lines 1-21)

**HTML email layout shell** — copy this outer table structure for all three HTML templates:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[email subject]</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <!-- Header (lines 14-23): brokerage logo or name -->
            <!-- Body (lines 25-67): h1 + p + CTA button -->
            <!-- Footer (lines 70-77): "Sent via RealtyBase · brokerage name" -->
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

**Text email layout shell** — copy this structure for all three text templates:
```text
[Subject line]

[Body paragraph]

[Action label]:
[URL]

--
Sent via RealtyBase · <%= @brokerage.name %>
```

**CTA button pattern** (lines 52-61 of `invite_brokerage.html.erb`):
```html
<table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
  <tr>
    <td style="background-color:#18181b;border-radius:6px;">
      <a href="<%= @dashboard_url %>" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
        Go to Domain Settings
      </a>
    </td>
  </tr>
</table>
```

---

### `backend/app/controllers/ops/plan_controller.rb` (controller, new)

**Analog:** `backend/app/controllers/ops/brokerage_domains_controller.rb` (lines 1-36) for ops namespace structure; `backend/app/controllers/ops/base_controller.rb` (lines 1-12) for auth.

**Ops BaseController** (lines 1-12) — HTTP Basic + CSRF protection inherited:
```ruby
module Ops
  class BaseController < ActionController::Base
    layout "ops"
    http_basic_authenticate_with(
      name: ENV.fetch("OPS_USERNAME"),
      password: ENV.fetch("OPS_PASSWORD")
    )
    protect_from_forgery with: :exception
  end
end
```

**BrokerageDomainsController namespace + set_brokerage pattern** (lines 1-5, 28-30):
```ruby
module Ops
  class BrokerageDomainsController < BaseController
    before_action :set_brokerage

    private

    def set_brokerage
      @brokerage = Brokerage.without_deleted.find(params[:brokerage_id])
    end
  end
end
```

**PlanController** — must add `skip_before_action :verify_authenticity_token` since this is a JSON endpoint invoked by curl/webhook (not a browser form), unlike existing ops controllers which serve HTML forms:
```ruby
module Ops
  class PlanController < BaseController
    skip_before_action :verify_authenticity_token, raise: false
    before_action :set_brokerage

    def update
      freeze = ActiveModel::Type::Boolean.new.cast(params[:freeze])
      if freeze
        @brokerage.freeze_custom_domains!
        render json: { status: "frozen", brokerage_id: @brokerage.id }, status: :ok
      else
        @brokerage.unfreeze_custom_domains!
        render json: { status: "unfrozen", brokerage_id: @brokerage.id }, status: :ok
      end
    rescue => e
      render json: { error: e.message }, status: :unprocessable_entity
    end

    private

    def set_brokerage
      @brokerage = Brokerage.without_deleted.find(params[:brokerage_id])
    end
  end
end
```

**Route addition** — nest under existing `resources :brokerages` block in `config/routes.rb` (lines 6-11):
```ruby
namespace :ops do
  resources :brokerages, only: [:index, :new, :create, :show, :update, :destroy] do
    resource :plan, only: [:update], controller: "plan"   # POST /ops/brokerages/:brokerage_id/plan
    resources :brokerage_domains, only: [:create, :destroy]
    resources :brokerage_memberships, only: [:destroy]
    resources :invitations, only: [:create, :destroy]
  end
end
```

---

### `backend/app/controllers/v1/admin/domains_controller.rb` (update — D-08)

**Analog:** self (lines 64-84, the `custom` action)

**Current `custom` action create call** (lines 70-78) — change `status: :active, verified: true, verified_at:, verification_token: nil` to `status: :pending, verified: false`:
```ruby
# Before (lines 70-78):
new_domain = Current.brokerage.brokerage_domains.create!(
  domain: domain_param,
  domain_type: :custom,
  status: :active,
  is_primary: false,
  verified: true,
  verified_at: Time.current,
  verification_token: nil
)

# After D-08:
new_domain = Current.brokerage.brokerage_domains.create!(
  domain: domain_param,
  domain_type: :custom,
  status: :pending,
  is_primary: false,
  verified: false
  # verification_token set automatically by before_create :generate_verification_token
)
```

Also update the `destroy` action (lines 87-121) to handle `status_pending?` — pending domains should `decommission!` immediately (no live traffic to protect). Add a branch before the existing phasing_out check:
```ruby
if domain.status_pending?
  domain.decommission!
  return render json: mutation_payload(domain, domain.domain_type.to_sym), status: :ok
end
```

---

### `backend/app/serializers/brokerage_domain_serializer.rb` (update)

**Analog:** self (line 1-3)

**Current serializer** (lines 1-3):
```ruby
class BrokerageDomainSerializer < ActiveModel::Serializer
  attributes :id, :domain, :domain_type, :status, :is_primary, :phase_out_at
end
```

**Add new columns** — append `last_checked_at`, `consecutive_failures`, `verified`, `verified_at`:
```ruby
class BrokerageDomainSerializer < ActiveModel::Serializer
  attributes :id, :domain, :domain_type, :status, :is_primary, :phase_out_at,
             :verified, :verified_at, :last_checked_at, :consecutive_failures
end
```

---

## Shared Patterns

### Soft Delete Guard on BrokerageMembership
**Source:** `backend/app/models/brokerage.rb` line 12 + CLAUDE.md project instructions
**Apply to:** `DomainMailer` (all three methods), any job that queries memberships
```ruby
# ALWAYS chain .without_deleted — acts_as_paranoid does NOT add a default scope
BrokerageMembership.without_deleted
                   .where(brokerage: brokerage, role: "owner")
                   .includes(:user)
```

### Transaction Pattern
**Source:** `backend/app/controllers/v1/admin/domains_controller.rb` lines 136-141
**Apply to:** `Brokerage#freeze_custom_domains!`, `DomainVerificationJob#promote_to_active!`
```ruby
ApplicationRecord.transaction do
  # multi-record updates
end
```

### Pessimistic Row Lock
**Source:** Rails `ActiveRecord::Locking::Pessimistic` (standard Rails pattern, confirmed in RESEARCH.md)
**Apply to:** `DomainVerificationJob#promote_to_active!` (DVER-05)
```ruby
ApplicationRecord.transaction do
  locked = BrokerageDomain.lock.find(domain.id)
  return if locked.status_active?   # idempotency guard
  locked.update!(status: :active, verified: true, ...)
end
```

### Error Handling in Controllers
**Source:** `backend/app/controllers/v1/admin/domains_controller.rb` lines 45-48, 82-84
**Apply to:** `Ops::PlanController`
```ruby
rescue ActiveRecord::RecordInvalid => e
  render json: { error: "...", details: e.record.errors.full_messages }, status: :unprocessable_entity
```

### Email Delivery Inside Job
**Source:** `backend/app/jobs/send_invitation_email_job.rb` line 9
**Apply to:** Both `DomainVerificationJob` and `DomainHealthJob` when dispatching `DomainMailer` emails
```ruby
DomainMailer.health_failure(domain).deliver_now!
# Use deliver_now! (not deliver_later) — job is already async; deliver_now! inside job is the established pattern
```

### `retry_on` / `discard_on` Pattern for Jobs
**Source:** `backend/app/jobs/send_invitation_email_job.rb` lines 2-4; `backend/app/jobs/resync_stale_photos_job.rb` lines 2-3
**Apply to:** `DomainVerificationJob`, `DomainHealthJob`
```ruby
retry_on StandardError, wait: :polynomially_longer, attempts: 5
# Note: ResyncStalePhotosJob uses :exponentially_longer but polynomially_longer
# is in SendInvitationEmailJob — use polynomially_longer for domain jobs (gentler backoff for DNS)
```

### `primary_domain` Helper in Mailers
**Source:** `backend/app/mailers/invitation_mailer.rb` lines 23-27
**Apply to:** `DomainMailer` — copy this method verbatim
```ruby
def primary_domain(brokerage)
  brokerage.brokerage_domains
    .where(is_primary: true)
    .where.not(domain: "localhost")
    .first&.domain || brokerage.brokerage_domains.first&.domain
end
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| None | — | — | All Phase 22 files have close analogs in the codebase |

---

## Metadata

**Analog search scope:** `backend/app/jobs/`, `backend/app/mailers/`, `backend/app/views/invitation_mailer/`, `backend/app/models/`, `backend/app/controllers/ops/`, `backend/app/controllers/v1/admin/`, `backend/app/serializers/`, `backend/config/`, `backend/db/migrate/`
**Files scanned:** 13 source files read directly
**Pattern extraction date:** 2026-05-30

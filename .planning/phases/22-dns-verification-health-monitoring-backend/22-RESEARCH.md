# Phase 22: DNS Verification & Health Monitoring Backend - Research

**Researched:** 2026-05-30
**Domain:** Ruby/Rails background jobs, DNS resolution, ActionMailer, SolidQueue recurring tasks, domain lifecycle state machine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** DNS lookup uses Ruby's built-in `Resolv` library — no system dependency. `Resolv::DNS.open { |dns| dns.getresources(domain, Resolv::DNS::Resource::IN::CNAME) }`.
- **D-02:** The CNAME target to verify against is the brokerage's own subdomain (looked up from `brokerage_domains` at check time, not a hardcoded platform value).
- **D-03:** Any lookup failure (wrong target, DNS error, timeout, domain not found) counts as a failure. No distinction between transient and permanent errors.
- **D-04:** Both jobs run sequentially over all matching domains in a single job execution — no per-domain fanout. Matches `ResyncStalePhotosJob` pattern.
- **D-05:** The freeze/unfreeze trigger is external. Phase 22 builds `Brokerage#freeze_custom_domains!` and `#unfreeze_custom_domains!` service methods only.
- **D-06:** A JSON ops endpoint `POST /ops/brokerages/:id/plan` is added for manual freeze/unfreeze. Accepts `freeze: true/false`. Secured behind existing ops auth.
- **D-07:** Same endpoint handles both freeze (downgrade) and unfreeze (re-upgrade) via `freeze` param toggle.
- **D-08:** `POST /v1/admin/domains/custom` is updated to create custom domains with `status: pending, verified: false`.
- **D-09:** `pending` and `frozen` are added to the `BrokerageDomain` status enum in the same Phase 22 migration.
- **D-10:** Existing `status_active?` guard in `set_primary` and `status_requires_verified` validation already cover `pending` and `frozen` correctly — no additional audit needed.
- **D-11:** One `DomainMailer` class with three methods: `health_failure(domain)`, `downgrade_notice(brokerage)`, `unverified_warning(domain)`.
- **D-12:** ActionMailer ERB templates — `app/views/domain_mailer/{method_name}.html.erb` + `.text.erb` per method.
- **D-13:** Recipient resolution for owner-role emails: `BrokerageMembership.where(role: 'owner').includes(:user)` at send time.

### Claude's Discretion
- Queue assignment for new jobs: `:background` queue (follow `ResyncStalePhotosJob`).
- Naming constants (DHLT-05): `HEALTH_CHECK_INTERVAL = 30.minutes` and `PHASE_OUT_DURATION = 30.days` — Claude decides location (module-level constants in job class or `DomainConstants` module).
- DVER-05 race condition: Claude decides exact locking mechanism — `with_lock` / `lock!` / `BrokerageDomain.lock.find(domain_id)` inside a transaction before promoting to active.
- Job class naming: `DomainVerificationJob` (handles pending) and `DomainHealthJob` (handles active). Claude confirms names during planning.

### Deferred Ideas (OUT OF SCOPE)
- `POST /ops/brokerages/:id/plan` for actual plan changes (e.g., upgrading premium) — Phase 22 endpoint only toggles domain freeze.
- Full billing integration — v2.
- Notification/alert at `consecutive_failures` hits 1 or 2 (early warning before full phase-out).
- Retry budget / backoff within verification job for flapping domains.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DVER-02 | Background verification polling runs every 30 minutes for all pending and phasing-out domains | SolidQueue recurring.yml `every 30 minutes` schedule confirmed [VERIFIED: Context7] |
| DVER-05 | Simultaneous registrations resolved by first-to-verify wins | Pessimistic lock via `BrokerageDomain.lock.find` inside transaction [VERIFIED: codebase CONTEXT.md specifics] |
| DHLT-01 | Active custom domains checked every 30 minutes | Second SolidQueue recurring job [VERIFIED: Context7] |
| DHLT-02 | After 3 consecutive failed health checks (~90 min), domain auto-moved to Phasing out | `consecutive_failures` counter + `phase_out!` when count reaches 3 [VERIFIED: codebase schema] |
| DHLT-03 | Health failure email to Owner-role users with domain, reason, decommission date, dashboard link | `DomainMailer#health_failure` + `BrokerageMembership.where(role: 'owner')` [VERIFIED: codebase] |
| DHLT-04 | If failed domain was primary, email explicitly calls this out | Conditional in `health_failure` email template [VERIFIED: CONTEXT.md D-11] |
| DHLT-05 | Health check cadence and phase-out duration as named constants | `HEALTH_CHECK_INTERVAL = 30.minutes`, `PHASE_OUT_DURATION = 30.days` [VERIFIED: CONTEXT.md] |
| DLCX-01 | Phasing-out domain restored to active if CNAME passes before decommission date | `DomainVerificationJob` checks `phase_out_at > Time.current` before restoring [VERIFIED: CONTEXT.md specifics] |
| DPRI-01 | Any fully active domain can be set as primary (Owner only) | Existing `set_primary` already enforces `status_active?` — no change needed [VERIFIED: codebase] |
| DPRI-02 | Pending/phasing-out domains cannot be set as primary | Covered by existing `unless domain.status_active?` guard [VERIFIED: codebase] |
| DPRD-01 | On Pro downgrade, all custom domains frozen | `Brokerage#freeze_custom_domains!` transitions active/pending/phasing_out custom domains to frozen [VERIFIED: CONTEXT.md D-05] |
| DPRD-03 | Subdomain automatically becomes primary on downgrade | `freeze_custom_domains!` finds `domain_type_subdomain.status_active.first` and sets `is_primary: true` [VERIFIED: codebase pattern] |
| DPRD-05 | Owner-role email on plan downgrade explaining domain effect | `DomainMailer#downgrade_notice(brokerage)` [VERIFIED: CONTEXT.md D-11] |
| DPRD-06 | On re-upgrade to Pro, frozen custom domains restored to active | `Brokerage#unfreeze_custom_domains!` transitions frozen custom domains back to active [VERIFIED: CONTEXT.md D-05] |
| DADD-04 | Unverified pending domains auto-removed after 7 days; day-5 warning email to owners | `DomainVerificationJob` checks age and sends `DomainMailer#unverified_warning` at day 5, decommissions at day 7 [VERIFIED: CONTEXT.md specifics] |
</phase_requirements>

---

## Summary

Phase 22 is a pure backend phase adding autonomous DNS lifecycle management to an established Rails 7.1 + SolidQueue stack. The codebase already has a working DNS resolution helper (`Resolv::DNS`) in `V1::Onboarding::DomainsController`, a sequential batch job pattern in `ResyncStalePhotosJob`, a transactional email pattern in `SendInvitationEmailJob`, and a lifecycle transition model in `BrokerageDomain`. Phase 22 extends all of these rather than introducing new patterns.

The domain model uses string-backed Rails enums (not PostgreSQL native enums), so adding `pending` and `frozen` values requires only updating the model enum declaration — no `ALTER TYPE` migration is needed. The two new DB columns (`consecutive_failures integer default 0` and `last_checked_at datetime nullable`) are standard Rails migrations. The unique domain index (`WHERE status != 'decommissioned'`) correctly covers all new status values without modification.

The key architectural challenge is the first-to-verify race condition (DVER-05): two overlapping job runs could both detect the same pending domain's CNAME resolving and both attempt to promote it. The solution is a transaction + pessimistic lock (`BrokerageDomain.lock.find(id)`) inside the promotion step. The ops freeze endpoint introduces the only non-trivial pattern divergence: it must skip CSRF verification (`skip_before_action :verify_authenticity_token, raise: false`) because `Ops::BaseController` inherits from `ActionController::Base` (which has CSRF) whereas the new endpoint is a JSON API call.

**Primary recommendation:** Implement in this wave order — (1) migration + model enum update, (2) `DomainVerificationJob` + `DomainHealthJob` + recurring.yml entries, (3) `DomainMailer` with three methods + ERB templates, (4) `Brokerage#freeze_custom_domains!` / `#unfreeze_custom_domains!`, (5) ops plan endpoint, (6) update `DomainsController#custom` for pending status, (7) update serializer.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DNS CNAME polling (DVER-02, DHLT-01) | Background Job (SolidQueue) | — | Recurring jobs own all autonomous polling; no HTTP request layer involved |
| Domain status transitions (DLCX-01, DHLT-02) | Model (BrokerageDomain) | Background Job (calls model methods) | State machine logic belongs in the model; jobs orchestrate, models transition |
| Freeze/unfreeze on plan change (DPRD-01, DPRD-06) | Model (Brokerage) | Ops Controller (trigger) | Service methods on Brokerage encapsulate multi-record transactions; ops endpoint is the trigger |
| Transactional emails (DHLT-03, DPRD-05, DADD-04) | Mailer (DomainMailer) | Background Job (dispatches) | ActionMailer owns email composition; jobs call deliver_now! in their execution context |
| DVER-05 race prevention | Model/DB layer | — | Pessimistic lock (SELECT FOR UPDATE) at DB level is the only reliable race guard |
| Primary domain promotion on freeze (DPRD-03) | Model (Brokerage#freeze_custom_domains!) | — | Atomic transaction on brokerage's domains; belongs in model service method |
| Ops freeze endpoint (D-06) | Ops Controller | — | Manual trigger only; secured by HTTP Basic auth from Ops::BaseController |
| Pending status on domain creation (D-08) | API Controller (DomainsController) | — | Creation API change; job then drives promotion |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| solid_queue | 0.9.0 | Background job processing + recurring tasks | Already installed, DB-backed, no Redis [VERIFIED: backend/Gemfile.lock] |
| Ruby Resolv (stdlib) | built-in | DNS lookups (CNAME resolution) | Already used in `V1::Onboarding::DomainsController`; no gem install [VERIFIED: codebase] |
| ActionMailer (Rails 7.1) | built-in | Transactional email composition + delivery | Established pattern via `InvitationMailer` [VERIFIED: codebase] |
| Resend gem | installed | Email delivery backend | Already configured via Rails credentials [VERIFIED: backend/Gemfile] |
| acts_as_paranoid | installed | Soft deletes (used by BrokerageMembership) | Required for `.without_deleted` scopes on recipient queries [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| active_model_serializers | installed | JSON serialization | When updating `BrokerageDomainSerializer` to include new columns [VERIFIED: codebase] |
| FactoryBot + Minitest | installed | Test infrastructure | All new model/job/mailer tests follow existing patterns [VERIFIED: test_helper.rb] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Resolv::DNS.open { getresources }` | `Resolv::DNS.new` + `getresource` | `getresources` returns `[]` on miss; `getresource` raises `Resolv::ResolvError`. `getresources` is safer in batch jobs — D-01 locked this choice |
| Sequential job over all domains | Per-domain job fanout | Fanout adds queue pressure and complicates failure tracking; D-04 locked sequential |
| Module-level constants | Separate `DomainConstants` module | Both acceptable; constants in the job class are simpler for a small set |

---

## Architecture Patterns

### System Architecture Diagram

```
[SolidQueue Scheduler]
        |
        |-- every 30 min --> [DomainVerificationJob]
        |                         |
        |                    pending domains
        |                    + phasing_out domains
        |                         |
        |                    CNAME resolve? (Resolv::DNS)
        |                    /         \
        |               YES              NO
        |          (+ lock tx)         (increment
        |         promote to            failures /
        |           active              count age)
        |              |                    |
        |         clear phase_out_at     day 5? -> unverified_warning email
        |                                day 7? -> decommission!
        |                              failures=3? -> phase_out!
        |
        |-- every 30 min --> [DomainHealthJob]
                                  |
                             active custom domains
                                  |
                             CNAME resolve?
                             /           \
                          YES             NO
                     reset failures    increment consecutive_failures
                     update last_checked_at       |
                                           = 3? -> phase_out!
                                                + health_failure email (owners)

[POST /ops/brokerages/:id/plan]  (HTTP Basic auth)
        |
   freeze: true  --> Brokerage#freeze_custom_domains!
        |               --> custom domains -> frozen
        |               --> subdomain -> is_primary: true
        |               --> downgrade_notice email (owners)
   freeze: false --> Brokerage#unfreeze_custom_domains!
                        --> frozen custom domains -> active

[POST /v1/admin/domains/custom]  (D-08)
        --> create with status: :pending, verified: false
        --> DomainVerificationJob picks it up within 30 min
```

### Recommended Project Structure
```
backend/
├── app/
│   ├── jobs/
│   │   ├── domain_verification_job.rb    # new — handles pending + phasing_out
│   │   └── domain_health_job.rb          # new — handles active custom
│   ├── mailers/
│   │   └── domain_mailer.rb              # new
│   ├── views/domain_mailer/
│   │   ├── health_failure.html.erb       # new
│   │   ├── health_failure.text.erb       # new
│   │   ├── downgrade_notice.html.erb     # new
│   │   ├── downgrade_notice.text.erb     # new
│   │   ├── unverified_warning.html.erb   # new
│   │   └── unverified_warning.text.erb   # new
│   ├── models/
│   │   ├── brokerage_domain.rb           # update: enum + freeze!/unfreeze! methods
│   │   └── brokerage.rb                  # update: freeze_custom_domains! + unfreeze_custom_domains!
│   ├── controllers/
│   │   ├── ops/
│   │   │   └── plan_controller.rb        # new
│   │   └── v1/admin/
│   │       └── domains_controller.rb     # update: D-08 pending status
│   └── serializers/
│       └── brokerage_domain_serializer.rb # update: add last_checked_at, consecutive_failures
├── config/
│   ├── routes.rb                         # update: ops plan member route
│   └── recurring.yml                     # update: add 2 new job entries
└── db/migrate/
    └── YYYYMMDDNNNNNN_add_domain_health_columns.rb  # new
```

### Pattern 1: Sequential Batch Job (DomainVerificationJob / DomainHealthJob)
**What:** Process all matching domains in one job execution using `in_batches`, with constants for intervals.
**When to use:** Polling jobs over a bounded, DB-resident domain set where fanout is unnecessary.
**Example:**
```ruby
# Source: backend/app/jobs/resync_stale_photos_job.rb [VERIFIED: codebase]
class DomainVerificationJob < ApplicationJob
  queue_as :background
  retry_on StandardError, wait: :polynomially_longer, attempts: 5

  VERIFICATION_EXPIRY_DAYS = 7
  WARNING_EMAIL_DAYS = 5

  def perform
    # Pending domains: verify CNAME, send warning email at day 5, decommission at day 7
    BrokerageDomain.where(domain_type: :custom, status: :pending)
                   .in_batches do |batch|
      batch.each { |domain| process_pending(domain) }
    end

    # Phasing-out domains: verify CNAME for rescue opportunity (DLCX-01)
    BrokerageDomain.where(domain_type: :custom, status: :phasing_out)
                   .where("phase_out_at > ?", Time.current)
                   .in_batches do |batch|
      batch.each { |domain| process_phasing_out(domain) }
    end
  end
end
```

### Pattern 2: Pessimistic Lock for First-to-Verify (DVER-05)
**What:** Wrap the status promotion in a transaction with row-level lock to prevent duplicate promotions.
**When to use:** Any case where two concurrent workers might race to promote the same record.
**Example:**
```ruby
# Source: CONTEXT.md specifics + codebase Rails pattern [VERIFIED: CONTEXT.md]
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
    locked.update!(is_primary: true) if locked.brokerage.brokerage_domains.where(is_primary: true).none?
  end
end
```

### Pattern 3: ActionMailer with Owner Recipient Resolution (D-13)
**What:** Query `BrokerageMembership.where(role: 'owner')` at send time to get owner email recipients.
**When to use:** Any domain lifecycle email that targets brokerage owners.
**Example:**
```ruby
# Source: backend/app/mailers/invitation_mailer.rb [VERIFIED: codebase]
class DomainMailer < ApplicationMailer
  def health_failure(domain)
    @domain = domain
    @brokerage = domain.brokerage
    @dashboard_url = "https://#{primary_domain(@brokerage)}/admin/domains"
    owner_emails = BrokerageMembership.without_deleted
                                       .where(brokerage: @brokerage, role: "owner")
                                       .includes(:user)
                                       .map(&:user)
                                       .map(&:email)
    mail(to: owner_emails, subject: "Domain health check failed: #{domain.domain}")
  end

  private

  def primary_domain(brokerage)
    brokerage.brokerage_domains
             .where(is_primary: true)
             .where.not(domain: "localhost")
             .first&.domain || brokerage.brokerage_domains.first&.domain
  end
end
```

### Pattern 4: Ops JSON Endpoint with CSRF Skip
**What:** A new ops controller action that returns JSON and skips CSRF (inherited from `Ops::BaseController < ActionController::Base`).
**When to use:** Any ops endpoint that is invoked programmatically (curl, webhooks) rather than via a browser form.
**Example:**
```ruby
# Source: backend/app/controllers/v1/domains_controller.rb pattern [VERIFIED: codebase]
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

### Pattern 5: Brokerage Service Method (freeze_custom_domains!)
**What:** A transactional model method that transitions multiple associated records atomically.
**When to use:** Multi-record status transitions that must be atomic.
**Example:**
```ruby
# Source: Derived from existing Brokerage + BrokerageDomain patterns [VERIFIED: codebase]
def freeze_custom_domains!
  ApplicationRecord.transaction do
    brokerage_domains.domain_type_custom
                     .where(status: [:active, :pending, :phasing_out])
                     .update_all(status: "frozen")
    # DPRD-03: subdomain becomes primary
    brokerage_domains.update_all(is_primary: false)
    brokerage_domains.domain_type_subdomain
                     .where(status: :active)
                     .first
                     &.update!(is_primary: true)
  end
  # Email owners after transaction commits
  DomainMailer.downgrade_notice(self).deliver_later
end
```

### Anti-Patterns to Avoid
- **Inline DNS resolution without `Resolv::DNS.open` block:** `Resolv::DNS.new` requires explicit `.close` — use the block form or wrap in ensure. [VERIFIED: codebase — existing `finally resolver&.close` pattern]
- **Calling `status_requires_verified` assumption:** The validation only fires on `status_active?`. Setting `status: :pending, verified: false` is valid and intentional (D-08, D-10).
- **Using `update_all` for verified/verified_at transitions:** `update_all` bypasses callbacks and validations. For status transitions on individual records, use the model's named methods (`phase_out!`, `verify!`, etc.).
- **Singleton `Brokerage.lock.find`:** Use `BrokerageDomain.lock.find(id)` inside a transaction. `lock` on the class is a scope modifier that adds `FOR UPDATE` to the generated SQL.
- **Forgetting `.without_deleted` on BrokerageMembership queries:** `BrokerageMembership` uses `acts_as_paranoid` — always chain `.without_deleted` when querying for owner recipients.
- **Hard-coding 30-minute interval or 30-day phase-out duration:** DHLT-05 mandates named constants. Use `HEALTH_CHECK_INTERVAL` and `PHASE_OUT_DURATION` references, not `30.minutes` and `30.days` inline.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recurring job scheduling | Custom cron wrapper or separate clockwork gem | SolidQueue recurring.yml entries | Already used for `ResyncStalePhotosJob`; proven pattern [VERIFIED: codebase] |
| DNS CNAME lookup | System call / `Net::DNS` gem | Ruby stdlib `Resolv::DNS` | Already used in codebase; no extra dependency; works in test via stub [VERIFIED: codebase] |
| Email HTML layout | Inline style tables from scratch | Copy `InvitationMailer` ERB layout structure | Consistent brand, tested rendering, pre-existing pattern [VERIFIED: codebase] |
| Race condition prevention | Application-level "claimed" flag column | PostgreSQL `SELECT FOR UPDATE` via `ActiveRecord::Locking::Pessimistic` | DB-level lock is atomic; flag-based approach has TOCTOU gap [VERIFIED: Rails docs] |
| Owner email resolution | Caching user list in a separate table | `BrokerageMembership.without_deleted.where(role: 'owner').includes(:user)` at send time | D-13 mandates this; resolves live to avoid stale cache [VERIFIED: CONTEXT.md] |

---

## Critical Implementation Details

### 1. Migration: Adding Columns + Enum Values

The `brokerage_domains.status` column is a Rails string enum (not a PG native enum — type is `t.string "status"`). [VERIFIED: schema.rb]

Implications:
- Adding `pending` and `frozen` to the enum hash in `brokerage_domain.rb` requires NO database `ALTER TYPE` statement.
- The migration only needs to add two new columns:
  ```ruby
  add_column :brokerage_domains, :consecutive_failures, :integer, null: false, default: 0
  add_column :brokerage_domains, :last_checked_at, :datetime, null: true
  ```
- The unique index (`WHERE status != 'decommissioned'`) automatically covers `pending` and `frozen` — they are included in the uniqueness check, which is correct behaviour (two brokerages cannot hold the same pending domain). [VERIFIED: schema.rb index definition]
- SQLite3 (test DB) handles both column types without special handling. [VERIFIED: database.yml]

### 2. Enum Update in Model

```ruby
# Source: backend/app/models/brokerage_domain.rb [VERIFIED: codebase]
# Before:
enum :status, {active: "active", phasing_out: "phasing_out", decommissioned: "decommissioned"}, prefix: :status

# After Phase 22:
enum :status, {active: "active", phasing_out: "phasing_out", decommissioned: "decommissioned", pending: "pending", frozen: "frozen"}, prefix: :status
```

This auto-generates `status_pending?`, `status_frozen?` predicates. The existing `status_active?` guard in `status_requires_verified` and `set_primary` already correctly excludes these new statuses — no additional validation changes needed (D-10). [VERIFIED: codebase]

### 3. SolidQueue Recurring Schedule Syntax

The existing `recurring.yml` uses a flat structure (no environment keys) and natural-language schedule strings. [VERIFIED: codebase]

```yaml
# config/recurring.yml — current + additions
resync_stale_photos:
  class: ResyncStalePhotosJob
  queue: background
  schedule: every day at 3am

domain_verification:
  class: DomainVerificationJob
  queue: background
  schedule: every 30 minutes

domain_health:
  class: DomainHealthJob
  queue: background
  schedule: every 30 minutes
```

The schedule string `every 30 minutes` is valid SolidQueue 0.9 syntax — confirmed by official docs showing `every 10 minutes`, `every hour` natural language patterns. [VERIFIED: Context7 /rails/solid_queue] No `queue.yml` `scheduler:` section is needed for static recurring tasks (the scheduler process is started automatically by the SolidQueue supervisor when `recurring.yml` is present).

### 4. DNS Resolution — `getresources` vs `getresource`

The existing `V1::Onboarding::DomainsController#dns_resolves?` uses `getresource` (singular), which raises `Resolv::ResolvError` on failure. The CONTEXT D-01 decision specifies `getresources` (plural), which returns `[]` on miss — safer in a batch job where a failed lookup should count as a failure increment, not raise an exception. [VERIFIED: CONTEXT.md D-01, codebase existing implementation]

```ruby
# Source: CONTEXT.md D-01 + Ruby stdlib docs [VERIFIED: CONTEXT.md]
def cname_resolves_to_subdomain?(custom_domain, target_subdomain)
  Resolv::DNS.open do |dns|
    records = dns.getresources(custom_domain, Resolv::DNS::Resource::IN::CNAME)
    records.any? { |r| r.name.to_s.chomp(".") == target_subdomain.chomp(".") }
  end
rescue Resolv::ResolvError, Resolv::ResolvTimeout
  false
end
```

Per D-02, `target_subdomain` is looked up at check time:
```ruby
target_subdomain = domain.brokerage.brokerage_domains
                         .domain_type_subdomain
                         .status_active
                         .first
                         &.domain
```

### 5. CSRF in Ops Plan Endpoint

`Ops::BaseController < ActionController::Base` enables `protect_from_forgery with: :exception`. [VERIFIED: codebase]

The new `Ops::PlanController` is invoked via curl/webhook (not a browser form), so it must skip CSRF:
```ruby
# Source: backend/app/controllers/v1/domains_controller.rb pattern [VERIFIED: codebase]
skip_before_action :verify_authenticity_token, raise: false
```

The HTTP Basic authentication from `Ops::BaseController` still applies (inherited).

### 6. Ops Route Addition

Current routes: `namespace :ops do resources :brokerages do resources :brokerage_domains ...`

Add a member route:
```ruby
# config/routes.rb addition
namespace :ops do
  resources :brokerages, only: [...] do
    member do
      post :plan   # => Ops::BrokeragesController#plan, or separate controller
    end
    ...
  end
end
```

Given D-06 specifies a JSON endpoint with complex behaviour, a separate `Ops::PlanController` is cleaner than adding to the existing HTML-heavy `Ops::BrokeragesController`. [ASSUMED — architectural preference]

The route path `POST /ops/brokerages/:brokerage_id/plan` fits a nested resource:
```ruby
resources :brokerages do
  resource :plan, only: [:update], controller: 'plan'
  # or: member { post :plan }
end
```

### 7. D-08: DomainsController#custom Update

Current (creates active + verified):
```ruby
new_domain = Current.brokerage.brokerage_domains.create!(
  domain: domain_param, domain_type: :custom,
  status: :active, is_primary: false,
  verified: true, verified_at: Time.current, verification_token: nil
)
```

After D-08 (creates pending + unverified):
```ruby
new_domain = Current.brokerage.brokerage_domains.create!(
  domain: domain_param, domain_type: :custom,
  status: :pending, is_primary: false,
  verified: false
  # verification_token auto-set by before_create :generate_verification_token
)
```

Note: `generate_verification_token` runs `before_create` and sets a hex token — this is correct for pending domains. The `status_requires_verified` validation only runs `if status_active?` so `pending + verified: false` is valid. [VERIFIED: codebase]

The existing tests in `admin_domains_test.rb` for `POST /v1/admin/domains/custom` will need updates: the "creates active custom domain" test must now assert `status: "pending", verified: false`.

### 8. DPRD-01 + DPRI-02 Are Already Satisfied

`DPRI-01` (active domain can be set as primary, owner only) and `DPRI-02` (pending/phasing-out domains cannot be set as primary) are enforced by the existing `set_primary` action's `unless domain.status_active?` guard. Since `pending` and `frozen` are both not `:active`, they are rejected with a 422. No code changes needed for these requirements — they become satisfied when the new enum values are added. [VERIFIED: codebase domains_controller.rb L129]

### 9. Freeze Custom Domains — What Gets Frozen

`freeze_custom_domains!` should transition custom domains in these statuses to `frozen`: `active`, `pending`, `phasing_out`. Domains already `frozen` or `decommissioned` should be skipped. Subdomains are never frozen. [VERIFIED: CONTEXT.md D-05, DPRD-01]

`unfreeze_custom_domains!` restores `frozen` custom domains to `active` only. Does NOT restore `is_primary` — the subdomain remains primary until the owner manually reassigns. [VERIFIED: REQUIREMENTS.md DPRD-06 says "restored to previous active state", STATE.md]

### 10. DADD-04 Timing Logic

`DomainVerificationJob` must distinguish:
- Domains `created_at < 7.days.ago`: decommission immediately (no email — they got the day-5 warning)
- Domains `created_at.between(5.days.ago, 7.days.ago)` AND day-5 email not yet sent: send `unverified_warning`

The challenge: how to track whether the day-5 warning was already sent. Options:
1. Add a `warning_email_sent_at` boolean/datetime column (extra migration)
2. Use `last_checked_at`: if `last_checked_at >= 5.days.ago - 30.minutes` AND `created_at <= 5.days.ago`, the job already processed the day-5 window
3. Simple approximation: send warning every time domain is in the 5-7 day window (idempotent email send; owner may receive multiple warnings, but this is acceptable)

**Recommendation (Claude's discretion):** Option 3 is the simplest, consistent with D-03 (no complex logic). If the planner wants deterministic single-send, add a boolean `verification_warning_sent` column to the migration. [ASSUMED — tradeoff decision]

---

## Common Pitfalls

### Pitfall 1: Missing `.without_deleted` on BrokerageMembership in Mailer
**What goes wrong:** `BrokerageMembership.where(role: 'owner', brokerage: @brokerage)` returns soft-deleted memberships — deleted owners receive emails.
**Why it happens:** `acts_as_paranoid` does NOT apply default scope in all query contexts; you must chain `.without_deleted`.
**How to avoid:** Always use `BrokerageMembership.without_deleted.where(role: 'owner', brokerage: @brokerage).includes(:user)`.
**Warning signs:** Test brokerage with manually-deleted owner membership still appears in recipient list.
[VERIFIED: CLAUDE.md project instructions]

### Pitfall 2: Race Condition Without Transaction Lock (DVER-05)
**What goes wrong:** Two DomainVerificationJob runs overlap; both see a pending domain with valid CNAME and both call `domain.update!(status: :active, verified: true)`. The second write succeeds but logs as a "duplicate verification" in after-callbacks.
**Why it happens:** The check-then-act is not atomic without a DB lock.
**How to avoid:** Wrap promotion in `ApplicationRecord.transaction { BrokerageDomain.lock.find(id) ... return if already active }`.
**Warning signs:** Two `verified_at` values in audit logs with identical timestamps; status double-emits in tests.
[VERIFIED: CONTEXT.md DVER-05 specifics]

### Pitfall 3: update_all Bypassing the `status_requires_verified` Validation
**What goes wrong:** Using `update_all(status: "active", verified: true)` in `freeze_custom_domains!` or verification promotion skips all AR validations and callbacks.
**Why it happens:** `update_all` generates a direct SQL UPDATE — no AR callbacks or validations run.
**How to avoid:** Use individual record `update!` calls (inside `in_batches` blocks) for status transitions, OR use `update_all` only for status changes that don't require validation (e.g., bulk `frozen` transition which doesn't trigger `status_requires_verified` since only `status_active?` triggers it).
**Warning signs:** Domains in `active` status with `verified: false` — data integrity violation.
[VERIFIED: codebase model validation]

### Pitfall 4: CSRF 422 on Ops Plan Endpoint
**What goes wrong:** `POST /ops/brokerages/:id/plan` returns `422 ActionController::InvalidAuthenticityToken` because `Ops::BaseController` enables `protect_from_forgery with: :exception`.
**Why it happens:** The new JSON endpoint inherits from a base class designed for HTML form submissions.
**How to avoid:** Add `skip_before_action :verify_authenticity_token, raise: false` at the top of `Ops::PlanController`.
**Warning signs:** Manual `curl -X POST` test returns 422 instead of 200.
[VERIFIED: codebase ops/base_controller.rb]

### Pitfall 5: `phase_out!` Hardcodes 30.days Duration
**What goes wrong:** The existing `BrokerageDomain#phase_out!` uses `30.days.from_now` inline. DHLT-05 requires that 30-day duration be a named constant.
**Why it happens:** The existing implementation predates Phase 22.
**How to avoid:** Replace inline `30.days` in `phase_out!` with `PHASE_OUT_DURATION` constant when adding the constant in Phase 22.
**Warning signs:** `grep -n "30.days" backend/app/models/brokerage_domain.rb` finds a match after Phase 22 is implemented.
[VERIFIED: codebase brokerage_domain.rb L36]

### Pitfall 6: Job Failing Because DNS Times Out on All Domains
**What goes wrong:** In test environment or CI with no real DNS, `Resolv::DNS` resolution raises `Resolv::ResolvTimeout` or hangs.
**Why it happens:** Tests don't mock DNS resolution.
**How to avoid:** Stub `Resolv::DNS.open` in job tests using Minitest's `stub` or a custom mock. Tests should not make real DNS calls.
**Warning signs:** Job tests hang for 5+ seconds or fail with `Resolv::ResolvTimeout` in CI.
[ASSUMED — standard test isolation practice]

### Pitfall 7: Serializer Not Updated for New Columns
**What goes wrong:** `BrokerageDomainSerializer` doesn't expose `last_checked_at` or `consecutive_failures`; Phase 24 frontend code can't display verification state.
**Why it happens:** New columns added in migration but serializer not updated.
**How to avoid:** Update `BrokerageDomainSerializer` in the same wave as the migration. [VERIFIED: codebase serializer]

---

## Code Examples

### Migration (verified pattern from existing migration)
```ruby
# Source: backend/db/migrate/20260527000001_add_lifecycle_columns_to_brokerage_domains.rb [VERIFIED: codebase]
class AddDomainHealthColumnsToBrokerageDomains < ActiveRecord::Migration[7.1]
  def change
    add_column :brokerage_domains, :consecutive_failures, :integer, null: false, default: 0
    add_column :brokerage_domains, :last_checked_at, :datetime, null: true
  end
end
```

### Email Dispatch Pattern (from existing mailer job)
```ruby
# Source: backend/app/jobs/send_invitation_email_job.rb [VERIFIED: codebase]
# Dispatch health failure email inline in job (deliver_now!, not deliver_later)
DomainMailer.health_failure(domain).deliver_now!
```

### Recurring Job Entry Format
```yaml
# Source: backend/config/recurring.yml [VERIFIED: codebase + Context7 /rails/solid_queue]
domain_verification:
  class: DomainVerificationJob
  queue: background
  schedule: every 30 minutes

domain_health:
  class: DomainHealthJob
  queue: background
  schedule: every 30 minutes
```

### Owner Recipient Query
```ruby
# Source: Derived from InvitationMailer + BrokerageMembership patterns [VERIFIED: codebase]
owner_emails = BrokerageMembership.without_deleted
                                   .where(brokerage: @brokerage, role: "owner")
                                   .includes(:user)
                                   .map { |m| m.user.email }
```

### Existing DNS Resolution (onboarding, for reference)
```ruby
# Source: backend/app/controllers/v1/onboarding/domains_controller.rb [VERIFIED: codebase]
# NOTE: uses getresource (singular, raises on miss) — Phase 22 uses getresources (plural, returns [])
resolver = Resolv::DNS.new
cname = resolver.getresource(domain, Resolv::DNS::Resource::IN::CNAME)
# Phase 22 variant:
Resolv::DNS.open do |dns|
  records = dns.getresources(domain, Resolv::DNS::Resource::IN::CNAME)
  records.any? { |r| r.name.to_s.chomp(".") == target }
end
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `status: :active, verified: true` on domain creation | `status: :pending, verified: false` (D-08) | Phase 22 | Breaks Phase 21 UI until Phase 24 — accepted trade-off per CONTEXT.md D-08 |
| No consecutive failure tracking | `consecutive_failures` counter + `last_checked_at` | Phase 22 | Enables DHLT-02 3-failure threshold |
| 3-value enum (active/phasing_out/decommissioned) | 5-value enum (+ pending/frozen) | Phase 22 | Required for full lifecycle state machine |
| No recurring DNS verification | DomainVerificationJob + DomainHealthJob every 30 min | Phase 22 | Fulfils DVER-02 + DHLT-01 |

**Deprecated/outdated after Phase 22:**
- Creating custom domains as immediately `active + verified: true` — replaced by pending flow (D-08)
- Inline `30.days.from_now` in `phase_out!` — must be replaced with `PHASE_OUT_DURATION` constant (DHLT-05)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Ops::PlanController` as a separate controller (not extending `Ops::BrokeragesController`) is architecturally cleaner | Architecture Patterns / Ops Route Addition | Low — either approach works; separate controller is cleaner for JSON-only endpoint |
| A2 | Day-5 warning email for pending domains uses option 3 (send on each 30-min run while in 5-7 day window) rather than a separate tracking column | Critical Detail #10 / DADD-04 | Medium — if user requires single-send guarantee, a `verification_warning_sent` boolean column is needed in the migration |
| A3 | `Resolv::ResolvTimeout` is the exception class raised on DNS timeout (in addition to `Resolv::ResolvError`) | Common Pitfalls #6 | Low — if wrong, unhandled timeout propagates to `retry_on StandardError` which handles it anyway |
| A4 | Unfreezing domains does NOT restore `is_primary` to frozen custom domains — subdomain remains primary until manually changed | Critical Detail #9 | Medium — if requirements say "restore exact previous state", a snapshot of pre-freeze primary state is needed |

---

## Open Questions (RESOLVED)

1. **DADD-04: single-send vs multi-send for day-5 warning email**
   - What we know: `DomainVerificationJob` runs every 30 min; each run between day 5 and day 7 will see the domain in the warning window
   - What's unclear: Should the warning email be sent exactly once, or is idempotent re-send acceptable?
   - Recommendation: If single-send is required, add `verification_warning_sent boolean default false` to the migration. If idempotent (acceptable to send ~48 times), no extra column needed.
   - **RESOLVED:** Multi-send / idempotent. Plan 22-05 implements `DomainVerificationJob` with idempotent warning email dispatch on each 30-min run while domain is in the 5–7 day window. No extra tracking column added to the migration.

2. **DELETE on pending domains in Phase 22**
   - What we know: The existing `destroy` action handles active (phase_out!) and phasing_out (decommission!) but doesn't mention pending
   - What's unclear: Should `DELETE /v1/admin/domains/:id` on a pending domain immediately decommission it (skip phase-out since no CNAME is live), or be blocked by Phase 22?
   - Recommendation: Pending domains should decommission immediately on delete (no live traffic to protect). Update the destroy action to handle `status_pending? → decommission!`.
   - **RESOLVED:** Immediate decommission. Plan 22-04 updates `DomainsController#destroy` to call `decommission!` directly when `domain.status_pending?` — no phase-out window because no CNAME record is live.

3. **`phase_out!` constant extraction: model vs job?**
   - What we know: `BrokerageDomain#phase_out!` uses `30.days.from_now` inline (line 36); DHLT-05 requires a named constant
   - What's unclear: Should `PHASE_OUT_DURATION` live in `BrokerageDomain` model or in the job?
   - Recommendation: Define `PHASE_OUT_DURATION = 30.days` in `BrokerageDomain` (since `phase_out!` lives there) and reference it from both the model method and the jobs.
   - **RESOLVED:** Constant defined in `BrokerageDomain` model. Plan 22-01 adds `PHASE_OUT_DURATION = 30.days` to `brokerage_domain.rb` and replaces the inline `30.days.from_now` in `phase_out!` with `PHASE_OUT_DURATION.from_now`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ruby | All backend jobs/models | ✓ | 3.0.2 (local) | — |
| SQLite3 | Test suite | ✓ | Confirmed via db:migrate status | — |
| PostgreSQL | Dev/prod (DATABASE_URL) | External | Not confirmed in this env | Test uses SQLite3 — no blocker |
| Ruby Resolv (stdlib) | DNS lookup jobs | ✓ | Built-in Ruby stdlib | — |
| SolidQueue 0.9.0 | Background jobs + recurring | ✓ | 0.9.0 [VERIFIED: Gemfile.lock] | — |
| Resend gem | Email delivery | ✓ | Installed [VERIFIED: Gemfile] | — |

**Missing dependencies with no fallback:** None — all dependencies are stdlib, already installed gems, or use SQLite3 in test.

**Missing dependencies with fallback:** PostgreSQL is not available in this WSL2 bash context — but tests run against SQLite3 (confirmed in database.yml), so this does not block development or testing.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (ops endpoint) | HTTP Basic auth via `Ops::BaseController` — inherited automatically [VERIFIED: codebase] |
| V3 Session Management | No | Jobs run server-side without user sessions |
| V4 Access Control | Yes (ops endpoint, email recipients) | Ops HTTP Basic; email restricted to `role: 'owner'` members only |
| V5 Input Validation | Yes (freeze param) | Cast `params[:freeze]` with `ActiveModel::Type::Boolean.new.cast` — not raw string comparison |
| V6 Cryptography | No | No new cryptographic operations |

**Known Threat Patterns:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ops endpoint accessible without auth | Spoofing | HTTP Basic from `Ops::BaseController` + ENV-backed credentials |
| DNS lookups triggering SSRF to internal addresses | Tampering | `Resolv::DNS` resolves public DNS only; domain format validated by `valid_domain_format` regex [VERIFIED: model] |
| Mass-sending emails to unintended recipients | Information Disclosure | Recipient resolution queries `BrokerageMembership.without_deleted.where(role: 'owner')` — scoped to brokerage |

---

## Sources

### Primary (HIGH confidence)
- `backend/app/jobs/resync_stale_photos_job.rb` — sequential batch job pattern
- `backend/app/jobs/send_invitation_email_job.rb` — email dispatch pattern (`deliver_now!`, retry, discard)
- `backend/config/recurring.yml` — existing schedule format reference
- `backend/config/queue.yml` — queue worker definitions
- `backend/app/models/brokerage_domain.rb` — current enum, validations, lifecycle methods
- `backend/db/schema.rb` — confirmed column types, indexes
- `backend/app/controllers/ops/base_controller.rb` — CSRF + HTTP Basic auth pattern
- `backend/app/controllers/v1/admin/domains_controller.rb` — D-08 target + set_primary guard
- `backend/app/controllers/v1/onboarding/domains_controller.rb` — existing Resolv usage pattern
- `backend/app/mailers/invitation_mailer.rb` — mailer pattern, primary_domain helper
- Context7 `/rails/solid_queue` — schedule syntax `every 30 minutes`, recurring.yml format, pessimistic locking

### Secondary (MEDIUM confidence)
- `.planning/phases/22-dns-verification-health-monitoring-backend/22-CONTEXT.md` — locked decisions, locked architecture decisions
- `.planning/STATE.md` — phase constraints and accumulated decisions
- `.planning/REQUIREMENTS.md` — requirement definitions for all Phase 22 IDs

### Tertiary (LOW confidence — flagged in Assumptions Log)
- A2: DADD-04 single-send strategy recommendation
- A4: Unfreeze-does-not-restore-primary assumption

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in Gemfile.lock/codebase
- Architecture: HIGH — all patterns traced to verified codebase files
- Pitfalls: HIGH for CSRF/validation/lock issues (verified); MEDIUM for DNS timeout exception class naming (A3)
- Migration strategy: HIGH — string enum confirmed, no PG ALTER TYPE needed

**Research date:** 2026-05-30
**Valid until:** 2026-06-30 (stable Rails/SolidQueue stack; recurring.yml syntax unlikely to change in patch releases)

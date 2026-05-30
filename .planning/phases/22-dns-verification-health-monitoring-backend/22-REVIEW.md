---
phase: 22-dns-verification-health-monitoring-backend
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - backend/app/controllers/ops/plan_controller.rb
  - backend/app/controllers/v1/admin/domains_controller.rb
  - backend/app/jobs/domain_health_job.rb
  - backend/app/jobs/domain_verification_job.rb
  - backend/app/mailers/domain_mailer.rb
  - backend/app/models/brokerage.rb
  - backend/app/models/brokerage_domain.rb
  - backend/app/serializers/brokerage_domain_serializer.rb
  - backend/app/views/domain_mailer/downgrade_notice.html.erb
  - backend/app/views/domain_mailer/downgrade_notice.text.erb
  - backend/app/views/domain_mailer/health_failure.html.erb
  - backend/app/views/domain_mailer/health_failure.text.erb
  - backend/app/views/domain_mailer/unverified_warning.html.erb
  - backend/app/views/domain_mailer/unverified_warning.text.erb
  - backend/config/recurring.yml
  - backend/config/routes.rb
  - backend/db/migrate/20260530000001_add_domain_health_columns_to_brokerage_domains.rb
  - backend/test/integration/admin_domains_test.rb
  - backend/test/integration/ops_plan_test.rb
  - backend/test/jobs/domain_health_job_test.rb
  - backend/test/jobs/domain_verification_job_test.rb
  - backend/test/mailers/domain_mailer_test.rb
  - backend/test/models/brokerage_domain_test.rb
  - backend/test/models/brokerage_freeze_test.rb
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

This phase implements DNS verification and health monitoring for custom domains: a lifecycle state machine (pending → active → phasing_out → decommissioned, +frozen), two background jobs (`DomainVerificationJob`, `DomainHealthJob`), `ActionMailer` notifications, and an ops freeze/unfreeze endpoint. The overall architecture is sound — pessimistic locking is applied in the right places, soft-delete guards are respected, and the test suite is thorough. Three blockers were found: two race conditions (health job fires `phase_out!` without a lock, warning emails fire on every job run for two days), and one crash path when the ops endpoint fires when no brokerage owner exists. Five additional warnings cover logic gaps and silent failure modes.

---

## Critical Issues

### CR-01: `DomainHealthJob#process_health_check` calls `phase_out!` without a pessimistic lock

**File:** `backend/app/jobs/domain_health_job.rb:34-37`

**Issue:** `DomainVerificationJob#promote_to_active!` and `process_phasing_out` both acquire a `BrokerageDomain.lock.find` before mutating status, correctly preventing concurrent duplicate promotions. `DomainHealthJob#process_health_check` does not do this. Both jobs run on the same 30-minute schedule. If a verification job re-promotes a domain to `active` (DLCX-01 rescue) at the same moment the health job reads it as `active`, the health job will call `phase_out!` on a record that the verification job has just written `consecutive_failures: 0` to. The window is small but the consequence is silent reversal of a successful rescue: a healthy domain gets phased out.

**Fix:**
```ruby
def process_health_check(domain)
  ApplicationRecord.transaction do
    locked = BrokerageDomain.lock.find(domain.id)
    return unless locked.status_active?   # guard: may have been rescued or frozen

    if cname_resolves_to_subdomain?(locked)
      locked.update!(consecutive_failures: 0, last_checked_at: Time.current)
    else
      new_count = locked.consecutive_failures + 1
      locked.update!(consecutive_failures: new_count, last_checked_at: Time.current)

      if new_count >= MAX_CONSECUTIVE_FAILURES
        locked.phase_out!
        DomainMailer.health_failure(locked).deliver_now!
      end
    end
  end
end
```

---

### CR-02: `DomainVerificationJob` sends `unverified_warning` on every run for two days — no idempotency guard

**File:** `backend/app/jobs/domain_verification_job.rb:41-44`

**Issue:** The job runs every 30 minutes. The warning branch fires for any pending domain whose age is `>= 5 days` AND `< 7 days` — a 48-hour window. With a 30-minute cadence that is up to **96 emails** sent to brokerage owners for a single domain. The comment on line 41 acknowledges this ("may send multiple times") but treats it as acceptable; it is not. Owners will receive a flood of identical "expires in 2 days" emails and mark them as spam, destroying deliverability.

Additionally, note that `last_checked_at` is **not updated** when the warning branch fires (the `return` on line 44 skips line 51). This is also incorrect — `last_checked_at` represents the last time the domain was polled, which happened regardless of which branch ran.

**Fix:** Add a `warning_sent_at` column (or reuse any nullable timestamp) to make the send idempotent, and move `last_checked_at` update before the early returns:

```ruby
def process_pending(domain)
  age_days = (Time.current - domain.created_at) / 1.day
  domain.update_column(:last_checked_at, Time.current)  # always update

  if age_days >= VERIFICATION_EXPIRY_DAYS
    domain.decommission!
    return
  end

  if age_days >= WARNING_EMAIL_DAYS
    # Only send once per domain (idempotency guard)
    unless domain.warning_sent_at?
      DomainMailer.unverified_warning(domain).deliver_now!
      domain.update_column(:warning_sent_at, Time.current)
    end
    return
  end

  promote_to_active!(domain) if cname_resolves_to_subdomain?(domain)
end
```

This requires a `warning_sent_at` datetime column in a migration.

---

### CR-03: `Ops::PlanController#update` crashes with `Net::SMTPError` (or similar) when `owner_emails` returns an empty array — email sent before verifying there are recipients

**File:** `backend/app/controllers/ops/plan_controller.rb:16-18`

**Issue:** `freeze_custom_domains!` is called first, which commits the DB transaction. Then `DomainMailer.downgrade_notice(@brokerage).deliver_now!` is called. `owner_emails` in the mailer resolves to `[]` when a brokerage has no active owner memberships (e.g., the sole owner was soft-deleted). `mail(to: [])` with `deliver_now!` raises an exception in most SMTP adapters. Because the DB mutation already committed, the rescue block on line 24 catches the mailer error and returns 422 — but the domains are already frozen. The caller receives a 422 and believes the freeze failed, when it actually succeeded. This is a data-integrity / misleading-response bug.

Additionally, the `rescue => e` on line 26 returns `:unprocessable_entity` for all errors including this mailer crash, which leaks internal error messages and signals incorrect HTTP semantics for a server-side failure.

**Fix:** Guard against an empty recipient list before sending, and separate the email error from the freeze error:

```ruby
def update
  freeze = ActiveModel::Type::Boolean.new.cast(params[:freeze])
  if freeze
    @brokerage.freeze_custom_domains!
    # Send email only when there are recipients; never let mailer failure roll back
    # a committed freeze (email is best-effort here).
    begin
      DomainMailer.downgrade_notice(@brokerage).deliver_now!
    rescue => mail_err
      Rails.logger.error("[PlanController] downgrade_notice failed: #{mail_err.message}")
    end
    render json: {status: "frozen", brokerage_id: @brokerage.id}, status: :ok
  else
    @brokerage.unfreeze_custom_domains!
    render json: {status: "unfrozen", brokerage_id: @brokerage.id}, status: :ok
  end
rescue ActiveRecord::RecordInvalid => e
  render json: {error: e.message, details: e.record.errors.full_messages}, status: :unprocessable_entity
rescue => e
  render json: {error: e.message}, status: :internal_server_error
end
```

---

## Warnings

### WR-01: `Brokerage#unfreeze_custom_domains!` is not wrapped in a transaction

**File:** `backend/app/models/brokerage.rb:53-64`

**Issue:** `freeze_custom_domains!` runs inside `ApplicationRecord.transaction`. `unfreeze_custom_domains!` does not. It executes two independent `update_all` calls (lines 57-60 and 62-64). If the second call fails (e.g., DB connection drop), previously-verified domains are restored to `active` but previously-pending domains remain `frozen`. The brokerage is left in a partially-unfrozen state with no error surfaced to the caller.

**Fix:**
```ruby
def unfreeze_custom_domains!
  ApplicationRecord.transaction do
    brokerage_domains.domain_type_custom
                     .status_frozen
                     .where(verified: true)
                     .update_all(status: "active")
    brokerage_domains.domain_type_custom
                     .status_frozen
                     .where(verified: false)
                     .update_all(status: "pending")
  end
end
```

---

### WR-02: `slot_block_response` and `phase_out_warning_for` will crash with `NoMethodError` if no phasing-out record has a `phase_out_at` value

**File:** `backend/app/controllers/v1/admin/domains_controller.rb:159-165` and `183-186`

**Issue:** Both helpers call `.first.phase_out_at` without a nil guard. `phase_out_at` is nullable (schema line 45). If a phasing-out domain somehow has `phase_out_at: nil` (e.g., set via `update_all` in `freeze_custom_domains!`, or through a direct DB write), `.first.phase_out_at` returns `nil`, and calling `.strftime` on it in the view (or returning it as-is in JSON) is fine — but `.first` itself could theoretically be `nil` if the count check and the query race between two requests. The more concrete risk: `phase_out!` always sets `phase_out_at`, but `freeze_custom_domains!` calls `update_all(status: "frozen")` on phasing-out domains without clearing `phase_out_at`. If a domain is unfrozen back to `phasing_out` (not currently possible via `unfreeze_custom_domains!`, but a future code path could introduce it), `phase_out_at` could be stale. The immediate hazard is the missing nil guard on `.first`.

**Fix:** Guard both helpers against `nil`:
```ruby
earliest_record = Current.brokerage.brokerage_domains
  .status_phasing_out
  .where(domain_type: domain_type)
  .order(:phase_out_at)
  .first
return render json: {error: "Phase-out slot limit reached"}, status: :unprocessable_entity unless earliest_record

render json: {
  error: "Phase-out slot limit reached",
  earliest_slot_available_at: earliest_record.phase_out_at
}, status: :unprocessable_entity
```

---

### WR-03: `DomainVerificationJob#process_phasing_out` scope uses `phase_out_at > Time.current` — excludes domains whose decommission date has already passed, which silently skips the rescue opportunity

**File:** `backend/app/jobs/domain_verification_job.rb:23-27`

**Issue:** The DLCX-01 requirement says a phasing-out domain can be rescued if "CNAME resolves before decommission date." The query on line 24 (`where("phase_out_at > ?", Time.current)`) correctly implements this boundary — a domain past its decommission date should not be rescued. However, there is no accompanying job or scheduled task that actually decommissions domains whose `phase_out_at` has expired. The `DomainVerificationJob` explicitly skips them (they fall outside this scope), and the `DomainHealthJob` only checks `status_active` domains. This means phasing-out domains whose `phase_out_at` has elapsed remain in `phasing_out` status indefinitely — they are routable (the `routable` scope includes `phasing_out`) and continue serving traffic forever. The decommission date is communicated to users in the health failure email as a hard deadline, but it is never enforced.

**Fix:** Add a third step to `DomainVerificationJob#perform` (or a dedicated job) that decommissions overdue phasing-out domains:
```ruby
# Step 3: Decommission expired phasing-out domains
BrokerageDomain
  .status_phasing_out
  .where("phase_out_at <= ?", Time.current)
  .in_batches do |batch|
    batch.each(&:decommission!)
  end
```

---

### WR-04: `DomainMailer#owner_emails` uses `includes(:user)` but does not guard against a soft-deleted or nil `user` record — will raise `NoMethodError` if a membership's user is deleted

**File:** `backend/app/mailers/domain_mailer.rb:31-35`

**Issue:** `BrokerageMembership.without_deleted` guards against soft-deleted memberships, but `User` also uses `acts_as_paranoid`. A membership row can exist for a user who has been soft-deleted via the `User` model. `includes(:user)` will load the user via a regular `WHERE id IN (...)` query which does not apply `without_deleted` on `User`, so the user record is loaded. However, if `m.user` is somehow `nil` (orphaned foreign key, or if `User` queries elsewhere apply a default scope), `m.user.email` raises `NoMethodError` and the mailer call crashes — taking the caller (the job or controller) with it.

**Fix:**
```ruby
def owner_emails(brokerage)
  BrokerageMembership.without_deleted
                     .where(brokerage: brokerage, role: "owner")
                     .joins(:user)
                     .merge(User.without_deleted)
                     .map { |m| m.user.email }
end
```

---

### WR-05: `DomainHealthJob` uses `deliver_now!` inside `process_health_check`, which is called from inside an `in_batches` block — a mailer failure raises `StandardError`, triggering job retry and re-running the CNAME check and `phase_out!` for the entire batch

**File:** `backend/app/jobs/domain_health_job.rb:37`

**Issue:** `retry_on StandardError` is configured at the job level. `deliver_now!` raises on SMTP failure. When it raises, the entire job is retried from `perform`, re-running health checks for all domains in the batch — including the one that already had `phase_out!` called. Calling `phase_out!` a second time sets a new `phase_out_at` 30 days from the retry time, extending the domain's life incorrectly. It also resends the health failure email on each retry, up to 5 times.

**Fix:** Use `deliver_later` for mailer calls inside jobs (decouple delivery from job retry), or rescue mailer errors locally:
```ruby
if new_count >= MAX_CONSECUTIVE_FAILURES
  domain.phase_out!
  begin
    DomainMailer.health_failure(domain).deliver_now!
  rescue => e
    Rails.logger.error("[DomainHealthJob] health_failure email failed for #{domain.id}: #{e.message}")
  end
end
```

---

## Info

### IN-01: `BrokerageDomain#generate_verification_token` is a public method — should be private

**File:** `backend/app/models/brokerage_domain.rb:53-55`

**Issue:** `generate_verification_token` is defined after the `before_create` callback but before the `private` declaration (line 57), making it a public instance method. It can be called externally, which could allow overwriting a domain's verification token. The callback mechanism does not require it to be public.

**Fix:** Move the method definition below the `private` marker (line 57), or explicitly declare it private:
```ruby
private

def generate_verification_token
  self.verification_token = SecureRandom.hex(16)
end
```

---

### IN-02: `unverified_warning` email subject and template hardcode "2 days" and "5 days ago" regardless of actual domain age

**File:** `backend/app/mailers/domain_mailer.rb:23`, `backend/app/views/domain_mailer/unverified_warning.html.erb:32`, `backend/app/views/domain_mailer/unverified_warning.text.erb:3`

**Issue:** The subject line says "expires in 2 days" and the template body says "added 5 days ago." These are hardcoded strings that are only accurate at exactly day 5. At day 6 the email says "added 5 days ago" and "expires in 2 days" when the domain is 6 days old and expires in 1 day. The inaccuracy undermines urgency and trust. This also creates confusion if `WARNING_EMAIL_DAYS` is ever adjusted.

**Fix:** Pass the actual expiry date to the mailer and compute remaining days from it:
```ruby
# In mailer:
def unverified_warning(domain)
  @domain = domain
  @brokerage = domain.brokerage
  @expires_at = domain.created_at + VERIFICATION_EXPIRY_DAYS.days  # or pass as arg
  @days_remaining = [((@expires_at - Time.current) / 1.day).ceil, 0].max
  ...
end
```

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

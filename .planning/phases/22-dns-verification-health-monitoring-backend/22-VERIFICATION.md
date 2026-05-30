---
phase: 22-dns-verification-health-monitoring-backend
verified: 2026-05-30T22:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run the full Phase 22 test suite and confirm zero failures"
    expected: "rails test test/models/brokerage_domain_test.rb test/models/brokerage_freeze_test.rb test/mailers/domain_mailer_test.rb test/integration/ops_plan_test.rb test/integration/admin_domains_test.rb test/jobs/domain_verification_job_test.rb test/jobs/domain_health_job_test.rb exits with 0 failures, 0 errors"
    why_human: "Three known code-review issues were found. Tests pass in isolation but human must confirm all 20+ tests pass with the FakeJob subclass pattern and no cross-contamination between test files."
  - test: "Confirm ops freeze endpoint behavior when no active owner memberships exist"
    expected: "POST /ops/brokerages/:id/plan with freeze: true should either succeed silently (sending 0 emails) or return a clear error — domains must remain frozen regardless of email failure"
    why_human: "CR-03: if owner_emails returns [] and deliver_now! raises ArgumentError, the rescue clause returns 422 (unprocessable_entity). The freeze already committed to DB but the HTTP response signals failure. Human must decide whether this edge case (brokerage with no active owners) is acceptable or needs a guard."
---

# Phase 22: DNS Verification & Health Monitoring Backend Verification Report

**Phase Goal:** The system autonomously monitors all custom domains, heals DNS changes without manual intervention, and notifies owners when action is required
**Verified:** 2026-05-30T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A SolidQueue recurring job runs every 30 minutes for pending and phasing-out custom domains; verified domains promoted to active | ✓ VERIFIED | `DomainVerificationJob` exists with `VERIFICATION_EXPIRY_DAYS=7`, `WARNING_EMAIL_DAYS=5`; `recurring.yml` has `domain_verification: schedule: every 30 minutes`; `promote_to_active!` uses pessimistic lock (`BrokerageDomain.lock.find`) inside `ApplicationRecord.transaction` |
| 2 | A separate SolidQueue recurring job runs every 30 minutes against active custom domains; 3 consecutive failures → phasing-out + health_failure email with subdomain fallback language for primary domains | ✓ VERIFIED | `DomainHealthJob` exists with `HEALTH_CHECK_INTERVAL = 30.minutes`, `MAX_CONSECUTIVE_FAILURES = 3`; `recurring.yml` has `domain_health: schedule: every 30 minutes`; `process_health_check` increments `consecutive_failures`, calls `phase_out!` + `DomainMailer.health_failure(domain).deliver_now!` at count>=3; `health_failure.html.erb` and `.text.erb` have `<% if @domain.is_primary? %>` conditional with "primary domain…subdomain is now serving as the fallback" |
| 3 | When a phasing-out domain passes CNAME verification before decommission date, status restored to active and phase_out_at cleared (DLCX-01) | ✓ VERIFIED | `process_phasing_out` in `DomainVerificationJob` uses `ApplicationRecord.transaction { BrokerageDomain.lock.find(domain.id) }` with guard `return unless locked.status_phasing_out?` and `locked.update!(status: :active, consecutive_failures: 0, last_checked_at: Time.current, phase_out_at: nil)` |
| 4 | When a brokerage plan downgrades from Pro, all custom domains are frozen, subdomain promoted to primary, owners emailed; on re-upgrade frozen domains restored (DPRD-01, DPRD-03, DPRD-05, DPRD-06) | ✓ VERIFIED | `Brokerage#freeze_custom_domains!` atomically freezes active/pending/phasing_out custom domains via `update_all(status: "frozen")`, clears all `is_primary`, promotes first active subdomain; `unfreeze_custom_domains!` restores verified→active, unverified→pending; `Ops::PlanController#update` dispatches `DomainMailer.downgrade_notice(@brokerage).deliver_now!` after freeze returns; route `resource :plan, only: [:update, :create]` exists under ops namespace |
| 5 | Health check interval and phase-out duration are named constants; no inline magic numbers | ✓ VERIFIED | `HEALTH_CHECK_INTERVAL = 30.minutes` in `DomainHealthJob`; `PHASE_OUT_DURATION = 30.days` in `BrokerageDomain`; `phase_out!` uses `PHASE_OUT_DURATION.from_now`; no `30.days.from_now` in model; job files use constant-backed method calls only |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/db/migrate/20260530000001_add_domain_health_columns_to_brokerage_domains.rb` | Migration adding consecutive_failures + last_checked_at | ✓ VERIFIED | Migration exists; schema.rb shows `t.integer "consecutive_failures", default: 0, null: false` and `t.datetime "last_checked_at"` |
| `backend/app/models/brokerage_domain.rb` | 5-value enum, PHASE_OUT_DURATION constant, freeze_domain!/unfreeze_domain! methods | ✓ VERIFIED | Enum: `{active: "active", phasing_out: "phasing_out", decommissioned: "decommissioned", pending: "pending", frozen: "frozen"}, prefix: :status`; `PHASE_OUT_DURATION = 30.days` at top of class; `freeze_domain!` and `unfreeze_domain!` methods present |
| `backend/app/serializers/brokerage_domain_serializer.rb` | Exposes 10 attributes including health columns | ✓ VERIFIED | `attributes :id, :domain, :domain_type, :status, :is_primary, :phase_out_at, :verified, :verified_at, :last_checked_at, :consecutive_failures` |
| `backend/app/mailers/domain_mailer.rb` | DomainMailer with three lifecycle email methods | ✓ VERIFIED | `health_failure(domain)`, `downgrade_notice(brokerage)`, `unverified_warning(domain)` all present; `owner_emails` private method uses `BrokerageMembership.without_deleted.where(brokerage: brokerage, role: "owner")` |
| `backend/app/views/domain_mailer/` | 6 ERB templates (3 × html + text) | ✓ VERIFIED | 6 files present: health_failure.html.erb, health_failure.text.erb, downgrade_notice.html.erb, downgrade_notice.text.erb, unverified_warning.html.erb, unverified_warning.text.erb |
| `backend/app/models/brokerage.rb` | freeze_custom_domains! and unfreeze_custom_domains! | ✓ VERIFIED | Both methods present; `freeze_custom_domains!` uses `ApplicationRecord.transaction`; `unfreeze_custom_domains!` selectively restores by `verified` flag; model contains no `DomainMailer` reference |
| `backend/app/controllers/ops/plan_controller.rb` | Ops JSON endpoint with CSRF skip and HTTP Basic auth | ✓ VERIFIED | `skip_before_action :verify_authenticity_token, raise: false`; `freeze_custom_domains!` + `DomainMailer.downgrade_notice(@brokerage).deliver_now!` in freeze branch; `alias_method :create, :update` present |
| `backend/config/routes.rb` | POST /ops/brokerages/:brokerage_id/plan route | ✓ VERIFIED | `resource :plan, only: [:update, :create], controller: "plan"` nested under ops brokerages |
| `backend/app/jobs/domain_verification_job.rb` | Verification job with VERIFICATION_EXPIRY_DAYS constant and pessimistic lock | ✓ VERIFIED | `VERIFICATION_EXPIRY_DAYS = 7`, `WARNING_EMAIL_DAYS = 5`; `promote_to_active!` uses `BrokerageDomain.lock.find` inside transaction; `process_phasing_out` also uses transaction+lock; `getresources` plural used (not singular) |
| `backend/app/jobs/domain_health_job.rb` | Health job with HEALTH_CHECK_INTERVAL constant | ✓ VERIFIED | `HEALTH_CHECK_INTERVAL = 30.minutes`, `MAX_CONSECUTIVE_FAILURES = 3`; `process_health_check` increments counter and calls phase_out! + email at threshold; `getresources` plural used |
| `backend/config/recurring.yml` | SolidQueue schedule for both jobs at 30-minute intervals | ✓ VERIFIED | Both `domain_verification` and `domain_health` entries present with `schedule: every 30 minutes` |
| `backend/app/controllers/v1/admin/domains_controller.rb` | D-08 pending creation; pending domain immediately decommissioned on destroy; pending in index/mutation_payload | ✓ VERIFIED | `custom` action uses `status: :pending, verified: false`; `destroy` has `if domain.status_pending? then domain.decommission!` branch; index and mutation_payload use `.routable.or(.status_pending)` scope |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `DomainVerificationJob#promote_to_active!` | `BrokerageDomain.lock.find(id)` | `ApplicationRecord.transaction` | ✓ WIRED | Lines 73-88 of domain_verification_job.rb: `ApplicationRecord.transaction do; locked = BrokerageDomain.lock.find(domain.id); return if locked.status_active?` |
| `DomainHealthJob#process_health_check` | `domain.phase_out! + DomainMailer#health_failure` | `consecutive_failures >= 3 condition` | ✓ WIRED | Lines 34-38: `if new_count >= MAX_CONSECUTIVE_FAILURES; domain.phase_out!; DomainMailer.health_failure(domain).deliver_now!` |
| `recurring.yml` | `DomainVerificationJob / DomainHealthJob` | SolidQueue scheduler | ✓ WIRED | Both entries present with `every 30 minutes` schedule |
| `DomainMailer#health_failure` | `BrokerageMembership.without_deleted.where(role: 'owner')` | `owner_emails` private method | ✓ WIRED | Line 31 of domain_mailer.rb: `BrokerageMembership.without_deleted.where(brokerage: brokerage, role: "owner").includes(:user).map { |m| m.user.email }` |
| `DomainMailer#health_failure` | `is_primary? conditional in template` | `@domain.is_primary? instance variable` | ✓ WIRED | `health_failure.html.erb` line 43: `<% if @domain.is_primary? %>` with "primary domain…subdomain is now serving as the fallback" text |
| `Ops::PlanController#update` | `Brokerage#freeze_custom_domains!` | `ActiveModel::Type::Boolean.new.cast(params[:freeze])` | ✓ WIRED | Line 16: `@brokerage.freeze_custom_domains!` inside `if freeze` branch |
| `Ops::PlanController#update` | `DomainMailer#downgrade_notice` | `deliver_now! call after freeze_custom_domains! returns` | ✓ WIRED | Line 18: `DomainMailer.downgrade_notice(@brokerage).deliver_now!` |
| `DomainsController#custom` | `BrokerageDomain status: :pending` | `create! call` | ✓ WIRED | Lines 67-73: `create!(domain: domain_param, domain_type: :custom, status: :pending, is_primary: false, verified: false)` |
| `DomainsController#destroy` | `domain.decommission!` | `status_pending? branch` | ✓ WIRED | Lines 93-96: `if domain.status_pending?; domain.decommission!; return render...` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|---------------------|--------|
| `domain_health_job.rb` | `domain.consecutive_failures` | `BrokerageDomain.domain_type_custom.status_active` DB query | Yes — reads from real DB records | ✓ FLOWING |
| `domain_verification_job.rb` | `domain.status` (pending/phasing_out) | `BrokerageDomain.domain_type_custom.status_pending` DB query | Yes — reads from real DB records | ✓ FLOWING |
| `domain_mailer.rb` | `owner_emails` | `BrokerageMembership.without_deleted.where(role: "owner")` | Yes — real DB query with soft-delete guard | ✓ FLOWING |
| `brokerage.rb#freeze_custom_domains!` | domain statuses | `brokerage_domains.domain_type_custom.where(status: ...)` | Yes — real `update_all` bulk writes | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — background jobs cannot be triggered without running SolidQueue; DNS resolution requires external network; behavioral validation requires human execution of test suite.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DVER-02 | 22-05 | Background verification polling every 30 minutes | ✓ SATISFIED | `domain_verification` entry in recurring.yml with `every 30 minutes` |
| DVER-05 | 22-01, 22-05 | First-to-verify wins via pessimistic lock | ✓ SATISFIED | `promote_to_active!` uses `BrokerageDomain.lock.find` inside transaction with idempotency guard |
| DHLT-01 | 22-05 | Active custom domains checked every 30 minutes | ✓ SATISFIED | `domain_health` entry in recurring.yml; `DomainHealthJob` scopes to `domain_type_custom.status_active` |
| DHLT-02 | 22-05 | 3 consecutive failures → phasing-out | ✓ SATISFIED | `MAX_CONSECUTIVE_FAILURES = 3`; `if new_count >= MAX_CONSECUTIVE_FAILURES then domain.phase_out!` |
| DHLT-03 | 22-02, 22-05 | health_failure email to Owner-role users when auto-phased-out | ✓ SATISFIED | `DomainMailer.health_failure(domain).deliver_now!` called from DomainHealthJob; mailer queries owner-role members |
| DHLT-04 | 22-02, 22-05 | health_failure email notes subdomain fallback when domain was primary | ✓ SATISFIED | Both HTML and text templates have `<% if @domain.is_primary? %>` conditional with explicit "primary domain…subdomain is now serving as the fallback" language |
| DHLT-05 | 22-01, 22-05 | HEALTH_CHECK_INTERVAL and PHASE_OUT_DURATION as named constants | ✓ SATISFIED | `HEALTH_CHECK_INTERVAL = 30.minutes` in DomainHealthJob; `PHASE_OUT_DURATION = 30.days` in BrokerageDomain; `phase_out!` uses `PHASE_OUT_DURATION.from_now`; no inline literals in jobs |
| DLCX-01 | 22-05 | Phasing-out domain rescued to active if CNAME passes before decommission date | ✓ SATISFIED | `process_phasing_out` in DomainVerificationJob: locks domain, guards with `status_phasing_out?`, updates `status: :active, phase_out_at: nil` |
| DPRI-01 | 22-04 | Any fully active domain can be set as primary | ✓ SATISFIED | `set_primary` action allows any `status_active?` domain to be set as primary |
| DPRI-02 | 22-04 | Pending/phasing-out domains cannot be set as primary | ✓ SATISFIED | `unless domain.status_active?` guard in `set_primary` — rejects pending, frozen, phasing_out, decommissioned |
| DPRD-01 | 22-03 | Plan downgrade freezes all custom domains | ✓ SATISFIED | `freeze_custom_domains!` uses `update_all(status: "frozen")` for active/pending/phasing_out custom domains inside transaction |
| DPRD-03 | 22-03 | Subdomain becomes primary on downgrade | ✓ SATISFIED | `freeze_custom_domains!` clears all `is_primary`, then promotes `domain_type_subdomain.status_active.first` |
| DPRD-05 | 22-02, 22-03 | Owner-role users emailed on plan downgrade | ✓ SATISFIED* | `downgrade_notice` email dispatched from `Ops::PlanController` after freeze commits; see CR-03 caveat below |
| DPRD-06 | 22-03 | Frozen domains restored on re-upgrade | ✓ SATISFIED | `unfreeze_custom_domains!` restores verified→active, unverified→pending via scoped `update_all` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `domain_verification_job.rb` | 41-44 | `unverified_warning` sent on every job run from day 5 to day 7; code comment acknowledges this as intentional ("may send multiple times in the 5-7 day window") | ⚠️ Warning | Can send up to 96 warning emails for a single domain if the job runs every 30 minutes over the 48-hour window. DADD-04 is Phase 24 scope per REQUIREMENTS.md traceability table — the unverified_warning implementation is Phase 22 bonus work. Phase 24 should add idempotency (e.g. last_warning_sent_at column). |
| `domain_health_job.rb` | 31-38 | No pessimistic lock around `consecutive_failures` increment + `phase_out!` + email dispatch | ⚠️ Warning | Two concurrent DomainHealthJob workers processing the same domain can both observe `consecutive_failures=2`, both increment to 3, and both dispatch a `health_failure` email. The `phase_out!` call itself is idempotent (sets status/phase_out_at to same values), but the email will be duplicated. Low probability with SolidQueue's default concurrency but possible under burst load. |
| `ops/plan_controller.rb` | 18 | `DomainMailer.downgrade_notice(@brokerage).deliver_now!` with no guard for empty `owner_emails` | ⚠️ Warning | If a brokerage has no active Owner-role memberships, `owner_emails` returns `[]`. In Rails 7.1 with `delivery_method: :resend` (production), `deliver_now!` with `to: []` raises `ArgumentError`. The `rescue => e` block catches this and returns 422, but `freeze_custom_domains!` has already committed. The brokerage is frozen but the HTTP response signals failure to the caller. In practice, every brokerage has at least one owner at registration; this is an edge case for soft-deleted-all-owners scenarios. |
| `domain_health_job.rb` | 37 | `DomainMailer.health_failure(domain).deliver_now!` called after `domain.phase_out!` | ℹ️ Info | `domain` is the AR object passed in-memory (not reloaded); `phase_out!` modifies `status` and `phase_out_at` in-place. The `is_primary?` check in the template reads `@domain.is_primary?` which reflects the in-memory value (not persisted yet at template render time). Since `phase_out!` does NOT change `is_primary`, the value is correct. No bug, but the ordering is worth noting. |

### Human Verification Required

#### 1. Full Test Suite Execution

**Test:** Run the complete Phase 22 test suite from the backend directory:
```bash
cd /home/tomlaventure/projects/realstate/backend
RAILS_ENV=test rails test \
  test/models/brokerage_domain_test.rb \
  test/models/brokerage_freeze_test.rb \
  test/mailers/domain_mailer_test.rb \
  test/integration/ops_plan_test.rb \
  test/integration/admin_domains_test.rb \
  test/jobs/domain_verification_job_test.rb \
  test/jobs/domain_health_job_test.rb
```

**Expected:** 0 failures, 0 errors across all files (SUMMARY claims 20+ tests passing across job files, 13 in mailer, 9 model, 5 integration ops). Note the pre-existing DMOD-11 failure (`PATCH /v1/admin/domains/subdomain includes phase_out_warning...`) was documented by Phase 22 as pre-existing — it may still appear in admin_domains_test.rb.

**Why human:** The test files use a `FakeJob` subclass pattern (not Minitest::Mock) to avoid real DNS calls. The verification agent cannot run the full test suite without a live Rails environment.

#### 2. Ops Freeze Endpoint — Empty Owner Edge Case (CR-03)

**Test:** Create a brokerage with no active owner memberships (soft-delete all owners), then POST to `/ops/brokerages/:id/plan` with `freeze: true`.

**Expected:** Either (a) domains are frozen AND 200 is returned (treating 0-owner brokerage as a non-fatal no-op for email), or (b) domains are frozen AND the error is clearly logged but not returned as HTTP failure to caller.

**Why human:** The current implementation (`rescue => e; render json: {error: e.message}, status: :unprocessable_entity`) would return 422 if `deliver_now!` raises on empty recipients, even though the freeze operation committed. This means the caller receives a "failure" response for a "succeeded" operation. Human must decide if a guard like `DomainMailer.downgrade_notice(@brokerage).deliver_now! if owner_emails(@brokerage).any?` is required, or if the ops endpoint's docs should state "requires at least one active owner."

### Gaps Summary

No FAILED truths or MISSING artifacts. All 5 roadmap success criteria are implemented. The three code-review issues (CR-01, CR-02, CR-03) are real bugs within an otherwise-functional implementation — they are edge cases that do not prevent the phase goal from being achieved under normal operating conditions.

**CR-01 (DomainHealthJob race condition):** Low probability in practice with SolidQueue's ordered queue processing. Does not prevent health monitoring from working — at worst, causes a duplicate health_failure email under concurrent execution. Phase 22 must_haves do not require a pessimistic lock on DomainHealthJob (only DomainVerificationJob's promote_to_active! is locked, per DVER-05 scope).

**CR-02 (unverified_warning multi-send):** The warning email is Phase 22 bonus work (DADD-04 is Phase 24 scope). The code explicitly comments this is known behavior. Phase 24 should add a `last_warning_sent_at` column for idempotency.

**CR-03 (ops freeze crash on no owners):** Affects only the manual ops endpoint used for testing. The billing webhook integration (v2) is not yet implemented. Every production brokerage has at least one owner at registration. The domain freeze itself is atomic and correct — only the email dispatch fails in this edge case.

---

_Verified: 2026-05-30T22:00:00Z_
_Verifier: Claude (gsd-verifier)_

# Phase 22: DNS Verification & Health Monitoring Backend - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 22 delivers the autonomous backend infrastructure for custom domain lifecycle management: two SolidQueue recurring jobs (verification poller + health monitor), the `pending` and `frozen` status values, new DB columns (`consecutive_failures`, `last_checked_at`), downgrade freeze/unfreeze service methods + ops endpoint, and three transactional emails via a new `DomainMailer`. No frontend changes, no 301 redirect middleware (that's Phase 23), no UI triggers (that's Phase 24).

</domain>

<decisions>
## Implementation Decisions

### CNAME Verification Mechanics
- **D-01:** DNS lookup uses Ruby's built-in `Resolv` library — no system dependency. `Resolv::DNS.open { |dns| dns.getresources(domain, Resolv::DNS::Resource::IN::CNAME) }`.
- **D-02:** The CNAME target to verify against is the brokerage's own subdomain (looked up from `brokerage_domains` at check time, not a hardcoded platform value).
- **D-03:** Any lookup failure (wrong target, DNS error, timeout, domain not found) counts as a failure. No distinction between transient and permanent errors — simpler logic, acceptable for 30-minute polling cadence.
- **D-04:** Both jobs run sequentially over all matching domains in a single job execution — no per-domain fanout. Matches `ResyncStalePhotosJob` pattern. Sufficient for current scale.

### Downgrade Trigger
- **D-05:** The freeze/unfreeze domain trigger is external (future billing webhook / manual ops action). Phase 22 builds the service methods (`Brokerage#freeze_custom_domains!` and `#unfreeze_custom_domains!`) only — no automatic trigger wiring.
- **D-06:** A JSON ops endpoint `POST /ops/brokerages/:id/plan` is added to allow manual freeze/unfreeze for testing. It accepts `freeze: true/false` and calls the appropriate service method. Secured behind existing ops auth (`Ops::BaseController`).
- **D-07:** The same endpoint handles both freeze (downgrade) and unfreeze (re-upgrade) via the `freeze` param toggle.

### Pending Status + API Impact
- **D-08:** The existing `POST /v1/admin/domains/custom` is updated now to create custom domains with `status: pending, verified: false`. The Phase 21 UI will show domains in an indeterminate state until Phase 24 overhaul. Accepted trade-off — Phase 24 follows immediately.
- **D-09:** `pending` is added as a new enum value to the existing `BrokerageDomain` status enum: `{active, phasing_out, decommissioned, pending}`. `frozen` is also added: `{active, phasing_out, decommissioned, pending, frozen}`. Both added in the same Phase 22 migration.
- **D-10:** The existing `status_active?` guard in `set_primary` and `status_requires_verified` validation already cover `pending` and `frozen` correctly — no additional audit needed.

### Email Structure
- **D-11:** One `DomainMailer` class with three methods: `health_failure(domain)`, `downgrade_notice(brokerage)`, `unverified_warning(domain)`.
- **D-12:** ActionMailer ERB templates — `app/views/domain_mailer/{method_name}.html.erb` + `.text.erb` per method. Matches existing `InvitationMailer` pattern.
- **D-13:** Recipient resolution for owner-role emails: query `BrokerageMembership.where(role: 'owner').includes(:user)` at send time within the mailer or dispatching job. No separate model needed.

### Claude's Discretion
- Queue assignment for new jobs: follow `ResyncStalePhotosJob` and use `:background` queue.
- Naming constants (DHLT-05): `HEALTH_CHECK_INTERVAL = 30.minutes` and `PHASE_OUT_DURATION = 30.days` — Claude decides the exact location (e.g., module-level constants in the job class or a `DomainConstants` module).
- DVER-05 (first-to-verify wins): Claude decides on the exact locking mechanism — `with_lock` / `lock!` on the domain record or a DB-level advisory lock. Prevent race between concurrent job runs promoting the same domain.
- Job class naming: `DomainVerificationJob` (handles pending) and `DomainHealthJob` (handles active). Claude confirms names during planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — all v1.6 requirement definitions; Phase 22 covers: DVER-02, DVER-05, DHLT-01–05, DLCX-01, DPRI-01, DPRI-02, DPRD-01, DPRD-03, DPRD-05, DPRD-06, DADD-04
- `.planning/ROADMAP.md` §Phase 22 — success criteria (5 items) and phase dependencies

### Existing Domain Model
- `backend/app/models/brokerage_domain.rb` — current model: enum values, scopes, `phase_out!`/`decommission!`/`verify!` methods, validations
- `backend/db/schema.rb` §brokerage_domains — current columns (Phase 22 migration adds `consecutive_failures`, `last_checked_at`, and two new status enum values)
- `backend/app/controllers/v1/admin/domains_controller.rb` — controller to update for pending status (D-08); also reference for ops endpoint auth pattern

### Background Job Patterns
- `backend/app/jobs/resync_stale_photos_job.rb` — sequential batch job pattern to follow
- `backend/config/recurring.yml` — add two new recurring entries (verification + health, every 30 min)
- `backend/config/queue.yml` — queue worker definitions; new jobs use `:background` queue

### Email Patterns
- `backend/app/jobs/send_invitation_email_job.rb` — async email dispatch pattern (`deliver_now!` inside job, retry + discard_on RecordNotFound)
- `backend/app/mailers/` — existing mailer location; `DomainMailer` is new

### Ops Namespace
- `backend/app/controllers/ops/brokerage_domains_controller.rb` — existing ops controller pattern (note: ops controllers use HTML responses for existing actions; new freeze endpoint returns JSON)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BrokerageDomain#phase_out!` and `#decommission!` — existing lifecycle transition methods; `freeze!` / `unfreeze!` should follow the same pattern
- `BrokerageMembership` — used to resolve owner-role recipients for emails
- `Resend` gem — transactional email delivery; already configured via credentials

### Established Patterns
- `ResyncStalePhotosJob`: sequential `in_batches` loop, `:background` queue, `retry_on StandardError, wait: :polynomially_longer` — follow this pattern for both new jobs
- `recurring.yml`: add entries like `domain_verification: { class: DomainVerificationJob, queue: background, schedule: "every 30 minutes" }` — verify SolidQueue recurring schedule syntax matches existing entry
- `SendInvitationEmailJob`: `deliver_now!` inside job, `discard_on ActiveRecord::RecordNotFound`, `retry_on StandardError` — follow for async email dispatch
- Status enum + prefix convention: `enum :status, {...}, prefix: :status` — all checks use `domain.status_active?`, `domain.status_pending?` etc.

### Integration Points
- `backend/config/recurring.yml` — add two new recurring job entries
- `backend/app/controllers/v1/admin/domains_controller.rb#custom` — update `status: :active, verified: true` → `status: :pending, verified: false`
- `backend/app/controllers/ops/` — add new `PlanController` or extend existing ops namespace for freeze endpoint
- `backend/db/migrate/` — one migration adding `consecutive_failures` (integer, default 0), `last_checked_at` (datetime, nullable), and expanding status enum for `pending` and `frozen`

</code_context>

<specifics>
## Specific Ideas

- The `DomainVerificationJob` checks pending domains (verifies CNAME → promotes to active; ages out after 7 days → decommissions + sends `unverified_warning` at day 5).
- The `DomainHealthJob` checks active custom domains (CNAME still resolves to brokerage subdomain? → resets `consecutive_failures`; failure increments counter; at 3 → `phase_out!` + sends `health_failure` email).
- When the phasing-out domain's CNAME passes re-verification before `phase_out_at`, `DomainVerificationJob` restores it to active and clears `phase_out_at` (DLCX-01).
- The ops freeze endpoint path: `POST /ops/brokerages/:brokerage_id/plan` with `{ freeze: true/false }` body — fits the existing `/ops/brokerages/:brokerage_id/domains` pattern.
- DVER-05 race condition: when two verification job runs find the same domain pending and both succeed, use `BrokerageDomain.lock.find(domain_id)` (pessimistic lock) inside a transaction before promoting to active.

</specifics>

<deferred>
## Deferred Ideas

- `POST /ops/brokerages/:id/plan` endpoint for actual plan changes (e.g., upgrading premium) — the Phase 22 endpoint only toggles domain freeze, not the plan field itself. Full billing integration is v2.
- Notification/alert when `consecutive_failures` hits 1 or 2 (early warning before full phase-out) — mentioned implicitly; deferred, not in DHLT requirements.
- Retry budget / backoff within verification job for flapping domains — not required by DHLT; deferred to a future health refinement phase.

</deferred>

---

*Phase: 22-DNS Verification & Health Monitoring Backend*
*Context gathered: 2026-05-30*

# Phase 22: DNS Verification & Health Monitoring Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 22-DNS Verification & Health Monitoring Backend
**Areas discussed:** CNAME verification, Downgrade trigger, Pending status + API impact, Email structure

---

## CNAME Verification

### DNS lookup method

| Option | Description | Selected |
|--------|-------------|----------|
| Ruby Resolv (built-in) | Standard library, no OS dependency, consistent across environments | ✓ |
| Shell out to dig/nslookup | Simpler to read, adds OS dependency and injection risk | |
| HTTParty / external DNS API | Works behind NAT, adds external dependency | |

**User's choice:** Ruby Resolv (recommended)

---

### CNAME target

| Option | Description | Selected |
|--------|-------------|----------|
| Brokerage's subdomain | Each brokerage's subdomain looked up from DB at check time | ✓ |
| Fixed platform CNAME target | One canonical `verify.realstate.ca` for all | |
| Per-domain TXT verification token | Standard ownership proof, extra DNS steps for users | |

**User's choice:** The brokerage's subdomain (recommended)

---

### Error handling

| Option | Description | Selected |
|--------|-------------|----------|
| Any failure counts as failure | Simple — can't confirm CNAME = failure; 3 consecutive = phase_out | ✓ |
| Distinguish transient from permanent | ResolvError (timeout) → skip; wrong target → count. More resilient, more complex | |
| Retry per job attempt | SolidQueue retry before recording failure, slows detection | |

**User's choice:** Any lookup failure counts as a failure (recommended)

---

### Job scale / batching

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential in one job | Iterate all domains in single perform run — matches ResyncStalePhotosJob | ✓ |
| Fan out per-domain jobs | Enqueue VerifyDomainJob per domain — more parallelism, more overhead | |
| You decide | Let Claude pick based on existing job patterns | |

**User's choice:** Sequential in one job (recommended)

---

## Downgrade Trigger

### Plan downgrade origin

| Option | Description | Selected |
|--------|-------------|----------|
| New backend endpoint | Phase 22 adds PATCH/POST for plan changes, triggers freeze | |
| Brokerage model callback | `after_update :handle_plan_downgrade` when plan changes | |
| External webhook / future scope | Phase 22 builds service methods only; trigger wired later | ✓ |

**User's choice:** External webhook / future scope

---

### Ops test endpoint

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add test/ops endpoint | POST /ops/brokerages/:id/freeze_domains behind ops auth | ✓ |
| No — just service method | Build methods only; use Rails console for manual testing | |

**User's choice:** Yes — add a test/ops endpoint

---

### Re-upgrade (unfreeze) in same endpoint

| Option | Description | Selected |
|--------|-------------|----------|
| Same endpoint, toggle behavior | `freeze: true/false` param — symmetric | ✓ |
| Separate unfreeze endpoint | Explicit but two endpoints to build | |
| Unfreeze is Phase 24 concern | Phase 22 freeze only | |

**User's choice:** Yes — same endpoint, toggle behavior

---

## Pending Status + API Impact

### Transition timing

| Option | Description | Selected |
|--------|-------------|----------|
| Change endpoint now (Phase 24 adapts) | Update controller immediately; Phase 21 UI shows indeterminate state until Phase 24 | ✓ |
| Feature-flag the pending behavior | DOMAIN_VERIFICATION_ENABLED env var; Phase 24 flips it | |
| Keep active+verified, change in Phase 24 | Leave existing behavior; Phase 22 jobs handle manually-inserted pending domains | |

**User's choice:** Change the endpoint now — Phase 24 UI will adapt (recommended)

---

### Status modeling

| Option | Description | Selected |
|--------|-------------|----------|
| New enum value `pending` | Add to existing status enum — consistent, natural fit | ✓ |
| Reuse verified boolean | `active+unverified` = pending; semantically odd | |
| Separate verification_status column | Two state machines to manage | |

**User's choice:** New enum value `pending` (recommended)

---

### Primary domain guard coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Existing `status_active?` is sufficient | Already rejects non-active; pending/frozen automatically covered | ✓ |
| Audit existing controller + model | Explicit audit for all status guards | |
| You decide | Claude audits during planning | |

**User's choice:** No — existing `status_active?` check is sufficient

---

## Email Structure

### Mailer organization

| Option | Description | Selected |
|--------|-------------|----------|
| One DomainMailer, three methods | health_failure, downgrade_notice, unverified_warning | ✓ |
| Separate mailer per email type | HealthFailureMailer, DowngradeMailer, UnverifiedWarningMailer | |

**User's choice:** One DomainMailer class, three methods (recommended)

---

### Email format

| Option | Description | Selected |
|--------|-------------|----------|
| ActionMailer ERB templates | html.erb + text.erb per method — Rails default, easy to edit | ✓ |
| Inline HTML strings | Heredocs in mailer class — hard to maintain | |
| Plain text only | Simple but less polished for SaaS product | |

**User's choice:** ActionMailer ERB templates (recommended)

---

### Recipient resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Query BrokerageMembership at send time | .where(role: 'owner').includes(:user) in mailer/job | ✓ |
| Pass user list to job explicitly | Resolve owner users before enqueuing, pass user_ids | |
| You decide | Claude picks cleanest pattern | |

**User's choice:** Query BrokerageMembership for owner role at send time (recommended)

---

## Claude's Discretion

- Queue assignment: `:background` (follows ResyncStalePhotosJob)
- Named constants location: module-level in job class or `DomainConstants` module
- DVER-05 locking mechanism: `BrokerageDomain.lock.find(id)` inside transaction or advisory lock
- Job class naming: `DomainVerificationJob` and `DomainHealthJob`

## Deferred Ideas

- Billing integration for plan changes (trigger source) — future scope
- Early-warning emails at 1–2 consecutive failures before full phase-out
- Retry budget / backoff for flapping domains in health check

---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: — Domain Management v2
status: executing
stopped_at: Plan 24-02 complete — frontend type contract (domain types, verifyDomain hook, add/remove hooks, Tooltip)
last_updated: "2026-05-31T06:20:00Z"
last_activity: 2026-05-31 -- Phase 24 Plan 02 executed
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 11
  completed_plans: 9
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30)

**Core value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.
**Current focus:** v1.6 — Domain Management v2

## Current Position

Phase: 24 — Domain UI Overhaul
Plan: 03 (next) — 4 plans across 3 waves, Plans 01-02 complete
Status: Executing
Last activity: 2026-05-31 -- Phase 24 Plan 02 complete

```
Progress: [=======================       ] 75% (2/3 phases complete, 9/11 plans complete)
```

## Phase Summary

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 22 | DNS Verification & Health Monitoring Backend | 14 | Complete ✓ |
| 23 | 301 Redirect & Primary Domain Enforcement | 3 | Complete ✓ |
| 24 | Domain UI Overhaul | 17 | In Progress |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Apple / Microsoft social login | v2 | Requirements |
| Calendar | Two-way calendar sync | v2 | Requirements |
| Security | JWT → HttpOnly cookies migration | v2 | Requirements |
| Frontend | Redux → Context/TanStack Query migration | v2 | Requirements |
| CAL-04 | Microsoft Calendar sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CAL-05 | Apple CalDAV sync | Adapter built; activate by expanding PROVIDERS | v1.0 close |
| CR-02 | S3 favicon upload outside transaction | Pre-existing; carry to v1.7 | v1.1 close |
| UX | Brokerage switch preserving active tab position | Carry to v1.7 | v1.4 close |
| UX | Deep-link into admin panel with brokerage context preserved | Carry to v1.7 | v1.4 close |

## Accumulated Context

### Key Constraints for v1.6

- DPRI-04 (301 redirect) must be implemented as Rails Rack middleware (not Caddy config) — Caddy-layer redirect is explicitly listed as out of scope in REQUIREMENTS.md
- DPRD-02 (frozen domain redirect) uses the same Rack middleware path as DPRI-04 — both belong in Phase 23 for clean isolation
- Background jobs run on SolidQueue (DB-backed, no Redis) — recurring job scheduling uses SolidQueue's built-in recurring job support
- DVER-05 (first-to-verify wins) requires a database-level lock or atomic check during the verification promotion to prevent race conditions between concurrent verification jobs
- Phase 22 adds `consecutive_failures` counter and `last_checked_at` timestamp columns to `brokerage_domains` — migration required
- Phase 22 adds `frozen` as a new domain status value (in addition to active / phasing_out / decommissioned / pending)
- DADD-04 (7-day auto-remove of unverified domains) is driven by the Phase 22 verification polling job — the job checks `created_at` age and enqueues a day-5 warning email

### Decisions Made

| Decision | Rationale |
|----------|-----------|
| Phase 23 isolated for redirect middleware | 301 redirect affects every HTTP request; isolated phase allows focused testing before UI work in Phase 24 |
| DPRI-01/02 backend constraints in Phase 22 | Pending-verification is a new status introduced in Phase 22; primary eligibility rules must be updated atomically with the status machine |
| DVER-01 (Verify now button) in Phase 24 not Phase 22 | The button enqueues an existing job; the UI trigger belongs with the UI phase; the job implementation belongs in Phase 22 |
| PHASE_OUT_DURATION constant at model class level | Duration constant placed before RESERVED_SLUGS in BrokerageDomain — visible, centralized, and used by phase_out! instead of inline 30.days |
| pending/frozen enum values require no migration | String enum in Rails — adding values to the hash is model-only, no ALTER TYPE or migration needed |
| verified exposed in BrokerageDomainSerializer | Phase 24 UI needs verification state; endpoint is behind require_admin! (T-22-02: accept disposition) |
| owner_emails resolves at send time via BrokerageMembership.without_deleted | Soft-deleted members must never receive email; paranoid guard is required at query time |
| primary_domain helper copied to DomainMailer from InvitationMailer (not extracted) | Only two callers; premature abstraction to ApplicationMailer deferred until third caller exists |
| DHLT-04 fallback language in ERB template (not mailer method) | Keeps mailer method signatures clean; template-layer conditional is the established pattern |
| Email dispatch in Ops::PlanController (not Brokerage model) | Model method stays mailer-free and testable without mailer dependency; email sent only after transaction commits |
| unfreeze_custom_domains! uses verified flag to determine restore target | verified:true -> active, verified:false -> pending; avoids tracking pre-freeze status separately |
| alias_method :create, :update in Ops::PlanController | Enables POST alongside PATCH/PUT for JSON ops endpoint without duplicate action code |
| D-08: custom domains created as pending (not active) | DomainVerificationJob promotes to active after CNAME check; bypasses old phase-out-on-create logic |
| DNS stub via define_method/remove_method (Phase 24) | Cleanest Minitest 6 compatible stub — no module prepend teardown complexity; matches FakeJob subclass precedent from Phase 22 |
| verify action uses synchronous dns_resolves? inline | Frontend useVerifyDomain expects direct { verified } response; mirrors onboarding verify pattern |
| Pending destroy: immediate decommission, no phase-out | Pending domains have no live traffic — slot checks and phase-out period do not apply |
| index and mutation_payload include pending domains | .routable.or(.status_pending) ensures Phase 24 UI can display verification state immediately after creation |
| FakeJob subclass for DNS testing in Minitest 6 | Minitest 6.0.3 (Ruby 4.0.0) removed Minitest::Mock and .stub — test subclass overrides cname_resolves_to_subdomain? directly |
| No without_deleted on BrokerageDomain job scopes | BrokerageDomain does not include acts_as_paranoid; plain status scopes are correct |
| require_relative in application.rb for DomainRedirectMiddleware | Zeitwerk autoload not yet active when application.rb runs — class must be resolvable at middleware registration time |
| insert_before ActionDispatch::Static for middleware position | Places DomainRedirectMiddleware after Rack::Cors (position 2) so CORS preflight OPTIONS requests are handled before redirect logic |
| In-memory .find on .includes() collection for primary lookup | Avoids second AR query per redirected request — eager-loaded collection handles primary resolution with no N+1 |
| useVerifyDomain uses onMutate snapshot for rescue detection | Captures previousStatus before mutation fires; avoids relying solely on response data which may not include prior state |
| FetchDomainsResponse used as getQueryData generic in useVerifyDomain | More type-safe than inline shape; matches actual cache shape exactly |

## Session Continuity

Stopped at: Plan 24-02 complete — frontend type contract (domain types, verifyDomain hook, add/remove hooks, Tooltip)
Next action: Execute Phase 24 Plan 03 (DomainCard, DomainCardList, AddDomainWizard components)
Last session: 2026-05-31T06:20:00Z — Completed 24-02 (domain types, verifyDomain, useAddCustomDomain, useRemoveCustomDomain, Tooltip)

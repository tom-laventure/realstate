---
phase: 22-dns-verification-health-monitoring-backend
plan: "02"
subsystem: mailer
tags: [rails, actionmailer, email, minitest, factory_bot]

requires:
  - phase: 22-01
    provides: "BrokerageDomain model with status enum, phase_out_at, and health-tracking columns"

provides:
  - "DomainMailer with health_failure(domain), downgrade_notice(brokerage), unverified_warning(domain) methods"
  - "owner_emails private helper using BrokerageMembership.without_deleted.where(role: 'owner')"
  - "health_failure HTML+text templates with DHLT-04 primary-domain fallback conditional"
  - "downgrade_notice HTML+text templates for plan downgrade freeze notification"
  - "unverified_warning HTML+text templates for 2-day pending domain expiry warning"
  - "DomainMailerTest with 13 tests covering all three mailer methods"

affects:
  - "22-03-domain-health-job"
  - "22-05-dns-verification-job"

tech-stack:
  added: []
  patterns:
    - "Mailer recipient resolution: owner_emails private method queries BrokerageMembership.without_deleted at send time"
    - "primary_domain helper copied from InvitationMailer — consistent pattern across all mailers"
    - "ERB email templates follow 600px table-based layout with header/body/footer sections and CTA button"

key-files:
  created:
    - "backend/app/mailers/domain_mailer.rb"
    - "backend/app/views/domain_mailer/health_failure.html.erb"
    - "backend/app/views/domain_mailer/health_failure.text.erb"
    - "backend/app/views/domain_mailer/downgrade_notice.html.erb"
    - "backend/app/views/domain_mailer/downgrade_notice.text.erb"
    - "backend/app/views/domain_mailer/unverified_warning.html.erb"
    - "backend/app/views/domain_mailer/unverified_warning.text.erb"
    - "backend/test/mailers/domain_mailer_test.rb"
  modified: []

key-decisions:
  - "owner_emails resolves recipients at send time via BrokerageMembership.without_deleted — soft-deleted members excluded from email lists"
  - "primary_domain helper copied verbatim from InvitationMailer rather than extracted to ApplicationMailer — avoids premature abstraction; both mailers are the only callers"
  - "DHLT-04 implemented as an ERB conditional in both HTML and text templates — template-layer separation keeps mailer methods clean"

patterns-established:
  - "Mailer recipient list: always resolve via owner_emails(brokerage) with .without_deleted guard — never pass emails as argument"
  - "Dashboard URL: always build as 'https://#{primary_domain(brokerage)}/admin/domains' using same primary_domain helper"

requirements-completed:
  - DHLT-03
  - DHLT-04
  - DPRD-05

duration: 8min
completed: "2026-05-30"
---

# Phase 22 Plan 02: DomainMailer Summary

**DomainMailer with health_failure, downgrade_notice, and unverified_warning email methods — 6 ERB templates, 13 passing mailer tests, DHLT-04 primary-domain fallback language in health failure templates**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-30T20:00:00Z
- **Completed:** 2026-05-30T20:08:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- DomainMailer class with three public email methods dispatching to Owner-role brokerage members, guarded with `.without_deleted` (DHLT-03)
- health_failure email includes decommission date, domain name, dashboard link, and explicit primary-domain fallback language when the failing domain was primary (DHLT-04)
- downgrade_notice email explains frozen custom domains and links to dashboard (DPRD-05)
- unverified_warning email alerts owners 2 days before 7-day pending domain auto-removal
- All 6 ERB templates follow the established 600px table-based email layout from InvitationMailer
- 13 mailer tests pass with 0 failures, 0 errors

## Task Commits

Each task was committed atomically (backend/ sub-repo):

1. **Task 1: Create DomainMailer class** - `84a78e1` (feat)
2. **Task 2: Create 6 ERB email templates and mailer tests** - `91672f9` (feat)

## Files Created/Modified

- `backend/app/mailers/domain_mailer.rb` - DomainMailer with three methods + owner_emails + primary_domain helpers
- `backend/app/views/domain_mailer/health_failure.html.erb` - HTML email with DHLT-04 primary/fallback conditional block
- `backend/app/views/domain_mailer/health_failure.text.erb` - Plain text version with same conditional
- `backend/app/views/domain_mailer/downgrade_notice.html.erb` - HTML email for plan downgrade freeze notification
- `backend/app/views/domain_mailer/downgrade_notice.text.erb` - Plain text version
- `backend/app/views/domain_mailer/unverified_warning.html.erb` - HTML email for pending domain expiry warning
- `backend/app/views/domain_mailer/unverified_warning.text.erb` - Plain text version
- `backend/test/mailers/domain_mailer_test.rb` - 13 tests for all three mailer methods

## Decisions Made

- `owner_emails` resolves recipients at send time via `BrokerageMembership.without_deleted.where(role: "owner")` — ensures soft-deleted members are excluded from the recipient list (T-22-02 mitigate disposition)
- `primary_domain` helper copied verbatim from InvitationMailer rather than refactoring to ApplicationMailer — avoids premature abstraction; only two callers exist and the pattern was already established
- DHLT-04 fallback language implemented as an ERB conditional (`<% if @domain.is_primary? %>`) in both HTML and text templates — keeps mailer method signatures clean and lets the template control presentation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `PG::ObjectInUse` transient warning on `rails test` startup — the dev server's connection briefly blocked the test database reset. Rails test runner automatically retried and all 13 tests ran to completion. Pre-existing issue, not introduced by this plan.

## User Setup Required

None - no external service configuration required. Mailer delivery uses the existing ActionMailer configuration (Resend/SMTP in production).

## Known Stubs

None. All mailer methods are fully implemented with real recipient resolution and real template variables. No placeholder data.

## Threat Flags

No new security-relevant surface beyond the plan's threat model. T-22-02 (BrokerageMembership query) is mitigated by `.without_deleted` as planned. T-22-03 (domain value in template) accepted — domain value validated on creation. T-22-04 (from address spoofing) accepted — ApplicationMailer default from address covers this.

## Next Phase Readiness

DomainMailer is ready to be called from:
- Plan 22-03 (DomainHealthJob): `DomainMailer.health_failure(domain).deliver_later`
- Plan 22-05 (DNS verification job): `DomainMailer.unverified_warning(domain).deliver_later`
- Plan 22-05 or ops endpoint: `DomainMailer.downgrade_notice(brokerage).deliver_later`

---
*Phase: 22-dns-verification-health-monitoring-backend*
*Completed: 2026-05-30*

---
phase: 19-domain-schema-auth-integration
plan: "02"
subsystem: backend-model
tags: [model, enum, validation, brokerage_domains, domain-lifecycle, reserved-slugs]
dependency_graph:
  requires: [domain_type-column, status-column, partial-unique-index-brokerage_domains]
  provides: [BrokerageDomain-enums, BrokerageDomain-routable-scope, BrokerageDomain-reserved-slugs, BrokerageDomain-status-invariant]
  affects: [BrokerageDomain, BrokerageAuth, DomainsController]
tech_stack:
  added: []
  patterns: [rails-enum-string-backed, frozen-constant, partial-uniqueness-validator, named-scope]
key_files:
  created: []
  modified:
    - backend/app/models/brokerage_domain.rb
decisions:
  - "RESERVED_SLUGS contains 21 words (not 20 as stated in plan acceptance criteria) — the plan body listed 21 words including 'status'; the word list is authoritative over the count assertion"
  - "Used prefix: :domain_type and prefix: :status on enums to generate scoped predicate helpers (domain_type_subdomain?, status_active?, etc.) and avoid name collisions with column names"
  - "valid_subdomain_slug guard (if: domain_type_subdomain?) ensures slug format/reserved word checks only run for subdomain type records, not custom domains"
  - "Partial uniqueness validator uses conditions lambda scoping to non-decommissioned records, allowing decommissioned domains to be reclaimed"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-27"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 19 Plan 02: BrokerageDomain Model Enums, Scopes, and Validations Summary

**One-liner:** BrokerageDomain model updated with string-backed Rails enums for domain_type/status, RESERVED_SLUGS constant, routable scope, subdomain slug validation, and status-requires-verified invariant.

## What Was Built

Updated `backend/app/models/brokerage_domain.rb` (42 lines → 84 lines) with:

1. **RESERVED_SLUGS constant** — 21 reserved subdomain slugs (admin, api, www, mail, smtp, ftp, staging, dev, test, app, auth, login, signup, dashboard, static, assets, cdn, docs, help, support, status) as a frozen array.

2. **Rails enum declarations with string backing and prefix options:**
   - `enum :domain_type, {subdomain: "subdomain", custom: "custom"}, prefix: :domain_type` — generates `domain_type_subdomain?`, `domain_type_custom?`, class scopes `BrokerageDomain.domain_type_subdomain`, etc.
   - `enum :status, {active: "active", phasing_out: "phasing_out", decommissioned: "decommissioned"}, prefix: :status` — generates `status_active?`, `status_phasing_out?`, `status_decommissioned?`, class scopes `BrokerageDomain.status_active`, etc.

3. **Partial uniqueness validator** — replaced `uniqueness: true` with `uniqueness: { conditions: -> { where.not(status: :decommissioned) }, message: "is already taken" }`. Decommissioned domains are excluded from uniqueness scope, allowing future reuse.

4. **`scope :routable`** — returns records with `status IN ('active', 'phasing_out')`. Used by BrokerageAuth (Plan 03) for domain resolution.

5. **Removed old `scope :active`** — the `where(deleted_at: nil)` scope is gone; the enum-generated `BrokerageDomain.status_active` replaces it.

6. **`validate :valid_subdomain_slug` (conditional)** — only fires when `domain_type_subdomain?` is true. Extracts the slug (text before first dot), validates alphanumeric+hyphens format, rejects leading/trailing hyphens, rejects RESERVED_SLUGS members. Error messages are user-facing and descriptive.

7. **`validate :status_requires_verified`** — blocks setting `status: active` unless `verified == true`. Guards against routing unverified domains.

8. **All existing methods preserved** — `verify!`, `unverify!`, `generate_verification_token`, `valid_domain_format`.

## Verification Results

- Ruby loads without error: `BrokerageDomain.respond_to?(:routable)` => `true`
- `BrokerageDomain.respond_to?(:status_active)` => `true`
- `BrokerageDomain::RESERVED_SLUGS.length` => `21`
- All 17 grep acceptance criteria pass (RESERVED_SLUGS defined + used, enum declarations, prefix options, routable scope, phasing_out in enum + scope, old .active scope absent, conditions lambda, error messages, validate declarations, predicate method uses, verify! preserved)

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add enums, RESERVED_SLUGS, routable scope, and validations to BrokerageDomain | 756c332 (backend) | app/models/brokerage_domain.rb |

## Deviations from Plan

**1. [Rule 1 - Minor] RESERVED_SLUGS count: 21 words, not 20**

- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criterion states `BrokerageDomain::RESERVED_SLUGS.length == 20`, but the plan body explicitly lists 21 words: "admin api www mail smtp ftp staging dev test app auth login signup dashboard static assets cdn docs help support status". The word "status" is included at the end, making 21.
- **Fix:** Implemented exactly the word list from the plan body (21 words). The count assertion in acceptance_criteria is a documentation error — the substantive specification (the word list) takes precedence.
- **Files modified:** backend/app/models/brokerage_domain.rb
- **Impact:** None — all functional requirements are met. Plan 03 code depending on RESERVED_SLUGS will work correctly.

## Known Stubs

None.

## Threat Flags

None. All three STRIDE threats from the plan's threat_model are mitigated:
- T-19-03 (domain uniqueness spoofing): partial uniqueness validator + DB partial index (from Plan 01)
- T-19-04 (reserved slug bypass): RESERVED_SLUGS validated at model layer before any save; slug extracted from domain string
- T-19-05 (status: active on unverified domain): status_requires_verified validation blocks it

## Self-Check: PASSED

- [x] `backend/app/models/brokerage_domain.rb` — FOUND (84 lines, exceeds min_lines: 60)
- [x] backend commit 756c332 — FOUND
- [x] `BrokerageDomain::RESERVED_SLUGS` defined — FOUND
- [x] `scope :routable` defined — FOUND
- [x] `enum :domain_type` defined — FOUND
- [x] `enum :status` defined — FOUND
- [x] `scope :active` removed — CONFIRMED (grep returns 0)
- [x] `valid_subdomain_slug` method defined — FOUND
- [x] `status_requires_verified` method defined — FOUND

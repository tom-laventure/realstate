---
phase: 43-home-page-legal-pages
plan: 03
subsystem: ui
tags: [astro, tailwind, lucide, landing-site, legal-pages, static-site]

# Dependency graph
requires:
  - phase: 43-home-page-legal-pages (plan 01)
    provides: landing/src/consts.ts (CONTACT_EMAIL, LEGAL_LINKS), BaseLayout.astro noindex prop, SiteHeader.astro, SiteFooter.astro, @lucide/astro dependency
provides:
  - "landing/src/components/LegalNotice.astro — shared pending-legal-review banner, imported identically by both legal pages"
  - "landing/src/pages/privacy.astro — placeholder Privacy Policy, 13 canonical SaaS sections, noindex"
  - "landing/src/pages/terms.astro — placeholder Terms of Service, 14 canonical SaaS sections, noindex, pricing-free"
  - "/privacy and /terms routes now resolve, making SiteFooter's legal links non-dead (LAND-05)"
affects: [43-04-heading-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared LegalNotice.astro component prevents banner copy/placement drift between /privacy and /terms"
    - "Legal page section prose uses 'pending confirmation by legal counsel' language instead of asserting compliance/jurisdiction/liability specifics not yet reviewed"
    - "ToS pricing section stays generic ('plans and fees as described at the time of purchase') to avoid a second source of truth alongside AppConstants::PLAN_TIERS"

key-files:
  created:
    - landing/src/components/LegalNotice.astro
    - landing/src/pages/privacy.astro
    - landing/src/pages/terms.astro
  modified: []

key-decisions:
  - "Applied design_contract's spacing correction (gap-2/mb-8 instead of PATTERNS.md's illustrative gap-3/mb-10) and leading-[1.6]/leading-[1.2] instead of leading-relaxed, since design_contract explicitly overrides the illustrative snippet in 43-PATTERNS.md"
  - "Both pages' 'pending confirmation by legal counsel' phrasing was used consistently across retention, cookies, regional-rights, international-transfer, liability, indemnification, and governing-law sections to avoid asserting any control, compliance regime, or jurisdiction the product has not actually implemented or the business has not actually chosen (T-43-12)"

patterns-established:
  - "New static marketing pages import BaseLayout + SiteHeader + SiteFooter + LegalNotice from consts.ts-driven components — no per-page duplication of chrome"

requirements-completed: [LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LAND-08]

# Metrics
duration: 4min
completed: 2026-07-30
---

# Phase 43 Plan 03: Legal Pages (Privacy Policy + Terms of Service) Summary

**Placeholder `/privacy` (13 sections) and `/terms` (14 sections) routes with a shared `LegalNotice` pending-review banner, `noindex` robots meta, and zero hardcoded pricing facts on the Terms page.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-30T21:16:00-07:00 (approx)
- **Completed:** 2026-07-30T21:20:37-07:00
- **Tasks:** 2
- **Files modified:** 3 (all new)

## Accomplishments
- `LegalNotice.astro` built as a single shared banner component (TriangleAlert icon + exact copy), imported identically by both legal pages so the banner cannot drift between them
- `privacy.astro` built with all 13 canonical FEATURES.md section headings in exact order, each with 2-4 sentences of generic, compliance-non-asserting placeholder prose, the banner correctly positioned between the `<h1>` and the first `<h2>`, and a `mailto:` link built from `CONTACT_EMAIL`
- `terms.astro` built as `privacy.astro`'s structural sibling with all 14 canonical section headings, a pricing-free "Subscription Plans and Billing" section, and an in-body `text-primary` cross-reference link to `/privacy` in the "Data Ownership and Privacy" section
- Both pages pass `noindex` to `BaseLayout`, verified present in built HTML while `dist/index.html` remains unaffected (noindex scoped, not global)
- `npx astro check` reports 0 errors; `npx astro build` succeeds; every automated verification assertion in both tasks (heading counts, banner byte-order, pricing-fact absence, spacing-scale compliance, forbidden-pattern absence) passed on first build with no rework needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Build LegalNotice.astro and the Privacy Policy page** - `dc3267b` (feat)
2. **Task 2: Build the Terms of Service page** - `643731b` (feat)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `landing/src/components/LegalNotice.astro` - New: shared pending-legal-review banner (TriangleAlert icon + exact copy, `border-destructive/40 bg-destructive/10` treatment)
- `landing/src/pages/privacy.astro` - New: Privacy Policy placeholder route, 13 h2 sections, noindex, RealtyBase Inc. entity naming, mailto contact
- `landing/src/pages/terms.astro` - New: Terms of Service placeholder route, 14 h2 sections, noindex, pricing-free billing section, cross-reference link to /privacy

## Decisions Made
- Followed the plan's `design_contract` spacing correction (`gap-2`/`mb-8`) over 43-PATTERNS.md's illustrative (off-scale) `gap-3`/`mb-10` snippet, and used `leading-[1.6]`/`leading-[1.2]` exact values instead of `leading-relaxed`, per the plan's explicit override instruction.
- Used consistent "pending confirmation by legal counsel" language across every section that would otherwise require asserting a compliance regime (GDPR/CCPA/PIPEDA/Law 25), a specific data retention window, a governing jurisdiction, or a liability limitation — matching the threat register's T-43-12 mitigation (no over-claiming in placeholder legal copy).

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and both tasks' full automated verification blocks passed without modification on the first build.

## Issues Encountered
None.

## Known Stubs
None in the sense of broken/empty UI. Both pages are intentionally placeholder legal text pending real legal review — this is the plan's explicit, documented purpose (LEGAL-01 through LEGAL-04), not an unintentional stub. Every section has non-empty, on-topic placeholder prose; nothing renders as blank, "coming soon," or a raw TODO/FIXME marker.

## Threat Flags

None. All new surface (two public static routes, one shared banner component, a `mailto:` link, an in-body cross-reference link) maps directly to threat register entries already disposed in this plan's `<threat_model>` (T-43-10 through T-43-15) — no new trust boundary or attack surface was introduced beyond what was pre-registered.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/privacy` and `/terms` now resolve, so `SiteFooter.astro`'s legal links (built in 43-01) are no longer dead links — LAND-05 fully satisfied once 43-04's review pass confirms cross-plan consistency.
- Both pages are ready for 43-04's heading-hierarchy/consistency review pass; no known issues to flag going into that plan.
- No blockers.

---
*Phase: 43-home-page-legal-pages*
*Completed: 2026-07-30*

## Self-Check: PASSED

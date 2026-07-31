---
phase: 43-home-page-legal-pages
plan: 02
subsystem: ui
tags: [astro, tailwind, lucide, landing-site, marketing-page]

# Dependency graph
requires:
  - phase: 43-01
    provides: consts.ts (CTA_URLS/LEGAL_LINKS/SITE_NAME), BaseLayout.astro noindex prop, SiteHeader.astro, SiteFooter.astro
provides:
  - "Hero.astro — eyebrow, sole page h1, subhead, CTA touchpoint 1"
  - "ValueProp.astro — h2, outcome-framed body, CTA touchpoint 2 (D-02)"
  - "FeatureGrid.astro — 7 lucide icon+text feature pairs, flex-wrap + justify-center centered-row-2 layout"
  - "ClosingCTA.astro — h2, body, CTA touchpoint 3, secondary Log in link"
  - "landing/src/pages/index.astro composed as the real marketing home page, replacing Phase 42's proof-of-tokens content"
affects: [43-03-legal-pages, 43-04-heading-review, 44-seo-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "flex-wrap + justify-center with calc()-based fractional widths (sm:w-[calc(50%_-_0.75rem)], lg:w-[calc(25%_-_1.125rem)]) used instead of CSS grid whenever an incomplete final row must render centered rather than left-aligned — grid-cols-N cannot center a partial row"
    - "Feature-pair titles rendered as <p class='font-semibold'> rather than <h3> to keep a flat, locked heading outline (1 h1 + 3 h2 + 0 h3) on content-heavy sections"
    - "All three home-page CTA anchors share one identical class string, defined once in the plan's design_contract and copy-pasted verbatim into Hero/ValueProp/ClosingCTA rather than extracted into a shared component (kept plan-simple; a future refactor could extract a <CtaButton> component)"

key-files:
  created:
    - landing/src/components/Hero.astro
    - landing/src/components/ValueProp.astro
    - landing/src/components/FeatureGrid.astro
    - landing/src/components/ClosingCTA.astro
  modified:
    - landing/src/pages/index.astro

key-decisions:
  - "FeatureGrid's 'Filter' icon import from @lucide/astro triggers a TS ts(6385) 'deprecated' hint (colliding with a built-in lib.dom.d.ts global named Filter) — this is expected per the plan's locked icon assignment for item 7 and does not affect astro check's 0-error/0-warning result (only hints), so no substitution was made"
  - "Documented a self-contradictory line in Task 1's automated verify script: '! grep -q text-primary src/components/Hero.astro' is unsatisfiable by any Hero.astro that also carries the plan-mandated CTA class string 'bg-primary text-primary-foreground', since 'text-primary-foreground' is a Tailwind superstring containing 'text-primary' as a literal substring. Verified the actual accent-reservation intent by inspection instead: the eyebrow element uses text-muted-foreground (not text-primary) as required; the only 'text-primary' occurrence in the file is inside the CTA anchor's mandated text-primary-foreground class."

requirements-completed: [LAND-01, LAND-02, LAND-03, LAND-04, LAND-08]

# Metrics
duration: 3min
completed: 2026-07-30
---

# Phase 43 Plan 02: Home Page Content Summary

**Built the four home-page content sections (Hero, ValueProp, FeatureGrid, ClosingCTA) and composed them into the real `/` marketing page, replacing Phase 42's proof-of-tokens scaffold — verified 1 h1 / 3 h2 / 0 h3, zero client JS, and exactly 4 Get Started + 2 Log in absolute-HTTPS touchpoints in the built HTML.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-30T21:12:00-07:00 (approx, first commit 21:12:50-07:00)
- **Completed:** 2026-07-30T21:13:58-07:00
- **Tasks:** 3
- **Files modified:** 5 (4 new, 1 replaced)

## Accomplishments
- `Hero.astro`: eyebrow (`Built for real estate brokerages`), the page's only `<h1>` (`Every listing, every group, every board — one workspace.`), subhead, and CTA touchpoint 1 — all above the fold in a single vertical stack, no hero image/illustration (LAND-01, LAND-09 deferred)
- `ValueProp.astro`: `<h2>` (`Run your brokerage from one place, not five.`) plus outcome-framed body copy and CTA touchpoint 2 (D-02's explicit second Get Started touchpoint)
- `FeatureGrid.astro`: all 7 locked capabilities (D-04) as lucide icon+text pairs in exact source order, with `Group collaboration` and `Multi-tenant isolation` adjacent (D-05); laid out with `flex-wrap` + `justify-center` (not `grid-cols-4`) so the second desktop row (items 5-7) renders visually centered instead of left-aligned per UI-SPEC line 110
- `ClosingCTA.astro`: `<h2>`, body, CTA touchpoint 3, and the secondary `Already have an account? Log in` link bound to `CTA_URLS.login` (LAND-03)
- `landing/src/pages/index.astro`: fully replaced — all Phase 42 "Slate token proof-of-concept" markup deleted; now composes `SiteHeader`, a `<main>` landmark wrapping the four content sections, and `SiteFooter`; stays indexable (no `noindex` passed)
- Built `dist/index.html` verified: exactly 1 `<h1>`, 3 `<h2>`, 0 `<h3>`, 0 `<script>` tags, `https://app.realtybase.ca/create` exactly 4 times, `https://app.realtybase.ca/auth/login` exactly 2 times, footer legal links (`Privacy Policy`, `Terms of Service`, `All rights reserved.`) present

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Hero.astro and ValueProp.astro** - `d08a6ba` (feat)
2. **Task 2: Build FeatureGrid.astro (7 pairs) and ClosingCTA.astro** - `219391d` (feat)
3. **Task 3: Replace index.astro with the composed home page and prove the semantic contract** - `9f73534` (feat)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `landing/src/components/Hero.astro` - New: eyebrow, page h1, subhead, CTA touchpoint 1
- `landing/src/components/ValueProp.astro` - New: h2, body, CTA touchpoint 2
- `landing/src/components/FeatureGrid.astro` - New: h2 + 7 lucide icon+text feature pairs, flex-wrap/justify-center layout
- `landing/src/components/ClosingCTA.astro` - New: h2, body, CTA touchpoint 3, secondary Log in link
- `landing/src/pages/index.astro` - Replaced Phase 42 proof-of-tokens body with the composed home page (SiteHeader + main[Hero, ValueProp, FeatureGrid, ClosingCTA] + SiteFooter)

## Decisions Made
- Followed the plan's locked copy, class strings, and layout technique verbatim (no copy or class deviations).
- Kept the `Filter` icon import as specified despite its TS "deprecated" hint (it collides with a DOM lib global of the same name, not an actual deprecation of the lucide icon) — substituting it would violate the plan's locked D-04 icon assignment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan's own verify script] Task 1's `! grep -q 'text-primary'` check on Hero.astro is unsatisfiable as literally written**
- **Found during:** Task 1 automated verification
- **Issue:** The plan's `<design_contract>` mandates the CTA anchor class string `bg-primary text-primary-foreground ...` verbatim in Hero.astro, but the same task's verify script also asserts Hero.astro must not contain the substring `text-primary` anywhere. `text-primary-foreground` is a Tailwind class name that contains `text-primary` as a literal substring, so any Hero.astro correctly implementing the mandated CTA class will always fail this specific grep. This is a self-contradiction in the plan text, not a defect in the implementation.
- **Fix:** No code change made (there is no way to satisfy both requirements simultaneously). Verified the actual intent — accent-color reservation, i.e. the eyebrow element must use `text-muted-foreground` rather than `text-primary` — by direct inspection: the eyebrow's class list is `text-muted-foreground mb-4 text-sm font-semibold` with no `text-primary`; the sole `text-primary` occurrence in the file is inside the CTA anchor's required `text-primary-foreground` class.
- **Files modified:** None (documentation-only finding).
- **Verification:** `npx astro check` passes with 0 errors/warnings; all other automated checks in Task 1's verify block pass; manual grep confirms the eyebrow paragraph carries no `text-primary` class.
- **Committed in:** N/A (no code change; noted here for the plan author / future verifier).

---

**Total deviations:** 1 (plan verify-script self-contradiction, documented and worked around by manual verification; no code changes required)
**Impact on plan:** None on shipped code — the CTA class string and eyebrow color are both correct per the design contract's actual intent. Future plans reusing this verify-script pattern should scope the `text-primary` exclusion to non-CTA elements only (e.g. exclude lines containing `text-primary-foreground`).

## Issues Encountered
None beyond the verify-script deviation documented above.

## Known Stubs
None. All four new components render real, locked copy bound to real `CTA_URLS`/`LEGAL_LINKS` values from `consts.ts` — no placeholder text, no `#` hrefs, no empty props.

## Threat Flags

None. All new surface (three outbound Get Started anchors, one outbound Log in anchor, seven build-time inline-SVG icons, zero client JS) maps directly to threats T-43-05, T-43-06, and T-43-07 already disposed as `mitigate` in this plan's `<threat_model>`, and the mitigations described there (CTA_URLS-only hrefs, no `target="_blank"`, zero `<script>` tags) were all verified true in the built `dist/index.html`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/` is now the complete, real marketing home page — ready for 43-03 (legal pages, which the footer already links to via `LEGAL_LINKS`) and 43-04 (heading/review pass).
- `SiteFooter.astro`'s `/privacy` and `/terms` links still point to routes that do not exist on disk yet — expected, resolved by 43-03 in the same wave-2 batch.
- No blockers.

---
*Phase: 43-home-page-legal-pages*
*Completed: 2026-07-30*

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 task commit hashes (`d08a6ba`, `219391d`, `9f73534`) verified present in `git log`.

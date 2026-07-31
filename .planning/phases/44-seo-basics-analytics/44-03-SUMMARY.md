---
phase: 44-seo-basics-analytics
plan: 03
subsystem: infra
tags: [astro, seo, open-graph, twitter-card, vercel-analytics, noindex]

# Dependency graph
requires:
  - phase: 44-01
    provides: "@vercel/analytics@2.0.1 and @astrojs/sitemap@3.7.3 installed as dependencies, astro.config.mjs site + sitemap integration already wired"
  - phase: 44-02
    provides: "landing/public/og-image.png — 1200x630 static OG/Twitter share image, committed and served at /og-image.png"
provides:
  - "landing/src/layouts/BaseLayout.astro as the site's single SEO + analytics integration point: meta description, canonical link, full Open Graph block, full Twitter card block, environment-aware noindex, mounted <Analytics />"
  - "Per-page description props on index/privacy/terms, distinct and length-appropriate"
  - "Six located CTA track() events (get_started_click x4, login_click x2) wired via per-component scoped scripts"
affects: [44-04-verification-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BaseLayout.astro as single SEO/analytics integration point — meta/OG/Twitter/canonical/noindex/<Analytics /> all live in one file, page call sites only pass title/description/noindex"
    - "Per-component scoped <script> blocks for CTA click tracking, no global delegated listener, no shared analytics.ts helper — first client-side JS in this project alongside <Analytics />"

key-files:
  modified:
    - landing/src/layouts/BaseLayout.astro
    - landing/src/pages/index.astro
    - landing/src/pages/privacy.astro
    - landing/src/pages/terms.astro
    - landing/src/components/SiteHeader.astro
    - landing/src/components/Hero.astro
    - landing/src/components/ValueProp.astro
    - landing/src/components/ClosingCTA.astro

key-decisions:
  - "import.meta.env.VERCEL_ENV form worked directly (no process.env.VERCEL_ENV fallback needed) — VERCEL_ENV=preview/production npm run build correctly toggled noindex on/off, verified via full build-and-grep, no @types/node addition required"
  - "Fixed @vercel/analytics/astro import from named `{ Analytics }` (as written in RESEARCH.md/PATTERNS.md/this plan's own interfaces block) to default `Analytics` — astro check failed with ts(2614) 'Module has no exported member Analytics'; the installed package's dist/astro/component.ts re-exports the component as `export { default } from './index.astro'`, not a named export"

requirements-completed: [SEO-01, SEO-04, ANALYTICS-01]

# Metrics
duration: 8min
completed: 2026-07-31
---

# Phase 44 Plan 03: BaseLayout SEO + Analytics Integration Summary

**BaseLayout.astro extended into the site's single SEO/analytics integration point (canonical + full OG/Twitter blocks + env-aware noindex + `<Analytics />`), with per-page descriptions and six D-03-schema `track()` call sites wired across four components**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-31T13:00:00-07:00
- **Completed:** 2026-07-31T13:03:23-07:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- `BaseLayout.astro` now emits a required `description` prop, `<link rel="canonical">`, a complete 8-tag Open Graph block, a complete 4-tag Twitter card block (all resolving to the absolute `https://realtybase.ca/og-image.png` committed in plan 44-02), and computes `noindex` as the page's own prop OR'd with a `VERCEL_ENV`-driven non-production check (guarded against `undefined` so local builds stay unaffected)
- `<Analytics />` from `@vercel/analytics/astro` mounted in `<body>` after `<slot />` — cookieless page-view tracking site-wide, no consent UI added
- `index.astro`, `privacy.astro`, `terms.astro` each pass a distinct, 100-175-char `description`; `astro check` and `astro build` both exit 0 with all three descriptions rendering uniquely in the built HTML
- All six CTA instances (`nav-get-started`, `nav-login`, `hero-get-started`, `value-prop-get-started`, `closing-get-started`, `closing-login`) carry stable `id`s and per-component scoped `<script>` blocks calling `track()` with the exact D-03 event name / `location` pairing — zero changes to any CTA's `href` or `class`
- Full plan-level `<verification>` block passed: 8 unique `og:*` tags and 4 unique `twitter:*` tags on `dist/index.html`, absolute OG image URL confirmed, `VERCEL_ENV=preview` build emits `noindex` on the home page while `VERCEL_ENV=production` does not, `git status --short landing/` shows changes limited to exactly the eight `files_modified` files

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend BaseLayout with SEO head block, env-aware noindex, and Analytics** - `15418ec` (feat)
2. **Task 2: Supply per-page meta descriptions from all three routes** - `c1b5879` (feat)
3. **Task 3: Wire the six CTA instances to located track() calls** - `611b58d` (feat)

**Plan metadata:** pending (this summary commit)

## Files Created/Modified
- `landing/src/layouts/BaseLayout.astro` - single SEO/analytics integration point: required `description` prop, canonical link, full OG + Twitter blocks, env-aware `noindex`, mounted `<Analytics />`
- `landing/src/pages/index.astro` - added home-page `description` prop (133 chars, "MLS-synced listings" substring)
- `landing/src/pages/privacy.astro` - added privacy-page `description` prop (153 chars, "Placeholder pending legal review" substring), `noindex` shorthand preserved
- `landing/src/pages/terms.astro` - added terms-page `description` prop (153 chars, "Placeholder pending legal review" substring), `noindex` shorthand preserved
- `landing/src/components/SiteHeader.astro` - `nav-get-started`/`nav-login` ids + scoped script firing `get_started_click`/`login_click` with `location: 'nav'`
- `landing/src/components/Hero.astro` - `hero-get-started` id + scoped script firing `get_started_click` with `location: 'hero'`
- `landing/src/components/ValueProp.astro` - `value-prop-get-started` id + scoped script firing `get_started_click` with `location: 'value_prop'`
- `landing/src/components/ClosingCTA.astro` - `closing-get-started`/`closing-login` ids + scoped script firing `get_started_click`/`login_click` with `location: 'closing'`

## Decisions Made
- Confirmed `import.meta.env.VERCEL_ENV` (not the `process.env` fallback flagged as a contingency in the plan) correctly surfaces through Astro's env handling — verified end-to-end with real `VERCEL_ENV=preview`/`VERCEL_ENV=production` builds against `dist/index.html`, not just a syntactic check
- Corrected the `@vercel/analytics/astro` import to use the package's actual default export rather than the named `{ Analytics }` form specified in this plan's own `<interfaces>` block (and mirrored from RESEARCH.md/PATTERNS.md) — see Deviations below

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Fixed `@vercel/analytics/astro` import to use the default export**
- **Found during:** Task 2's `npx astro check` run (surfaced only once Task 2's build attempt exercised the layout for real; Task 1's automated verify block only grepped for the import string, so it didn't catch this)
- **Issue:** The plan's Task 1 action, its `<interfaces>` reference snippet, RESEARCH.md Pattern 2, and PATTERNS.md all specify `import { Analytics } from '@vercel/analytics/astro'`. `astro check` failed with `ts(2614): Module '"@vercel/analytics/astro"' has no exported member 'Analytics'. Did you mean to use 'import Analytics from "@vercel/analytics/astro"' instead?` Inspecting the installed package (`node_modules/@vercel/analytics/dist/astro/component.ts`) confirmed the module re-exports the component as `export { default } from './index.astro'` — a default export, not a named one, in the installed `@vercel/analytics@2.0.1`.
- **Fix:** Changed the import to `import Analytics from '@vercel/analytics/astro'` in `BaseLayout.astro`. No other code changed — `<Analytics />` usage in the template was already correct either way.
- **Files modified:** `landing/src/layouts/BaseLayout.astro`
- **Commit:** `c1b5879` (folded into Task 2's commit since it was discovered and fixed while unblocking Task 2's `astro check`/`npm run build` verification step)

## Issues Encountered

None beyond the auto-fixed import issue above.

## User Setup Required

None — no external service configuration required for this plan. Per this plan's `<vercel_plan_tier_note>`, the six `track()` call sites are shipped correctly and completely, but end-to-end delivery of custom click events into the Vercel dashboard cannot be verified until the project's Vercel team is confirmed/upgraded to Pro tier (the team is currently on Hobby, which supports `<Analytics />` page views but not custom `track()` events). This is a known, accepted limitation, not a defect — plan 44-04's checkpoint asks the developer to acknowledge it, not resolve it here.

## Next Phase Readiness

- SEO-01 is now fully satisfied end to end: 44-02 shipped the OG image asset, this plan wires it (and the rest of the meta/OG/Twitter block) into every page via `BaseLayout.astro`
- SEO-04 is fully satisfied and verified via real `VERCEL_ENV=preview`/`production` builds
- ANALYTICS-01's code is fully and correctly shipped (page views + all six located CTA click events); dashboard-level confirmation of custom events is blocked on Vercel plan tier, tracked as a known limitation for plan 44-04
- Ready for plan 44-04's verification checkpoint

---
*Phase: 44-seo-basics-analytics*
*Completed: 2026-07-31*

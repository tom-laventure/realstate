---
phase: 44-seo-basics-analytics
verified: 2026-07-31T13:35:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 44: SEO Basics + Analytics Verification Report

**Phase Goal:** The site is discoverable and correctly indexed in production while non-production deploys stay out of search results, and CTA engagement is measurable.
**Verified:** 2026-07-31T13:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Truths merged from ROADMAP.md Phase 44 Success Criteria and the four plans' `must_haves.truths`.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Page source shows meta title/description and full OG + Twitter card tags, including a static logo/wordmark OG image | ✓ VERIFIED | Ran `VERCEL_ENV=production npm run build`; `dist/index.html` contains all 14 required tag substrings (title, description, canonical, 8 `og:*`, 4 `twitter:*`). `dist/og-image.png` confirmed `PNG image data, 1200 x 630` via `file`. |
| 2 | `og:image`/`twitter:image` are absolute URLs on the production apex, not relative paths | ✓ VERIFIED | `dist/index.html` contains `property="og:image" content="https://realtybase.ca/og-image.png"` and the matching `twitter:image` — built from hardcoded `siteUrl` in `BaseLayout.astro`, not `Astro.url`/`VERCEL_URL`. |
| 3 | `/sitemap.xml` lists routes with `site` hardcoded to the production apex (never `VERCEL_URL`), and `/robots.txt` references the sitemap | ✓ VERIFIED | `astro.config.mjs` has `site: 'https://realtybase.ca'` (no `VERCEL_URL` anywhere in file). Build emits `dist/sitemap-index.xml` + `dist/sitemap-0.xml` with exactly one `<loc>https://realtybase.ca/</loc>`, no `privacy`/`terms` substrings. `dist/robots.txt` contains `Sitemap: https://realtybase.ca/sitemap-index.xml`. |
| 4 | A non-production (preview) deployment's page source includes `noindex`; a production deploy's does not | ✓ VERIFIED | Ran the full 4-environment matrix myself: no-`VERCEL_ENV` → no noindex on `/`; `VERCEL_ENV=preview` → noindex on `/`; `VERCEL_ENV=development` → noindex on `/`; `VERCEL_ENV=production` → no noindex on `/`. All 4 builds exited 0. |
| 5 | Legal pages (`/privacy`, `/terms`) stay `noindex` in every environment, including production | ✓ VERIFIED | Across all 4 build environments tested, `dist/privacy/index.html` and `dist/terms/index.html` both contained `name="robots" content="noindex"` every time — driven by the always-on `noindex` prop OR'd with the env check. |
| 6 | Vercel Analytics page-view tracking is present on every page, with no cookie-consent banner anywhere | ✓ VERIFIED | `dist/index.html` renders `<vercel-analytics ...>` custom element from `<Analytics />`; runtime chunk `dist/_astro/dist.CBfE3_J4.js` constructs `/_vercel/insights/script.js`. Zero case-insensitive `consent` hits across all three built HTML files; zero `cookie` hits in `dist/index.html`/`dist/terms/index.html` (the one hit in `dist/privacy/index.html` is the legitimate "Cookies and Tracking Technologies" policy heading, correctly excluded per plan design). |
| 7 | Each of the six CTA instances fires a distinctly-located `track()` call, per the D-03 event schema | ✓ VERIFIED | Read source of all four CTA components: `SiteHeader.astro` (`nav-get-started`/`nav-login`, `location:'nav'` x2), `Hero.astro` (`hero-get-started`, `location:'hero'`), `ValueProp.astro` (`value-prop-get-started`, `location:'value_prop'`), `ClosingCTA.astro` (`closing-get-started`/`closing-login`, `location:'closing'` x2). Confirmed all 6 string literals (`get_started_click` x4, `login_click` x2) survive bundling into `dist/_astro/*.js`. |
| 8 | A production build emits a sitemap anchored to the hardcoded apex, excluding `/privacy/` and `/terms/` (D-02) | ✓ VERIFIED | Same build evidence as #3 — `astro.config.mjs` filter excludes both trailing-slash URLs exactly; verified compiled sitemap contains only the home page. |
| 9 | The four phase npm dependencies are installed at exact researched versions in the correct sections | ✓ VERIFIED | `package.json` `dependencies`: `@astrojs/sitemap: 3.7.3`, `@vercel/analytics: 2.0.1` (exact, no range). `devDependencies`: `satori: 0.29.0`, `@resvg/resvg-js: 2.6.2` (exact, no range). Pre-existing 6 entries unchanged with their original `^` ranges. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `landing/astro.config.mjs` | Hardcoded `site` + sitemap integration with trailing-slash filter | ✓ VERIFIED | `site: 'https://realtybase.ca'`, `integrations: [sitemap({ filter: ... })]` excluding `.../privacy/` and `.../terms/` exactly. |
| `landing/public/robots.txt` | Static crawler directives + sitemap pointer | ✓ VERIFIED | 6 lines exactly as specified: `Allow: /`, two `Disallow`, blank line, `Sitemap:` pointer. |
| `landing/package.json` | Pinned runtime deps + build-tooling devDeps | ✓ VERIFIED | All 4 pinned exact; existing 6 entries untouched. |
| `landing/scripts/generate-og-image.mjs` | One-off satori+resvg OG generator, not wired into build | ✓ VERIFIED | 90 lines, imports `SITE_NAME` from `../src/consts.ts`, uses hardcoded hex literals (no `oklch`), asserts 1200x630 before write. `grep -c "generate-og-image" astro.config.mjs` = 0 (not wired into build). |
| `landing/scripts/fonts/Lato-Semibold.ttf` + `LATO-LICENSE.txt` | Bundled TTF + OFL license | ✓ VERIFIED | Both present, 676KB TTF file exists, license file present. |
| `landing/public/og-image.png` | 1200x630 static share image | ✓ VERIFIED | `file` confirms `PNG image data, 1200 x 630, 8-bit/color RGBA`. Copied to `dist/og-image.png` on build. Not gitignored. |
| `landing/src/layouts/BaseLayout.astro` | Single SEO/analytics integration point | ✓ VERIFIED | 58 lines. Required `description` prop, computed `noindex` (pageNoindex OR isNonProduction with `undefined` guard), hardcoded `siteUrl`, canonical, full OG (8 tags) + Twitter (4 tags) block, `<Analytics />` mounted after `<slot />`. |
| `SiteHeader.astro`/`Hero.astro`/`ValueProp.astro`/`ClosingCTA.astro` | Located `track()` calls | ✓ VERIFIED | All 4 files contain correct `id`s, scoped `<script>` blocks with `track()` calls, exact `location` values per D-03 schema. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `landing/astro.config.mjs` | `@astrojs/sitemap` | integrations array | ✓ WIRED | `sitemap(...)` present in `integrations: [...]`. |
| `landing/public/robots.txt` | `/sitemap-index.xml` | Sitemap directive | ✓ WIRED | Exact line present, byte-matches expected pattern. |
| `landing/src/layouts/BaseLayout.astro` | `@vercel/analytics/astro` | `<Analytics />` in `<body>` | ✓ WIRED | Import present (default export, corrected from plan's assumed named export — documented deviation, functionally equivalent), component rendered after `<slot />`. |
| `landing/dist/index.html` | `landing/dist/og-image.png` | absolute `og:image` URL | ✓ WIRED | `og:image` resolves to `https://realtybase.ca/og-image.png`; `dist/og-image.png` exists at 1200x630, proving the URL maps to a real served asset. |
| `landing/dist/robots.txt` | `landing/dist/sitemap-index.xml` | Sitemap directive | ✓ WIRED | Confirmed present in built output, not just source. |
| CTA components | `@vercel/analytics` | scoped `<script>` `track()` calls | ✓ WIRED | All 6 `track()` calls confirmed present in bundled `dist/_astro/*.js` chunks — not dropped by the Vite bundling step. |

### Behavioral Spot-Checks

All checks below were run independently by the verifier (not taken from SUMMARY.md), via `npm run build` from `landing/` on Node 22.23.2.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Production build succeeds | `npm run build` | Exit 0, 3 pages built | ✓ PASS |
| No-env build: home indexable, legal noindex | `npm run build` + grep | index: no noindex; privacy/terms: noindex | ✓ PASS |
| Preview build: home noindex | `VERCEL_ENV=preview npm run build` + grep | index: noindex | ✓ PASS |
| Development build: home noindex | `VERCEL_ENV=development npm run build` + grep | index: noindex | ✓ PASS |
| Production build: home indexable, legal noindex | `VERCEL_ENV=production npm run build` + grep | index: no noindex; privacy/terms: noindex | ✓ PASS |
| All 14 head tags present | grep sweep on `dist/index.html` | All 14 present | ✓ PASS |
| Sitemap contains exactly 1 URL, apex-anchored, no legal pages | grep on `dist/sitemap-0.xml` | 1 `<loc>https://realtybase.ca/</loc>`, no privacy/terms | ✓ PASS |
| OG image reachable at served root, correct dimensions | `file dist/og-image.png` | `PNG image data, 1200 x 630` | ✓ PASS |
| Analytics marker present (custom element + runtime chunk) | grep on `dist/index.html` + `dist/_astro/*.js` | `<vercel-analytics` in HTML, `insights` in JS chunk | ✓ PASS |
| 6 CTA track() calls survive bundling | `grep -ro` on `dist/` | 4x `get_started_click`, 2x `login_click`, matching per-component distribution | ✓ PASS |
| No consent/cookie banner signal | grep sweep on 3 built HTML files | Zero `consent` hits; zero illegitimate `cookie` hits | ✓ PASS |
| No stray build artifacts committed | `git status --short landing/` | Clean — `dist/` is gitignored | ✓ PASS |
| Commit hashes referenced in SUMMARYs exist | `git log --oneline --all \| grep <hashes>` | All 8 commit hashes found in history | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEO-01 | 44-02, 44-03, 44-04 | Meta title/description, OG + Twitter tags, static wordmark OG image | ✓ SATISFIED | OG image + all tags confirmed present and correctly valued in production build. |
| SEO-02 | 44-01, 44-04 | Sitemap with `site` hardcoded to production apex | ✓ SATISFIED | Confirmed no `VERCEL_URL` in config; sitemap output correct. |
| SEO-03 | 44-01, 44-04 | robots.txt referencing sitemap | ✓ SATISFIED | robots.txt present and correct at dist root. |
| SEO-04 | 44-03, 44-04 | Env-aware noindex, production stays indexable | ✓ SATISFIED | Full 4-environment matrix independently re-run and passed. |
| ANALYTICS-01 | 44-03, 44-04 | Page views + CTA click tracking, no cookie banner | ✓ SATISFIED | `<Analytics />` wired, all 6 track() calls confirmed present and correctly located; no consent UI found anywhere in source or build output. Custom-event dashboard delivery is blocked by Vercel Hobby plan tier — this is an explicitly documented, developer-acknowledged limitation (not a code defect) recorded in 44-04-SUMMARY.md, and matches the phase's own `<vercel_plan_tier_note>` guidance not to descope ANALYTICS-01 over it. |

No orphaned requirements — REQUIREMENTS.md traceability table maps all 5 Phase 44 requirement IDs (SEO-01 through SEO-04, ANALYTICS-01) to this phase, and all 5 appear in the `requirements:` frontmatter across plans 44-01/44-03/44-04. All 5 are marked `[x]` Complete in REQUIREMENTS.md.

### Anti-Patterns Found

Scanned all phase-modified files (`astro.config.mjs`, `public/robots.txt`, `BaseLayout.astro`, `scripts/generate-og-image.mjs`, all 4 CTA components) for `TODO`/`FIXME`/`TBD`/`XXX`/`HACK`/`PLACEHOLDER`/empty-implementation patterns.

None found. No debt markers, no stub returns, no empty handlers, no hardcoded-empty state feeding into rendered output.

### Human Verification Required

None outstanding. Phase 44's own PLAN (44-04, Task 3) contained a `type="checkpoint:human-verify"` gate="blocking" task covering exactly the items that would otherwise require human verification here: visual OG image quality, rendered `<head>` inspection, no-banner confirmation on live pages, CTA click-through behavior, and explicit acknowledgement of the Vercel Hobby-tier custom-event limitation. Per 44-04-SUMMARY.md, this checkpoint was executed and the developer replied "approved," with all six acknowledgement items recorded. This is standard GSD in-phase human verification (already completed during execution), not a gap carried forward to this verification pass. The commit trail (all 8 referenced task commits found in `git log`) supports the timeline claimed in the summaries.

### Deferred Items

None — this phase carries forward two explicitly-tracked cross-phase items (Vercel Hobby-tier custom-event dashboard delivery, and Phase 45's "Enable access to System Environment Variables" checklist item), both of which are already documented as accepted limitations / Phase 45 carry-forwards in ROADMAP.md and 44-04-SUMMARY.md, not unaddressed gaps of this phase.

### Gaps Summary

No gaps found. All 9 observable truths (roadmap Success Criteria + plan-level must_haves) verified directly against live codebase and a fresh production build run independently by the verifier — not inferred from SUMMARY.md claims. All artifacts exist, are substantive, are wired, and (for the sitemap/OG-image/analytics chain) produce real data through the full build pipeline. All 5 phase requirement IDs are satisfied with concrete evidence. The one known limitation (Vercel Hobby-tier blocking custom-event dashboard delivery) is explicitly out-of-scope for this phase per the plan's own `<vercel_plan_tier_note>` and was developer-acknowledged at the phase's human checkpoint — it does not block phase goal achievement.

---

*Verified: 2026-07-31T13:35:00Z*
*Verifier: Claude (gsd-verifier)*

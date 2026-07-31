---
phase: 43-home-page-legal-pages
plan: 01
subsystem: ui
tags: [astro, tailwind, lucide, landing-site, static-site]

# Dependency graph
requires:
  - phase: 42-landing-scaffold
    provides: landing/ Astro scaffold (BaseLayout.astro, Slate global.css tokens, bare index.astro)
provides:
  - "@lucide/astro@1.28.0 icon dependency for build-time inline-SVG icons"
  - "System font stack declared once on body in global.css"
  - "landing/src/consts.ts — single source of truth for SITE_NAME, CTA_URLS, LEGAL_LINKS, CONTACT_EMAIL"
  - "BaseLayout.astro noindex?: boolean prop (default false), backward-compatible"
  - "SiteHeader.astro and SiteFooter.astro shared chrome components"
affects: [43-02-home-page-content, 43-03-legal-pages, 43-04-heading-review]

# Tech tracking
tech-stack:
  added: ["@lucide/astro@1.28.0"]
  patterns:
    - "Centralized cross-origin CTA URLs and site-relative legal links in consts.ts, imported by every component that renders a link — never inlined"
    - "Optional BaseLayout prop with destructuring default for backward-compatible layout extension under astro/tsconfigs/strict"
    - "Build-time-only copyright year via new Date().getFullYear() in Astro frontmatter — zero client JS"

key-files:
  created:
    - landing/src/consts.ts
    - landing/src/components/SiteHeader.astro
    - landing/src/components/SiteFooter.astro
  modified:
    - landing/package.json
    - landing/package-lock.json
    - landing/src/styles/global.css
    - landing/src/layouts/BaseLayout.astro

key-decisions:
  - "Installed @lucide/astro@1.28.0 exactly (scoped package) per RESEARCH.md's Package Legitimacy Audit; verified live against npm registry before install, confirmed no legacy lucide-astro key present"
  - "consts.ts formatted with 2-space indentation (matches PATTERNS.md's specified target content) despite BaseLayout.astro using tab indentation inside its HTML body — each file's existing/specified convention was preserved independently"

patterns-established:
  - "Single source of truth for all outbound URLs in consts.ts — any future CTA or legal link must be added there, never inlined in a component"
  - "noindex opt-in via BaseLayout prop for placeholder/non-canonical pages"

requirements-completed: [LAND-03, LAND-05, LAND-06, LEGAL-04]

# Metrics
duration: 2min
completed: 2026-07-30
---

# Phase 43 Plan 01: Shared Foundation (consts, layout, header, footer) Summary

**Installed `@lucide/astro`, centralized all CTA/legal URLs in `consts.ts`, added an optional `noindex` prop to `BaseLayout.astro`, and built `SiteHeader`/`SiteFooter` shared chrome components — all wired to the single-source-of-truth constants.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-30T21:03:00-07:00 (approx, first commit 21:03:16-07:00)
- **Completed:** 2026-07-30T21:04:23-07:00
- **Tasks:** 3
- **Files modified:** 7 (3 new, 4 modified)

## Accomplishments
- `@lucide/astro@1.28.0` installed as the phase's only new dependency (scoped package, verified against npm registry; legacy unscoped `lucide-astro` confirmed absent)
- System font stack (matching `frontend/src/index.css`) declared once on `body` in `global.css`, existing provenance header and `@theme inline` block untouched
- `landing/src/consts.ts` created with `SITE_NAME`, `CTA_URLS` (absolute `https://app.realtybase.ca` URLs), `LEGAL_LINKS` (site-relative `/privacy`, `/terms`), and `CONTACT_EMAIL` (`hello@realtybase.ca`)
- `BaseLayout.astro` extended with optional `noindex?: boolean` prop (default `false`), rendering `<meta name="robots" content="noindex">` conditionally, with `index.astro`'s existing zero-arg call site still type-checking clean under `astro/tsconfigs/strict`
- `SiteHeader.astro` and `SiteFooter.astro` built — text-only wordmark, Log in / Get Started links, footer legal links, mailto contact, and a build-time-computed copyright year — all sourced from `consts.ts`, zero headings, zero client JS

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @lucide/astro and declare the site font stack** - `08ef190` (feat)
2. **Task 2: Create src/consts.ts and add the optional noindex prop to BaseLayout** - `b7de2a9` (feat)
3. **Task 3: Build SiteHeader.astro and SiteFooter.astro** - `d6e139a` (feat)

**Plan metadata:** (pending — this SUMMARY commit)

## Files Created/Modified
- `landing/package.json` - Added `@lucide/astro@^1.28.0` runtime dependency
- `landing/package-lock.json` - Updated lockfile, committed and tracked
- `landing/src/styles/global.css` - Added system font-family declaration to the existing `body` rule inside `@layer base`
- `landing/src/consts.ts` - New: `SITE_NAME`, `CTA_URLS`, `LEGAL_LINKS`, `CONTACT_EMAIL` named exports
- `landing/src/layouts/BaseLayout.astro` - Added optional `noindex?: boolean` prop and conditional `<meta name="robots" content="noindex">`
- `landing/src/components/SiteHeader.astro` - New: nav bar with wordmark, Log in, Get Started
- `landing/src/components/SiteFooter.astro` - New: footer with legal links, contact email, build-time copyright year

## Decisions Made
- Verified `@lucide/astro` version (`1.28.0`) and peer dependency range live against the npm registry immediately before install, matching `43-RESEARCH.md`'s Package Legitimacy Audit exactly — no legitimacy checkpoint was needed since the package was already audited `[OK]` in research with no `[ASSUMED]`/`[SUS]`/`[SLOP]` disposition.
- `consts.ts` uses 2-space indentation (per PATTERNS.md's exact specified target content) while `BaseLayout.astro`'s HTML body retains its existing tab indentation — each file follows its own pre-existing/specified convention rather than forcing uniformity across files that had none to begin with.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria and automated verification blocks in Tasks 1-3 passed without modification.

## Issues Encountered
None.

## Known Stubs
None. `SiteHeader.astro` and `SiteFooter.astro` are fully wired to real `consts.ts` values (no placeholder URLs, no `#` hrefs, no empty props). `/privacy` and `/terms` routes referenced by `SiteFooter.astro` do not exist yet on disk — this is the plan's documented, intentional forward dependency (resolved in plan 43-03, same phase/wave-2 batch, well before Phase 45 deploy), not a stub.

## Threat Flags

None. All new surface (npm dependency, cross-origin CTA links, static outbound links, build-time-only script execution) maps directly to the threat register entries already disposed in this plan's `<threat_model>` (T-43-SC, T-43-01, T-43-02, T-43-03) — no new trust boundary or attack surface was introduced beyond what was pre-registered.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `consts.ts`, `BaseLayout.astro`'s `noindex` prop, `SiteHeader.astro`, and `SiteFooter.astro` are all ready for import by Wave 2 plans (43-02 home page content, 43-03 legal pages, 43-04 heading/review pass).
- `SiteHeader`/`SiteFooter` are not yet imported by any page (that composition work belongs to 43-02/43-03) — `npx astro build` still succeeds since Astro does not require component files to be referenced.
- No blockers.

---
*Phase: 43-home-page-legal-pages*
*Completed: 2026-07-30*

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 task commit hashes (`08ef190`, `b7de2a9`, `d6e139a`) verified present in `git log`.

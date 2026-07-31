---
phase: 44-seo-basics-analytics
plan: 02
subsystem: infra
tags: [astro, satori, resvg-js, og-image, seo, static-asset]

# Dependency graph
requires:
  - phase: 44-01
    provides: satori + @resvg/resvg-js installed as devDependencies at audited exact versions (satori@0.29.0, @resvg/resvg-js@2.6.2)
provides:
  - "landing/public/og-image.png — 1200x630 static Open Graph / Twitter card share image, committed and served at /og-image.png"
  - "landing/scripts/generate-og-image.mjs — re-runnable satori+resvg-js generator script, single-sourced from src/consts.ts SITE_NAME"
  - "landing/scripts/fonts/Lato-Semibold.ttf + LATO-LICENSE.txt — vendored OFL-1.1 font enabling offline regeneration"
  - "npm run generate:og — documented regeneration command, not wired into astro build"
affects: [44-04-verification-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns: ["one-off build-tooling script under landing/scripts/, excluded from astro build, invoked via a dedicated npm script"]

key-files:
  created:
    - landing/scripts/generate-og-image.mjs
    - landing/scripts/fonts/Lato-Semibold.ttf
    - landing/scripts/fonts/LATO-LICENSE.txt
    - landing/public/og-image.png
  modified:
    - landing/package.json

key-decisions:
  - "Node 22.23.2 imports landing/src/consts.ts directly via native type-stripping (no regex-extraction fallback needed) — verified with a standalone import smoke test before writing the script"
  - "Script uses 2-space indent + semicolons, matching astro.config.mjs's existing .mjs convention rather than the tab/no-semicolon style used inside .astro template markup"

patterns-established:
  - "Build-tooling scripts that produce static public/ assets live under landing/scripts/, run via a dedicated npm script, and are never wired into astro build"

requirements-completed: [SEO-01]

# Metrics
duration: 6min
completed: 2026-07-31
---

# Phase 44 Plan 02: OG Share Image Generation Summary

**Programmatic 1200x630 Slate-on-wordmark OG share image generated via satori + resvg-js, committed as a static asset with a vendored OFL Lato font for offline reproducibility**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-31T12:53:00-07:00
- **Completed:** 2026-07-31T12:55:26-07:00
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Vendored `Lato-Semibold.ttf` (SIL OFL-1.1, sourced from the local `fonts-lato` Debian package) plus its full license text into `landing/scripts/fonts/`
- Wrote `landing/scripts/generate-og-image.mjs`, a satori + `@resvg/resvg-js` generator that builds the wordmark image from pre-converted Slate sRGB hex literals (`#394658` / `#FAFAFA`), single-sourced from `SITE_NAME` in `src/consts.ts`
- Generated `landing/public/og-image.png` — confirmed 1200x630, non-empty, deterministic (byte-identical, 13044 bytes, across two runs), and copied by `astro build` to `dist/og-image.png`
- Added `npm run generate:og` without touching the Astro build pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Vendor the OFL font and write the OG image generation script** - `41e8590` (feat)
2. **Task 2: Generate and commit the 1200x630 OG share image** - `b786077` (feat)

**Plan metadata:** pending (this summary commit)

## Files Created/Modified
- `landing/scripts/generate-og-image.mjs` - satori + resvg-js OG image generator, imports `SITE_NAME` directly from `src/consts.ts` via Node 22's native `.ts` type-stripping
- `landing/scripts/fonts/Lato-Semibold.ttf` - vendored TrueType font, required because satori has no system-font fallback
- `landing/scripts/fonts/LATO-LICENSE.txt` - full SIL OFL-1.1 text + copyright line, satisfying OFL redistribution requirements
- `landing/public/og-image.png` - generated 1200x630 PNG (13044 bytes), the committed static OG/Twitter share image
- `landing/package.json` - added `"generate:og": "node scripts/generate-og-image.mjs"` script entry

## Decisions Made
- Verified Node 22.23.2 can `import('./src/consts.ts')` directly (native type-stripping) before writing the script, so the plan's regex-extraction fallback path was not needed — the script imports `SITE_NAME` directly, keeping the wordmark text single-sourced with zero duplication
- Matched `astro.config.mjs`'s 2-space + semicolons `.mjs` convention for the new script, rather than the tab/no-semicolon style used inside `.astro` template markup, since Task 1 required picking one and staying internally consistent

## Deviations from Plan

None - plan executed exactly as written. The script worked on the first run with no satori/resvg errors, so no auto-fixes were needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEO-01's image half is fully satisfied: `landing/public/og-image.png` is committed, served at `/og-image.png`, and reproducible offline via `npm run generate:og`
- Ready for plan 44-03 to wire the `<link>`/`<meta>` OG/Twitter tags in `BaseLayout.astro` referencing this image
- Visual/legibility confirmation of the wordmark rendering is deferred to plan 44-04's human checkpoint, per this plan's `<verification>` note

---
*Phase: 44-seo-basics-analytics*
*Completed: 2026-07-31*

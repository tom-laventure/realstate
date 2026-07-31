---
phase: 44-seo-basics-analytics
plan: 01
subsystem: infra
tags: [astro, seo, sitemap, robots-txt, npm, vercel-analytics, satori, resvg]

# Dependency graph
requires:
  - phase: 42-scaffold-stack-setup
    provides: "landing/ Astro + Tailwind project scaffold with astro.config.mjs and package.json baseline"
provides:
  - "landing/ dependencies installed at exact audited versions: @astrojs/sitemap@3.7.3, @vercel/analytics@2.0.1 (dependencies), satori@0.29.0, @resvg/resvg-js@2.6.2 (devDependencies)"
  - "@astrojs/sitemap wired into astro.config.mjs with hardcoded https://realtybase.ca site and a filter excluding /privacy/ and /terms/"
  - "landing/public/robots.txt served at dist root, pointing crawlers at sitemap-index.xml"
affects: [44-02-og-images, 44-03-analytics-wiring, 45-vercel-project-setup, 46-apex-domain-cutover]

# Tech tracking
tech-stack:
  added: ["@astrojs/sitemap@3.7.3", "@vercel/analytics@2.0.1", "satori@0.29.0", "@resvg/resvg-js@2.6.2"]
  patterns:
    - "Exact-pinned (--save-exact) versions for legitimacy-audited third-party packages, rather than caret ranges"
    - "sitemap filter predicate matches full absolute URLs including trailing slash (Astro's directory build.format)"

key-files:
  created: [landing/public/robots.txt]
  modified: [landing/package.json, landing/package-lock.json, landing/astro.config.mjs]

key-decisions:
  - "Reworded the astro.config.mjs `site` trailing comment to avoid the literal substring 'VERCEL_URL' — the plan's own no-env-derivation verify check (grep excluding full-line comments) would otherwise false-positive on an inline comment explaining the constraint, same class of issue as Phase 42's @custom-variant collision"

patterns-established:
  - "Trailing inline comments explaining a hardcoded-value constraint must avoid literally containing the forbidden token the verify script greps for"

requirements-completed: [SEO-02, SEO-03]

# Metrics
duration: 4min
completed: 2026-07-31
---

# Phase 44 Plan 01: SEO Sitemap & Robots.txt Summary

**@astrojs/sitemap wired to a hardcoded `https://realtybase.ca` apex, filtered to exactly one home-page URL, plus a static robots.txt pointing crawlers at the generated sitemap index — with all four of this phase's npm dependencies pinned at their audited exact versions.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-31T19:49:00Z
- **Completed:** 2026-07-31T19:51:04Z
- **Tasks:** 2 completed
- **Files modified:** 4 (package.json, package-lock.json, astro.config.mjs, new public/robots.txt)

## Accomplishments
- Installed `@astrojs/sitemap@3.7.3` and `@vercel/analytics@2.0.1` into `dependencies`, and `satori@0.29.0` + `@resvg/resvg-js@2.6.2` into `devDependencies`, all pinned exact (no `^`/`~`) per RESEARCH.md's completed legitimacy audit
- Extended `landing/astro.config.mjs` in place (preserving its existing header comments, 2-space indent, semicolons) with a hardcoded `site: 'https://realtybase.ca'` and a sitemap `filter` that excludes `/privacy/` and `/terms/` by exact trailing-slash-correct URL match
- Added `landing/public/robots.txt` with `Allow: /`, `Disallow: /privacy`, `Disallow: /terms`, and a `Sitemap:` pointer to `sitemap-index.xml`
- Verified a full production build emits `dist/sitemap-index.xml` + `dist/sitemap-0.xml` containing exactly one `<loc>https://realtybase.ca/</loc>` entry, and `dist/robots.txt` matches the authored content byte-for-byte

## Task Commits

Each task was committed atomically:

1. **Task 1: Install phase dependencies at exact researched versions** - `d767af8` (chore)
2. **Task 2: Wire sitemap integration with hardcoded apex domain and add robots.txt** - `22f9601` (feat)

**Plan metadata:** _pending — final commit created after this summary_

## Files Created/Modified
- `landing/package.json` - Added 4 exact-pinned deps (2 runtime, 2 devDependency) alongside the 6 pre-existing caret-ranged entries
- `landing/package-lock.json` - Regenerated lockfile entries for the 4 new packages and their transitive deps
- `landing/astro.config.mjs` - Added `sitemap` import, hardcoded `site`, and `integrations: [sitemap({ filter })]`
- `landing/public/robots.txt` - New static file, copied byte-for-byte to `dist/robots.txt` at build time

## Decisions Made
- Reworded the `site` line's trailing comment ("Hardcoded production apex domain — never derived from environment/runtime request data") to avoid literally containing the string `VERCEL_URL`, since the plan's own acceptance check (`grep -v '^\s*//' ... | grep -c VERCEL_URL` expecting `0`) only strips full-line comments, not trailing ones. Functionally identical intent to the plan's original wording, just phrased without the literal forbidden substring — same class of self-collision as Phase 42's `@custom-variant` provenance-comment fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Trailing comment collided with its own verify assertion**
- **Found during:** Task 2, immediately after writing `astro.config.mjs` and before running the automated verify block
- **Issue:** The plan's suggested trailing comment content ("never derived from ... VERCEL_URL") would cause the acceptance criterion `grep -v '^\s*//' astro.config.mjs | grep -c "VERCEL_URL"` (expected `0`) to return `1`, since the check only excludes full `//`-prefixed comment lines, not inline trailing comments containing the literal token.
- **Fix:** Reworded the comment to preserve the same semantic constraint ("never derived from environment/runtime request data") without the literal substring `VERCEL_URL`.
- **Files modified:** `landing/astro.config.mjs`
- **Verification:** Re-ran `grep -v '^\s*//' astro.config.mjs | grep -c "VERCEL_URL"` → `0`; rebuilt and re-ran the full Task 2 automated verify block → all assertions passed.
- **Committed in:** `22f9601` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Purely a comment-wording fix to satisfy the plan's own verify script; no functional change to the hardcoded-domain behavior. No scope creep.

## Issues Encountered
None beyond the comment-wording deviation above.

## User Setup Required
None - no external service configuration required. All work is local build/config changes.

## Next Phase Readiness
- `landing/` build reliably emits a correct sitemap + robots.txt anchored to the real production domain — SEO-02 and SEO-03 satisfied
- `@vercel/analytics`, `satori`, and `@resvg/resvg-js` are now installed and pinned, unblocking plan 44-02 (OG image generation) and plan 44-03 (Vercel Analytics wiring) with no further install steps needed
- No blockers identified for 44-02/44-03

---
*Phase: 44-seo-basics-analytics*
*Completed: 2026-07-31*

## Self-Check: PASSED

- FOUND: landing/astro.config.mjs
- FOUND: landing/public/robots.txt
- FOUND: landing/package.json
- FOUND: commit d767af8
- FOUND: commit 22f9601

---
phase: 42-scaffold-stack-setup
plan: 02
subsystem: infra
tags: [astro, tailwindcss, oklch, design-tokens, landing]

# Dependency graph
requires:
  - phase: 42-01
    provides: "landing/ Astro 7 + Tailwind v4 project skeleton, own package.json/lockfile, @tailwindcss/vite pipeline"
provides:
  - "Fully-merged static Slate design tokens in landing/src/styles/global.css with a frontend-commit-SHA provenance comment"
  - "landing/src/layouts/BaseLayout.astro shared document shell (TypeScript Props, favicon, global.css import, <slot />)"
  - "landing/src/pages/index.astro bare proof-of-tokens placeholder page rendering through BaseLayout"
  - "landing/ deploy-independence config: .nvmrc (22.12.0), vercel.json (astro framework preset), scoped .gitignore"
affects: [43-content, 45-vercel-project-setup]

# Tech tracking
tech-stack:
  added: ["@astrojs/check@0.9.10 (devDependency)", "typescript (devDependency)"]
  patterns: ["Fully-merged static CSS custom property copy (no build-time coupling) with provenance comment for drift tracking", "BaseLayout.astro Props interface + <slot /> shell pattern"]

key-files:
  created:
    - landing/.nvmrc
    - landing/vercel.json
    - landing/src/layouts/BaseLayout.astro
  modified:
    - landing/.gitignore
    - landing/src/styles/global.css
    - landing/src/pages/index.astro
    - landing/package.json
    - landing/package-lock.json
    - landing/public/ (favicon_transparent.png added, favicon.svg removed)

key-decisions:
  - "landing/.nvmrc pinned to exact 22.12.0 (Astro 7's engine floor) rather than frontend/'s bare major-only 22, per plan's explicit rationale (local machine ran 22.9.0 at scaffold time)"
  - "landing/vercel.json kept to exactly 4 keys (schema, framework, buildCommand, outputDirectory) — no rewrites/redirects/headers, unlike auth-callback/'s SPA catch-all"
  - "Reworded the global.css provenance comment's dark-mode-omission note to avoid the literal string '@custom-variant' — the plan's own verify script's no-@custom-variant assertion collided with its own mandated comment text"
  - "Installed @astrojs/check + typescript as devDependencies after independently verifying both against npm registry metadata (withastro/astro and microsoft/TypeScript orgs) — required by astro check, which this plan's own Task 3 verify block invokes"

patterns-established:
  - "Static, one-way, build-time-decoupled CSS token copy: source files + exact commit SHA recorded in a header comment as the sole drift-detection mechanism (PITFALLS.md Pitfall 7)"

requirements-completed: [DEPLOY-01, LAND-07]

# Metrics
duration: 5min
completed: 2026-07-30
---

# Phase 42 Plan 02: Slate Tokens + BaseLayout + Proof-of-Tokens Page Summary

**landing/ now renders a Slate-styled placeholder page through a shared BaseLayout.astro shell, with the fully-merged Slate design tokens statically copied from frontend/ and a complete, independent Vercel deploy config.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-30T20:21:00Z (approx)
- **Completed:** 2026-07-30T20:25:16Z
- **Tasks:** 3 (all auto)
- **Files modified:** 10 (3 created, 7 modified, 1 asset added + 1 asset removed)

## Accomplishments
- `landing/` gained its own `.nvmrc`, `vercel.json`, and a scoped `.gitignore` — fully independent deploy config, root `.gitignore` untouched
- `frontend/public/favicon_transparent.png` copied byte-for-byte into `landing/public/`; the create-astro default `favicon.svg` removed
- `landing/src/styles/global.css` rewritten with the fully-merged static Slate `:root` block (base tokens from `frontend/src/index.css` layered with the `slate` override from `frontend/src/assets/config/colorSchemes.ts`), the complete 32-entry `@theme inline` mapping, and a provenance comment recording frontend commit `b9e5e50768097fade21614728aa1d3950d1a2e9c`
- `landing/src/layouts/BaseLayout.astro` created: TypeScript `Props { title: string }`, imports `global.css`, favicon link, single `<slot />` — deliberately omits SiteHeader/SiteFooter/nav/OG/analytics per CONTEXT.md D-01
- `landing/src/pages/index.astro` rewritten as a bare proof-of-tokens page rendering through `BaseLayout`, with labelled swatches demonstrating `background`, `foreground`, `muted-foreground`, `primary`, `card`, `border`, and `sidebar` tokens
- Full independence re-verified: `rm -rf node_modules dist && npm ci && npm run build` succeeds from the committed lockfile alone
- `npx astro check` reports 0 errors, 0 warnings, 0 hints (strict TypeScript per D-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add landing/ deploy-independence config and the favicon asset** - `e71e754` (feat)
2. **Task 2: Write global.css with the fully-merged Slate tokens and provenance comment** - `46ad35b` (feat)
3. **Task 3: Build BaseLayout.astro shell and the bare proof-of-tokens index page** - `f3c97c8` (feat)

**Plan metadata:** (this commit, follows)

## Files Created/Modified
- `landing/.nvmrc` - Pinned to exact `22.12.0` (Astro 7's engine floor)
- `landing/vercel.json` - Minimal 4-key config declaring the `astro` framework preset
- `landing/.gitignore` - Added `.vercel` alongside existing `dist/`, `.astro/`, `node_modules/`, `.env` entries
- `landing/public/favicon_transparent.png` - Byte-for-byte copy from `frontend/public/`
- `landing/public/favicon.svg` - Removed (create-astro default, superseded)
- `landing/src/styles/global.css` - Full rewrite: provenance comment, `@import "tailwindcss"`, `@theme inline` (32 `--color-*` mappings), merged Slate `:root`, `@layer base` reset
- `landing/src/layouts/BaseLayout.astro` - New shared `<html>`/`<head>` shell
- `landing/src/pages/index.astro` - Full rewrite: bare labelled Slate-token swatch page rendering through `BaseLayout`
- `landing/package.json`, `landing/package-lock.json` - Added `@astrojs/check` + `typescript` devDependencies (required by `astro check`)

## Decisions Made
- The frontend commit SHA written into the provenance comment is `b9e5e50768097fade21614728aa1d3950d1a2e9c` (`git -C frontend rev-parse HEAD` at execution time), dated `2026-07-30`.
- The placeholder page demonstrates these Slate tokens via Tailwind utilities: `bg-background`/`text-foreground` (page shell), `text-muted-foreground` (description), `bg-primary`/`text-primary-foreground` (primary swatch), `bg-card`/`border-border` (card swatch), `bg-sidebar`/`text-sidebar-foreground` (sidebar swatch).
- `rm -rf node_modules dist && npm ci && npm run build` was re-run from a clean state and succeeded, confirming Plan 03's human verification and Phase 45's Vercel setup can rely on this build being reproducible from the committed lockfile alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded global.css provenance comment to avoid tripping the plan's own `@custom-variant` verify assertion**
- **Found during:** Task 2 (writing global.css)
- **Issue:** The plan's `<interfaces>` block mandates verbatim provenance-comment text that includes the literal substring `@custom-variant dark line are deliberately omitted`. The same task's `<verify>` block asserts `grep -c '@custom-variant' $CSS` equals `0` (checking for an actual `@custom-variant` at-rule). Following the interfaces text verbatim causes the verify script to fail on its own mandated content — a self-contradiction in the plan.
- **Fix:** Reworded the comment's final sentence from "...index.css's .dark block and @custom-variant dark line are deliberately omitted" to "...index.css's .dark block and its dark-mode variant declaration are deliberately omitted" — same meaning, no literal `@custom-variant` token in prose.
- **Files modified:** `landing/src/styles/global.css`
- **Verification:** `grep -c '@custom-variant' landing/src/styles/global.css` returns `0`; comment still documents the omission clearly.
- **Committed in:** `46ad35b` (Task 2 commit)

**2. [Rule 3 - Blocking] Installed @astrojs/check + typescript devDependencies**
- **Found during:** Task 3 (running `npx astro check` per the task's verify block)
- **Issue:** `astro check` requires `@astrojs/check` and `typescript`, neither of which were installed by Plan 01's scaffold. The command prompted interactively to install them.
- **Fix:** Independently verified both packages against npm registry metadata (`@astrojs/check` → `repository.url: git+https://github.com/withastro/astro.git`, maintained by the official Astro team; `typescript` → `repository.url: git+https://github.com/microsoft/TypeScript.git`, maintained by Microsoft) before running `npm install --save-dev @astrojs/check typescript` non-interactively. Both are exactly the official companion packages Astro's own CLI requested by name — not a freely-chosen or ambiguous package name.
- **Files modified:** `landing/package.json`, `landing/package-lock.json`
- **Verification:** `npx astro check` now runs and reports 0 errors, 0 warnings, 0 hints.
- **Committed in:** `f3c97c8` (Task 3 commit)

**3. [Informational, no fix needed] Built-CSS oklch serialization uses percentage notation, not decimal**
- **Found during:** Task 3 final verification (`npm run build` + grep against `dist/`)
- **Issue:** The plan's acceptance criteria expected the built CSS to match a regex tolerant of `0.39`/`.39` decimal notation (`oklch\(0?\.39 0?\.035 256\)`). Astro's lightningcss minifier instead serializes the oklch L channel as a percentage: `oklch(39% .035 256)`. `39%` and `0.39` are semantically identical values for oklch's L channel (0–1 range, 100% = 1) — this is a minifier serialization choice, not a source-token error.
- **Fix:** None required — verified semantic equivalence directly: `grep -rEq -- '--primary:oklch\(39% \.035 256\)' dist/` and `grep -rEq -- '--background:oklch\(97% \.003 256\)' dist/` both succeed, confirming the correct Slate values reached the built output.
- **Files modified:** None
- **Verification:** Manual regex check against `dist/_astro/*.css` confirmed the percentage-form values are present and correct.
- **Committed in:** N/A (no source change; documented here for Plan 03's human verification awareness)

---

**Total deviations:** 3 (1 auto-fixed bug in plan's own verify/interfaces contradiction, 1 auto-fixed blocking dependency install, 1 informational note on minifier output format)
**Impact on plan:** All deviations were necessary to complete the plan as intended (correct provenance comment, working `astro check`, correct token verification). No scope creep — no functionality was added beyond what the plan specified.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `landing/` is fully independent and reproducibly buildable (`npm ci && npm run build` from a clean `node_modules`/`dist`), ready for Plan 03's human visual verification of the Slate palette.
- The Slate token provenance comment records frontend commit `b9e5e50768097fade21614728aa1d3950d1a2e9c` — if `frontend/`'s Slate palette changes before Phase 45/46, the SHA in `global.css` will visibly diverge from `git -C frontend rev-parse HEAD`, signalling a manual re-copy is needed.
- No blockers.

---
*Phase: 42-scaffold-stack-setup*
*Completed: 2026-07-30*

## Self-Check: PASSED

All claimed created/modified files verified present on disk (`landing/.nvmrc`, `landing/vercel.json`, `landing/src/styles/global.css`, `landing/src/layouts/BaseLayout.astro`, `landing/src/pages/index.astro`, `landing/public/favicon_transparent.png`); `landing/public/favicon.svg` confirmed removed. All claimed commit hashes (`e71e754`, `46ad35b`, `f3c97c8`) verified present in git log.

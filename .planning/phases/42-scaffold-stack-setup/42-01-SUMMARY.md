---
phase: 42-scaffold-stack-setup
plan: 01
subsystem: infra
tags: [astro, tailwindcss, vite, landing, scaffold]

# Dependency graph
requires: []
provides:
  - "landing/ directory as an independent Astro 7 + Tailwind v4 project, own package.json/lockfile, no nested git repo"
  - "Working @tailwindcss/vite pipeline proven end-to-end (npm run build compiles utility classes into dist/)"
  - "Strict TypeScript preset (astro/tsconfigs/strict) for .astro frontmatter"
affects: [42-02-content-and-tokens, 43-content, 45-vercel-project-setup]

# Tech tracking
tech-stack:
  added: ["astro@7.1.6", "tailwindcss@4.3.3", "@tailwindcss/vite@4.3.3"]
  patterns: ["Astro static output with @tailwindcss/vite plugin (no PostCSS config, no @astrojs/tailwind)"]

key-files:
  created:
    - landing/package.json
    - landing/package-lock.json
    - landing/astro.config.mjs
    - landing/tsconfig.json
    - landing/.gitignore
    - landing/src/pages/index.astro
    - landing/src/styles/global.css
    - landing/public/favicon.svg
    - landing/public/favicon.ico
  modified: []

key-decisions:
  - "Used npm create astro@latest with --template minimal --install --no-git --typescript strict --skip-houston --yes (all flags accepted as-is, no adaptation needed)"
  - "Installed Node v22.23.2 via nvm (local floor was 22.9.0, below Astro 7's >=22.12.0 engine requirement) rather than scaffolding on an incompatible runtime"
  - "Added private: true to package.json manually; engines.node was already set correctly by create-astro"
  - "Left create-astro's AGENTS.md/CLAUDE.md(symlink)/README.md/.vscode/ scaffold artifacts in place — standard tool output, no conflict with root CLAUDE.md since scope is landing/-local"

patterns-established:
  - "Tailwind v4 wiring via `npx astro add tailwind --yes`, which correctly installs @tailwindcss/vite (never the deprecated @astrojs/tailwind) and registers vite.plugins in astro.config.mjs"

requirements-completed: [DEPLOY-01]

# Metrics
duration: 6min
completed: 2026-07-30
---

# Phase 42 Plan 01: Scaffold + Stack Setup Summary

**Astro 7.1.6 + Tailwind v4.3.3 (via @tailwindcss/vite) project skeleton scaffolded at `landing/`, independently buildable from its own lockfile with zero coupling to `frontend/`/`backend/`.**

## Performance

- **Duration:** 6 min (active task execution; excludes time waiting on the Task 1 human approval checkpoint)
- **Started:** 2026-07-30T20:11:00Z (approx, post-checkpoint-approval)
- **Completed:** 2026-07-30T20:16:31Z
- **Tasks:** 3 (1 checkpoint + 2 auto)
- **Files modified:** 14 (13 created by scaffold, 5 modified/created by Tailwind wiring, with overlap)

## Accomplishments
- Package legitimacy checkpoint (Task 1) presented, independently re-verified by the coordinator via `npm view <pkg> repository.url maintainers`, and approved before any install ran
- `landing/` scaffolded via `npm create astro@latest` — own `package.json`, `package-lock.json`, `astro.config.mjs`, `tsconfig.json` extending `astro/tsconfigs/strict`, no nested `.git`
- Node runtime upgraded from 22.9.0 to 22.23.2 via nvm to satisfy Astro 7's `>=22.12.0` engine floor
- `@tailwindcss/vite` wired via `astro add tailwind`, proven end-to-end: `npm run build` compiles a test `bg-white` utility class into `dist/`
- Full independence verified: `rm -rf node_modules && npm ci && npm run build` succeeds from the committed lockfile alone
- Root `.gitignore` confirmed byte-identical to its pre-task state (still exactly `backend` + `frontend`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate** — checkpoint only, no commit (approved by coordinator, independently re-verified against npm registry `repository.url`/`maintainers`)
2. **Task 2: Scaffold landing/ with create-astro** - `a4f2e58` (feat)
3. **Task 3: Wire Tailwind v4 via @tailwindcss/vite** - `5235edf` (feat)

**Plan metadata:** (this commit, follows)

## Files Created/Modified
- `landing/package.json` - Astro project manifest; `private: true`, `engines.node >=22.12.0`, `astro`/`tailwindcss`/`@tailwindcss/vite` deps
- `landing/package-lock.json` - Committed lockfile proving reproducible independent install
- `landing/astro.config.mjs` - Registers `@tailwindcss/vite` plugin via `vite.plugins`; no site/integrations/output/adapter (Phase 44+ scope)
- `landing/tsconfig.json` - Extends `astro/tsconfigs/strict` (D-02)
- `landing/.gitignore` - Standard Astro scaffold ignores (`dist/`, `.astro/`, `node_modules/`, etc.)
- `landing/src/pages/index.astro` - Bare placeholder page; temporarily imports `global.css` and applies `bg-white` to prove the Tailwind pipeline compiles (Plan 02 rewrites this)
- `landing/src/styles/global.css` - `@import "tailwindcss";` only (Plan 02 replaces with merged Slate token stylesheet)
- `landing/public/favicon.svg`, `landing/public/favicon.ico` - Scaffold-default favicons (Plan 02/CONTEXT.md may swap for the reused `frontend/public/favicon_transparent.png`)

## Decisions Made
- Node version: installed latest 22.x (22.23.2) via `nvm install 22` rather than pinning to the exact 22.12.0 floor — satisfies the plan's `>=22.12.0` gate; Plan 02 is expected to pin `landing/.nvmrc` to an exact patch per its own scope.
- Kept create-astro's incidental scaffold files (`AGENTS.md`, `CLAUDE.md` symlink, `README.md`, `.vscode/`) — they're harmless, tool-generated, and out of this plan's `files_modified` list but not prohibited by any acceptance criterion.

## Deviations from Plan

None — plan executed exactly as written. `astro add tailwind` installed the exact intended versions (`tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, no `@astrojs/tailwind`) with no correction needed, and no PostCSS config was generated.

## Issues Encountered
- Local Node runtime (22.9.0) was below Astro 7's declared engine floor (`>=22.12.0`), exactly as flagged in the plan's Task 2 action block. Resolved via `nvm install 22` (pulled 22.23.2) + `nvm use 22`, per the plan's documented blocker-first instruction. No network issues encountered.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `landing/` is ready for Plan 02 (content + Slate token stylesheet) — the placeholder `index.astro`/`global.css` are intentionally minimal and expected to be replaced.
- Node v22.23.2 is now the active nvm version in this environment; Plan 02's `.nvmrc` pin should be checked against it.
- No blockers.

---
*Phase: 42-scaffold-stack-setup*
*Completed: 2026-07-30*

# Phase 42: Scaffold + Stack Setup - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a working, independently-buildable Astro + Tailwind static site scaffold at `landing/`, with the Slate color scheme wired in — infrastructure only, no home-page content, no legal pages, no Vercel project/deployment (those are Phases 43-46). Success is: `astro dev` renders a Slate-styled placeholder page from a shared `BaseLayout.astro` shell, and `landing/` builds independently of `frontend/`/`backend/`.

</domain>

<decisions>
## Implementation Decisions

### Scaffold Depth
- **D-01:** The placeholder page ships as a bare proof-of-tokens page only — a single page inside `BaseLayout.astro` showing Slate-colored text/background elements, proving the CSS tokens and build pipeline work. It does NOT include `SiteHeader`/`SiteFooter`/nav components — those get built in Phase 43 alongside real content, not scaffolded empty ahead of time.

### TypeScript
- **D-02:** `landing/`'s Astro components use TypeScript (frontmatter + `<script lang="ts">` where scripting exists), consistent with `frontend/`'s strict-TS convention across the rest of the codebase — even though the site itself is nearly static with minimal client-side scripting.

### Claude's Discretion
- Astro project scaffold starting point (official `npm create astro@latest` minimal template vs. hand-built from scratch) — not discussed, left to planner/executor judgment as a pure technical choice with no user-facing effect.
- `package.json` naming, Node version pinning (`.nvmrc` matching `frontend/`'s Node 22 or not) — not discussed, low-stakes technical detail.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (this milestone, v1.14)
- `.planning/research/SUMMARY.md` — executive summary, phase breakdown rationale, critical pitfalls
- `.planning/research/STACK.md` — Astro 7.1.6 + Tailwind 4.3.3 via `@tailwindcss/vite` (not deprecated `@astrojs/tailwind`), no `@astrojs/vercel` adapter needed, `@vercel/analytics` `/astro` export, `@astrojs/sitemap`, and — critically for this phase — the CSS custom property merge strategy: the Slate scheme in `colorSchemes.ts` is a *partial* override on top of `frontend/src/index.css`'s base `:root` tokens, so `landing/` needs the fully-merged static result pasted into its own `global.css`, not just the `colorSchemes.ts` slate object alone
- `.planning/research/ARCHITECTURE.md` — recommended `landing/` internal folder structure (`src/pages`, `src/layouts`, `src/components`, `public/`), confirms `landing/` is a plain-tracked directory (like `auth-callback/`, unlike `frontend`/`backend` gitlinks), needs its own `package.json`/lockfile fully independent of `frontend/`'s, no root `.gitignore` changes needed
- `.planning/research/PITFALLS.md` — Pitfall 7 (Slate CSS token drift): document the source commit/file when copying tokens, since there's no mechanism to catch future drift from `frontend/src/assets/config/colorSchemes.ts`

### Project-level
- `.planning/PROJECT.md` — Current Milestone section (v1.14 goal/target features), Context section (stack conventions)
- `.planning/REQUIREMENTS.md` — DEPLOY-01, LAND-07 (this phase's mapped requirements)
- `.planning/ROADMAP.md` — Phase 42 entry (goal, success criteria, dependencies)

### Source files to copy from (not import/couple to)
- `frontend/src/index.css` — base `:root` CSS custom properties (the foundation layer under any color scheme)
- `frontend/src/assets/config/colorSchemes.ts` — the `slate` scheme object (the override layer); `applyColorScheme()` shows exactly how the two layers merge at runtime, which must be replicated as a static, pre-merged result in `landing/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/index.css` + `frontend/src/assets/config/colorSchemes.ts` (`slate` entry) — source values to hand-copy (fully merged, not partial) into `landing/`'s own stylesheet
- `frontend/public/favicon_transparent.png` — existing favicon asset, reusable as-is per the original ticket
- `auth-callback/vercel.json` — precedent for a minimal, independent Vercel project config (though `landing/`'s will differ since it's a build-step project, not static passthrough)

### Established Patterns
- `frontend/tailwind.config.js` + `frontend/src/index.css`'s `@theme inline` block — shows the existing Tailwind v4 + CSS-variable-token pattern this project already uses; `landing/` should mirror the token-naming approach (`--background`, `--primary`, etc.) for consistency, even though it's a separate Tailwind config
- `frontend/tsconfig.json` — strict TypeScript convention to mirror per D-02

### Integration Points
- None at the code level — `landing/` has zero runtime coupling to `backend/` or `frontend/`. The only "integration" is copied (not shared) CSS token values and CTA links to `app.realtybase.ca` (built in Phase 43, not this phase).

</code_context>

<specifics>
## Specific Ideas

No specific visual/content ideas for this phase — it's infrastructure only. The "bare proof-of-tokens page" (D-01) should look like a minimal test page (e.g., a heading and a couple of Tailwind utility classes using the Slate `--primary`/`--background` tokens), not a designed page.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `arch-brokerage-listing-access.md` ("Rethink listing access model — BrokerageEstate vs board credential JOIN") — matched Phase 42 by keyword ("backend") only, score 0.6. Reviewed and confirmed unrelated: it's backend listing-access architecture debt with no connection to scaffolding the `landing/` Astro project. Left untouched in `.planning/todos/pending/`.

</deferred>

---

*Phase: 42-Scaffold + Stack Setup*
*Context gathered: 2026-07-30*

# Stack Research

**Domain:** Marketing landing site — standalone Astro + Tailwind static site, independently deployed to Vercel from a `landing/` folder in an existing Rails+React monorepo
**Researched:** 2026-07-30
**Confidence:** HIGH (Astro/Tailwind/Vercel core versions verified via Context7 + live npm registry + official Vercel docs; Analytics custom-event free-tier limit is MEDIUM — third-party pricing summaries, not primary Vercel docs)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Astro | 7.1.6 | Static site generator | Zero-JS-by-default "islands" architecture is exactly the target ("zero client-side JS by default"). Ships pure HTML/CSS unless a component explicitly opts into hydration. Verified current via `npm view astro version` (7.1.6, published 2026-07-29) and Context7 `/withastro/docs`. Requires Node >=22.12.0. |
| Tailwind CSS | 4.3.3 | Utility-first styling | Already the project's chosen CSS approach (per milestone decision) and byte-for-byte the same major version (`v4`) already used in `frontend/`, so the copied Slate CSS custom properties and `@theme` mapping pattern transfer over with no translation needed. |
| @tailwindcss/vite | 4.3.3 | Tailwind's official Vite plugin | **This — not `@astrojs/tailwind` — is the correct integration path for Tailwind v4 in Astro.** `@astrojs/tailwind` is deprecated (confirmed in `withastro/docs`); Tailwind 4 ships its own Vite plugin, and Astro's dev server *is* Vite, so it plugs in directly via `astro.config.mjs`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vercel/analytics | 2.0.1 | Page-view + CTA click tracking | Use the `./astro` subpath export (`import Analytics from '@vercel/analytics/astro'`) which ships an Astro-native `<Analytics />` component (available since `@vercel/analytics@1.4.0`, current major is 2.x). Drop `<Analytics />` once in the base layout's `<head>`. **No peer dependency on Astro or a UI framework** — confirmed via `npm view @vercel/analytics@2.0.1 peerDependencies` (only lists react/vue/svelte/next/nuxt/remix, astro is dependency-free) — so it works on a pure static Astro build with no framework runtime installed. |
| @astrojs/sitemap | 3.7.3 | `sitemap-index.xml` / `sitemap-0.xml` generation | Add as an Astro integration; requires `site: 'https://<your-domain>'` set in `astro.config.mjs` so it can emit absolute URLs. Auto-discovers all static routes at build time — zero manual maintenance for a small, mostly-static page set (home + privacy + terms). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `astro add tailwind` | Scaffolds the `@tailwindcss/vite` plugin wiring | Run once from `landing/`; for Astro `>=5.2.0` this installs the Vite plugin (not the deprecated integration) and updates `astro.config.mjs` automatically. |
| `astro add sitemap` | Scaffolds `@astrojs/sitemap` | Adds the integration entry to `astro.config.mjs` automatically. |

## Installation

```bash
# From landing/ (new Astro project, npm create astro@latest scaffolds the base)
npm create astro@latest -- --template minimal --no-install

cd landing

# Core
npm install astro@^7.1.6

# Tailwind (Vite plugin path — do NOT install @astrojs/tailwind, it's deprecated)
npx astro add tailwind

# Supporting
npm install @vercel/analytics@^2.0.1
npx astro add sitemap
```

No `@astrojs/vercel` adapter install is needed for this project — see "What NOT to Use" below.

## CSS Custom Properties Reuse Strategy (Slate scheme, no shared package)

`frontend/src/assets/config/colorSchemes.ts`'s `'slate'` entry is a **partial override** layered on top of `frontend/src/index.css`'s `:root` defaults at runtime via a JS theme hook (`useBrandColorScheme`) — it only redefines `--background`, `--card`, `--card-foreground`, `--sidebar*`, `--primary`, `--primary-foreground`, and `--border`. The remaining tokens (`--foreground`, `--popover*`, `--secondary*`, `--muted*`, `--accent*`, `--destructive*`, `--input`, `--ring`, `--chart-*`, `--radius`) come from `index.css`'s base `:root` block, which is currently identical across all schemes (all schemes share the same neutral base, only overriding brand-specific slots).

**For `landing/`, copy the fully-merged, static result as plain CSS — do not port the scheme-switching mechanism:**

1. Create `landing/src/styles/global.css`.
2. Hand-copy the **merged** Slate values (base `:root` block from `frontend/src/index.css` lines 90–124, with the Slate overrides from `colorSchemes.ts` applied on top) as static `:root` custom properties. Only copy the light-mode block — a marketing site has no dark-mode toggle, so the `.dark { ... }` block and `@custom-variant dark` line are not needed.
3. Add a matching `@theme inline { --color-background: var(--background); ... }` block (copy verbatim from `frontend/src/index.css` lines 48–88) so Tailwind utility classes (`bg-background`, `text-primary`, `border-border`, etc.) resolve to the pasted values, matching shadcn/ui's token convention used across the rest of the app.
4. Import `@import "tailwindcss";` plus this file from the base layout.

This is a one-time, versioned copy-paste — not a build-time import from `frontend/`. If the Slate palette changes later, it must be re-copied manually; this is an accepted tradeoff for keeping `landing/` a fully independent deploy with no cross-repo build coupling (matches the `auth-callback/` precedent of zero shared build tooling).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `@tailwindcss/vite` plugin | `@astrojs/tailwind` integration | Never for a new project — it's deprecated by the Astro team in favor of the Vite plugin now that Tailwind ships one directly. Only relevant if stuck on Tailwind v3. |
| No `@astrojs/vercel` adapter (`output: 'static'`, default) | `@astrojs/vercel` adapter with `output: 'server'` | Only if a future requirement needs SSR, Vercel Image Optimization, server islands, or Vercel Actions — none apply to a static marketing page. |
| `<Analytics />` from `@vercel/analytics/astro` | `webAnalytics: { enabled: true }` on the `@astrojs/vercel` adapter | Only relevant for `@vercel/analytics@1.3.x` or earlier, which required the adapter to inject the tracking script. Current major (2.x) ships the Astro component directly — pulling in the whole adapter just for analytics would be unnecessary weight. |
| Static `public/robots.txt` referencing the sitemap URL | Dynamic `src/pages/robots.txt.ts` API route | Only worth the extra moving part if `site` changes across environments (e.g. preview vs. production domains) frequently enough that hand-maintaining the URL becomes error-prone. For a single production domain, a static file is simpler and has zero build-time cost. |
| Plain Astro components + a scoped `<script>` tag for the mobile-nav toggle | `@astrojs/react` / `@astrojs/preact` island | Only if the site later needs genuinely stateful interactivity (e.g. a live form, multi-step interaction). A single scrolling page with hero/features/CTA needs no component framework — adding one would work against the "zero client-side JS by default" goal for zero benefit. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `@astrojs/tailwind` | Deprecated by the Astro team; Tailwind v4's official Vite plugin supersedes it | `@tailwindcss/vite` |
| `@astrojs/vercel` adapter (for this project) | Only unlocks SSR/image-optimization/server-feature capabilities this site doesn't need; adding it without `output: 'server'` provides no benefit and signals intent (SSR) the site doesn't have | Deploy the static `dist/` output directly — Vercel auto-detects Astro's static preset with zero extra config, same pattern as `auth-callback/`'s zero-build static deploy |
| A shared npm package / monorepo workspace link to `frontend/` for design tokens | Creates a build-time coupling between two projects that are deliberately independent Vercel deployments with separate deploy lifecycles; a token change in `frontend/` would silently need to trigger a `landing/` rebuild | Hand-copy the merged Slate CSS custom properties once (see above); treat drift as an acceptable, rare manual sync cost |
| A UI framework integration (React/Vue/Svelte) just to get `<Analytics />` working | Unnecessary — `@vercel/analytics/astro`'s component has no framework peer dependency | Import `Analytics` directly from `@vercel/analytics/astro` in a `.astro` file |
| `window.va(...)` inline script tracking (the "html"/vanilla approach) | Astro has a first-class, typed component for this (`@vercel/analytics/astro`'s `<Analytics />` for page views, `track()` from `@vercel/analytics` for custom events) — the raw script approach is Vercel's fallback for sites with no JS framework at all | `<Analytics />` in the layout + `track('cta_click', { location: '...' })` from a small scoped `<script>` on the CTA button |

## Stack Patterns by Variant

**If a future page needs a real interactive widget (e.g. embedded calculator, live chat):**
- Add `@astrojs/react` (or `preact`, smaller footprint) scoped to just that island via `client:visible`/`client:idle`
- Because Astro islands keep the JS cost isolated to that one component — the rest of the site (hero, features, CTA) stays zero-JS

**If the domain needs environment-specific URLs (preview deploys vs. production):**
- Set `site` in `astro.config.mjs` from `import.meta.env.VERCEL_URL` / a `SITE_URL` env var rather than hardcoding the production domain
- Because `@astrojs/sitemap` and any canonical/OG tags derive from `site`, and Vercel preview deployments get their own generated hostname

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| astro@7.1.6 | @astrojs/vercel@11.0.4 (peer: `astro: ^7.0.0`) | Not installed for this project (see "What NOT to Use"), but confirmed compatible if a future SSR need arises |
| astro@7.1.6 | @tailwindcss/vite@4.3.3 (peer: `vite: ^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8`) | Astro 7's internal Vite version satisfies this range; no manual Vite pinning needed |
| astro@7.1.6 | Node >=22.12.0 | Astro 7 raised the Node floor from Astro 6 — verify the Vercel project's Node runtime version setting matches (Vercel defaults to a current LTS, should already satisfy this) |
| @vercel/analytics@2.0.1 | astro (any, no declared peer) | The `./astro` export has zero peer dependencies — confirmed via `npm view @vercel/analytics@2.0.1 peerDependencies` |
| tailwindcss@4.3.3 | @tailwindcss/vite@4.3.3 | Keep both on the same 4.x minor/patch cadence; they're published in lockstep from the same monorepo upstream |

## Sources

- Context7 `/withastro/docs` — Tailwind integration guide, Vercel adapter guide, sitemap integration guide (HIGH confidence, official docs mirror)
- `npm view astro/@astrojs/vercel/@astrojs/sitemap/@vercel/analytics/tailwindcss/@tailwindcss/vite version/peerDependencies/engines/time` — live npm registry, verified 2026-07-30 (HIGH confidence — primary source for exact current versions)
- https://vercel.com/docs/analytics/quickstart — confirmed `@vercel/analytics@1.4.0+` uses the Astro `<Analytics />` component; adapter-based `webAnalytics` config is legacy (≤1.3.x) (HIGH confidence, official Vercel docs, fetched 2026-07-30)
- https://vercel.com/docs/analytics/custom-events — confirmed `track()` API and server vs. client tracking split (HIGH confidence, official docs)
- WebSearch "does static Astro site need @astrojs/vercel adapter" — confirmed adapter is optional for static-only deploys, only required for SSR/image optimization/Web Analytics on the legacy config path (MEDIUM confidence, cross-referenced against official Astro Vercel deploy guide title in same result set)
- WebSearch "Vercel Web Analytics custom events Hobby plan free tier limit" — Hobby plan ~50,000 combined analytics events/month, page views and `track()` custom events share the same pool (LOW/MEDIUM confidence — third-party pricing summary sites, not fetched directly from Vercel's own pricing page; validate against `vercel.com/docs/analytics/limits-and-pricing` before assuming this cap in production planning)
- Read `frontend/src/assets/config/colorSchemes.ts` and `frontend/src/index.css` directly — source of truth for the exact Slate OKLCH values and the base/override merge behavior (HIGH confidence, first-party repo code)

---
*Stack research for: Astro + Tailwind marketing landing site, independent Vercel deploy*
*Researched: 2026-07-30*

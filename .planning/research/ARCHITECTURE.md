# Architecture Research

**Domain:** Static marketing site (Astro + Tailwind) as a third independently-deployed Vercel project inside an existing polyglot monorepo
**Researched:** 2026-07-30
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     realstate/ (single git repo, monorepo root)           │
├───────────────────────────┬───────────────────────┬───────────────────────┤
│   backend/ (gitlink)      │  frontend/ (gitlink)   │  auth-callback/       │
│   Rails API — own repo    │  Vite/React SPA — own  │  (plain dir, tracked  │
│   deployed to Render.com  │  repo — own Vercel     │  directly, no build)  │
│                            │  project               │  own Vercel project   │
├───────────────────────────┴───────────────────────┼───────────────────────┤
│                                                     │   landing/ (NEW)      │
│                                                     │   plain dir, tracked  │
│                                                     │   directly — Astro +  │
│                                                     │   Tailwind, own       │
│                                                     │   Vercel project      │
└─────────────────────────────────────────────────────────────────────────┘
                         │                    │                  │
                         ▼                    ▼                  ▼
                 Vercel Project A     Vercel Project B    Vercel Project C
                 Root Dir: frontend/  Root Dir: auth-     Root Dir: landing/
                 (existing)           callback/ (existing) (NEW — this milestone)
```

Each Vercel "project" in this setup is an independent connection to the **same** GitHub repo (`tom-laventure/realstate`), scoped by a **Root Directory** setting configured in the Vercel dashboard per project — not by separate repos. `frontend/` and `backend/` are gitlinks (git submodule-style pointers, tracked as mode `160000`, no `.gitmodules` file present — the repo bumps the pointer commit via `git add frontend && git commit`, consistent with the "chore: bump backend/frontend submodule pointers" commits already in this repo's history). `auth-callback/` is a **plain tracked directory** (regular files, no gitlink) — this is the direct precedent for how `landing/` should be structured this milestone, since the milestone context already locks in "plain directory, NOT a submodule."

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `landing/` (NEW) | Public marketing site: home page, Privacy Policy, Terms | Astro static site, Tailwind v4 via `@tailwindcss/vite` |
| `landing/vercel.json` (NEW) | Vercel build/output/redirect config scoped to this project | Minimal — Astro's zero-config static output needs little beyond defaults |
| Vercel Project "landing" (NEW, dashboard-side) | Connects GitHub repo, Root Directory = `landing/`, builds + deploys on push | Configured in Vercel dashboard, not in repo |
| `landing/package.json` + lockfile (NEW) | Isolated dependency graph for the Astro build | Independent of `frontend/package.json` — different framework, different repo boundary |
| `.planning/` (existing) | Cross-cutting planning docs for all sub-projects | No changes needed for `landing/` beyond this research + roadmap phase docs |

## Recommended Project Structure

```
landing/
├── public/                      # Static, unprocessed assets — copied as-is to output root
│   ├── favicon.svg
│   ├── og-image.png             # Open Graph share image
│   └── robots.txt                # Static robots.txt (simplest option — see Patterns)
├── src/
│   ├── pages/                   # File-based routing — Astro's one reserved directory
│   │   ├── index.astro          # Single scrolling home page (hero, value prop, features, CTA)
│   │   ├── privacy.astro        # Privacy Policy (placeholder legal text)
│   │   └── terms.astro          # Terms of Service (placeholder legal text)
│   ├── layouts/
│   │   └── BaseLayout.astro     # <html>/<head> shell: meta tags, OG tags, favicon, Analytics component, global styles import
│   ├── components/              # Section-level building blocks for the scrolling home page
│   │   ├── Hero.astro
│   │   ├── ValueProp.astro
│   │   ├── FeatureGrid.astro    # "How it works" — icons (lucide via astro-icon or inline SVG) + text
│   │   ├── ClosingCTA.astro
│   │   ├── SiteHeader.astro
│   │   └── SiteFooter.astro
│   ├── styles/
│   │   └── global.css           # `@import "tailwindcss";` entrypoint (Tailwind v4 CSS-first config)
│   └── consts.ts                # Shared copy/config: site URL, nav links, brand name — avoids hardcoding across pages
├── astro.config.mjs             # Astro config — Vite plugins array includes @tailwindcss/vite
├── package.json                 # Independent from frontend/package.json (see rationale below)
├── package-lock.json            # or pnpm-lock.yaml — independent lockfile
├── tsconfig.json                # Astro's strict TS preset (astro/tsconfigs/strict)
├── .gitignore                   # Scoped to landing/: node_modules, dist, .astro, .vercel (see Integration Points)
└── vercel.json                  # Only if non-default behavior is needed (see Patterns)
```

### Structure Rationale

- **`src/pages/`:** Astro's only reserved directory — file-based routing. Three files map directly to this milestone's three routes (home, privacy, terms). No nested routing needed for a single-page-plus-two-legal-pages site.
- **`src/layouts/`:** One `BaseLayout.astro` is sufficient for this milestone's scope (a marketing site with legal pages, not a documentation site or blog with varied templates). Centralizes `<head>` — meta/OG tags, sitemap link, favicon, the Vercel Analytics component — in one place so SEO/analytics changes are a one-file edit.
- **`src/components/`:** One component per home-page section keeps `index.astro` readable and each section independently reviewable, mirroring the monorepo's existing preference (in `frontend/`) for composable, single-responsibility files over monolithic page files.
- **`public/`:** Static assets that need zero processing (favicon, OG image, `robots.txt`) live here and are copied byte-for-byte to the deployed output root — standard Astro convention, verified against current Astro docs.
- **Independent `package.json`/lockfile:** `landing/` is a different framework (Astro, not Vite+React) with a near-fully-disjoint dependency set from `frontend/` (no Redux, TanStack Query, Amplify, Mapbox, etc.). Sharing a lockfile or hoisting to a root `package.json` would couple two unrelated build pipelines and force Vercel's `landing/` project to either set "Include source files outside of the Root Directory" (unnecessary complexity) or fail to resolve dependencies. A self-contained `package.json` is also what makes Vercel's zero-config Astro framework detection work correctly when Root Directory = `landing/`.

## Architectural Patterns

### Pattern 1: Vercel Root-Directory-Scoped Monorepo Project

**What:** One GitHub repo, N independent Vercel projects, each with its own dashboard-configured **Root Directory** (`Settings → General → Root Directory`). Each project builds only the files under its root, using its own `package.json`, and deploys to its own default `*.vercel.app` URL and (later) its own custom domain.
**When to use:** Exactly this repo's existing pattern — `frontend/` and `auth-callback/` are already two separate Vercel projects pointed at two separate subdirectories of the same repo. `landing/` becomes the third.
**Trade-offs:** Simple and matches existing precedent (low learning cost, nothing new to teach the team). The cost is that every push to the repo triggers a build-check on all three projects unless "Ignored Build Step" is configured per project — worth setting later (not blocking for this milestone's definition of done) so a `backend/`-only commit doesn't waste a `landing/` build minute.

**Example (Vercel dashboard setting, not a repo file):**
```
Project: realtybase-landing
Root Directory: landing
Framework Preset: Astro (auto-detected from landing/package.json + astro.config.mjs)
Build Command: (default — astro build)
Output Directory: (default — dist)
Install Command: (default — npm install, scoped to landing/)
```

### Pattern 2: Tailwind v4 via Vite Plugin (not `@astrojs/tailwind`)

**What:** Tailwind v4's recommended Astro integration is the official `@tailwindcss/vite` plugin registered in `astro.config.mjs`'s `vite.plugins` array, with a single `@import "tailwindcss";` line in a global CSS file. The older `@astrojs/tailwind` integration is a Tailwind v3 wrapper and should not be used with v4.
**When to use:** Always, for this milestone — `frontend/` already runs Tailwind v4 via `@tailwindcss/vite` (confirmed in `frontend/package.json`: `"@tailwindcss/vite": "^4.1.18"`), so this keeps the same major version and mental model across both frontend surfaces, even though the two projects don't share a build.
**Trade-offs:** None meaningful here — this is simply the current-correct setup path, not a judgment call.

**Example:**
```js
// astro.config.mjs
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  vite: { plugins: [tailwindcss()] },
})
```
```css
/* src/styles/global.css */
@import "tailwindcss";
```

### Pattern 3: Static Output, No Vercel Adapter Needed

**What:** Astro's default `output: 'static'` mode requires **no** `@astrojs/vercel` adapter to deploy on Vercel — plain `astro build` output (`dist/`) is served directly. The adapter is only needed for SSR output or to opt into Vercel-native Image Optimization.
**When to use:** This milestone — the landing site is a fully static scrolling page + two static legal pages, no server rendering, no personalization, no per-request logic.
**Trade-offs:** Skipping the adapter keeps `package.json` and `astro.config.mjs` minimal, at the cost of not getting Vercel's automatic image optimization pipeline for free (Astro's own built-in `<Image />` component still works and optimizes at build time, which is sufficient for a handful of hero/OG images at this scale).

### Pattern 4: Vercel Analytics via Component, Not Adapter Option

**What:** For `@vercel/analytics@1.4.0+`, Web Analytics on Astro is enabled by importing the `<Analytics />` component from `@vercel/analytics/astro` into the base layout — not by passing `webAnalytics: { enabled: true }` to the (unneeded, per Pattern 3) Vercel adapter.
**When to use:** This milestone — "Vercel Analytics" is an explicit target feature, and this is the current supported path that doesn't require pulling in the full SSR adapter just for analytics.
**Trade-offs:** None — this is the documented current approach; the older adapter-option path is legacy behavior for pre-1.4 versions.

**Example:**
```astro
---
// src/layouts/BaseLayout.astro
import { Analytics } from '@vercel/analytics/astro'
---
<html lang="en">
  <head><!-- meta/OG tags --></head>
  <body>
    <slot />
    <Analytics />
  </body>
</html>
```

## Data Flow

### Request Flow (fully static — no runtime data flow)

```
[Browser request to realtybase.ca/*]
    ↓
[Vercel Edge — serves pre-built static file from landing/'s dist/ output]
    ↓
[HTML/CSS/JS response — no API calls, no backend/, no auth]
```

There is deliberately **no** runtime coupling to `backend/` or `frontend/`. The landing site's only "dynamic" behavior is client-side navigation to the app: CTAs link out to `https://app.realtybase.ca/create` (or the appropriate onboarding entry point) as a plain `<a href>`, not an API call.

### Build/Deploy Flow

```
[git push to realstate repo, main branch]
    ↓
[Vercel webhook fires for each connected project]
    ↓
┌─────────────────┬──────────────────────┬──────────────────────┐
│ frontend project │ auth-callback project│ landing project (NEW)│
│ Root: frontend/  │ Root: auth-callback/ │ Root: landing/       │
│ npm install+build│ static passthrough   │ npm install+astro    │
│                  │ (no build step)      │ build                │
└─────────────────┴──────────────────────┴──────────────────────┘
    ↓                       ↓                       ↓
[app.realtybase.ca]  [auth.realtybase.ca]   [*.vercel.app preview
                                              — this milestone's DoD;
                                              realtybase.ca apex is a
                                              later manual DNS step]
```

### Key Data Flows

1. **Build-time only:** All content (copy, legal text, feature list) is authored directly in `.astro` files/components at build time — no CMS, no backend fetch. This matches the milestone's "placeholder legal text, flagged pending review" framing — no dynamic content pipeline needed yet.
2. **Outbound conversion flow:** Home page CTA → static link to `app.realtybase.ca` (the brokerage-creation wizard entry point). This is the only "integration" between `landing/` and the rest of the platform, and it's a plain hyperlink, not a shared component, API, or type.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (marketing site, low traffic) | Static output is already optimal — Vercel's CDN edge-caches every file; no server, no database, effectively unlimited cheap scale for this workload |
| If content grows (blog, case studies, docs) | Add `src/content/` Astro Content Collections — no architecture change, same project, same Vercel project, just more `src/pages/` routes |
| If personalization/A-B testing needed | Would require Vercel Edge Middleware or switching `output` to `'server'`/`'hybrid'` + adding `@astrojs/vercel` adapter — explicitly out of scope for this milestone |

### Scaling Priorities

1. **Not a concern at this milestone's scope.** A single scrolling page + 2 legal pages, statically built, has no realistic bottleneck at any traffic level a marketing site for this product would see.
2. **If it ever matters:** the first real lever would be adding `@astrojs/sitemap` and structured data for SEO growth, not infrastructure scaling.

## Anti-Patterns

### Anti-Pattern 1: Hoisting `landing/` into `frontend/`'s dependency tree or a root `package.json`

**What people do:** Add a root-level `package.json` with npm/pnpm workspaces to "share" tooling between `frontend/` and `landing/`, or literally build the landing pages as routes inside the `frontend/` Vite/React SPA.
**Why it's wrong:** Breaks the milestone's explicit decision that `landing/` is "fully independent of the `frontend/` SPA build." It would also couple two unrelated frameworks (React SPA vs. Astro static site) and reintroduce exactly the kind of shared-build fragility that led to putting `auth-callback/` in its own zero-build directory in the first place. Vercel's Root Directory model already gives clean isolation for free — don't reach for a workspace tool to solve a problem that doesn't exist yet.
**Do this instead:** Keep `landing/package.json` fully self-contained, exactly like `auth-callback/` (no build) and `frontend/` (separate repo) are already isolated from each other.

### Anti-Pattern 2: Adding `landing` to the root `.gitignore`

**What people do:** By analogy with `backend`/`frontend` appearing in the root `.gitignore`, add `landing` there too.
**Why it's wrong:** `backend`/`frontend` are gitlinks (submodule-style pointers); ignoring the directory name there is a (somewhat unusual, but intentional) convention for how this repo already handles those two gitlinked directories. `landing/` is explicitly a **plain tracked directory** (like `auth-callback/`), and adding it to the root `.gitignore` would make git ignore the entire folder's contents — nothing would ever get committed.
**Do this instead:** Leave the root `.gitignore` untouched. Give `landing/` its own scoped `.gitignore` (`landing/.gitignore`) for build artifacts only — `node_modules/`, `dist/`, `.astro/`, `.vercel/` — the same way a fresh `npm create astro@latest` scaffold generates one by default. Nested `.gitignore` files work correctly within a single git repo; this requires no root config changes at all.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Vercel (new project) | Dashboard-configured Root Directory = `landing/`, connected to the same GitHub repo as the existing `frontend`/`auth-callback` projects | This is a **dashboard-side** setup step, not a repo file — nothing in `landing/vercel.json` sets the root directory; that's a Vercel Project Setting only. `landing/vercel.json` should stay minimal (Astro's zero-config output needs no rewrites/redirects/headers by default; add only if a specific need arises, e.g. a redirect from a legacy path) |
| Vercel Web Analytics | `@vercel/analytics/astro` package, `<Analytics />` component in `BaseLayout.astro` | No adapter required (see Pattern 4); enabling Web Analytics for the project itself is a Vercel dashboard toggle done once the project exists |
| GitHub (existing) | Same repo, same webhook mechanism already powering `frontend`/`auth-callback` Vercel projects | No new repo, no new remote, no CI config needed — this repo has no `.github/workflows/*.yml` (only `copilot-instructions.md`), so there is no existing CI pipeline to update for a third deployable |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `landing/` ↔ `frontend/` (app.realtybase.ca) | Plain `<a href>` outbound links only | No shared components, no shared types, no shared API client — deliberately zero coupling, consistent with `landing/`'s "fully independent" mandate |
| `landing/` ↔ `backend/` (Rails API) | None | Landing site makes zero API calls; all content is static/build-time |
| `landing/` ↔ `.planning/` | Planning docs only (this research file, future ROADMAP phase docs) | No runtime coupling; `.planning/` never ships to the deployed site |
| `landing/` ↔ Vercel dashboard config | Root Directory setting, project name, (later) custom domain (`realtybase.ca` apex) attachment | Domain attachment is explicitly out-of-band/manual per this milestone's definition of done — not a repo-level integration point |

## Suggested Build Order

1. **Scaffold `landing/` locally** — `npm create astro@latest` (or manual scaffold matching the structure above) inside `landing/`, add Tailwind v4 via `@tailwindcss/vite`, verify `astro dev` renders a blank page. This produces `landing/package.json`, `landing/astro.config.mjs`, `landing/.gitignore`, and the base `src/` tree.
2. **Build `BaseLayout.astro`** — head/meta/OG scaffolding, global Tailwind import, `SiteHeader`/`SiteFooter` — before any page content, since every page depends on it.
3. **Build the home page sections** (`Hero`, `ValueProp`, `FeatureGrid`, `ClosingCTA`) as isolated components, then assemble in `src/pages/index.astro`.
4. **Build `privacy.astro`/`terms.astro`** — simpler than the home page, can happen in parallel with step 3 once `BaseLayout` exists.
5. **Add SEO basics** — meta/OG tags in `BaseLayout`, `@astrojs/sitemap` integration (auto-generates `sitemap-index.xml` at build time), static `public/robots.txt` referencing the sitemap.
6. **Add `<Analytics />`** from `@vercel/analytics/astro` into `BaseLayout`.
7. **Commit `landing/` to the monorepo root** (plain directory, per the milestone's locked decision) — this is the first point at which anything needs to exist in the actual git tree beyond local scaffolding.
8. **Create the new Vercel project** in the dashboard — connect the existing GitHub repo, set Root Directory to `landing`, let Vercel auto-detect the Astro framework preset, deploy.
9. **Verify the default `*.vercel.app` preview URL deploys successfully** — this is this milestone's definition of done. Pointing `realtybase.ca`'s apex domain at the project is an explicit out-of-band manual step, not part of this build order.

## Sources

- [Vercel — Using Monorepos](https://vercel.com/docs/monorepos) — Root Directory per-project configuration, HIGH confidence
- [Vercel — Monorepos FAQ](https://vercel.com/docs/monorepos/monorepo-faq) — multi-project-per-repo pattern confirmation, HIGH confidence
- [Astro Docs — Project Structure](https://docs.astro.build/en/basics/project-structure/) — `src/pages`/`src/layouts`/`src/components`/`public/` conventions, HIGH confidence
- [Astro Docs — Deploy to Vercel](https://docs.astro.build/en/guides/deploy/vercel/) — static output needs no adapter unless using Vercel-native SSR/Analytics-adapter-mode/Image Optimization, HIGH confidence
- [Astro Docs — `@astrojs/vercel` integration guide](https://docs.astro.build/en/guides/integrations-guide/vercel/) — adapter is optional for static sites; `webAnalytics` adapter option is legacy for `@vercel/analytics` pre-1.4, HIGH confidence
- [Tailwind CSS Docs — Astro framework guide](https://tailwindcss.com/docs/installation/framework-guides/astro) — `@tailwindcss/vite` is the current v4 integration path, replacing `@astrojs/tailwind` (a v3-only wrapper), HIGH confidence
- Repo inspection (`git ls-files -s`, `.gitignore`, `auth-callback/vercel.json`, `frontend/package.json`) — confirmed existing gitlink structure for `backend`/`frontend`, plain-directory precedent in `auth-callback/`, existing Tailwind v4 usage in `frontend/`, and the absence of any `.github/workflows/*.yml` CI pipeline, HIGH confidence (direct observation, not inference)

---
*Architecture research for: Marketing Landing Site (`landing/`) monorepo/Vercel integration*
*Researched: 2026-07-30*

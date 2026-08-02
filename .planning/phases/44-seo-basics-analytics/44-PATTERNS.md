# Phase 44: SEO Basics + Analytics - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 10 (4 new, 6 modified)
**Analogs found:** 10 / 10 (all analogs are files within `landing/` itself — this is a small, self-contained Astro project with no comparable prior-art elsewhere in the monorepo)

**Scope note:** This phase touches only the standalone `landing/` Astro static site (its own package.json/repo root at `landing/`), not `backend/` or `frontend/`. All analogs below are existing `landing/` files from Phase 42/43.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `landing/src/layouts/BaseLayout.astro` | layout/config | request-response (build-time SSG) | itself (existing file, extend in place) | exact |
| `landing/astro.config.mjs` | config | build-time transform | itself (existing file, extend in place) | exact |
| `landing/public/robots.txt` | config (static asset) | file-I/O (static serve) | `landing/public/favicon.ico` / `favicon_transparent.png` | role-match (static public asset, no code analog needed) |
| `landing/public/og-image.png` | static asset (generated) | file-I/O (static serve) | `landing/public/favicon_transparent.png` | role-match (both are pre-generated static images checked into `public/`) |
| `landing/scripts/generate-og-image.mjs` | utility (build-tooling, one-off script) | transform (element tree → SVG → PNG) | none in codebase | no analog — first build-tooling script in `landing/` |
| `landing/src/components/SiteHeader.astro` | component | event-driven (click tracking) | itself (existing file, add scoped `<script>`) | exact |
| `landing/src/components/Hero.astro` | component | event-driven (click tracking) | itself (existing file, add scoped `<script>`) | exact |
| `landing/src/components/ValueProp.astro` | component | event-driven (click tracking) | itself (existing file, add scoped `<script>`) | exact |
| `landing/src/components/ClosingCTA.astro` | component | event-driven (click tracking) | itself (existing file, add scoped `<script>`) | exact |
| `landing/src/pages/index.astro`, `privacy.astro`, `terms.astro` | route/page | request-response (build-time SSG) | each other (all three already share the `BaseLayout` call-site pattern) | exact |
| `landing/package.json` | config | — | itself | exact |

## Pattern Assignments

### `landing/src/layouts/BaseLayout.astro` (layout, request-response/build-time)

**Analog:** itself — `landing/src/layouts/BaseLayout.astro` (current 25-line file, full contents below; this phase extends it, doesn't replace it)

**Current full file** (all 25 lines — small enough for one read):
```astro
---
import '../styles/global.css'

interface Props {
  title: string
  noindex?: boolean
}

const { title, noindex = false } = Astro.props
---

<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="generator" content={Astro.generator} />
		<link rel="icon" href="/favicon.ico" sizes="any" />
		<title>{title}</title>
		{noindex && <meta name="robots" content="noindex" />}
	</head>
	<body>
		<slot />
	</body>
</html>
```

**Pattern to preserve:** tab-indentation inside `<head>`/`<body>` (existing file uses tabs, not the 2-space convention used in frontmatter — match this exactly, it's an Astro-formatter artifact already present), `Props` interface declared in frontmatter, destructured with defaults (`noindex = false`), conditional JSX-style tag rendering (`{noindex && <meta .../>}`).

**Required extension (per RESEARCH.md Pattern 2 — already fully specified, copy directly):**
- Add `description: string` (required, no default) to `Props`.
- Add `import { Analytics } from '@vercel/analytics/astro'` to frontmatter.
- Compute `isNonProduction` from `import.meta.env.VERCEL_ENV`, OR it into `noindex` (rename local var to avoid prop-name collision — RESEARCH.md example uses `pageNoindex` for the prop and `noindex` for the computed final value).
- Hardcode `siteUrl = 'https://realtybase.ca'` (never derive from `Astro.url`/`VERCEL_URL` — same constraint as `astro.config.mjs`'s `site`).
- Add `<link rel="canonical">`, full OG block (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` + width/height), full Twitter block (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`).
- Add `<Analytics />` inside `<body>`, after `<slot />` (matches RESEARCH.md Pattern 2 body ordering).

**Call-site impact:** every `<BaseLayout title="...">` call site (`index.astro`, `privacy.astro`, `terms.astro`) must add a `description="..."` prop — this is a breaking prop-interface change, so all 3 page files need a one-line edit alongside the layout change.

---

### `landing/astro.config.mjs` (config, build-time transform)

**Analog:** itself — current full file (11 lines):
```js
// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  }
});
```

**Pattern to preserve:** `// @ts-check` header, `// https://astro.build/config` comment above `defineConfig`, integration imports above the config object, 2-space indent (note: this file uses 2-space + semicolons, unlike the `.astro` files' tab/no-semicolon frontmatter style — don't "fix" this inconsistency, it's pre-existing).

**Required extension (per RESEARCH.md Pattern 3, exact code given — copy directly):**
```js
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://realtybase.ca',
  vite: { plugins: [tailwindcss()] },
  integrations: [
    sitemap({
      filter: (page) =>
        page !== 'https://realtybase.ca/privacy/' &&
        page !== 'https://realtybase.ca/terms/',
    }),
  ],
})
```
**Load-bearing detail:** trailing slash on both excluded URLs (Astro's default `build.format: 'directory'` output shape) — RESEARCH.md Pitfall 1.

---

### `landing/public/robots.txt` (new static file)

**No code analog** — first `robots.txt` in this project. Content is fully specified in RESEARCH.md "Code Examples" section, copy directly:
```
User-agent: *
Allow: /
Disallow: /privacy
Disallow: /terms

Sitemap: https://realtybase.ca/sitemap-index.xml
```
Sibling static assets for reference on `public/` conventions: `landing/public/favicon.ico`, `landing/public/favicon_transparent.png` (both committed binary/text static files, no build step — same pattern this file and `og-image.png` follow).

---

### `landing/scripts/generate-og-image.mjs` (new build-tooling script)

**No code analog in this codebase** — this is the first Node build-tooling script in `landing/` (everything else is Astro components/pages/config). Follow RESEARCH.md Pattern 1 exactly (satori + `@resvg/resvg-js`, one-off script, not wired into `astro build`).

**Concrete Slate token values to bake in** (from `landing/src/styles/global.css` lines 68-69 — these are the exact CSS custom property values this script must convert to hex/rgb for satori, since satori cannot parse `oklch()`):
```css
--primary: oklch(0.39 0.035 256);
--primary-foreground: oklch(0.985 0 0);
```
Per RESEARCH.md Open Question 3 / Assumption A1: convert these two oklch values to hex/rgb equivalents up front (offline color-space conversion) before passing to satori — do not pass the oklch string literal.

**Wordmark text source:** `SITE_NAME` constant already exists at `landing/src/consts.ts:1` (`export const SITE_NAME = 'RealtyBase'`) — import/reference this value rather than hardcoding `'RealtyBase'` a second time in the script, consistent with the project's single-source-of-truth convention already established for `CTA_URLS`/`CONTACT_EMAIL` in the same file.

**Node version constraint:** `landing/.nvmrc` pins `22.12.0`; run `nvm use` before `npm install`/running this script (documented quirk, not new to this phase).

---

### `landing/src/components/SiteHeader.astro`, `Hero.astro`, `ValueProp.astro`, `ClosingCTA.astro` (components, event-driven click tracking)

**Analog:** each component's own current file (all already read in full above — each is small, ≤ 29 lines).

**Shared current pattern across all four** (imports + CTA anchor shape):
```astro
---
import { CTA_URLS } from '../consts'
---
<!-- ... -->
<a
	href={CTA_URLS.getStarted}
	class="bg-primary text-primary-foreground inline-block rounded-md px-6 py-4 text-sm font-semibold transition-opacity hover:opacity-90 motion-reduce:transition-none"
>
	Get Started
</a>
```
(`SiteHeader.astro` also imports `SITE_NAME` and uses a smaller `px-4 py-2` variant for its nav-bar CTA; `ClosingCTA.astro` additionally has a "Log in" link styled as underlined text.)

**Required extension per file (per RESEARCH.md Pattern 5 — exact code given, repeat per CTA instance):**
1. Add a stable `id` attribute to each `<a>` CTA element (RESEARCH.md example: `id="hero-get-started"`) — needed because `document.getElementById(...)` is the wiring mechanism.
2. Add a scoped `<script>` block immediately after the CTA (not in `BaseLayout`, not a single delegated listener — matches the "zero-client-JS-by-default" convention from Phase 42/43):
```astro
<script>
  import { track } from '@vercel/analytics'
  document.getElementById('hero-get-started')?.addEventListener('click', () => {
    track('get_started_click', { location: 'hero' })
  })
</script>
```

**Exact per-file/per-instance mapping (D-03, locked):**

| File | CTA | `id` (suggested) | Event name | `location` value |
|------|-----|-------------------|------------|-------------------|
| `SiteHeader.astro` | Get Started | `nav-get-started` | `get_started_click` | `nav` |
| `SiteHeader.astro` | Log in | `nav-login` | `login_click` | `nav` |
| `Hero.astro` | Get Started | `hero-get-started` | `get_started_click` | `hero` |
| `ValueProp.astro` | Get Started | `value-prop-get-started` | `get_started_click` | `value_prop` |
| `ClosingCTA.astro` | Get Started | `closing-get-started` | `get_started_click` | `closing` |
| `ClosingCTA.astro` | Log in | `closing-login` | `login_click` | `closing` |

Each of `SiteHeader.astro` and `ClosingCTA.astro` needs **two** `id`s + two `<script>` blocks (one per CTA instance in that file); `Hero.astro` and `ValueProp.astro` need one each.

---

### `landing/src/pages/index.astro`, `privacy.astro`, `terms.astro` (pages, request-response/build-time)

**Analog:** each other — all three already share the identical `<BaseLayout title="..." [noindex]>` call-site shape (see full contents read above).

**Required extension:** add a `description="..."` prop to each `<BaseLayout>` call (new required prop per the layout change above). Exact copy is Claude's Discretion per CONTEXT.md — draft ~150-160 char descriptions grounded in each page's existing content (home page's Hero/ValueProp copy already reads "RealtyBase unifies MLS-synced listings, group collaboration, and role-based access..." — RESEARCH.md's Code Examples section already drafted a compliant home-page description built from this exact source text; privacy/terms descriptions should be drafted the same way, from `LegalNotice.astro`/each page's own intro section).

`privacy.astro` and `terms.astro` already pass `noindex` (boolean shorthand, always-on per Phase 43 D-09) — this prop is untouched by this phase; the new environment-based override in `BaseLayout` is OR'd on top of it, not a replacement.

---

## Shared Patterns

### Layout as single SEO/Analytics integration point
**Source:** `landing/src/layouts/BaseLayout.astro`
**Apply to:** All page files indirectly (no page-level changes needed beyond the new `description` prop) — this is the one place meta tags, canonical URL, OG/Twitter tags, env-aware noindex override, and `<Analytics />` all live, matching `ARCHITECTURE.md`'s stated "single integration point" design (confirmed in CONTEXT.md `code_context`).

### Single source of truth for CTA URLs/site name
**Source:** `landing/src/consts.ts` (`SITE_NAME`, `CTA_URLS`, `CONTACT_EMAIL`, `LEGAL_LINKS`)
**Apply to:** `generate-og-image.mjs` (reference `SITE_NAME` for wordmark text), all four CTA-tracking components (already import `CTA_URLS`, no change needed there since `href` values aren't changing — only `id` + `<script>` are added).

### Zero-client-JS-by-default / scoped `<script>` convention
**Source:** established in Phase 42 D-03 / Phase 43 D-03 (no single component file to point to — this is a project-wide convention, not existing code, since no component currently ships a `<script>` tag). `<Analytics />` and the six `track()` scoped scripts are this project's first client-side JS.
**Apply to:** all four CTA-bearing components — each script is scoped to its own component file, not centralized in `BaseLayout` or a shared `analytics.ts` utility.

### Tab-indentation inside Astro template markup, 2-space in frontmatter/config
**Source:** every existing `.astro` file in `landing/src/` (`BaseLayout.astro`, `SiteHeader.astro`, `Hero.astro`, etc. all use tabs inside `<head>`/`<body>`/JSX-like markup, 2-space inside `---` frontmatter blocks); `astro.config.mjs` uses 2-space throughout.
**Apply to:** all modified `.astro` files — preserve existing indentation style per file, don't reformat.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `landing/scripts/generate-og-image.mjs` | utility (build script) | transform (element tree → SVG → PNG) | First Node build-tooling script in `landing/` — no prior art exists in this project. RESEARCH.md Pattern 1 provides a complete, directly-copyable code example (satori + `@resvg/resvg-js`), so the planner should treat that as the canonical source rather than a codebase analog. |
| `landing/public/robots.txt` | config (static text file) | file-I/O (static serve) | No prior `robots.txt` in `landing/public/`; content is fully specified verbatim in RESEARCH.md "Code Examples" — copy directly, no analog search needed. |
| `landing/public/og-image.png` | static asset (binary, generated) | file-I/O (static serve) | No prior generated-image asset exists (`favicon_transparent.png` is hand-supplied, not build-script-generated) — closest structural analog by *location convention* only (`public/`), not by generation method. |

## Metadata

**Analog search scope:** `landing/` (entire project — `src/components/`, `src/layouts/`, `src/pages/`, `src/consts.ts`, `astro.config.mjs`, `package.json`, `public/`, `.nvmrc`). No search performed in `backend/`/`frontend/` — phase is explicitly scoped to the standalone `landing/` static site with no shared code path to the monorepo's other two projects.
**Files scanned:** 17 (all non-generated files under `landing/` excluding `node_modules/`, `.astro/`, `dist/`)
**Pattern extraction date:** 2026-07-31

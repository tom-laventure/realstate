# Phase 44: SEO Basics + Analytics - Research

**Researched:** 2026-07-31
**Domain:** Static Astro site SEO (meta/OG/Twitter tags, sitemap, environment-aware noindex) + Vercel Web Analytics custom event tracking, inside the standalone `landing/` project
**Confidence:** HIGH (package versions, sitemap `filter` API, `track()` API, `VERCEL_ENV` behavior all confirmed against official docs/registries) / MEDIUM (Vercel plan-tier gate on custom events — verified against official pricing docs, but this project's actual Vercel team plan tier is unconfirmed) / LOW (exact OG image visual design — implementation detail, Claude's Discretion per CONTEXT.md)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — OG Share Image (SEO-01):** No logo/brand-mark image asset exists anywhere in the codebase (confirmed in Phase 43 D-01 — nav uses a text-only wordmark; `favicon_transparent.png` is a 32×32 icon, not a wordmark mark). The 1200×630 OG image must therefore be **generated programmatically** (e.g. Satori/resvg or an Astro build-time script) rather than hand-designed or supplied externally — a Slate-colored background with the "RealtyBase" text wordmark, consistent with D-01's text-only brand treatment. Output is a one-time-generated static file checked into `landing/public/og-image.png` (STACK.md/ARCHITECTURE.md already establish it lives in `public/`, not generated per-request — this is a fully static site).

**D-02 — Sitemap Scope (SEO-02):** `@astrojs/sitemap`'s `filter` option must exclude `/privacy` and `/terms` from `sitemap.xml`. Both pages are always `noindex`'d regardless of environment (Phase 43 D-09 / LEGAL-03/04) — listing them in the sitemap while telling crawlers not to index them is a self-contradictory signal. Only `/` (and any future indexable routes) should appear in the sitemap.

**D-03 — CTA Analytics Event Schema (ANALYTICS-01):** The home page has 4 "Get Started" CTA instances (nav, hero, value-prop, closing) and 2 "Log in" instances (nav, closing). Custom `track()` calls must **distinguish which instance was clicked**, not just track by label: two event names — `get_started_click` and `login_click` — each with a `location` property whose value is one of `nav` | `hero` | `value_prop` | `closing` (only the two applicable values apply to `login_click`: `nav`, `closing`). This preserves per-placement conversion visibility that a flat `cta_click` event would lose.

### Claude's Discretion

- Exact meta description copy per page (home/privacy/terms) — draft succinct ~150-160 char descriptions grounded in existing page content during planning/execution, same pattern as Phase 43's hero copy (drafted then reviewed before ship), not locked here.
- `twitter:card` value (`summary_large_image` is the correct default for a 1200×630 image — no need to re-litigate).
- Exact OG image generation tooling choice (Satori vs. a plain Astro/Canvas script) — implementation detail, not a product decision.
- `VERCEL_ENV`-driven noindex wiring mechanics (combining page-level `noindex` prop with environment-based forcing) — already fully specified by `.planning/research/PITFALLS.md` Pitfall 5, no ambiguity remains.

### Deferred Ideas (OUT OF SCOPE)

- LAND-11 (UTM/conversion-tracking params on CTA links) — explicitly out of scope per REQUIREMENTS.md, v2 candidate; not raised during this discussion but noted here for completeness since it's analytics-adjacent.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEO-01 | Meta title/description + Open Graph + Twitter card tags, including a static logo/wordmark OG image | `## Code Examples` (full `<head>` block), `## Architecture Patterns` Pattern 1 (OG image build-time generation script using satori + @resvg/resvg-js) |
| SEO-02 | `sitemap.xml` with `site` hardcoded to the production apex domain (never derived from `VERCEL_URL`) | `## Code Examples` (sitemap config + trailing-slash-correct `filter`), `## Common Pitfalls` Pitfall 1 (already resolved by milestone PITFALLS.md Pitfall 4, reconfirmed here), `## Package Legitimacy Audit` (`@astrojs/sitemap` verified) |
| SEO-03 | `robots.txt` referencing the sitemap | `## Code Examples` (static `public/robots.txt` content) |
| SEO-04 | Non-production preview deployments marked `noindex`, production stays indexable | `## Common Pitfalls` Pitfall 2 (`VERCEL_ENV` build-time availability + the "Enable access to System Environment Variables" project setting), `## Code Examples` (BaseLayout noindex logic) |
| ANALYTICS-01 | Vercel Analytics tracks page views + CTA clicks via `<Analytics />`, cookieless, no consent banner | `## Common Pitfalls` Pitfall 3 (**custom `track()` events require a Pro-tier Vercel team — not available on Hobby**), `## Code Examples` (scoped `<script>` `track()` wiring per D-03's `location` schema), `## Package Legitimacy Audit` (`@vercel/analytics` verified) |
</phase_requirements>

## Summary

This phase adds SEO metadata, a sitemap/robots.txt pair, environment-aware `noindex`, and Vercel Analytics (page views + custom CTA click events) to the already-built `landing/` Astro site from Phase 43. The milestone-level research (`STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`) already resolved almost all technical plumbing: exact package versions (`@vercel/analytics@2.0.1`, `@astrojs/sitemap@3.7.3`), the Astro-native `<Analytics />` component import path, the requirement to hardcode `site` in `astro.config.mjs` rather than derive it from `VERCEL_URL`, and the `VERCEL_ENV !== 'production'` pattern for `noindex`. This research fills the three gaps CONTEXT.md flagged as unresolved: (1) how to generate the static OG image given no logo asset exists, (2) the exact `@astrojs/sitemap` `filter` syntax — including a load-bearing trailing-slash detail Astro's default `build.format: 'directory'` produces — needed to exclude `/privacy` and `/terms`, and (3) the precise vanilla-JS `track()` API and its custom-data constraints for wiring the six CTA instances to `get_started_click`/`login_click` events with a `location` property.

The single most important new finding, not previously flagged anywhere in existing research: **Vercel Web Analytics custom events (the `track()` calls this phase's ANALYTICS-01 requirement depends on) require a Pro-tier Vercel team — they are not available on the Hobby plan at all** (confirmed against `vercel.com/docs/analytics/limits-and-pricing`, last updated 2026-06-26). Page-view tracking via `<Analytics />` works on Hobby; the click-event half of ANALYTICS-01 does not, until/unless the Vercel team hosting this project is on Pro. This project's actual Vercel plan tier could not be determined from the codebase or existing planning docs — it is an **Open Question** the planner must resolve (likely via a `checkpoint:human-verify` task) before ANALYTICS-01 can be marked complete, since the custom events silently fail to appear in the dashboard on Hobby rather than erroring at build/runtime.

**Primary recommendation:** Implement all four `SEO-*` requirements as straightforward frontmatter/config additions to the existing `BaseLayout.astro` + `astro.config.mjs` + a new `public/robots.txt`. Generate the OG image once via a small standalone Node script (`satori` + `@resvg/resvg-js`, not wired into the Astro build) and commit the resulting PNG. Implement `<Analytics />` and the six `track()` call sites exactly as specified by D-03, but flag the Pro-plan gate as a blocking open question before considering ANALYTICS-01 verifiably complete in production.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Meta title/description/OG/Twitter tags | Static / Build-time (Astro SSG) | — | Rendered once into static HTML at `astro build` time; no runtime component |
| OG share image (1200×630 PNG) | Static / Build-time (one-off Node script, not part of `astro build`) | CDN/Static (`public/`) | Generated once locally, committed as a static asset, served byte-for-byte from `landing/public/` like `favicon.ico` |
| Sitemap (`sitemap-index.xml`, `sitemap-0.xml`) | Static / Build-time (`@astrojs/sitemap` integration) | — | Auto-generated from Astro's route manifest during `astro build`; zero runtime |
| `robots.txt` | CDN / Static | — | Hand-authored static file in `public/`, copied byte-for-byte to output root |
| Environment-aware `noindex` | Static / Build-time (Astro SSG, reads `import.meta.env.VERCEL_ENV`) | — | Resolved once per deployment at build time — Vercel runs a separate build for every preview/production deployment, so the env var is correct per-deploy even though the site itself is fully static at request time |
| Page-view analytics | Browser / Client | Vercel Edge (collection endpoint) | `<Analytics />` injects a client-side script that beacons to Vercel's collection endpoint on page load |
| CTA click analytics | Browser / Client | Vercel Edge (collection endpoint) | Scoped `<script>` tags call `track()` client-side on click; same collection endpoint as page views, gated by the same plan-tier restriction |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@astrojs/sitemap` | `3.7.3` | Generates `sitemap-index.xml`/`sitemap-0.xml` at build time | Already locked in milestone STACK.md `[VERIFIED: npm registry]`; official Astro-maintained integration, no viable alternative for this ecosystem |
| `@vercel/analytics` | `2.0.1` | Page-view + custom CTA click tracking, via the `./astro` subpath's `<Analytics />` component and the root `track()` export | Already locked in milestone STACK.md `[VERIFIED: npm registry]`; official Vercel package, framework-native for Astro, no adapter required |

### Supporting (new to this phase — for OG image generation only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `satori` | `0.29.0` | Renders a JSX/hyperscript-style element tree (HTML+CSS subset) to SVG | One-off Node script (`scripts/generate-og-image.mjs`), run manually/locally — not part of `astro build`. Requires an explicit font `Buffer` (TTF/OTF/WOFF; **not** WOFF2) passed via its `fonts` option — there is no "use the system font stack" mode. `[CITED: github.com/vercel/satori]` |
| `@resvg/resvg-js` | `2.6.2` | Rasterizes the SVG satori produces into a PNG buffer | Same script, second step: `new Resvg(svg).render().asPng()`. Ships prebuilt native `.node` binaries for Linux (glibc/musl, x64/arm), macOS (x64/arm64), and Windows — **no `node-gyp`/native toolchain required** on any of this repo's likely dev/CI environments. `[CITED: github.com/yisibl/resvg-js]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `satori` + `@resvg/resvg-js` (hand-composed element tree, no JSX transform needed since satori accepts plain object trees) | `node-canvas` (`canvas` npm package) drawing rect + text directly | `node-canvas` requires system Cairo/Pango libraries (`libcairo2-dev`, `libpango1.0-dev`, etc.) for native compilation on Linux — a much more fragile local/CI install than resvg-js's prebuilt-binary approach, for a script that only needs to run once. Rejected for this phase. |
| `satori` + `@resvg/resvg-js` | `@vercel/og`'s `ImageResponse` (edge/serverless function) | `@vercel/og` is designed to render OG images **per-request** at the edge (dynamic per-page images) — that's the exact pattern D-01 explicitly rejects ("Output is a one-time-generated static file... not generated per-request"). Would also require adding the `@astrojs/vercel` adapter this project deliberately avoids (STACK.md "What NOT to Use"). |
| A single generation script with a bundled font file | Design the image externally (Figma/Canva) and export a PNG | D-01 explicitly rules this out — no logo/brand-mark asset exists to compose with externally; the wordmark-on-Slate-background treatment is simple enough that a programmatic script is faster and reproducible if the Slate palette ever changes. |

**Installation (for the OG image generation script only — do not add to `landing/`'s runtime `dependencies`, these are build-tooling-only):**
```bash
npm install --save-dev satori@^0.29.0 @resvg/resvg-js@^2.6.2
```

**Version verification:** Confirmed live against the npm registry 2026-07-31:
```
npm view @astrojs/sitemap version   → 3.7.3
npm view @vercel/analytics version  → 2.0.1
npm view satori version             → 0.29.0
npm view @resvg/resvg-js version    → 2.6.2
```

## Package Legitimacy Audit

| Package | Registry | Age (first published) | Downloads (last 7 days) | Source Repo | slopcheck | Disposition |
|---------|----------|------------------------|--------------------------|--------------|-----------|-------------|
| `@vercel/analytics` | npm | 2022-10-24 (~4 yrs) | 4,499,215/wk | github.com/vercel/analytics | [OK] | Approved (already locked in milestone STACK.md) |
| `@astrojs/sitemap` | npm | 2022-03-18 (~4.5 yrs) | 2,156,138/wk | github.com/withastro/astro | [OK] | Approved (already locked in milestone STACK.md) |
| `satori` | npm | 2021-12-28 (~5 yrs) | 3,863,187/wk | github.com/vercel/satori | [OK] | Approved |
| `@resvg/resvg-js` | npm | 2021-10-09 (~5 yrs) | 2,089,031/wk | github.com/yisibl/resvg-js | [OK] | Approved |

No `postinstall` scripts detected on any of the four packages (`npm view <pkg> scripts.postinstall` returned empty for all).

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

**Note on verification method:** `slopcheck install` was run scoped to `--ecosystem npm` from `landing/` (its default ecosystem auto-detection incorrectly targeted PyPI on the first attempt, which would have installed a same-named-but-unrelated Python package — see `## Common Pitfalls` Pitfall 4 for this cross-ecosystem confusion caught live during this research session). All four packages returned `[OK]`. Because `satori` and `@resvg/resvg-js` were discovered via WebSearch before being confirmed against their official GitHub repos directly (not Context7), they are tagged `[CITED]` rather than `[VERIFIED]` per the package-name-provenance rule, despite passing both the registry check and slopcheck.

## Architecture Patterns

### Recommended File Additions (this phase only)
```
landing/
├── public/
│   ├── og-image.png          # NEW — 1200×630, generated once, committed
│   └── robots.txt            # NEW — static, references sitemap
├── scripts/
│   ├── generate-og-image.mjs # NEW — one-off Node script, NOT part of `astro build`
│   └── fonts/
│       └── Inter-SemiBold.ttf # NEW — bundled font for the script only (satori requires a Buffer, TTF/OTF/WOFF only)
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro  # MODIFIED — add description/OG/Twitter meta, env-aware noindex, <Analytics />
│   └── components/
│       ├── SiteHeader.astro  # MODIFIED — add scoped track() script (2 CTAs: nav)
│       ├── Hero.astro        # MODIFIED — add scoped track() script (1 CTA: hero)
│       ├── ValueProp.astro   # MODIFIED — add scoped track() script (1 CTA: value_prop)
│       └── ClosingCTA.astro  # MODIFIED — add scoped track() script (2 CTAs: closing)
└── astro.config.mjs          # MODIFIED — add `site`, `sitemap()` integration
```

### Pattern 1: OG Image as a One-Off Build-Tooling Script (not an Astro integration hook)

**What:** A standalone Node script under `landing/scripts/`, run manually (`node scripts/generate-og-image.mjs`) once during this phase's execution, that composes a satori element tree (Slate `--primary` background `oklch(0.39 0.035 256)`, "RealtyBase" wordmark text in `--primary-foreground`) and rasterizes it to `landing/public/og-image.png` via `@resvg/resvg-js`. The script is **not** wired into `astro build` (no custom integration hook) — D-01 is explicit that this is a one-time-generated static file, matching how `favicon.ico`/`favicon_transparent.png` already sit untouched in `public/`.
**When to use:** This phase, for the single static OG image. Re-run manually only if the Slate palette or wordmark ever changes (same manual-sync tradeoff already accepted for the copied CSS tokens per Pitfall 7 in the milestone `PITFALLS.md`).
**Example:**
```js
// scripts/generate-og-image.mjs
// Source: satori usage pattern per github.com/vercel/satori README;
// Resvg usage pattern per github.com/yisibl/resvg-js README
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'

const fontData = readFileSync(new URL('./fonts/Inter-SemiBold.ttf', import.meta.url))

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'oklch(0.39 0.035 256)', // Slate --primary
      },
      children: {
        type: 'div',
        props: {
          style: { color: 'oklch(0.985 0 0)', fontSize: 96, fontWeight: 600 }, // Slate --primary-foreground
          children: 'RealtyBase',
        },
      },
    },
  },
  {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Inter', data: fontData, weight: 600, style: 'normal' }],
  }
)

const png = new Resvg(svg).render().asPng()
writeFileSync(new URL('../public/og-image.png', import.meta.url), png)
```
Note: satori accepts a plain object element tree (no JSX/React required) — the `{ type, props: { style, children } }` shape shown above works in a plain `.mjs` file with no build step of its own. **Satori does not understand CSS custom properties or `oklch()` color functions at all** — it only accepts literal CSS values it can parse (hex/rgb/named colors, or a small set of functions); the `oklch(...)` strings shown above are illustrative of *which* Slate token to use, but the script must convert them to an equivalent hex/rgb literal before passing to satori (verify by test-rendering — this exact conversion was not runtime-verified in this research session, flagged in Assumptions Log).

### Pattern 2: Full `<head>` SEO Block in `BaseLayout.astro`

**What:** Extend the existing `Props` (`title`, `noindex?`) with a `description` prop, and add a fixed set of OG/Twitter meta tags plus the environment-driven `noindex` override, all in one place per the milestone `ARCHITECTURE.md`'s "single integration point" design.
**When to use:** This phase — every page (`index.astro`, `privacy.astro`, `terms.astro`) already renders through `BaseLayout`, so this is the only file that needs the SEO tag logic; call sites just pass a `description` string.
**Example:**
```astro
---
// src/layouts/BaseLayout.astro
import '../styles/global.css'
import { Analytics } from '@vercel/analytics/astro'

interface Props {
  title: string
  description: string
  noindex?: boolean
}

const { title, description, noindex: pageNoindex = false } = Astro.props

// Environment-aware override: force noindex on any non-production Vercel deployment,
// regardless of the per-page `noindex` prop. Read server-side in frontmatter — no
// PUBLIC_ prefix needed since this never executes in client-side JS.
// Source: PITFALLS.md Pitfall 5 (milestone research) + docs.astro.build/en/guides/environment-variables/
const isNonProduction = import.meta.env.VERCEL_ENV !== undefined && import.meta.env.VERCEL_ENV !== 'production'
const noindex = pageNoindex || isNonProduction

const siteUrl = 'https://realtybase.ca' // matches astro.config.mjs `site` — hardcoded, never derived from VERCEL_URL
const canonicalUrl = new URL(Astro.url.pathname, siteUrl).toString()
const ogImageUrl = new URL('/og-image.png', siteUrl).toString()
---
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="generator" content={Astro.generator} />
		<link rel="icon" href="/favicon.ico" sizes="any" />
		<link rel="canonical" href={canonicalUrl} />
		<title>{title}</title>
		<meta name="description" content={description} />
		{noindex && <meta name="robots" content="noindex" />}

		<meta property="og:type" content="website" />
		<meta property="og:site_name" content="RealtyBase" />
		<meta property="og:title" content={title} />
		<meta property="og:description" content={description} />
		<meta property="og:url" content={canonicalUrl} />
		<meta property="og:image" content={ogImageUrl} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />

		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content={title} />
		<meta name="twitter:description" content={description} />
		<meta name="twitter:image" content={ogImageUrl} />
	</head>
	<body>
		<slot />
		<Analytics />
	</body>
</html>
```
**Important caveat on `VERCEL_ENV` availability:** confirmed via `vercel.com/docs/environment-variables/system-environment-variables` that `VERCEL_ENV` is populated automatically for every Vercel-triggered build (both build-time and runtime), gated by the project's "Enable access to System Environment Variables" checkbox — **enabled by default for new projects** (confirmed via WebSearch cross-referencing an official Vercel GitHub discussion, MEDIUM confidence on the "default" claim specifically, since the primary doc page only documents how to enable it, not the default state explicitly). During local `npm run build` (no Vercel context), `import.meta.env.VERCEL_ENV` is `undefined` — the `isNonProduction` check above explicitly guards for `undefined` so a local build does not accidentally noindex everything; it also does not force-index anything locally beyond each page's own `noindex` prop, which is the correct fallback behavior for local dev/build.

### Pattern 3: Sitemap Config with Trailing-Slash-Correct `filter`

**What:** Add `site` and the `sitemap()` integration to `astro.config.mjs`. The `filter` predicate must match Astro's **actual built URL shape**, not the route path as written in `src/pages/`.
**When to use:** This phase, SEO-02.
**Load-bearing detail (new finding, not in milestone research):** Astro's default `build.format` is `'directory'` (confirmed via `docs.astro.build/en/reference/configuration-reference/`), meaning `src/pages/privacy.astro` builds to `dist/privacy/index.html` and `@astrojs/sitemap` emits the URL as `https://realtybase.ca/privacy/` **with a trailing slash** — not `/privacy`. A filter written as `page !== 'https://realtybase.ca/privacy'` (no trailing slash) will silently fail to exclude the page, since the string comparison never matches. This is exactly the class of bug the milestone `PITFALLS.md` Pitfall 4 warned about generically ("canonical vs. sitemap mismatch") — here it applies directly to D-02's exclusion filter.
**Example:**
```js
// astro.config.mjs
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://realtybase.ca', // hardcoded production apex — never derive from VERCEL_URL (SEO-02, PITFALLS.md Pitfall 4)
  vite: { plugins: [tailwindcss()] },
  integrations: [
    sitemap({
      // Source: docs.astro.build/en/guides/integrations-guide/sitemap/
      // Note the trailing slash — matches Astro's default build.format: 'directory' output shape.
      filter: (page) =>
        page !== 'https://realtybase.ca/privacy/' &&
        page !== 'https://realtybase.ca/terms/',
    }),
  ],
})
```
**Verification step to add to the plan:** after `astro build`, inspect `dist/sitemap-0.xml` directly and confirm it contains exactly one `<url>` entry (`https://realtybase.ca/`) — don't just trust that the `filter` predicate compiled without error, since a silent string mismatch produces no warning.

### Pattern 4: `robots.txt` Referencing the Sitemap

**What:** A static file in `public/robots.txt` (not a dynamic `src/pages/robots.txt.ts` route — STACK.md already decided against the dynamic approach for this single-domain project).
**Example:**
```
# public/robots.txt
User-agent: *
Allow: /
Disallow: /privacy
Disallow: /terms

Sitemap: https://realtybase.ca/sitemap-index.xml
```
The `Disallow` lines for `/privacy` and `/terms` are a belt-and-suspenders addition alongside their per-page `<meta name="robots" content="noindex">` tags (already shipped in Phase 43 via LEGAL-04) — `robots.txt` `Disallow` prevents crawling, while the meta tag prevents indexing even if a crawler reaches the page via an external link; using both is standard practice, not redundant, since a `Disallow`'d page can still be indexed (without content) if enough external links point to it.

### Pattern 5: Scoped `track()` Wiring Per CTA Instance (D-03 schema)

**What:** Each CTA `<a>` element gets a scoped `<script>` immediately below it (not a single global delegated listener in `BaseLayout`) — consistent with the "zero-client-JS-by-default" philosophy already established in Phase 42/43 (only the specific interactive element ships its own tiny script, nothing global/hydrated).
**Example (one CTA instance — repeat per D-03's six-instance schema):**
```astro
---
// src/components/Hero.astro
import { CTA_URLS } from '../consts'
---
<section class="bg-background px-4 py-16 text-center">
  <div class="mx-auto max-w-3xl">
    <!-- ...existing hero markup... -->
    <a
      id="hero-get-started"
      href={CTA_URLS.getStarted}
      class="bg-primary text-primary-foreground inline-block rounded-md px-6 py-4 text-sm font-semibold transition-opacity hover:opacity-90 motion-reduce:transition-none"
    >
      Get Started
    </a>
  </div>
</section>

<script>
  import { track } from '@vercel/analytics'
  document.getElementById('hero-get-started')?.addEventListener('click', () => {
    track('get_started_click', { location: 'hero' })
  })
</script>
```
Repeat this pattern for all six CTA instances per D-03:
| Component | CTA | Event name | `location` value |
|-----------|-----|------------|-------------------|
| `SiteHeader.astro` | Get Started | `get_started_click` | `nav` |
| `SiteHeader.astro` | Log in | `login_click` | `nav` |
| `Hero.astro` | Get Started | `get_started_click` | `hero` |
| `ValueProp.astro` | Get Started | `get_started_click` | `value_prop` |
| `ClosingCTA.astro` | Get Started | `get_started_click` | `closing` |
| `ClosingCTA.astro` | Log in | `login_click` | `closing` |

`track()`'s custom-data value constraints (confirmed via `vercel.com/docs/analytics/custom-events`): only `strings`, `numbers`, `booleans`, and `null` are allowed (no nested objects); event name/keys/values are each capped at 255 characters. A single `location` string property comfortably satisfies this. **On a Pro-tier team, only 2 custom-data properties per event are allowed** (8 on Pro+Web Analytics Plus) — this phase's single `location` property is well within that limit regardless of tier, so the property-count cap is not a blocker, only the plan-tier gate on custom events existing at all (see Pitfall 3 below).

### Anti-Patterns to Avoid
- **Wiring `track()` in a single global `BaseLayout` script with event delegation on `document`:** works functionally, but a per-CTA scoped script (Pattern 5) keeps each component self-contained and matches this project's established "zero global JS" convention (Phase 42 D-03) more literally — each script only exists on pages that render that specific component.
- **Using the `html`/vanilla `window.va(...)` snippet pattern instead of `import { track } from '@vercel/analytics'`:** this is Vercel's fallback for sites with genuinely no bundler/JS framework at all. Astro's `<script>` tags are processed by Vite, so the typed `track()` import works directly and is what STACK.md's "What NOT to Use" table already rejected the raw-script approach in favor of.
- **Deriving `og:image`/`twitter:image` URLs relative to `Astro.url` instead of the hardcoded `siteUrl`:** OG/Twitter crawlers require absolute URLs; a relative `/og-image.png` will not resolve correctly when the crawler fetches the page HTML from a different context than a browser would.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Sitemap XML generation/formatting | A custom `src/pages/sitemap.xml.ts` route hand-writing XML | `@astrojs/sitemap` | Handles XML escaping, `sitemap-index.xml` chunking past 45,000 URLs, and lastmod/changefreq extensibility for free; a hand-rolled route re-implements a solved problem for zero benefit at this site's scale |
| Page-view tracking beacon/cookie logic | A custom `fetch()`-based analytics pinger | `<Analytics />` from `@vercel/analytics/astro` | Already cookieless by design (satisfies the "no cookie-consent banner" requirement out of the box) and integrates with Vercel's dashboard with zero extra config — reimplementing this to avoid a well-audited first-party dependency has no upside |
| SVG→PNG rasterization for the OG image | A hand-rolled Canvas/pixel-drawing routine | `satori` + `@resvg/resvg-js` | Text layout/kerning/font-metrics is a genuinely hard problem; satori exists specifically to solve "lay out this text+box tree and emit correct SVG" so a build script doesn't have to reimplement a text renderer |

**Key insight:** Every piece of this phase has an official, already-locked-in-research library solving it — the only genuinely new construction this phase requires is the ~30-line OG image generation script (Pattern 1) and the ~10 six-times-repeated `track()` wiring snippets (Pattern 5), both of which are thin glue code around the libraries above, not reimplementations of what the libraries already do.

## Common Pitfalls

### Pitfall 1: `@astrojs/sitemap` `filter` predicate silently no-ops on a trailing-slash mismatch
**What goes wrong:** Writing `filter: (page) => page !== 'https://realtybase.ca/privacy'` (matching the route path as authored, no trailing slash) does not exclude the page, because Astro's default `build.format: 'directory'` makes the actual emitted sitemap URL `https://realtybase.ca/privacy/` (with a trailing slash). The build succeeds with no warning; `/privacy` and `/terms` end up in `sitemap.xml` anyway, directly contradicting D-02 and their own `noindex` meta tags.
**Why it happens:** `filter` receives full URL strings, and JavaScript string inequality doesn't complain about "close" mismatches — it just silently evaluates `true` for every page since neither privacy nor terms URL exactly equals the (wrong) no-trailing-slash string being compared against.
**How to avoid:** Use the trailing-slash form shown in Pattern 3, and add a build-output verification step (`cat dist/sitemap-0.xml` or grep for `<loc>` count) to the phase's verification checklist rather than trusting the config compiles cleanly.
**Warning signs:** `dist/sitemap-0.xml` contains 3 `<url>` entries instead of the expected 1.

### Pitfall 2: `VERCEL_ENV` unavailable at build time if "Enable access to System Environment Variables" is unchecked
**What goes wrong:** If the `landing` Vercel project (created in Phase 45, per DEPLOY-02) ever has this setting disabled, `import.meta.env.VERCEL_ENV` reads as `undefined` during every build — including production builds. Given the `isNonProduction` guard in Pattern 2 explicitly treats `undefined` as "don't force noindex," a disabled setting would mean **preview deployments never get the environment-based noindex override**, silently reintroducing exactly the "preview deployments indexed as duplicate content" risk the milestone `PITFALLS.md` Pitfall 5 warned about.
**Why it happens:** This is a per-project Vercel dashboard checkbox, invisible in the repo, with no build-time error if it's off — the build just proceeds with `undefined` instead of failing loudly.
**How to avoid:** When Phase 45 creates the Vercel project, explicitly verify "Enable access to System Environment Variables" is checked (WebSearch cross-reference suggests it's on by default for new projects, but this should be positively confirmed, not assumed — MEDIUM confidence on the default-enabled claim specifically). Add a post-deploy verification step for this phase: fetch a live preview deployment's HTML and grep for `<meta name="robots" content="noindex">`.
**Warning signs:** A preview deployment's page source is missing the `noindex` tag despite the code being correct.
**Phase to address:** This phase implements the logic (SEO-04); the verification that it actually fires correctly can only happen once a real preview deployment exists, which may not be until Phase 45 (DEPLOY-02) — flag this as a cross-phase verification dependency for the planner.

### Pitfall 3: Vercel Web Analytics custom events (`track()`) require a Pro-tier team — not available on Hobby
**What goes wrong:** ANALYTICS-01 requires both page-view tracking (works on any plan) and custom CTA click events via `track()`. Per official Vercel pricing docs (`vercel.com/docs/analytics/limits-and-pricing`, confirmed 2026-07-31): the "Custom Events" row shows `-` (not included) for Hobby, and `Included` starting at Pro. The official custom-events guide (`vercel.com/docs/analytics/custom-events`) additionally states this feature requires the `Custom Events` **permission**, gated by plan. On Hobby, calling `track()` from the client either fails silently or the event is dropped server-side (not verified in this research session which specific failure mode occurs — flagged in Open Questions) — there is no compile-time or obvious runtime error that would surface this during local development or even a successful production deploy.
**Why it happens:** This is a billing/plan-tier restriction, not a code or config bug — nothing in the `landing/` codebase or this phase's task list would reveal it. The milestone-level `STACK.md` already flagged the *event-volume* limit (50k/month on Hobby) as needing primary-source verification, but did not separately investigate whether custom events are gated by plan at all — that's this phase's independent finding.
**How to avoid:** Confirm the Vercel team hosting this project's `landing` project (created in Phase 45) is on Pro before considering ANALYTICS-01's CTA-click-tracking half complete. If the team is on Hobby, either (a) upgrade to Pro, or (b) flag to the user that only page-view tracking is achievable in production until upgraded, and get explicit sign-off that this is acceptable for milestone completion.
**Warning signs:** The Vercel dashboard's Analytics → Events panel shows zero events despite confirmed click-throughs and correct `track()` code deployed to production.
**Phase to address:** This phase (ANALYTICS-01) — should be an explicit `checkpoint:human-verify` gate in the plan, not an automated check, since it depends on account-level billing state outside the codebase's visibility.

### Pitfall 4: Cross-ecosystem package-name confusion during legitimacy verification (caught live in this research session)
**What goes wrong:** Running a package-legitimacy checker without explicitly specifying the target registry can silently check the wrong ecosystem. During this research session, running `slopcheck install @vercel/analytics @astrojs/sitemap satori @resvg/resvg-js` with auto-detected ecosystem defaulted to PyPI (not npm) because the checker was invoked outside a directory with clear npm signals present at invocation time, incorrectly flagged three real npm packages as "hallucinated" (they don't exist on PyPI, correctly), and — most importantly — **actually installed an unrelated, same-named `satori` package from PyPI** (a Python penetration-testing toolkit with `impacket`/`paramiko` dependencies, nothing to do with the Vercel/OG-image `satori`).
**Why it happens:** Package names collide across ecosystems more often than expected (~9% documented hallucination-adjacent rate per this project's own tooling guidance); an ecosystem-detection heuristic that guesses wrong produces confidently-wrong results with no obvious error.
**How to avoid:** Always pass `--ecosystem npm` explicitly (or run from inside `landing/` where `package.json` is present) when verifying Node packages for this project. This was corrected within this research session (the erroneous PyPI `satori` package was uninstalled; `landing/package.json`/`package-lock.json` were reverted to their pre-research state — no package changes from this research session should be present in the final diff for this phase).
**Warning signs:** A legitimacy check tool reports real, well-known packages as "does not exist" — that's a signal the wrong registry was checked, not that the packages are actually fake.
**Phase to address:** This phase's execution — when the planner/executor installs `satori`/`@resvg/resvg-js`/`@vercel/analytics`/`@astrojs/sitemap` for real, explicitly scope any legitimacy re-check to `--ecosystem npm`.

## Code Examples

### Full `public/robots.txt`
```
User-agent: *
Allow: /
Disallow: /privacy
Disallow: /terms

Sitemap: https://realtybase.ca/sitemap-index.xml
```
Source: pattern confirmed against `@astrojs/sitemap`'s default output filename (`sitemap-index.xml`, chunked `sitemap-0.xml` etc.) per `docs.astro.build/en/guides/integrations-guide/sitemap/`.

### `astro.config.mjs` (final merged state for this phase)
```js
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
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

### Per-page `description` prop usage (call-site change)
```astro
---
// src/pages/index.astro
import BaseLayout from '../layouts/BaseLayout.astro'
// ...
---
<BaseLayout
  title="RealtyBase — Real Estate Brokerage Software"
  description="RealtyBase unifies MLS-synced listings, group collaboration, and role-based access in one workspace built for real estate brokerages."
>
  <!-- ... -->
</BaseLayout>
```
(Exact copy for privacy/terms descriptions is Claude's Discretion per CONTEXT.md — draft during planning/execution, same as Phase 43's hero copy process.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `@vercel/analytics` adapter-mode (`webAnalytics: { enabled: true }` on `@astrojs/vercel`) | `<Analytics />` component from `@vercel/analytics/astro` | `@vercel/analytics@1.4.0+` (already superseded by the now-current `2.0.1`) | Already resolved by milestone STACK.md — no adapter dependency needed, confirmed still current as of this research (2.0.1, no peer dependency on Astro) |
| Astro's built-in `<Image />`/`astro:assets` for OG images baked into the build pipeline | A standalone one-off Node script outside the Astro build, for a single static (not per-page-dynamic) OG image | N/A — this is a scope decision (D-01: static, not dynamic), not a library deprecation | Simpler pipeline, no custom Astro integration hook needed, at the cost of the image only being valid until the wordmark/palette next changes (accepted tradeoff, same class as Pitfall 7's CSS token copy) |

**Deprecated/outdated:** None newly discovered this phase beyond what STACK.md already flagged (`@astrojs/tailwind` deprecated in favor of `@tailwindcss/vite` — not relevant to this phase's scope).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Satori requires converting Slate's `oklch()` CSS custom property values to literal hex/rgb before use, since satori's CSS parser does not support `oklch()` | Pattern 1 (OG image script) | Low — if wrong, the script errors loudly at generation time (satori throws on unparseable style values) rather than silently producing a wrong image; easy to catch and fix during the one-time script run |
| A2 | "Enable access to System Environment Variables" is enabled by default for new Vercel projects | Pitfall 2 | Medium — if actually disabled by default, `VERCEL_ENV` reads `undefined` on every build including production, and the `isNonProduction` guard (correctly, per its own logic) would not force-noindex anything; this degrades gracefully to "no environment-based override" rather than breaking production, but SEO-04 would not actually be satisfied until the setting is manually confirmed/enabled |
| A3 | A bundled open-source font file (e.g., Inter) visually approximates this site's system-ui font stack closely enough for a wordmark-only OG image where exact font match is not user-visible on the site itself | Pattern 1 (OG image script), Standard Stack | Low — cosmetic only; OG images are viewed in link-preview contexts (Slack/iMessage/etc.), not side-by-side with the live site, so a close-but-not-identical sans-serif is not a functional risk |
| A4 | The Vercel team hosting this project's Vercel projects (frontend, auth-callback, and the future `landing` project) is on the Hobby plan, not Pro | Summary, Pitfall 3 | High if wrong in either direction — if actually already Pro, Pitfall 3 is moot and ANALYTICS-01 is fully achievable as specified; if actually Hobby (the working assumption, since no evidence of Pro-tier usage — e.g. no indication of paid add-ons — was found anywhere in `.planning/`), the custom-events half of ANALYTICS-01 cannot be verified as working in production without an upgrade, and the planner must decide how to handle this (see Open Questions) |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Is the Vercel team hosting this project's projects on the Hobby or Pro plan?**
   - What we know: Custom events (`track()`) are Pro-tier-only per official Vercel docs (Pitfall 3). Page-view tracking works on any plan.
   - What's unclear: This project's actual Vercel account/team plan tier — nothing in `.planning/`, `landing/`, or the existing `frontend`/`auth-callback` Vercel configs reveals billing tier (it's account-level, not visible in any repo file).
   - Recommendation: The planner should insert a `checkpoint:human-verify` task asking the user to confirm the Vercel team's plan tier before/alongside the Phase 45 (Vercel project setup) work, since this phase's code can be written and deployed regardless, but ANALYTICS-01 cannot be verified "done" (dashboard shows real click events) until this is known. If Hobby, get explicit user sign-off on whether to (a) recommend a Pro upgrade, or (b) ship the code anyway and treat "custom events visible in dashboard" as a known gap pending upgrade.

2. **What exact failure mode occurs when `track()` is called on a Hobby-tier project — silent no-op, console warning, or dropped-but-logged?**
   - What we know: The official docs describe the plan gate but not the specific client-side behavior when the gate is hit.
   - What's unclear: Whether `track()` calls throw, warn, or silently no-op on Hobby, which affects whether this is even detectable via browser console during manual QA.
   - Recommendation: If Open Question 1 resolves to "Hobby confirmed," this becomes moot for scoping but still worth a quick manual check (open browser devtools console on a Hobby-tier preview, click a CTA, see whether `@vercel/analytics` logs anything) during phase execution/verification — cheap to check empirically rather than research further.

3. **Does satori's style parser accept the exact `oklch(0.39 0.035 256)` string format this repo's Slate tokens use, or does it require a pre-converted hex/rgb value?**
   - What we know: Satori's documentation and examples exclusively show hex/rgb/named CSS colors; `oklch()` is a newer CSS Color Level 4 function not confirmed as supported by satori's CSS subset parser in any source checked this session.
   - What's unclear: Whether satori has since added `oklch()` support (its docs/examples predate Slate's oklch-based token system).
   — Recommendation: During execution, convert the two Slate values needed (`--primary`: `oklch(0.39 0.035 256)`, `--primary-foreground`: `oklch(0.985 0 0)`) to hex/rgb equivalents up front (a one-time, offline color-space conversion) rather than assuming satori accepts the oklch string directly — cheaper than debugging a build failure mid-script.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js (via `landing/.nvmrc`, pinned `22.12.0`) | `astro build`, the OG image generation script | ✓ (via nvm) | Default shell `node` resolves to `v22.9.0` (below the `>=22.12.0` floor); `nvm` is installed but not auto-sourced in non-interactive shells | Explicitly run `nvm use` (or equivalent) respecting `.nvmrc` before any `npm install`/`npm run build`/script-run command in this phase's tasks — same known quirk already documented in Phase 42's STATE.md decisions, not new to this phase |
| npm | package installs | ✓ | `10.8.3` | — |
| `satori`/`@resvg/resvg-js` native binaries | OG image script | ✓ (prebuilt, no native toolchain needed) | `0.29.0` / `2.6.2` | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Node version floor (see row above) — has a known, already-established fallback (`nvm use` via `.nvmrc`).

## Security Domain

`workflow.nyquist_validation` is `false` in `.planning/config.json`, so the Validation Architecture section is omitted per instructions. `security_enforcement` is absent from `.planning/config.json`, which per protocol means enabled — included below, scoped to what's actually relevant for a fully static marketing site with no auth, no user input, and no data persistence.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No authentication surface exists on `landing/` — CTAs link out to `app.realtybase.ca`'s own auth, which is out of this phase's/project's scope |
| V3 Session Management | No | No sessions/cookies are set by `landing/` — `<Analytics />` is explicitly cookieless (confirmed by Vercel's own "Privacy-friendly" positioning and this milestone's "no cookie-consent banner" requirement, which would be violated if it set cookies) |
| V4 Access Control | No | No access-controlled resources on this static site |
| V5 Input Validation | No | No user input is accepted anywhere on `landing/` (no forms, no query-param-driven rendering) |
| V6 Cryptography | No | No secrets, tokens, or cryptographic operations on this static site |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Malicious/typosquatted OG-image-generation dependency injected at build time (supply-chain) | Tampering | Package Legitimacy Audit above (all four new/existing packages confirmed `[OK]` via slopcheck + registry + source-repo cross-check) |
| Sensitive internal env vars leaking into client-visible static HTML via a misused `import.meta.env.*` read in frontmatter | Information Disclosure | Only `VERCEL_ENV` (a non-sensitive, Vercel-documented public-safe value) is read in this phase's frontmatter; no `PUBLIC_`-prefixed or otherwise client-exposed leakage risk introduced, since frontmatter execution is server/build-side only and none of the values read here are written into any client-side script |

## Sources

### Primary (HIGH confidence)
- `vercel.com/docs/analytics/custom-events` (fetched 2026-07-31) — `track()` API, custom-data constraints (strings/numbers/booleans/null only, 255-char cap, 2 properties on Pro/8 on Plus), Astro import path
- `vercel.com/docs/analytics/limits-and-pricing` (fetched 2026-07-31, last updated 2026-06-26) — confirmed Custom Events row is `-` (not included) on Hobby, `Included` on Pro+
- `vercel.com/docs/environment-variables/system-environment-variables` (fetched 2026-07-31) — `VERCEL_ENV` values/availability, "Enable access to System Environment Variables" setting
- `docs.astro.build/en/guides/environment-variables/` (fetched 2026-07-31) — `import.meta.env.*` server-side-only availability without `PUBLIC_` prefix in frontmatter
- `docs.astro.build/en/reference/configuration-reference/` (fetched 2026-07-31) — `build.format` default `'directory'`, `trailingSlash` default `'ignore'`
- `docs.astro.build/en/guides/integrations-guide/sitemap/` (fetched 2026-07-31) — `filter` option exact semantics (full-URL string comparison)
- `github.com/vercel/satori` (fetched 2026-07-31) — Node.js usage pattern, explicit font-Buffer requirement, no-JSX-required element tree shape
- `github.com/yisibl/resvg-js` (fetched 2026-07-31) — `Resvg`/`.render()`/`.asPng()` API, prebuilt-binary platform coverage
- `npm view @vercel/analytics/@astrojs/sitemap/satori/@resvg/resvg-js version/time.created/repository.url/scripts.postinstall` — live npm registry, verified 2026-07-31
- `npmjs.com` download-count API (`api.npmjs.org/downloads/point/last-week/<pkg>`) — verified 2026-07-31, all four packages 2M-4.5M weekly downloads
- Direct codebase inspection: `landing/src/layouts/BaseLayout.astro`, `landing/src/consts.ts`, `landing/astro.config.mjs`, `landing/package.json`, `landing/src/components/{SiteHeader,Hero,ValueProp,ClosingCTA,SiteFooter}.astro`, `landing/src/pages/{index,privacy}.astro`, `landing/src/styles/global.css` — confirmed current baseline (4× Get Started, 2× Log in CTA count matching D-03; existing `noindex?` prop shape; Slate `--primary`/`--primary-foreground` oklch values)
- `.planning/phases/43-home-page-legal-pages/43-VERIFICATION.md` — confirmed CTA URL/count baseline (4× `/create`, 2× `/auth/login`) matches D-03's event schema exactly

### Secondary (MEDIUM confidence)
- WebSearch "Vercel Automatically expose System Environment Variables build time default enabled" — cross-referenced against an official Vercel GitHub discussion confirming default-enabled behavior for new projects; not fetched directly from a page that states the default explicitly (the primary doc page only documents the toggle, not its default state)
- `slopcheck` tool output (v0.6.1, local install) — legitimacy verification for all four packages, `[OK]` across the board once correctly scoped to `--ecosystem npm`

### Tertiary (LOW confidence)
- WebSearch summaries of third-party blog posts on Astro OG-image generation (anav.dev, snorre.io, dietcode.io, jilles.me, mfyz.com) — used only to identify satori+resvg as the standard combo; all load-bearing implementation details (exact API calls, font requirements) were re-verified against the two packages' own official GitHub repos before being included in Code Examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all four packages verified against live npm registry + official source repos + slopcheck, versions cross-checked against milestone STACK.md
- Architecture: HIGH — SEO tag/sitemap/robots.txt/analytics patterns all confirmed against official Astro/Vercel docs; OG image script pattern MEDIUM (satori's `oklch()` support unconfirmed, flagged as Open Question 3)
- Pitfalls: HIGH for the sitemap trailing-slash and cross-ecosystem-confusion findings (both directly observed/reproduced in this research session); MEDIUM for the Vercel plan-tier gate (confirmed via official docs, but this project's actual plan tier is unknown — the pitfall's *existence* is HIGH confidence, its *applicability to this project* is unconfirmed)

**Research date:** 2026-07-31
**Valid until:** 30 days (stable, mature libraries; the one fast-moving risk is Vercel's own plan/pricing terms, worth a quick re-check if execution is delayed past a few weeks)

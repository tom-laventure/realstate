# Phase 44: SEO Basics + Analytics - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

The `landing/` site becomes discoverable and correctly indexed in production while non-production (preview) deploys stay out of search results, and CTA engagement becomes measurable. Concretely: meta title/description + Open Graph/Twitter card tags (including a static OG share image), `sitemap.xml` + `robots.txt` with a hardcoded production apex domain, environment-aware `noindex` on non-production deploys, and Vercel Analytics tracking page views plus "Get Started"/"Log in" click events — cookieless, no consent banner.

Maps to REQUIREMENTS.md: SEO-01, SEO-02, SEO-03, SEO-04, ANALYTICS-01.

</domain>

<decisions>
## Implementation Decisions

### OG Share Image (SEO-01)
- **D-01:** No logo/brand-mark image asset exists anywhere in the codebase (confirmed in Phase 43 D-01 — nav uses a text-only wordmark; `favicon_transparent.png` is a 32×32 icon, not a wordmark mark). The 1200×630 OG image must therefore be **generated programmatically** (e.g. Satori/resvg or an Astro build-time script) rather than hand-designed or supplied externally — a Slate-colored background with the "RealtyBase" text wordmark, consistent with D-01's text-only brand treatment. Output is a one-time-generated static file checked into `landing/public/og-image.png` (STACK.md/ARCHITECTURE.md already establish it lives in `public/`, not generated per-request — this is a fully static site).

### Sitemap Scope (SEO-02)
- **D-02:** `@astrojs/sitemap`'s `filter` option must exclude `/privacy` and `/terms` from `sitemap.xml`. Both pages are always `noindex`'d regardless of environment (Phase 43 D-09 / LEGAL-03/04) — listing them in the sitemap while telling crawlers not to index them is a self-contradictory signal. Only `/` (and any future indexable routes) should appear in the sitemap.

### CTA Analytics Event Schema (ANALYTICS-01)
- **D-03:** The home page has 4 "Get Started" CTA instances (nav, hero, value-prop, closing) and 2 "Log in" instances (nav, closing). Custom `track()` calls must **distinguish which instance was clicked**, not just track by label: two event names — `get_started_click` and `login_click` — each with a `location` property whose value is one of `nav` | `hero` | `value_prop` | `closing` (only the two applicable values apply to `login_click`: `nav`, `closing`). This preserves per-placement conversion visibility that a flat `cta_click` event would lose.

### Claude's Discretion
- Exact meta description copy per page (home/privacy/terms) — draft succinct ~150-160 char descriptions grounded in existing page content during planning/execution, same pattern as Phase 43's hero copy (drafted then reviewed before ship), not locked here.
- `twitter:card` value (`summary_large_image` is the correct default for a 1200×630 image — no need to re-litigate).
- Exact OG image generation tooling choice (Satori vs. a plain Astro/Canvas script) — implementation detail, not a product decision.
- `VERCEL_ENV`-driven noindex wiring mechanics (combining page-level `noindex` prop with environment-based forcing) — already fully specified by `.planning/research/PITFALLS.md` Pitfall 5, no ambiguity remains.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §SEO/§Analytics — SEO-01–04, ANALYTICS-01 (exact requirement text), LAND-11 (deferred UTM tracking, out of scope this phase)
- `.planning/ROADMAP.md` Phase 44 section — goal, success criteria, depends-on Phase 43

### Milestone Research (already resolves most technical plumbing for this phase)
- `.planning/research/STACK.md` — exact package versions (`@vercel/analytics@2.0.1`, `@astrojs/sitemap@3.7.3`), the Astro-native `<Analytics />` component pattern (no adapter needed), static single `robots.txt` decision, `astro add sitemap` scaffolding command
- `.planning/research/ARCHITECTURE.md` §Pattern 4 — Vercel Analytics via component not adapter; `BaseLayout.astro` as the single place for meta/OG/sitemap-link/Analytics
- `.planning/research/PITFALLS.md` Pitfall 4 (sitemap `site` must be hardcoded to `https://realtybase.ca`, never derived from `VERCEL_URL`) and Pitfall 5 (environment-aware `noindex` via `VERCEL_ENV !== 'production'`, not `import.meta.env.PROD`)
- `.planning/research/FEATURES.md` line 32 — OG image rationale (brokerage decision-makers share links internally before clicking; a broken/generic preview undercuts trust)
- `.planning/research/SUMMARY.md` — consolidated Phase 44 deliverable list

### Prior Phase Decisions (carried forward)
- `.planning/phases/43-home-page-legal-pages/43-CONTEXT.md` D-01 — no logo image asset exists, text-only wordmark (drives D-01 above)
- `.planning/phases/43-home-page-legal-pages/43-CONTEXT.md` D-09 — legal pages always `noindex`, placeholder-pending-review status (drives D-02 above)
- `.planning/phases/43-home-page-legal-pages/43-VERIFICATION.md` — confirms current CTA URL/count baseline (4× Get Started, 2× Log in) that D-03's event schema must match exactly

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `landing/src/consts.ts`: `SITE_NAME`, `CTA_URLS`, `CONTACT_EMAIL` — single source of truth for CTA URLs; any analytics `location`/click wiring should read CTA hrefs from here, not hardcode them again.
- `landing/src/layouts/BaseLayout.astro`: already has a `noindex?: boolean` prop (default `false`) wired to a conditional `<meta name="robots">` tag. This phase extends it with meta description, OG/Twitter tags, and the environment-based noindex override — it does not replace the existing prop contract.
- `landing/public/`: existing static-asset location (`favicon.ico`, `favicon_transparent.png`) — `og-image.png` belongs alongside these.

### Established Patterns
- Zero-client-JS-by-default philosophy (Phase 42 D-03, Phase 43 D-03) — `<Analytics />` itself is an accepted exception (explicit milestone target), but custom `track()` calls should be scoped `<script>` tags attached only to the CTA elements, not a global framework/hydration island.
- `landing/astro.config.mjs` currently has no `site` value set and only the Tailwind Vite plugin — this phase is the first to add Astro integrations (`sitemap`) and set `site`.

### Integration Points
- `BaseLayout.astro` `<head>` is the single integration point for meta/OG tags, the sitemap `<link>` (if used), and `<Analytics />` — matches `ARCHITECTURE.md`'s stated design.
- CTA `<a>` elements live in `SiteHeader.astro`, `Hero.astro`, `ValueProp.astro`, `ClosingCTA.astro` — each needs its own scoped tracking script per D-03's location values.

</code_context>

<specifics>
## Specific Ideas

No specific visual/copy references beyond what's captured in Decisions above — this phase is infrastructure-leaning (meta tags, build config, analytics wiring) rather than new visible UI.

</specifics>

<deferred>
## Deferred Ideas

- LAND-11 (UTM/conversion-tracking params on CTA links) — explicitly out of scope per REQUIREMENTS.md, v2 candidate; not raised during this discussion but noted here for completeness since it's analytics-adjacent.

### Reviewed Todos (not folded)
None — the one open todo (`arch-brokerage-listing-access.md`) is unrelated to this phase's scope (backend listing-access architecture, not landing-site SEO/analytics); `todo.match-phase` returned zero matches.

</deferred>

---

*Phase: 44-seo-basics-analytics*
*Context gathered: 2026-07-31*

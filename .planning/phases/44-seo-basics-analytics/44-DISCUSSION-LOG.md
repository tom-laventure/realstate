# Phase 44: SEO Basics + Analytics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 44-seo-basics-analytics
**Areas discussed:** OG image sourcing, CTA analytics event schema, sitemap scope

Conducted via the project's mandatory `grill-me` pre-discussion interview (per CLAUDE.md's Feature Discussion Policy), after milestone-level research (`STACK.md`/`ARCHITECTURE.md`/`PITFALLS.md`) had already resolved most of the phase's technical plumbing.

---

## OG Image Source

| Option | Description | Selected |
|--------|-------------|----------|
| Generate programmatically | Satori/resvg or an Astro build step renders the Slate background + "RealtyBase" wordmark into a PNG at `public/og-image.png` | ✓ |
| I'll supply a finished asset | User provides a designed 1200×630 PNG externally | |
| Simple static HTML/CSS screenshot | Build a standalone HTML page, manually screenshot/export once | |

**User's choice:** Generate programmatically (Recommended)
**Notes:** No logo/brand-mark asset exists anywhere in the codebase (confirmed via Phase 43 D-01) — only a text wordmark and a 32×32 favicon. Programmatic generation keeps the treatment consistent with the text-only brand identity without needing external design tooling.

---

## CTA Analytics Event Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Track with a location property | Two event names (`get_started_click`, `login_click`) each carrying a `location` property (`nav`/`hero`/`value_prop`/`closing`) | ✓ |
| Track by label only | Single `cta_click` event with a `label` property, no location breakdown | |

**User's choice:** Track with a location property (Recommended)
**Notes:** Home page has 4 distinct "Get Started" CTA instances and 2 "Log in" instances (confirmed via `43-VERIFICATION.md`'s CTA-count audit). Location-level tracking preserves per-placement conversion visibility.

---

## Sitemap Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude /privacy and /terms | Use `@astrojs/sitemap`'s `filter` option to omit always-noindex legal pages | ✓ |
| Include all routes | List every static page regardless of noindex status | |

**User's choice:** Exclude /privacy and /terms (Recommended)
**Notes:** Both legal pages are permanently `noindex`'d (Phase 43 D-09) — including them in the sitemap would send crawlers a contradictory signal.

---

## Claude's Discretion

- Exact meta description copy per page — drafted during planning/execution, reviewed before ship (mirrors Phase 43's copy-drafting pattern)
- `twitter:card` value (`summary_large_image`)
- OG image generation tooling choice (Satori vs. plain script)
- `VERCEL_ENV`-based noindex wiring mechanics — fully specified already by `PITFALLS.md` Pitfall 5

## Deferred Ideas

- LAND-11 (UTM/conversion-tracking params on CTAs) — already out of scope per REQUIREMENTS.md as a v2 candidate; noted for completeness, not raised as new scope creep during this discussion.

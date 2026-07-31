# Phase 43: Home Page & Legal Pages - Research

**Researched:** 2026-07-30
**Domain:** Static Astro/Tailwind marketing site content — home page composition + placeholder legal pages
**Confidence:** HIGH

## Summary

This phase fills in `landing/`'s existing Phase 42 scaffold (`BaseLayout.astro`, Slate `global.css` tokens, bare `index.astro`) with real content: a composed home page (`SiteHeader`, `Hero`, `ValueProp`, `FeatureGrid`, `ClosingCTA`, `SiteFooter`) plus two new routes (`/privacy`, `/terms`) carrying placeholder legal text with a visible pending-review banner and `noindex` meta tag. Everything ships as zero-client-JS static HTML — Astro server components only, no hydration, no framework islands. The only new dependency is `@lucide/astro` (icons rendered as build-time inline SVG), which is confirmed legitimate (official Lucide org, npm `[OK]`, no postinstall script) and Astro-7-compatible.

Almost all requirements, copy, spacing/color/typography, and even exact feature-pair wording are already locked in `43-CONTEXT.md` and `43-UI-SPEC.md` — this research exists to fill the remaining structural/implementation gaps those documents leave open: how `BaseLayout.astro` needs to change to support per-page `noindex` and a build-time copyright year, the exact heading-hierarchy plan across all 5 pages (home + 2 legal + implicit structure), the `@lucide/astro` import pattern, and the specific pitfalls (cross-origin CTAs, placeholder-legal-text visibility, semantic HTML) that apply directly to this phase's build, not later phases.

**Primary recommendation:** Extend `BaseLayout.astro` with two new optional props (`noindex?: boolean`, and a `description`/head-slot mechanism is NOT needed this phase) before writing any page content; centralize the two cross-origin CTA URLs and internal nav links in a new `src/consts.ts`; build components in the dependency order Header/Footer → Hero → ValueProp → FeatureGrid → ClosingCTA → assemble `index.astro` → `privacy.astro`/`terms.astro` (can run in parallel with home-page component work once `BaseLayout` is extended).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Home page content (Hero, ValueProp, FeatureGrid, ClosingCTA) | CDN / Static | — | Astro compiles `.astro` components to static HTML at build time; Vercel Edge serves the pre-built file. No SSR, no server tier exists in this project. |
| Nav / footer (SiteHeader, SiteFooter) | CDN / Static | — | Same — static HTML fragments included in every page via `BaseLayout`. |
| Legal pages (`/privacy`, `/terms`) + pending-review banner | CDN / Static | — | Static HTML, no dynamic data. `noindex` is emitted as a static `<meta>` tag at build time, not computed per-request. |
| Icon rendering (`@lucide/astro`) | CDN / Static (build-time) | — | `@lucide/astro` icons are Astro server components — they render to inline `<svg>` markup during `astro build` and ship zero runtime JS. There is no client/browser tier involvement at all. |
| CTA navigation (Get Started / Log in) | Browser / Client | — | The only "dynamic" behavior in this phase: a plain `<a href>` the browser navigates on click, to a different origin (`app.realtybase.ca`). No JS-driven routing. |
| Footer copyright year | CDN / Static (build-time) | — | `new Date().getFullYear()` runs in Astro frontmatter (Node, at build time), emitting a static number into HTML — not a client-side computation, so it does not violate the zero-JS lock. |
| CSS hover/transition polish (D-03) | Browser / Client (CSS engine only) | — | Handled entirely by the browser's CSS engine (`:hover`, `transition`, `prefers-reduced-motion` media query) — no JavaScript execution of any kind. |

**Note:** This project has no Frontend-Server/SSR tier, API/Backend tier, or Database tier in scope for this phase — `landing/` is architecturally isolated from `backend/`/`frontend/` per Phase 42's lock (see `ARCHITECTURE.md`). Every capability in this phase resolves to CDN/Static (build-time) or Browser/Client (CSS/navigation only).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAND-01 | Hero names audience + value prop, understandable in 5s, above the fold | UI-SPEC locks exact hero eyebrow/headline/subhead copy; Typography section defines Display-size `<h1>` treatment. See Code Examples: Hero component. |
| LAND-02 | Consistent "Get Started" CTA at top + bottom, links to `app.realtybase.ca/create` | Pitfall 3 (cross-origin absolute URLs) + centralized `consts.ts` pattern below. D-02 adds a third touchpoint (post-ValueProp). |
| LAND-03 | Secondary "Log in" CTA → `app.realtybase.ca/auth/login` | Same `consts.ts` pattern; UI-SPEC locks visually-secondary styling. |
| LAND-04 | 3-6 icon+text features section (locked to 7 per D-04/D-05) | `@lucide/astro` install/import pattern (Code Examples); D-05's grid-grouping layout guidance from UI-SPEC. |
| LAND-05 | Minimal nav bar, no dead links | `SiteHeader.astro` pattern below; nav links sourced from `consts.ts`, both CTA hrefs verified live (per CONTEXT's "CTA targets" section). |
| LAND-06 | Footer: Privacy/Terms links, copyright, contact email | `SiteFooter.astro` pattern; build-time `getFullYear()` example; footer must ship only once `/privacy` and `/terms` routes exist (Feature Dependency note in FEATURES.md). |
| LAND-08 | Mobile-responsive + semantic HTML (1 h1, sequential h2s, alt text) | Heading Hierarchy Plan section below (per-page h1/h2 map); Common Pitfalls "Semantic HTML" entry; Tailwind responsive-class patterns already used in `frontend/`. |
| LEGAL-01 | Privacy Policy placeholder, standard SaaS section headings | FEATURES.md's 13-section heading list (already canonical, not re-derived here) — implementation pattern in Code Examples. |
| LEGAL-02 | Terms of Service placeholder, standard SaaS section headings | FEATURES.md's 14-section heading list — same pattern; ToS §5 must stay generic on pricing (already flagged in CONTEXT canonical refs). |
| LEGAL-03 | Visible "pending legal review" banner on both legal pages | UI-SPEC locks exact copy + `TriangleAlert` icon; Pitfall 6 (placeholder text mistaken for final) — banner-component pattern in Code Examples. |
| LEGAL-04 | Both legal pages `noindex` | BaseLayout extension pattern (Code Examples) — simple per-page meta tag, not the environment-aware `noindex` needed in Phase 44 for previews. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Astro | 7.1.6 (already installed) | Static site generator, file-based routing | Locked in Phase 42; no change this phase. |
| Tailwind CSS | 4.3.3 via `@tailwindcss/vite` (already installed) | Utility-class styling, Slate tokens | Locked in Phase 42; no change this phase. |
| `@lucide/astro` | ^1.28.0 [VERIFIED: npm registry + lucide.dev official docs] | Build-time inline-SVG icon components for the 7 FeatureGrid pairs + `TriangleAlert` legal banner icon | Official current package name for Lucide-in-Astro (the older `lucide-astro` package, last published at `0.556.0`, is the pre-rename legacy path per Lucide's own migration guide — do not install it). Zero client JS, matches the phase's CSS-only-motion lock (D-03). |

**Installation:**
```bash
cd landing && npm install @lucide/astro
```

**Version verification:** `npm view @lucide/astro version` → `1.28.0` (confirmed live 2026-07-30). `npm view @lucide/astro peerDependencies` → `{ astro: '^4 || ^5 || ^6 || ^7' }`, compatible with the installed Astro `7.1.6`. First published 2025-04-02, actively maintained (28 versions published, latest same day as most other 1.x releases), repository confirmed at `github.com/lucide-icons/lucide` (the same org that publishes `lucide-react`, already the app's only permitted icon library per `CLAUDE.md`).

### Supporting
None — no other new packages needed this phase. `@astrojs/sitemap`, `@vercel/analytics/astro`, and any SEO-integration packages are explicitly Phase 44 scope (see `REQUIREMENTS.md` traceability table).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@lucide/astro` | `astro-icon` + `@iconify-json/lucide` | `astro-icon` adds an extra abstraction layer (icon-name-as-string lookup) for no benefit here since only ~8 specific icons are needed; `@lucide/astro`'s direct named-import pattern is simpler and matches `frontend/`'s `lucide-react` mental model most closely. |
| `@lucide/astro` | Hand-copy raw SVG markup per icon | Loses tree-shaking, stroke-width/size consistency, and future icon-set updates for zero real benefit; explicitly what "Don't Hand-Roll" below argues against. |
| Manual `<meta name="robots">` on 2 pages | `astro-noindex` integration package | That package's job is environment-aware `noindex` (prod vs. preview) — Phase 44 scope, not this phase's simpler "always noindex while placeholder" requirement (LEGAL-04). Installing it now would be premature scope for a 2-page, always-on flag. A plain per-page prop on `BaseLayout` is sufficient and avoids a second Phase 44 rework. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@lucide/astro` | npm | ~16 months (first published 2025-04-02) | Not independently pulled this session; confirmed via official `lucide-icons` org repo + peer-dep metadata instead | github.com/lucide-icons/lucide | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

slopcheck was available and run this session (`slopcheck install @lucide/astro --ecosystem npm`) — result `[OK]`, one package scanned, zero flagged. `npm view @lucide/astro scripts.postinstall` returned empty (no postinstall script) — no elevated risk signal.

## Architecture Patterns

### System Architecture Diagram

```
[Browser request: realtybase.ca/ or /privacy or /terms]
        │
        ▼
[Vercel Edge — serves pre-built static HTML from landing/dist/]
        │
        ├── index.html  ──► composed at build time from:
        │                     BaseLayout(noindex=false)
        │                       └─ SiteHeader (nav: wordmark, Log in, Get Started)
        │                       └─ Hero (h1 + subhead + CTA #1)
        │                       └─ ValueProp (h2 + body + CTA #2, D-02)
        │                       └─ FeatureGrid (h2 + 7× icon+text pairs, @lucide/astro)
        │                       └─ ClosingCTA (h2 + body + CTA #3 + Log in link)
        │                       └─ SiteFooter (Privacy/Terms links, © year, contact email)
        │
        ├── privacy.html ──► BaseLayout(noindex=true)
        │                       └─ SiteHeader / SiteFooter (shared)
        │                       └─ h1 "Privacy Policy" + pending-review banner (TriangleAlert)
        │                       └─ 13 sequential h2 sections (FEATURES.md headings)
        │
        └── terms.html   ──► BaseLayout(noindex=true)
                                └─ SiteHeader / SiteFooter (shared)
                                └─ h1 "Terms of Service" + pending-review banner
                                └─ 14 sequential h2 sections (FEATURES.md headings)

[Any CTA click] ──► same-tab navigation, absolute URL ──► app.realtybase.ca/create
                                                       or  app.realtybase.ca/auth/login
                     (different Vercel project, different origin — no shared state)
```

A reader can trace the primary use case (visitor lands, reads hero, clicks Get Started) top-to-bottom: request → static HTML assembly from shared layout + components → CTA click exits to a different origin entirely. There is no server round-trip after the initial static asset is served.

### Recommended Project Structure

```
landing/src/
├── consts.ts                # NEW this phase — CTA URLs, nav links, site name (see Pattern 1 below)
├── layouts/
│   └── BaseLayout.astro     # EXTEND — add `noindex?: boolean` prop, keep existing `title` prop
├── components/               # NEW this phase — all 6 files
│   ├── SiteHeader.astro      # wordmark + nav (Log in, Get Started)
│   ├── Hero.astro            # h1 + subhead + CTA #1
│   ├── ValueProp.astro       # h2 + body + CTA #2 (D-02)
│   ├── FeatureGrid.astro     # h2 + 7 icon+text pairs
│   ├── ClosingCTA.astro      # h2 + body + CTA #3 + Log-in text link
│   └── SiteFooter.astro      # legal links, © year, contact email
└── pages/
    ├── index.astro           # REPLACE Phase-42 proof-of-tokens content — assembles all 6 components
    ├── privacy.astro         # NEW — h1 + banner + 13 sections
    └── terms.astro           # NEW — h1 + banner + 14 sections
```

This matches `ARCHITECTURE.md`'s recommended split exactly (already-approved research, not re-derived here) — the only addition this research surfaces beyond that file is `consts.ts` needing to exist *before* any component references a CTA URL, and `BaseLayout.astro` needing to change *before* `privacy.astro`/`terms.astro` are written (both depend on the new `noindex` prop).

### Pattern 1: Centralized CTA/Nav Constants (`src/consts.ts`)

**What:** A single exported object/consts file holding the two cross-origin CTA URLs and the internal nav link list, imported by every component that renders a link.
**When to use:** Every CTA and nav link in this phase — required by Pitfall 3 (cross-origin link mistakes are easy to introduce ad hoc; centralizing makes the absolute-URL requirement a one-time decision, not a per-call-site judgment call).
**Example:**
```typescript
// src/consts.ts
export const SITE_NAME = 'RealtyBase'

export const CTA_URLS = {
  getStarted: 'https://app.realtybase.ca/create',
  login: 'https://app.realtybase.ca/auth/login',
} as const

export const LEGAL_LINKS = {
  privacy: '/privacy',
  terms: '/terms',
} as const

export const CONTACT_EMAIL = 'hello@realtybase.ca'
```
```astro
---
// src/components/SiteHeader.astro
import { CTA_URLS, SITE_NAME } from '../consts'
---
<header class="border-border border-b">
  <nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
    <a href="/" class="text-primary text-lg font-semibold">{SITE_NAME}</a>
    <div class="flex items-center gap-4">
      <a href={CTA_URLS.login} class="text-foreground text-sm font-semibold">Log in</a>
      <a href={CTA_URLS.getStarted} class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold">
        Get Started
      </a>
    </div>
  </nav>
</header>
```

### Pattern 2: `@lucide/astro` Direct Import (Build-Time Inline SVG)

**What:** Import each icon component by name directly from `@lucide/astro`; render as a normal Astro/JSX-like element with `size`/`class`/`stroke-width` props. No client directive needed anywhere — these are Astro components, not framework islands.
**When to use:** All 7 FeatureGrid icons (`RefreshCw`, `Users`, `ShieldCheck`, `KeyRound`, `Globe`, `Share2`, `Filter` — per UI-SPEC's locked icon assignments) plus `TriangleAlert` for the legal-page banner.
**Example:**
```astro
---
// src/components/FeatureGrid.astro
import { RefreshCw, Users, ShieldCheck, KeyRound, Globe, Share2, Filter } from '@lucide/astro'

const features = [
  { icon: RefreshCw, title: 'MLS/board-synced listings', body: 'Listings sync automatically from your connected MLS/RETS board — no manual re-entry.' },
  { icon: Users, title: 'Group collaboration', body: 'Agents organize listings into groups with shared comments, ratings, documents, and dates.' },
  { icon: ShieldCheck, title: 'Multi-tenant isolation', body: 'Every brokerage gets its own fully isolated, secure workspace.' },
  { icon: KeyRound, title: 'Role-based access', body: 'Owner, admin, and agent tiers control who can manage listings, invite staff, and configure the brokerage.' },
  { icon: Globe, title: 'Custom domain', body: 'Run RealtyBase on your own branded domain instead of a shared subdomain.' },
  { icon: Share2, title: 'Client sharing', body: 'Invite clients into specific groups to view curated listings directly.' },
  { icon: Filter, title: 'Smart filter-set/client pairing', body: 'Filter sets automatically pair client groups with matching listings.' },
]
---
<section class="py-16 lg:py-16">
  <h2 class="text-foreground mb-8 text-center text-[28px] font-semibold">
    <!-- FeatureGrid H2 copy: not locked in UI-SPEC — draft during execution, e.g. "Everything your brokerage needs, in one place" -->
  </h2>
  <div class="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
    {features.map(({ icon: Icon, title, body }) => (
      <div class="bg-card border-border rounded-lg border p-6">
        <Icon class="text-primary mb-4" size={28} aria-hidden="true" />
        <p class="text-foreground mb-2 text-sm font-semibold">{title}</p>
        <p class="text-muted-foreground text-base">{body}</p>
      </div>
    ))}
  </div>
</section>
```
Icons are decorative (paired with adjacent visible text), so `aria-hidden="true"` on the `<Icon>` is the correct accessibility pattern — no `alt`/`aria-label` needed on the SVG itself since the text label already conveys the meaning. This satisfies LAND-08's alt-text intent without literally needing `alt` (icons aren't `<img>` elements; the equivalent semantic requirement is "not exposed as meaningless content to a screen reader," which `aria-hidden` handles).

### Pattern 3: Per-Page `noindex` via a `BaseLayout` Prop

**What:** Add an optional boolean prop to `BaseLayout.astro` that conditionally renders `<meta name="robots" content="noindex" />`. Pages that need it pass `noindex` explicitly; the home page omits it (defaults to indexable).
**When to use:** `/privacy` and `/terms` only, this phase (LEGAL-04). This is deliberately simpler than the environment-aware `noindex` pattern Phase 44/Pitfall 5 will need for preview deployments — do not build that generalized version now; it's out of this phase's scope and would be premature (the phase's own placeholder pages need *unconditional* `noindex` regardless of environment, since the content itself, not the deployment tier, is what's non-final).
**Example:**
```astro
---
// src/layouts/BaseLayout.astro (extended)
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
```astro
---
// src/pages/privacy.astro
import BaseLayout from '../layouts/BaseLayout.astro'
---
<BaseLayout title="Privacy Policy — RealtyBase" noindex>
  <!-- h1 + banner + sections -->
</BaseLayout>
```

### Pattern 4: Build-Time Copyright Year (No Client JS)

**What:** Compute `new Date().getFullYear()` in the Astro frontmatter (runs in Node during `astro build`), interpolate into static HTML.
**When to use:** `SiteFooter.astro`'s copyright line (LAND-06, UI-SPEC-locked copy: `"© {current year} RealtyBase. All rights reserved."`).
**Example:**
```astro
---
// src/components/SiteFooter.astro
const year = new Date().getFullYear()
---
<p class="text-sidebar-foreground/70 text-sm">© {year} RealtyBase. All rights reserved.</p>
```
This value is frozen at build time (each new production deploy recomputes it) — correct behavior for a marketing site with no runtime, and explicitly confirmed by CONTEXT.md D-08/copy table as compliant with the zero-client-JS lock.

### Heading Hierarchy Plan (LAND-08 semantic check)

| Page | `<h1>` | `<h2>` sequence |
|------|--------|-----------------|
| `index.astro` | Hero headline (exactly one, in `Hero.astro`) | ValueProp heading → FeatureGrid heading → ClosingCTA heading (3 total, one per section, in DOM order — no skipped levels, no `<h3>` needed anywhere on the home page since feature-pair titles are visually bolded `<p>`/`<span>` text, not headings — they're too granular/repetitive to be meaningful landmarks) |
| `privacy.astro` | "Privacy Policy" | 13 sequential `<h2>`s, one per FEATURES.md section (Introduction, Definitions, Information We Collect, ... Contact Us) |
| `terms.astro` | "Terms of Service" | 14 sequential `<h2>`s, one per FEATURES.md section |

`SiteHeader`/`SiteFooter` must not introduce any `<h1>`/`<h2>` (nav/footer headings, if any, should be `<p>`/visually-styled non-heading text or, if a footer column heading is desired, `<h3>`/`<span>` — never compete with the page's single `<h1>` or interrupt the `<h2>` sequence). This directly operationalizes LAND-08's "one `<h1>` per page, sequential `<h2>`s" success criterion into a concrete per-file checklist the planner can turn into verification tasks.

### Anti-Patterns to Avoid
- **Relative CTA paths (`href="/create"`):** 404s on the marketing site's own origin — always use the full `https://app.realtybase.ca/...` URL (Pitfall 3). Centralizing in `consts.ts` (Pattern 1) prevents this by construction.
- **Hardcoding the same CTA URL string at 3+ call sites:** even though URLs are static/no env-driven config exists yet, inlining `"https://app.realtybase.ca/create"` at every touchpoint instead of importing from `consts.ts` makes a future URL change error-prone and defeats the purpose of centralizing (Pitfall 3's stated mitigation).
- **Client-side icon hydration (`client:load`/`client:visible` on any `@lucide/astro` icon):** unnecessary and violates D-03's zero-JS lock — `@lucide/astro` icons render fully server-side by default; adding a client directive would be actively wrong here, not just superfluous.
- **Reintroducing `favicon_transparent.png`:** confirmed broken (fully transparent) per `42-REVIEW-FIX.md` — `BaseLayout.astro` already correctly points to `favicon.ico`; do not reference the transparent PNG anywhere in new markup (e.g. don't add it as an Open Graph fallback image this phase — OG images are Phase 44 scope anyway).
- **Skipping straight to `<h3>` for feature-pair titles:** the 7 feature-pair item titles are visually bold labels, not a third heading level — using `<h3>` there would create a heading outline with 7 duplicate near-identical entries ("MLS/board-synced listings", "Group collaboration", etc.) that adds noise to the page's semantic outline without aiding navigation; keep them as styled `<p>`/`<span>` text (per the Typography section's "Label" role, not a heading role).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon rendering (7 feature icons + 1 banner icon) | Inline hand-copied SVG `<path>` markup per icon | `@lucide/astro` named imports | Loses tree-shaking, consistent `stroke-width`/sizing, and any future icon updates; `@lucide/astro` gives all of this for one dependency, matches `frontend/`'s existing Lucide convention. |
| `noindex` on 2 specific pages | A generalized environment-aware SEO package (`astro-noindex`, `astro-seo`) | A plain optional `BaseLayout` prop (Pattern 3) | This phase's need is "always noindex while placeholder," not "noindex only on non-production" — that's Phase 44's job. Installing SEO tooling now is premature and risks conflicting with whatever Phase 44 introduces for the *other* noindex use case (preview deployments). |
| Responsive grid layout for 7 feature cards | Custom media-query breakpoint math | Tailwind's `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` utility classes (already specified in UI-SPEC) | Tailwind's responsive grid utilities are already the established pattern in this monorepo (`frontend/`) and in the UI-SPEC's own layout guidance — no custom CSS needed. |

**Key insight:** Every "don't hand-roll" item this phase resolves to "use the tool already chosen/available" rather than "avoid a whole category of custom code" — the phase's scope is small and static enough that the main hand-rolling risk is icon markup and ad-hoc SEO tag logic, both of which have a single obvious correct answer already covered above.

## Common Pitfalls

### Pitfall 1: Cross-origin CTA relative-path bug (from milestone PITFALLS.md, directly applicable this phase)
**What goes wrong:** A CTA or footer link is written as `href="/create"` or `href="/auth/login"` instead of the full `https://app.realtybase.ca/...` URL, producing a 404 on the marketing site's own origin.
**Why it happens:** Habit transfer from `frontend/`'s single-origin React Router links, where relative paths are always correct.
**How to avoid:** Only ever reference `CTA_URLS.getStarted`/`CTA_URLS.login` from `consts.ts` (Pattern 1) — never inline a URL string at a call site.
**Warning signs:** A local `astro dev` click-through can accidentally "look right" if a dev server happens to be running at the same relative path; the bug only surfaces on the actual deployed preview. Manually click-through-test both CTAs (and the footer legal links) against the built/previewed site, not just visually inspect the JSX.

### Pitfall 2: `BaseLayout` extended incorrectly, breaking the existing home-page usage
**What goes wrong:** Adding the `noindex` prop with a required (non-optional) type, or without a default value, forces every existing `BaseLayout` call site (i.e., `index.astro`, which does not need `noindex`) to pass the prop explicitly, or breaks TypeScript strict-mode compilation (`tsconfig.json` extends `astro/tsconfigs/strict`).
**Why it happens:** Easy to add a prop as required by default without considering backward compatibility with the page that doesn't need it.
**How to avoid:** Declare `noindex?: boolean` (optional) with a default of `false` in destructuring (`const { title, noindex = false } = Astro.props`), exactly as shown in Pattern 3.
**Warning signs:** `astro check` (via `@astrojs/check`, already a devDependency) fails on `index.astro` after the `BaseLayout` prop change — run `npx astro check` after extending the layout, before writing page content.

### Pitfall 3: Placeholder legal text ships without the on-page banner actually rendering above the fold of the content
**What goes wrong:** The "pending legal review" banner is added to the page but placed after several legal sections, or styled subtly enough that it reads as just another paragraph — defeating its purpose (Pitfall 6 in the milestone research, directly scoped to this phase per its own Pitfall-to-Phase Mapping).
**Why it happens:** Legal placeholder text is long (13-14 sections); it's easy to treat the banner as a footnote rather than a structural requirement.
**How to avoid:** Per UI-SPEC's explicit placement instruction — banner renders "directly below the page `<h1>`, before any body content." Build the banner as its own small component or inline block that always sits between `<h1>` and the first `<h2>` section, using the `--destructive`-at-low-opacity treatment UI-SPEC locks (`border-destructive/40`, `bg-destructive/10`, `text-destructive`).
**Warning signs:** Scrolling past the h1 shows body legal text before any visual "this is a placeholder" signal.

### Pitfall 4: Feature-pair heading noise — using `<h3>` per item instead of styled text
**What goes wrong:** Each of the 7 FeatureGrid items gets its own `<h3>` "for semantic correctness," producing a page outline with 7 near-duplicate, granular headings that don't aid screen-reader navigation and technically still pass a naive "sequential heading" checker while failing the spirit of LAND-08 (a meaningful, scannable heading outline).
**Why it happens:** Overcorrecting toward "more semantic markup is always better" without considering that not every visually-bold text label needs to be a heading-level element.
**How to avoid:** Follow the Heading Hierarchy Plan above exactly — feature-pair titles are `<p class="font-semibold">` (Label typography role), not `<h3>`. The section only needs one `<h2>` (the FeatureGrid section heading).
**Warning signs:** `grep -c '<h[1-6]' index.astro` returns a much higher count than the 4 headings (1 h1 + 3 h2) the Heading Hierarchy Plan specifies.

### Pitfall 5: `@lucide/astro` vs. legacy `lucide-astro` name confusion
**What goes wrong:** Installing the deprecated `lucide-astro` package (still on npm, latest `0.556.0`) instead of the current `@lucide/astro` (scoped package, `1.28.0`) — both exist on the registry, both technically "work" for basic icon rendering, but only the scoped package receives current updates per Lucide's own migration guide.
**Why it happens:** Search results and older tutorials/blog posts often reference the pre-rename `lucide-astro` name; it's not obviously deprecated from a quick npm search.
**How to avoid:** Install exactly `@lucide/astro` (with the `@lucide/` scope) — confirmed as the current official package via `lucide.dev`'s own documentation this session.
**Warning signs:** `package.json` shows `"lucide-astro"` (no `@lucide/` scope) as a dependency — this is the wrong/legacy package.

## Code Examples

Verified patterns from official/current sources (also see Architecture Patterns above for the full component-level examples):

### Legal page section structure (repeatable per-section pattern)
```astro
---
// src/pages/privacy.astro
import BaseLayout from '../layouts/BaseLayout.astro'
import SiteHeader from '../components/SiteHeader.astro'
import SiteFooter from '../components/SiteFooter.astro'
import { TriangleAlert } from '@lucide/astro'
---
<BaseLayout title="Privacy Policy — RealtyBase" noindex>
  <SiteHeader />
  <main class="mx-auto max-w-3xl px-4 py-16">
    <h1 class="text-foreground mb-6 text-4xl font-semibold">Privacy Policy</h1>

    <div class="border-destructive/40 bg-destructive/10 mb-10 flex gap-3 rounded-lg border p-4">
      <TriangleAlert class="text-destructive shrink-0" size={20} aria-hidden="true" />
      <p class="text-destructive text-sm">
        This page is a placeholder and has not yet been reviewed by legal counsel.
        Do not rely on it as final legal terms.
      </p>
    </div>

    <section class="prose-config">
      <h2 class="text-foreground mb-2 text-[28px] font-semibold">1. Introduction / Overview</h2>
      <p class="text-muted-foreground mb-8 text-base leading-relaxed">
        <!-- placeholder body copy per FEATURES.md's heading list -->
      </p>
    </section>
    <!-- repeat <section> block × 13 total, sequential h2s, per FEATURES.md headings -->
  </main>
  <SiteFooter />
</BaseLayout>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `lucide-astro` (unscoped package) | `@lucide/astro` (scoped package) | Lucide's v0→v1 migration (package rename to align with the org's other scoped packages like `lucide-react`'s eventual equivalents) | Only the scoped package receives current releases; this phase must install the new name, not the old one (Pitfall 5). |
| `@astrojs/tailwind` integration | `@tailwindcss/vite` plugin | Tailwind v4 release | Already correctly in place from Phase 42 — no action needed this phase, noted here only for completeness since it's adjacent to the styling work in this phase. |

**Deprecated/outdated:** `lucide-astro` (unscoped) is not deleted from npm but is the legacy pre-rename package — avoid.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The exact FeatureGrid `<h2>` section-heading copy (e.g. "Everything your brokerage needs, in one place") is not locked in `43-UI-SPEC.md`'s Copywriting Contract table — it only confirms a heading role, not the wording | Architecture Patterns, Pattern 2 code example | Low — this is explicitly flagged as Claude's Discretion in CONTEXT.md ("Exact hero/subhead/feature-pair copy wording... drafted during planning/execution"); the FeatureGrid heading falls under that same discretion umbrella even though it isn't individually named. Executor should draft grounded in D-07's outcome-framed guidance and flag for review, consistent with how Hero copy is handled. |
| A2 | `aria-hidden="true"` on decorative `@lucide/astro` icons paired with adjacent visible text is the correct accessibility treatment (rather than requiring a text alternative on the SVG itself) | Architecture Patterns, Pattern 2 | Low — this is standard, widely-documented icon-accessibility practice (decorative icon + adjacent text label = icon can be hidden from assistive tech), not project-specific; a slocheck/axe accessibility scan would confirm if this needs revisiting. |
| A3 | `@lucide/astro`'s download count / registry age was not independently pulled this session (network `npm view <pkg> downloads` was not run); legitimacy was instead established via slopcheck `[OK]` + official docs + peer-dependency metadata + no-postinstall-script check | Package Legitimacy Audit | Low — multiple independent verification signals already converge (slopcheck, official docs, GitHub org match, active version history through 1.28.0); a missing download-count figure doesn't change the disposition. |

**If this table is empty:** N/A — see entries above. All three are LOW risk; none block planning.

## Open Questions

1. **FeatureGrid section `<h2>` copy**
   - What we know: UI-SPEC confirms it must exist as an `<h2>` in the Typography section, but the Copywriting Contract table doesn't provide the exact wording (unlike ValueProp/ClosingCTA headings, which are both locked).
   - What's unclear: Whether this is an oversight in UI-SPEC or deliberately left to execution-time drafting alongside the other Claude's-Discretion copy items.
   - Recommendation: Treat as part of the same "Claude's Discretion" copy-drafting bucket as the Hero headline (D-06) and feature-pair descriptions — draft during execution, grounded in D-07's outcome-framing guidance, and flag for the same pre-ship review CONTEXT.md already calls for on hero copy. Does not block planning; the planner should just make sure a task exists to draft this specific heading, not assume it's pre-written.

2. **Footer column structure (single row vs. multi-column)**
   - What we know: UI-SPEC's spacing scale defines "footer column item gaps" (sm token) and "footer column headings" (Label role) explicitly, implying a multi-column footer layout is anticipated.
   - What's unclear: What the actual columns are — footer content per LAND-06 is fairly minimal (Privacy/Terms links, copyright, contact email), which doesn't obviously need multiple distinct columns the way a larger SaaS footer (product/company/resources) would.
   - Recommendation: A single-row or two-column (links | contact+copyright) footer layout is sufficient given the minimal content locked for this phase; reserve the "footer column heading" Label-role typography for if/when a future phase adds more footer content. Not a blocker — just don't over-build footer structure for content that doesn't exist yet (echoes the milestone's own anti-feature guidance against a multi-page nav that promises content that isn't there).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `astro build`/`astro dev`, `npm install @lucide/astro` | ✓ (via nvm) | System default `node` on PATH is `22.9.0`; `landing/.nvmrc` pins `22.12.0` (Astro 7's engine floor) | Phase 42 already resolved this by installing Node `22.23.2` via `nvm` — run `nvm use` (or equivalent) from `landing/` before any `npm`/`astro` command in this phase, consistent with the STATE.md note from Phase 42 execution. Not a new blocker, just a re-confirmation that this phase's executor must do the same `nvm` step. |
| npm | package install/build | ✓ | `10.8.3` | — |
| `@lucide/astro` (new dependency) | FeatureGrid icons, legal-page banner icon | Not yet installed — this phase's job to add it | `1.28.0` on registry, verified this session | None needed — package confirmed available, legitimate, and compatible. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Node version mismatch on the raw system PATH — already has an established fallback (`nvm use` against `landing/.nvmrc`) from Phase 42; not a new gap this phase introduces.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled per default), but this phase has almost no attack surface: `landing/` is a fully static site with no forms, no authentication, no session state, no API calls, and no database — confirmed architecturally in `ARCHITECTURE.md` ("zero runtime coupling to backend/ or frontend/").

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No login/auth surface exists on `landing/`; auth lives entirely on `app.realtybase.ca`, a separate origin/project outside this phase's scope. |
| V3 Session Management | No | No sessions, no cookies set by this site. |
| V4 Access Control | No | All pages are public marketing content; no gated/role-based content exists. |
| V5 Input Validation | No | No forms, no user input of any kind on this site (confirmed as an explicit anti-feature in `FEATURES.md` — no newsletter capture, no live chat). |
| V6 Cryptography | No | No secrets, no data storage, no crypto operations occur in `landing/`. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Reflected/stored XSS via user input | Tampering | Not applicable — no user input exists anywhere on this static site. |
| Tabnabbing via `target="_blank"` without `rel="noopener noreferrer"` | Tampering / Information Disclosure | If any link on the page ever opens in a new tab (none are currently planned — primary CTAs and legal links all use same-tab navigation per UI-SPEC's UX guidance and Pitfall research), pair `target="_blank"` with `rel="noopener noreferrer"` unconditionally. This phase's CTAs and footer links are same-tab, so this is a defensive default to carry forward, not an active fix needed right now. |
| Stale cross-origin trust assumptions on CTA links | Spoofing (low relevance) | CTA destinations (`app.realtybase.ca/create`, `/auth/login`) are hardcoded absolute HTTPS URLs to a known first-party origin, not user-influenced — no injection surface. |

## Sources

### Primary (HIGH confidence)
- [lucide.dev — Lucide for Astro](https://lucide.dev/guide/packages/lucide-astro) — official current package name (`@lucide/astro`), install command, import syntax, verified via WebFetch this session
- `npm view @lucide/astro version` / `peerDependencies` / `time.created` / `scripts.postinstall` — direct registry inspection this session (version `1.28.0`, peer dep `astro: ^4 || ^5 || ^6 || ^7`, first published 2025-04-02, no postinstall script)
- `slopcheck install @lucide/astro --ecosystem npm` — legitimacy gate run this session, result `[OK]`
- Direct repo inspection: `landing/src/layouts/BaseLayout.astro`, `landing/src/pages/index.astro`, `landing/src/styles/global.css`, `landing/astro.config.mjs`, `landing/tsconfig.json`, `landing/vercel.json`, `landing/.gitignore`, `landing/package.json` (existing Phase 42 scaffold state, read this session)
- `.planning/phases/43-home-page-legal-pages/43-CONTEXT.md` and `43-UI-SPEC.md` — locked decisions and design contract for this phase (already-approved upstream artifacts)
- `.planning/research/ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md` — canonical milestone-level research explicitly referenced by CONTEXT.md, re-applied here to this specific phase's build order and pitfalls

### Secondary (MEDIUM confidence)
- WebSearch cross-verification of `@lucide/astro` import pattern (matched WebFetch result from `lucide.dev` — consistent across both)
- WebSearch on Astro `noindex` meta-tag patterns — confirmed the plain per-page `<meta name="robots">` approach is standard/sufficient for this phase's simpler (non-environment-aware) requirement

### Tertiary (LOW confidence)
- None flagged — all findings this session were either verified via direct tool inspection (npm/slopcheck/file reads) or cross-referenced against official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Astro/Tailwind versions confirmed by direct file inspection (no change this phase); `@lucide/astro` confirmed via official docs + registry + slopcheck, all convergent.
- Architecture: HIGH — component split and build order are direct extensions of already-approved `ARCHITECTURE.md`, with the `BaseLayout`/`consts.ts` gaps filled in by direct inspection of the actual current scaffold files.
- Pitfalls: HIGH — this phase's applicable pitfalls (3, 6, and the semantic-HTML risk) are already deeply researched in the canonical `PITFALLS.md`; this document narrows them to this phase's concrete file-level manifestations rather than re-deriving them.

**Research date:** 2026-07-30
**Valid until:** 30 days (stable static-site stack; `@lucide/astro` is the only fast-moving-ish dependency, but pinned to `^1.28.0` and unlikely to introduce breaking changes within that window)

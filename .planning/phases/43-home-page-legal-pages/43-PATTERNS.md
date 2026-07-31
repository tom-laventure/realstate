# Phase 43: Home Page & Legal Pages - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 11 (1 extended, 10 new)
**Analogs found:** 11 / 11 (all resolve to in-repo analogs; `landing/` is a small, mostly-empty scaffold, so several files use the *same* Phase-42 file as their closest analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `landing/src/layouts/BaseLayout.astro` | layout (extend) | request-response (static HTML) | itself (Phase 42 version, in place) | exact — extend in place |
| `landing/src/consts.ts` | config/constants | transform (static data) | `frontend/src/assets/config/colorSchemes.ts` (closest "named-export const config object" convention) | role-match |
| `landing/src/pages/index.astro` | route/page (replace) | request-response (static HTML) | itself (Phase 42 version) + `landing/src/layouts/BaseLayout.astro` for the composition pattern | exact — replace in place |
| `landing/src/pages/privacy.astro` | route/page (new) | request-response (static HTML) | `landing/src/pages/index.astro` (only existing page in the project) | role-match |
| `landing/src/pages/terms.astro` | route/page (new) | request-response (static HTML) | `landing/src/pages/index.astro` | role-match |
| `landing/src/components/SiteHeader.astro` | component (new) | request-response (static HTML) | `frontend/src/components/layout/Header.tsx`-equivalent nav pattern (see note below — no direct file; used `landing/src/pages/index.astro`'s Tailwind-class conventions as structural analog) | partial — no nav/header component exists anywhere in `landing/` yet; classes/tokens borrowed from `index.astro` |
| `landing/src/components/Hero.astro` | component (new) | request-response (static HTML) | `landing/src/pages/index.astro` (token usage, `<h1>` styling precedent) | partial |
| `landing/src/components/ValueProp.astro` | component (new) | request-response (static HTML) | `landing/src/pages/index.astro` | partial |
| `landing/src/components/FeatureGrid.astro` | component (new) | transform (static array → markup, build-time) | `landing/src/pages/index.astro`'s card/grid `div` blocks (lines 19-27, `bg-card border border-border rounded-lg p-4`) | role-match |
| `landing/src/components/ClosingCTA.astro` | component (new) | request-response (static HTML) | `landing/src/pages/index.astro` | partial |
| `landing/src/components/SiteFooter.astro` | component (new) | request-response (static HTML) | `landing/src/pages/index.astro` (dark-surface `bg-sidebar text-sidebar-foreground` block, lines 24-27) | role-match |

**Note on match quality:** `landing/` is a brand-new Astro project (Phase 42 scaffold only) with exactly one existing page and one layout — there are no prior Header/Hero/Footer components to copy structurally. For those files, "closest analog" means the closest *token/class-usage* precedent within `landing/` itself (`index.astro`'s existing use of `bg-card`, `bg-sidebar`, `border-border`, etc.), combined with the already-locked, concrete markup in `43-RESEARCH.md`'s Architecture Patterns section (Pattern 1-4, which are themselves verified against the actual current scaffold files, not invented). Where `frontend/` has a loosely analogous concept (e.g., a constants file), it's noted for import-style/naming convention only — `frontend/` is a different framework (React/TS) and its component-level patterns do not transfer directly to `.astro` files.

## Pattern Assignments

### `landing/src/layouts/BaseLayout.astro` (layout, extend in place)

**Analog:** itself — current file at `landing/src/layouts/BaseLayout.astro` (full contents, 22 lines, already in context — see Read above)

**Current full contents (all 22 lines — extend, don't replace):**
```astro
---
import '../styles/global.css'

interface Props {
  title: string
}

const { title } = Astro.props
---

<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="generator" content={Astro.generator} />
		<link rel="icon" href="/favicon.ico" sizes="any" />
		<title>{title}</title>
	</head>
	<body>
		<slot />
	</body>
</html>
```

**Required extension** (per RESEARCH.md Pattern 3 — add optional `noindex` prop, default `false`, backward-compatible with the existing `index.astro` call site which passes only `title`):
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

**Critical constraint (Pitfall 2):** `noindex` MUST be optional (`noindex?: boolean`) with a default in destructuring. `tsconfig.json` extends `astro/tsconfigs/strict` — a required prop without a default breaks `index.astro`'s existing `<BaseLayout title="RealtyBase">` call (no `noindex` passed) under `astro check`. Run `npx astro check` from `landing/` after this edit, before writing any page content.

**Indentation note:** existing file uses tabs (`\t`) inside `<html>`/`<head>`/`<body>`, not spaces — match this exactly to avoid an inconsistent diff. The frontmatter block (`---` fenced) uses 2-space indentation. Keep both conventions as-is.

**Do not touch:** the `<link rel="icon" href="/favicon.ico" .../>` line — per `42-REVIEW-FIX.md`, this was deliberately fixed from a broken `favicon_transparent.png` reference. Never reintroduce `favicon_transparent.png` anywhere.

---

### `landing/src/consts.ts` (config, new)

**Analog:** No direct `.ts` consts file exists in `landing/` yet (this is the first). Closest naming/export convention from `frontend/src/assets/config/colorSchemes.ts` (named `export const` objects with `as const` for literal-type safety) — but the file content itself is fully specified in RESEARCH.md Pattern 1 and is not adapted from `frontend/`, since `frontend/`'s actual config values (brokerage-scoped) don't apply here.

**Required content** (RESEARCH.md Pattern 1, verified against CONTEXT.md D-08 and canonical CTA URLs):
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

**Critical constraint (Pitfall 1 / Pitfall 3 in RESEARCH.md's Common Pitfalls):** `CTA_URLS` values MUST be full absolute `https://` URLs, never relative paths — `landing/` and `app.realtybase.ca` are different origins/different Vercel projects. Every component that renders "Get Started" or "Log in" must import from this file — never inline the URL string at a call site (this is the single source of truth requirement).

**Must exist before:** any component that imports it (`SiteHeader.astro`, `Hero.astro`, `ValueProp.astro`, `ClosingCTA.astro`, `SiteFooter.astro`). Build/plan this file first.

---

### `landing/src/components/SiteHeader.astro` (component, new)

**Analog:** No existing header/nav component in `landing/`. Token/class conventions borrowed from `landing/src/pages/index.astro` (existing `bg-primary text-primary-foreground` and `border border-border` usage, lines 14-21).

**Required pattern** (RESEARCH.md Architecture Patterns, Pattern 1 — verified against actual Slate tokens in `global.css`):
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

**Design contract notes (from 43-UI-SPEC.md):**
- Wordmark = text only, `text-primary`, no logo image asset (D-01)
- "Log in" is Label typography role (14px/600) styled visually secondary (text link, not filled button) vs. "Get Started" which is the sole `bg-primary` filled CTA in this section
- No `<h1>`/`<h2>` inside header — would compete with the page's single `<h1>` (Heading Hierarchy Plan)

---

### `landing/src/components/Hero.astro` (component, new)

**Analog:** No existing hero component. Structural precedent: `landing/src/pages/index.astro`'s `<h1 class="text-foreground text-3xl font-semibold">` (line 8) — upgrade to Display-size type per UI-SPEC.

**Required pattern** (composed from RESEARCH.md's architecture map + UI-SPEC's locked copy — this is the one `<h1>` on the home page):
```astro
---
// src/components/Hero.astro
import { CTA_URLS } from '../consts'
---
<section class="bg-background px-4 py-16 text-center lg:py-16">
  <p class="text-primary mb-4 text-sm font-semibold">Built for real estate brokerages</p>
  <h1 class="text-foreground mx-auto mb-6 max-w-3xl text-4xl font-semibold md:text-5xl">
    Every listing, every group, every board — one workspace.
  </h1>
  <p class="text-muted-foreground mx-auto mb-8 max-w-2xl text-base leading-relaxed">
    RealtyBase unifies MLS-synced listings, group collaboration, and role-based access
    — so your brokerage isn't held together by spreadsheets, group texts, and five
    disconnected tools.
  </p>
  <a href={CTA_URLS.getStarted} class="bg-primary text-primary-foreground inline-block rounded-md px-6 py-3 text-sm font-semibold">
    Get Started
  </a>
</section>
```

**UI-SPEC typography lock:** Display role = 48px desktop (`text-5xl`) / 32px mobile (`text-4xl`, scales via `md:text-5xl`), weight 600, line-height 1.1 — this is the ONLY `<h1>` use of the Display role in the whole phase.

**Copy is locked verbatim in 43-UI-SPEC.md's Copywriting Contract** — eyebrow, headline, and subhead text above are the exact locked strings; do not redraft.

---

### `landing/src/components/ValueProp.astro` (component, new)

**Analog:** No existing component; same token precedent as Hero.

**Required pattern** (this is CTA touchpoint #2, per D-02 — same style/copy as Hero's CTA):
```astro
---
// src/components/ValueProp.astro
import { CTA_URLS } from '../consts'
---
<section class="bg-background px-4 py-12 text-center lg:py-16">
  <h2 class="text-foreground mx-auto mb-4 max-w-2xl text-[28px] font-semibold">
    Run your brokerage from one place, not five.
  </h2>
  <p class="text-muted-foreground mx-auto mb-8 max-w-2xl text-base leading-relaxed">
    Listings sync automatically from your connected MLS/RETS board. Agents collaborate
    inside shared groups. Owners and admins control exactly who can see and manage
    what. It's one connected workspace, built for how brokerages actually operate —
    not a bundle of disconnected tools.
  </p>
  <a href={CTA_URLS.getStarted} class="bg-primary text-primary-foreground inline-block rounded-md px-6 py-3 text-sm font-semibold">
    Get Started
  </a>
</section>
```

**Copy locked verbatim in UI-SPEC.** CTA #2 must be identical label/style to CTA #1 and #3 (D-02: "not a new goal" — same copy/style, additional touchpoint only).

---

### `landing/src/components/FeatureGrid.astro` (component, new)

**Analog:** `landing/src/pages/index.astro` lines 19-27 (`bg-card border border-border rounded-lg p-4` card pattern) — closest existing grid-item styling precedent in the repo.

**Analog excerpt** (`landing/src/pages/index.astro:19-27`):
```astro
<div class="bg-card border border-border rounded-lg p-4">
	<p class="font-medium">bg-card / border-border</p>
	<p class="text-sm">Card background against the Slate border color.</p>
</div>
```

**Required pattern** (RESEARCH.md Pattern 2, adapted with UI-SPEC's exact icon assignments and source order for the D-05 grouping requirement):
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
<section class="px-4 py-16 lg:py-16">
  <h2 class="text-foreground mb-8 text-center text-[28px] font-semibold">
    Everything your brokerage needs, in one place
  </h2>
  <div class="mx-auto flex max-w-6xl flex-wrap justify-center gap-6">
    {features.map(({ icon: Icon, title, body }) => (
      <div class="bg-card border-border w-full rounded-lg border p-6 sm:w-[calc(50%_-_0.75rem)] lg:w-[calc(25%_-_1.125rem)]">
        <Icon class="text-primary mb-4" size={28} aria-hidden="true" />
        <p class="text-foreground mb-2 text-sm font-semibold">{title}</p>
        <p class="text-muted-foreground text-base">{body}</p>
      </div>
    ))}
  </div>
</section>
```

**Critical constraints:**
- Source order MUST be exactly as above — items 2 ("Group collaboration") and 3 ("Multi-tenant isolation") must land adjacent at 1 / 2 / 4 cards per row (row 1 = items 1-4, row 2 = items 5-7, per D-05/UI-SPEC's explicit layout guidance).
- The container is `flex flex-wrap justify-center` with explicit card widths — NOT `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. A 4-track CSS grid with 7 children left-aligns row 2 in columns 1-3, which violates UI-SPEC line 110's locked "row 2 ... centered"; no integer track offset centers 3 cards in 4 tracks. `flex-wrap` + `justify-center` gives the same per-row counts and centers any incomplete final row (row 2 at `lg`, the orphan card at `sm`) for free. Widths are derived from `gap-6` (1.5rem): `sm` two-up = `50% - 0.75rem`, `lg` four-up = `25% - 1.125rem`; the underscores are Tailwind's escaped-space syntax and are required (`calc` needs whitespace around the minus).
- Feature-pair titles are `<p class="font-semibold">` (Label role) — NOT `<h3>`. Using `<h3>` here is Pitfall 4 (heading noise) — the section has exactly one heading, the `<h2>` above.
- `aria-hidden="true"` on every `<Icon>` — decorative, paired with adjacent visible text (Pattern 2's accessibility note).
- The `<h2>` copy is now LOCKED to "Everything your brokerage needs, in one place" in `43-02-PLAN.md` Task 2 (this closed RESEARCH.md Open Question 1) — use it verbatim, do not redraft it.
- Import `@lucide/astro` — NOT `lucide-astro` (legacy/unscoped package, Pitfall 5). Must run `cd landing && npm install @lucide/astro` first.

---

### `landing/src/components/ClosingCTA.astro` (component, new)

**Analog:** No existing component; same precedent as Hero/ValueProp for section structure.

**Required pattern** (this is CTA touchpoint #3, plus the secondary "Log in" text link per UI-SPEC):
```astro
---
// src/components/ClosingCTA.astro
import { CTA_URLS } from '../consts'
---
<section class="bg-background px-4 py-16 text-center lg:py-16">
  <h2 class="text-foreground mx-auto mb-4 max-w-2xl text-[28px] font-semibold">
    Ready to bring your brokerage into one workspace?
  </h2>
  <p class="text-muted-foreground mb-8 text-base">
    Get started in minutes — no credit card, no sales call.
  </p>
  <a href={CTA_URLS.getStarted} class="bg-primary text-primary-foreground inline-block rounded-md px-6 py-3 text-sm font-semibold">
    Get Started
  </a>
  <p class="mt-4 text-sm">
    <a href={CTA_URLS.login} class="text-foreground font-semibold underline-offset-2 hover:underline">
      Already have an account? Log in
    </a>
  </p>
</section>
```

**Copy locked verbatim in UI-SPEC.** D-03: any hover polish (e.g. `hover:underline` above) must be CSS-only — no JS, respect `prefers-reduced-motion` if a transition is added.

---

### `landing/src/components/SiteFooter.astro` (component, new)

**Analog:** `landing/src/pages/index.astro` lines 24-27 (`bg-sidebar text-sidebar-foreground` dark-surface block) — direct token precedent for the footer's dark-anchor styling.

**Analog excerpt** (`landing/src/pages/index.astro:24-27`):
```astro
<div class="bg-sidebar text-sidebar-foreground rounded-lg p-4">
	<p class="font-medium">bg-sidebar / text-sidebar-foreground</p>
	<p class="text-sm">The Slate sidebar override layer.</p>
</div>
```

**Required pattern** (RESEARCH.md Pattern 4 for the build-time year, combined with UI-SPEC's locked footer content — single-row/two-column layout per RESEARCH.md Open Question 2's recommendation, not a multi-column footer):
```astro
---
// src/components/SiteFooter.astro
import { LEGAL_LINKS, CONTACT_EMAIL } from '../consts'

const year = new Date().getFullYear()
---
<footer class="bg-sidebar text-sidebar-foreground px-4 py-8">
  <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
    <div class="flex items-center gap-4 text-sm font-semibold">
      <a href={LEGAL_LINKS.privacy} class="hover:underline">Privacy Policy</a>
      <a href={LEGAL_LINKS.terms} class="hover:underline">Terms of Service</a>
      <a href={`mailto:${CONTACT_EMAIL}`} class="hover:underline">{CONTACT_EMAIL}</a>
    </div>
    <p class="text-sidebar-foreground/70 text-sm">© {year} RealtyBase. All rights reserved.</p>
  </div>
</footer>
```

**Critical constraint:** the copyright year MUST be computed in Astro frontmatter (`new Date().getFullYear()`, runs at build time in Node) — never client-side JS. This is explicitly confirmed compliant with the zero-JS lock (D-03) in both CONTEXT.md and RESEARCH.md Pattern 4.

**Dependency ordering (FEATURES.md):** `/privacy` and `/terms` routes must exist and be routable BEFORE this footer ships — sequence legal pages alongside or before `SiteFooter.astro`, not after.

**No `<h1>`/`<h2>` here** — footer links/content stay non-heading text per the Heading Hierarchy Plan.

---

### `landing/src/pages/index.astro` (page, replace)

**Analog:** itself, current Phase-42 version (full 30 lines, already in context above) — replace body content, keep the `BaseLayout` import pattern.

**Current pattern to preserve** (import + `<BaseLayout>` wrapper convention, `landing/src/pages/index.astro:1-5`):
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
---

<BaseLayout title="RealtyBase">
```

**Required replacement composition** (per RESEARCH.md's Recommended Project Structure — assembles all 6 new components):
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import SiteHeader from '../components/SiteHeader.astro'
import Hero from '../components/Hero.astro'
import ValueProp from '../components/ValueProp.astro'
import FeatureGrid from '../components/FeatureGrid.astro'
import ClosingCTA from '../components/ClosingCTA.astro'
import SiteFooter from '../components/SiteFooter.astro'
---
<BaseLayout title="RealtyBase — Real Estate Brokerage Software">
  <SiteHeader />
  <Hero />
  <ValueProp />
  <FeatureGrid />
  <ClosingCTA />
  <SiteFooter />
</BaseLayout>
```

**Note:** `noindex` is NOT passed here — the home page must remain indexable (defaults to `false` per BaseLayout's extension).

**Heading check:** exactly 1 `<h1>` (inside `Hero.astro`) + 3 `<h2>`s in DOM order (`ValueProp` → `FeatureGrid` → `ClosingCTA`) — no `<h3>` anywhere on this page (Pitfall 4).

---

### `landing/src/pages/privacy.astro` (page, new)

**Analog:** `landing/src/pages/index.astro` (only existing page — import/`BaseLayout` composition convention) combined with RESEARCH.md's fully-specified Code Example.

**Required pattern** (RESEARCH.md Code Examples section, verified against FEATURES.md's 13-section heading list and UI-SPEC's locked banner copy/placement):
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

    <section>
      <h2 class="text-foreground mb-2 text-[28px] font-semibold">1. Introduction / Overview</h2>
      <p class="text-muted-foreground mb-8 text-base leading-relaxed">
        <!-- placeholder body copy -->
      </p>
    </section>
    <!-- repeat <section> block × 13 total, sequential h2s -->
  </main>
  <SiteFooter />
</BaseLayout>
```

**13 sequential `<h2>` sections in this exact order** (from `.planning/research/FEATURES.md` lines 155-169, canonical — do not reorder or invent different headings):
1. Introduction / Overview
2. Definitions
3. Information We Collect
4. How We Use Information
5. How Information Is Shared
6. Data Retention
7. Cookies and Tracking Technologies
8. Data Security
9. Your Rights and Choices
10. Children's Privacy
11. International Data Transfers
12. Changes to This Policy
13. Contact Us

**Critical constraint (Pitfall 3, LEGAL-03/D-09):** the banner div MUST sit directly between `<h1>` and the first `<h2>` section — never after body content, never buried near the footer. Use `border-destructive/40 bg-destructive/10 text-destructive` exactly (UI-SPEC's locked color treatment — `--destructive` is reserved exclusively for this banner on this site).

**Legal entity name:** "RealtyBase Inc." per UI-SPEC's Copywriting Contract (D-09's discretion resolved to the Inc. form).

**Contact section (§13) copy:** must reference `hello@realtybase.ca` (D-08).

**ToS §5 note does not apply here** (that's the Terms page) but Data Retention (§6) and Information We Collect (§3) should stay generic on Vercel Analytics specifics per FEATURES.md's dependency note — don't overstate what's collected.

---

### `landing/src/pages/terms.astro` (page, new)

**Analog:** `landing/src/pages/privacy.astro` (same-phase sibling, identical structural pattern) — build both from the same template.

**Required pattern** (same skeleton as `privacy.astro`, different title/heading/section list):
```astro
---
// src/pages/terms.astro
import BaseLayout from '../layouts/BaseLayout.astro'
import SiteHeader from '../components/SiteHeader.astro'
import SiteFooter from '../components/SiteFooter.astro'
import { TriangleAlert } from '@lucide/astro'
---
<BaseLayout title="Terms of Service — RealtyBase" noindex>
  <SiteHeader />
  <main class="mx-auto max-w-3xl px-4 py-16">
    <h1 class="text-foreground mb-6 text-4xl font-semibold">Terms of Service</h1>

    <div class="border-destructive/40 bg-destructive/10 mb-10 flex gap-3 rounded-lg border p-4">
      <TriangleAlert class="text-destructive shrink-0" size={20} aria-hidden="true" />
      <p class="text-destructive text-sm">
        This page is a placeholder and has not yet been reviewed by legal counsel.
        Do not rely on it as final legal terms.
      </p>
    </div>

    <section>
      <h2 class="text-foreground mb-2 text-[28px] font-semibold">1. Introduction / Acceptance of Terms</h2>
      <p class="text-muted-foreground mb-8 text-base leading-relaxed">
        <!-- placeholder body copy -->
      </p>
    </section>
    <!-- repeat <section> block × 14 total, sequential h2s -->
  </main>
  <SiteFooter />
</BaseLayout>
```

**14 sequential `<h2>` sections in this exact order** (from `.planning/research/FEATURES.md` lines 173-186, canonical):
1. Introduction / Acceptance of Terms
2. Definitions
3. Eligibility / Account Registration
4. Description of Service
5. Subscription Plans and Billing
6. User Responsibilities / Acceptable Use
7. Intellectual Property
8. Data Ownership and Privacy
9. Termination
10. Disclaimers and Limitation of Liability
11. Indemnification
12. Governing Law and Dispute Resolution
13. Changes to Terms
14. Contact Us

**Critical constraint — §5 "Subscription Plans and Billing":** MUST stay generic, no hardcoded tier prices/seat caps ("plans and fees as described at time of purchase" style language). Pricing tier data (`AppConstants::PLAN_TIERS`, `GET /v1/onboarding/plan_tiers`) is sourced from the in-app wizard only — do not create a second static declaration of pricing facts here (FEATURES.md line 191, explicit anti-drift instruction).

**§8 "Data Ownership and Privacy"** should cross-reference the Privacy Policy page (`<a href={LEGAL_LINKS.privacy}>` using `text-primary` link color per UI-SPEC's "in-body links on legal pages" color rule).

---

## Shared Patterns

### Cross-Origin CTA URLs (centralize, never inline)
**Source:** `landing/src/consts.ts` (new file, see above)
**Apply to:** `SiteHeader.astro`, `Hero.astro`, `ValueProp.astro`, `ClosingCTA.astro`, `SiteFooter.astro` — every file rendering "Get Started" or "Log in"
```typescript
export const CTA_URLS = {
  getStarted: 'https://app.realtybase.ca/create',
  login: 'https://app.realtybase.ca/auth/login',
} as const
```
Never write `href="/create"` or `href="/auth/login"` — always import `CTA_URLS` (Pitfall 1/3 in RESEARCH.md).

### `noindex` via BaseLayout prop
**Source:** `landing/src/layouts/BaseLayout.astro` (extended, see above)
**Apply to:** `privacy.astro`, `terms.astro` only — `index.astro` omits the prop (defaults `false`, stays indexable).

### Slate Design Tokens (reuse only, never invent new colors)
**Source:** `landing/src/styles/global.css` (already wired, Phase 42)
**Apply to:** every new component/page
Utility classes confirmed present and to be reused verbatim: `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `text-primary`, `bg-card`, `border-border`, `bg-sidebar`, `text-sidebar-foreground`, `border-destructive/40`, `bg-destructive/10`, `text-destructive`. Do not introduce a new custom color/hex/oklch value anywhere in this phase.

### Heading Hierarchy (one `<h1>` per page, sequential `<h2>`s, no stray `<h3>`)
**Source:** RESEARCH.md's Heading Hierarchy Plan table
**Apply to:** all 3 pages
- `index.astro`: 1 `<h1>` (in `Hero.astro`) + 3 `<h2>`s (`ValueProp`, `FeatureGrid`, `ClosingCTA`) — no `<h3>` anywhere, feature-pair titles are `<p class="font-semibold">`.
- `privacy.astro` / `terms.astro`: 1 `<h1>` + 13 or 14 sequential `<h2>`s respectively.
- `SiteHeader.astro` / `SiteFooter.astro`: zero headings — never compete with the page's `<h1>` or interrupt the `<h2>` sequence.

### `@lucide/astro` Icon Import (build-time inline SVG, zero client JS)
**Source:** RESEARCH.md Pattern 2 (verified against official `lucide.dev` docs + npm registry this session)
**Apply to:** `FeatureGrid.astro` (7 icons: `RefreshCw`, `Users`, `ShieldCheck`, `KeyRound`, `Globe`, `Share2`, `Filter`) and `privacy.astro`/`terms.astro` (`TriangleAlert`)
```astro
import { RefreshCw, Users, ShieldCheck, KeyRound, Globe, Share2, Filter } from '@lucide/astro'
// usage: <Icon class="text-primary" size={28} aria-hidden="true" />
```
Install first: `cd landing && npm install @lucide/astro` (NOT `lucide-astro` — legacy unscoped package, Pitfall 5). No `client:*` directive ever — these are server-rendered Astro components.

### Font Stack Consistency
**Source:** `frontend/src/index.css` line 11 (`body` font-family)
**Apply to:** `landing/src/styles/global.css` (verify this is already/will be set — system-font stack, no webfont)
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
```
Copy exactly — avoids FOIT/font-loading complexity per UI-SPEC's Design System table. Note: `global.css`'s current `@layer base body` block (lines 100-102) only sets `bg-background text-foreground`, no `font-family` yet — confirm/add this declaration if not already present when touching `global.css` for this phase (not currently required by CONTEXT/RESEARCH as a file to modify, but flagged here since UI-SPEC explicitly calls for this font stack and it isn't yet visible in the current `global.css` contents read this session).

### Build-Time Copyright Year (no client JS)
**Source:** RESEARCH.md Pattern 4
**Apply to:** `SiteFooter.astro` only
```astro
---
const year = new Date().getFullYear()
---
<p>© {year} RealtyBase. All rights reserved.</p>
```

## No Analog Found

None — every file has at least a partial analog (either the existing `index.astro`/`BaseLayout.astro` scaffold for token/composition conventions, or a fully-specified pattern in RESEARCH.md verified against the real current codebase state). The absence of prior Header/Hero/Footer components in `landing/` is expected (Phase 42 deliberately deferred these — see CONTEXT.md's Prior Phase reference, D-01 "bare scaffold, header/footer deliberately deferred to this phase") and is not a gap — RESEARCH.md's Architecture Patterns section fills this role as the primary implementation reference for those files, cross-verified against the actual scaffold rather than invented from scratch.

## Metadata

**Analog search scope:** `landing/src/**` (full — 5 files, all read), `frontend/src/index.css` (font-family lines only), `frontend/src/assets/config/colorSchemes.ts` (referenced by name only, not read — naming-convention pointer, not a content source), `.planning/research/FEATURES.md` (legal section headings, lines 151-194), `.planning/research/ARCHITECTURE.md` / `PITFALLS.md` (referenced via 43-RESEARCH.md's already-verified synthesis, not independently re-read)
**Files scanned:** 11 (all files in `landing/` excluding `.astro/`, `node_modules/`, `dist/`) + 2 targeted reads in `frontend/` + 1 targeted read in `.planning/research/FEATURES.md`
**Pattern extraction date:** 2026-07-30
</content>

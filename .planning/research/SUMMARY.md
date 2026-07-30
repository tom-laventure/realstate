# Project Research Summary

**Project:** RealtyBase — v1.14 Marketing Landing Site
**Domain:** B2B SaaS marketing landing site (Astro + Tailwind static site), deployed as a third independent Vercel project inside an existing polyglot monorepo, taking over the platform's apex domain
**Researched:** 2026-07-30
**Confidence:** HIGH

## Executive Summary

This milestone is architecturally simple but operationally risky. The product itself — a single scrolling home page plus two legal pages built in Astro + Tailwind v4, no client-side framework, no backend coupling — is a well-trodden pattern with unambiguous best practices: static output, `@tailwindcss/vite` (not the deprecated `@astrojs/tailwind`), Vercel Web Analytics via the framework-native `<Analytics />` component, and `@astrojs/sitemap` for SEO basics. All four research tracks converge on the same low-complexity build: nothing here requires novel engineering, and the milestone's scope has already deliberately excluded the features that would add real complexity (pricing tables, testimonials, live chat, interactive demos).

The real risk is not the Astro build — it's everything around it. This is the first deployable in the monorepo where three independent Vercel projects (`frontend/`, `auth-callback/`, `landing/`) will all be building off root-directory-scoped dashboard settings with zero code-level visibility, and it's the first time the team is taking over the apex domain of a live, Host-header-driven multi-tenant SaaS (`BrokerageAuth`/`MainDomainOnly`/`DomainRedirectMiddleware` all reason about `realtybase.ca` as a logical identity, not just a DNS record). A wrong Root Directory setting or a stale `BrokerageDomain` row referencing bare apex after cutover are both silent, dashboard/DB-only failures with no diff or test to catch them. The recommended approach is to treat "build the site" and "cut over the domain" as clearly separated phases, with explicit verification gates (build-log inspection, `curl -I`, backend config audit) between them — never combine site-build and domain-cutover into one step.

Secondary risks are all well-understood and cheap to prevent if addressed in the right phase: cross-origin CTAs need absolute URLs (not React-Router-style relative paths); `astro.config.mjs`'s `site` value must be hardcoded to the final production apex before `@astrojs/sitemap` runs; placeholder legal text needs a visible on-page "pending review" banner plus `noindex`, not just a ticket note; and the hand-copied Slate CSS tokens are an accepted, documented drift risk (not something to re-architect). None of these block a fast build — they just need to land in the phase where they're actually relevant rather than being treated as afterthought polish.

## Key Findings

### Recommended Stack

Astro 7.1.6 + Tailwind CSS 4.3.3 via the official `@tailwindcss/vite` plugin form the core — both verified current via live npm registry checks. No `@astrojs/vercel` adapter is needed since the site is fully static (`output: 'static'`, the default); pulling in the adapter would only be justified by a future SSR/personalization requirement, which is explicitly out of scope. `@vercel/analytics` (2.0.1, `/astro` subpath) and `@astrojs/sitemap` (3.7.3) round out the stack, both zero-peer-dependency, framework-native integrations.

**Core technologies:**
- Astro 7.1.6 — static site generator — zero-JS-by-default islands architecture matches the "zero client-side JS" goal exactly
- Tailwind CSS 4.3.3 (`@tailwindcss/vite`) — styling — same major version already used in `frontend/`, `@astrojs/tailwind` is deprecated and must not be used
- @vercel/analytics 2.0.1 (`/astro` export) — page-view + CTA click tracking — no adapter/framework peer dependency required
- @astrojs/sitemap 3.7.3 — sitemap generation — requires `site` set explicitly in `astro.config.mjs`, never derived from `VERCEL_URL`

### Expected Features

Scope is already locked in `PROJECT.md` (single scrolling home page, no pricing, no testimonials yet). Research confirms the locked scope aligns with B2B SaaS landing page consensus and flags what's needed to execute it well.

**Must have (table stakes):**
- 5-second above-the-fold clarity naming the audience ("real estate brokerages"), one consistent primary CTA ("Get Started") repeated top/bottom
- Minimal nav (logo, Log in, Get Started — no dead links to non-existent pages)
- Outcome-framed value prop copy (not feature lists), 3-6 icon+text "how it works" pairs
- Footer with Privacy Policy/Terms links, copyright, contact email; both legal pages must exist before footer ships
- Meta/OG tags + one static 1200x630 OG image, favicon, sitemap.xml, robots.txt
- Mobile-responsive, accessible semantic structure (one `<h1>`, sequential `<h2>`s, alt text)

**Should have (differentiators):**
- Concrete before/after problem-framing copy in hero (highest-leverage copywriting lever per research)
- A real product screenshot (not stock photography) in hero/features
- Subtle scroll/hover microinteractions signaling product craft
- Multiple CTA touchpoints down the scroll (same CTA copy/style repeated, not new goals)

**Defer / do not build:**
- Fake testimonials or customer logos (trust-destroying once discovered) — add once real customers consent
- Any pricing section/table — tier data must stay sourced only from `AppConstants::PLAN_TIERS` via the in-app wizard, to avoid the drift pattern already flagged elsewhere in this project
- Live chat, autoplay video, newsletter capture, interactive demo/sandbox — all explicitly out of scope, several conflict with the "static, zero backend coupling" architecture decision

### Architecture Approach

`landing/` becomes a third plain-tracked directory (like `auth-callback/`, unlike the `frontend`/`backend` gitlinks) with its own fully independent `package.json`/lockfile and its own Vercel project, connected to the same GitHub repo via a dashboard-configured Root Directory setting. There is deliberately zero runtime coupling to `backend/` or `frontend/` — the only integration point is plain `<a href>` CTAs pointing to `app.realtybase.ca`. All content is authored at build time directly in `.astro` files; no CMS, no API calls, no auth.

**Major components:**
1. `landing/src/layouts/BaseLayout.astro` — single shared `<head>` shell (meta/OG, sitemap link, favicon, `<Analytics />`) — build this before any page content
2. `landing/src/pages/{index,privacy,terms}.astro` — the three routes, file-based routing, no nesting needed
3. `landing/src/components/*.astro` — one component per home-page section (Hero, ValueProp, FeatureGrid, ClosingCTA, SiteHeader, SiteFooter)
4. Vercel Project "landing" (dashboard-side, Root Directory = `landing/`) — connects to the same repo as the existing `frontend`/`auth-callback` projects, deploys independently

### Critical Pitfalls

1. **Vercel Root Directory misconfiguration** — invisible in git, no diff/test catches it; the new project could deploy the wrong folder or overwrite an existing project's build. Avoid by explicitly setting Root Directory to `landing/`, verifying the build log shows Astro (not Vite) output, and sanity-checking the live preview URL's actual content before attaching any domain.
2. **Apex domain cutover ships hidden backend/DNS/index debt** — `realtybase.ca` is a logical identity to this codebase's Host-header-driven multi-tenant resolution (`BrokerageAuth`/`MainDomainOnly`/`DomainRedirectMiddleware`/`BrokerageDomain`), not just a DNS record. Avoid by auditing for stale bare-apex `BrokerageDomain` rows/CORS entries before cutover, lowering DNS TTL ahead of time, and verifying via `curl -I` (not browser refresh) post-cutover.
3. **Cross-origin CTA mistakes** — a relative `/create` link (habit carried from the single-origin `frontend/` SPA) 404s on the marketing site itself. Avoid by centralizing CTA destinations as named constants using fully-qualified absolute URLs, and QA'ing click-throughs on the actual Vercel preview deployment, not local dev.
4. **`astro.config.mjs` `site` left unset/wrong** — silently breaks sitemap and canonical tags together, and can ship preview/localhost URLs into a search-engine-crawled sitemap. Avoid by hardcoding the final production apex in `site` before adding `@astrojs/sitemap`, and inspecting `dist/sitemap-index.xml` before every cutover-adjacent deploy.
5. **Placeholder legal text mistaken for final copy** — a flag in a ticket doesn't protect a public, indexed, footer-linked page from being treated as authoritative. Avoid by shipping a visible on-page "pending legal review" banner plus `noindex` meta on both legal pages in the same phase as the pages themselves.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Scaffold + Stack Setup
**Rationale:** Everything downstream depends on a working Astro+Tailwind scaffold; this is pure setup with no content decisions, so it can start immediately and unblocks all other phases.
**Delivers:** `landing/` directory with `astro dev` rendering a blank Tailwind-wired page, `BaseLayout.astro` shell (meta/OG placeholders, global styles import, `<Analytics />` wired), Slate CSS tokens hand-copied per the documented merge strategy (with source commit/file noted in a comment per Pitfall 7).
**Addresses:** N/A (infrastructure, not user-facing feature)
**Avoids:** Pitfall 7 (drift risk documented at copy time, not silently forgotten)

### Phase 2: Home Page Content
**Rationale:** The single highest-value work — copy and section composition — should happen once the layout shell exists, and can proceed in parallel with legal pages once Phase 1 lands.
**Delivers:** Hero, ValueProp, FeatureGrid, ClosingCTA, SiteHeader, SiteFooter components assembled into `index.astro`; outcome-framed copy per FEATURES.md guidance; CTAs wired as absolute, centralized-constant URLs.
**Addresses:** Table-stakes hero/value-prop/features/CTA elements and P1 differentiators (real product screenshot, before/after copy) from FEATURES.md
**Avoids:** Pitfall 3 (cross-origin CTA relative-path bugs) — click-through QA on preview deployment before phase is considered done

### Phase 3: Legal Pages
**Rationale:** Depends only on `BaseLayout` (Phase 1), can run in parallel with Phase 2, but must land before the footer is considered complete since footer links must resolve.
**Delivers:** `privacy.astro` and `terms.astro` with placeholder legal text following the recommended section headings from FEATURES.md, plus a visible "pending legal review" banner and `noindex` meta tags.
**Addresses:** Footer legal-link requirement, trust/compliance table stakes
**Avoids:** Pitfall 6 (placeholder text mistaken for final copy) — banner and `noindex` must ship in this phase, not deferred

### Phase 4: SEO Basics + Environment Hygiene
**Rationale:** Needs final content structure to exist (routes must be stable) but is independent of exact copy, so it can follow content phases without blocking them; must complete before any domain cutover.
**Delivers:** `@astrojs/sitemap` wired with `site` hardcoded to the production apex, `robots.txt`, environment-aware `noindex` on non-production `VERCEL_ENV`, OG image, favicon.
**Uses:** `@astrojs/sitemap` from STACK.md
**Implements:** SEO/meta component of `BaseLayout.astro` from ARCHITECTURE.md

### Phase 5: Vercel Project Setup + Preview Verification
**Rationale:** Must follow content/SEO phases (nothing to deploy otherwise) and must precede — and be fully separated from — the domain cutover, per the strongest pitfall finding in this research.
**Delivers:** New Vercel project with Root Directory explicitly set to `landing/`, Ignored Build Step configured, successful `*.vercel.app` preview deployment verified against the actual build log and rendered content (not just "build succeeded").
**Avoids:** Pitfall 1 (Root Directory misconfiguration) — this phase's explicit deliverable is the verification gate itself

### Phase 6: Apex Domain Cutover
**Rationale:** Last phase, deliberately isolated from site-build work; requires a backend-config audit that has nothing to do with the Astro codebase, so bundling it with earlier phases would blur an important review boundary.
**Delivers:** `realtybase.ca` apex pointed at the `landing/` Vercel project, backend audited for stale bare-apex `BrokerageDomain`/CORS references, DNS TTL lowered ahead of cutover, Search Console re-crawl requested post-cutover.
**Avoids:** Pitfall 2 (DNS/cache/index/backend-config debt from the previous portal) — this phase exists specifically to make that audit an explicit, named step rather than an afterthought

### Phase Ordering Rationale

- Scaffold-first, content-in-parallel, SEO-after-content, deploy-before-cutover, cutover-last: this ordering directly mirrors ARCHITECTURE.md's "Suggested Build Order" and keeps the two riskiest, hardest-to-diff steps (Vercel project config, domain cutover) as isolated, individually-verifiable phases rather than folded into content work.
- Legal pages and home-page content are independent of each other (both only depend on `BaseLayout`) and can be planned as parallel-capable phases, but both must land before the phase that finalizes the footer.
- SEO basics are architecturally independent of content per ARCHITECTURE.md's dependency notes, but are sequenced after content phases here because `site`/sitemap correctness should be verified against final route structure, and because Pitfall 4/5 verification steps are naturally checked once real pages exist.
- Domain cutover is separated into its own phase specifically because Pitfall 1 and Pitfall 2 both call out that combining "does the build work" with "is the domain live" hides failures until they're expensive to diagnose.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 6 (Apex Domain Cutover):** Needs a concrete backend audit checklist against this project's actual `BrokerageDomain`/`MainDomainOnly`/`DomainRedirectMiddleware` implementation — PITFALLS.md flags the risk but the actual current state of those rows/configs needs first-party investigation during planning, not just research.
- **Phase 4 (SEO Basics):** The Vercel Analytics "Hobby plan free tier limit" figure sourced in STACK.md is explicitly LOW/MEDIUM confidence (third-party pricing summaries) — worth a quick primary-source check against `vercel.com/docs/analytics/limits-and-pricing` before assuming a specific cap in planning.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Scaffold):** Astro + Tailwind v4 + Vercel static deploy is a fully documented, HIGH-confidence pattern with an existing in-repo precedent (`auth-callback/`).
- **Phase 2/3 (Content pages):** Standard Astro file-based routing and component composition, no novel patterns.
- **Phase 5 (Vercel Project Setup):** Directly matches the existing `frontend`/`auth-callback` dual-project precedent already running in this repo.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core versions verified via Context7 + live npm registry + official Vercel/Astro docs; only the Analytics free-tier limit figure is MEDIUM (third-party pricing summaries) |
| Features | MEDIUM-HIGH | Conversion/structural patterns are strong industry consensus across many 2026 sources; specific benchmark numbers are MEDIUM (single-vendor-sourced) |
| Architecture | HIGH | Verified against official Vercel monorepo docs, official Astro docs, and direct first-party repo inspection (existing `frontend`/`auth-callback` configs) |
| Pitfalls | HIGH / MEDIUM | Vercel monorepo behavior and Astro env/sitemap config verified against official docs and direct codebase inspection (HIGH); apex-domain-cutover cache/cookie behavior is MEDIUM (general DNS guidance, not this project's specific DNS provider) |

**Overall confidence:** HIGH

### Gaps to Address

- Vercel Analytics exact free-tier event cap: validate against `vercel.com/docs/analytics/limits-and-pricing` directly before assuming a specific number matters for planning (low stakes — a marketing site at launch won't approach any plausible cap, but don't assert a number in user-facing docs without checking).
- Whether UTM/conversion tracking passthrough on CTAs is actually wanted for this milestone is unresolved — PITFALLS.md and FEATURES.md both flag it as "not explicitly in scope" per `PROJECT.md`'s target features, but it should be explicitly confirmed with stakeholders during phase discussion, since retrofitting after launch requires re-touching every CTA.
- Exact current state of backend `BrokerageDomain` rows / CORS allowlist / `MainDomainOnly` config referencing bare `realtybase.ca` needs first-party investigation during the domain-cutover phase's planning — research flags the risk pattern but doesn't (and can't, without querying the live system) enumerate the actual stale references.
- Whether Quebec Law 25 or other regional compliance obligations apply given the `.ca` domain is explicitly flagged as pending legal review, not resolved by this research — correctly deferred to the actual legal review, but worth a placeholder note in the Privacy Policy structure (already included in FEATURES.md's recommended section headings).

## Sources

### Primary (HIGH confidence)
- Context7 `/withastro/docs` — Tailwind integration, Vercel adapter, sitemap integration guides
- `npm view astro/@astrojs/vercel/@astrojs/sitemap/@vercel/analytics/tailwindcss/@tailwindcss/vite` — live npm registry, verified 2026-07-30
- https://vercel.com/docs/analytics/quickstart, https://vercel.com/docs/analytics/custom-events — official Vercel docs
- https://vercel.com/docs/monorepos, https://vercel.com/docs/monorepos/monorepo-faq — Root Directory / multi-project pattern
- https://docs.astro.build/en/basics/project-structure/, https://docs.astro.build/en/guides/deploy/vercel/, https://docs.astro.build/en/guides/integrations-guide/vercel/ — Astro official docs
- https://docs.astro.build/en/guides/environment-variables/, https://docs.astro.build/en/guides/configuring-astro/ — env var prefix and `site` config requirements
- https://tailwindcss.com/docs/installation/framework-guides/astro — official Tailwind v4 Astro integration path
- Direct repo inspection: `frontend/vercel.json`, `auth-callback/vercel.json`, `frontend/src/assets/config/colorSchemes.ts`, `frontend/src/index.css`, `frontend/.env.example`, `frontend/package.json`, `.planning/PROJECT.md`

### Secondary (MEDIUM confidence)
- Multiple 2026 B2B SaaS landing page best-practice sources (Leadfeeder, Genesys Growth, Apexure, Growthspree, SaaS Hero, Powered by Search, First Page Sage, Cortes Design) — cross-referenced conversion pattern consensus
- SaaS legal template sources (TermsFeed, PrivacyPolicyGenerator.info, GetTerms.io) — Privacy Policy / ToS section structure
- Vercel apex-domain cookie/cache behavior — general DNS/Vercel guidance, not this project's specific DNS provider

### Tertiary (LOW confidence)
- WebSearch "Vercel Web Analytics custom events Hobby plan free tier limit" — third-party pricing summary sites, not fetched directly from Vercel's own pricing page; validate before assuming this cap in production planning

---
*Research completed: 2026-07-30*
*Ready for roadmap: yes*

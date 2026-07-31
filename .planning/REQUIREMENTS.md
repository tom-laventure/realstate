# Requirements: RealState SaaS Platform — v1.14 Marketing Landing Site

**Defined:** 2026-07-30
**Core Value:** Brokerage agents can discover, evaluate, and coordinate on listings inside their isolated workspace — safely and reliably.

## v1 Requirements

Requirements for the v1.14 Marketing Landing Site milestone. Each maps to roadmap phases.

### Landing Page

- [x] **LAND-01**: Visitor sees a hero section naming the audience (real estate brokerages) and the value prop, understandable within 5 seconds, above the fold
- [x] **LAND-02**: Visitor sees one consistent primary CTA ("Get Started") repeated at the top and bottom of the page, linking to `app.realtybase.ca/create`
- [x] **LAND-03**: Visitor sees a secondary "Log in" CTA linking to `app.realtybase.ca/auth/login`
- [x] **LAND-04**: Visitor sees a features/how-it-works section with 3-6 icon+text pairs (lucide icons) describing real shipped capabilities (listings, groups, calendar sync, role-based access, etc.)
- [x] **LAND-05**: Visitor sees a minimal nav bar (logo, Log in, Get Started) with no dead or placeholder links
- [x] **LAND-06**: Visitor sees a footer with Privacy Policy and Terms of Service links, copyright, and a contact email
- [x] **LAND-07**: Page uses the "Slate" color scheme — the fully-merged base tokens (`frontend/src/index.css`) + Slate override (`frontend/src/assets/config/colorSchemes.ts`), hand-copied into `landing/` with a source-commit comment documenting the copy
- [x] **LAND-08**: Page is mobile-responsive and uses semantic HTML (one `<h1>`, sequential `<h2>`s, alt text on images)

### Legal Pages

- [x] **LEGAL-01**: Visitor can view a Privacy Policy page with placeholder/boilerplate legal text, structured per standard SaaS section headings
- [x] **LEGAL-02**: Visitor can view a Terms of Service page with placeholder/boilerplate legal text, structured per standard SaaS section headings
- [x] **LEGAL-03**: Both legal pages display a visible on-page "pending legal review" banner
- [x] **LEGAL-04**: Both legal pages are marked `noindex` while they remain placeholder text

### SEO

- [ ] **SEO-01**: Page has meta title/description and Open Graph + Twitter card tags, including a static logo/wordmark OG image
- [x] **SEO-02**: Site generates a `sitemap.xml` with `site` hardcoded to the production apex domain (never derived from `VERCEL_URL`)
- [x] **SEO-03**: Site serves a `robots.txt` referencing the sitemap
- [ ] **SEO-04**: Non-production preview deployments are marked `noindex` (environment-aware — production stays indexable)

### Analytics

- [ ] **ANALYTICS-01**: Vercel Analytics tracks page views and CTA clicks (Get Started / Log in) via the framework-native `<Analytics />` component; no cookie-consent banner (cookieless)

### Deploy

- [x] **DEPLOY-01**: `landing/` exists as an independently-buildable Astro + Tailwind project (own `package.json`/lockfile, own `vercel.json`) at the monorepo root, plain-tracked (not a submodule/gitlink) like `auth-callback/`
- [ ] **DEPLOY-02**: A new Vercel project exists with Root Directory set to `landing/`, verified via build log + rendered content to deploy Astro output (not another project's) to its own `*.vercel.app` preview URL
- [ ] **DEPLOY-03**: Apex domain cutover steps (DNS, Vercel domain assignment, backend `BrokerageDomain`/CORS audit for stale bare-apex references) are written up as a documented manual follow-up — not executed in this milestone

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Landing Page Polish

- **LAND-09**: Real product screenshots replacing icon+text feature pairs, once representative demo data/screenshots exist
- **LAND-10**: Customer testimonials / logos, once real customers exist and consent to being featured
- **LAND-11**: UTM/conversion-tracking params on CTA links, if campaign attribution becomes a real need

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Pricing section on the landing page | Tier data (`AppConstants::PLAN_TIERS`) must stay single-sourced in the `/create` wizard, not duplicated here — avoids the exact drift pattern already flagged elsewhere in this project (see PROJECT.md's plan-tier-union consolidation note) |
| Live chat, autoplay video, newsletter capture, interactive demo/sandbox | Conflict with the static, zero-backend-coupling architecture decision; not core to a B2B conversion page |
| Fake testimonials or customer logos | Trust-destroying once discovered; no real customers exist yet |
| Real product screenshots (this milestone) | No representative demo data/screenshots exist yet; icons+text chosen deliberately for this milestone (deferred to LAND-09) |
| Executing the apex domain DNS/Vercel cutover | Requires manual DNS/Vercel dashboard access outside agent reach; documented as a follow-up per DEPLOY-03, same pattern as the "Migrate main-domain portal to app.realtybase.ca" ticket |
| Full legal review of Privacy Policy / Terms text | Tracked under the separate "Research and implement full privacy policy and legal text" ticket; this milestone ships clearly-flagged placeholder text only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAND-01 | Phase 43 | Complete |
| LAND-02 | Phase 43 | Complete |
| LAND-03 | Phase 43 | Complete |
| LAND-04 | Phase 43 | Complete |
| LAND-05 | Phase 43 | Complete |
| LAND-06 | Phase 43 | Complete |
| LAND-07 | Phase 42 | Complete |
| LAND-08 | Phase 43 | Complete |
| LEGAL-01 | Phase 43 | Complete |
| LEGAL-02 | Phase 43 | Complete |
| LEGAL-03 | Phase 43 | Complete |
| LEGAL-04 | Phase 43 | Complete |
| SEO-01 | Phase 44 | Pending |
| SEO-02 | Phase 44 | Complete |
| SEO-03 | Phase 44 | Complete |
| SEO-04 | Phase 44 | Pending |
| ANALYTICS-01 | Phase 44 | Pending |
| DEPLOY-01 | Phase 42 | Complete |
| DEPLOY-02 | Phase 45 | Pending |
| DEPLOY-03 | Phase 46 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-07-30*
*Last updated: 2026-07-30 after roadmap creation (Phases 42-46)*

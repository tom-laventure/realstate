# Feature Research

**Domain:** B2B SaaS marketing landing site (single scrolling home page + legal pages) for a real estate brokerage platform
**Researched:** 2026-07-30
**Confidence:** MEDIUM-HIGH (conversion patterns are well-established industry consensus across multiple 2026 sources; specific benchmark numbers are MEDIUM confidence, single-vendor-sourced)

> **Note:** This file replaces prior-milestone feature research (Google Social Login, calendar sync, etc.), which is no longer relevant scope. This research covers only the v1.14 Marketing Landing Site milestone.

## Context Recap (from PROJECT.md — do not re-decide)

Already locked for this milestone: Astro + Tailwind `landing/` site, own Vercel project, Slate color scheme matching `/create`. Single scrolling home page (hero, value prop, features/how-it-works via icon+text pairs, closing CTA). Separate Privacy Policy + Terms of Service pages, placeholder/boilerplate legal text flagged pending review. **No pricing section** — tier data stays sourced from the in-app wizard only. Primary CTA "Get Started" → `app.realtybase.ca/create`. Secondary "Log in" → `app.realtybase.ca/auth/login`. Vercel Analytics + SEO basics (meta/OG/sitemap/robots.txt).

This research covers only what's needed to fill in that locked structure well — not whether to build it.

---

## Feature Landscape

### Table Stakes (Structural/Content Elements Expected on Any B2B SaaS Landing Page)

Missing these makes the page feel unfinished or untrustworthy to a brokerage owner evaluating whether to trust you with their business data.

| Element | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 5-second above-the-fold clarity (what it is, who it's for, one action) | Visitor must understand the offer without scrolling; confusion = bounce. Consensus across all sources reviewed. | LOW | Headline should name the audience ("real estate brokerages") not just the category ("SaaS platform"). Avoid generic "all-in-one platform" copy. |
| Single, consistent primary CTA repeated at top and bottom | Same CTA label in nav, hero, and closing section reduces decision friction; already locked as "Get Started" | LOW | Reuse exact same copy/style every instance — do not vary ("Get Started" vs "Sign Up" vs "Try Free") across sections. |
| Minimal top nav (logo + Log in + primary CTA, no mega-menu) | Reduces exit paths; a one-page site has nothing to link to internally besides anchors/legal pages | LOW | Nav should NOT expose multiple competing links (pricing, blog, docs) that don't exist yet — see anti-features. |
| Value proposition stated in outcome language, not feature language | Buyers convert on "what changes for me" not "what the software does" | MEDIUM | E.g., "Give every agent one shared view of every listing" beats "Manage listings, groups, and documents." |
| Feature/how-it-works section as scannable icon+text pairs | Already locked; matches "bento-grid" scanability pattern — B2B buyers skim, they don't read paragraphs on first visit | LOW | 3-6 items max. Each pair: short bolded label + one sentence, not a paragraph. |
| Mobile-responsive, fast-loading layout | Real estate is a mobile-heavy vertical (agents on-site); a slow/broken mobile hero kills first impressions | LOW-MEDIUM | Astro's static output makes this close to free if images are optimized (see below). |
| Footer with legal links (Privacy Policy, Terms of Service) | Baseline trust/compliance expectation; also required before any real user data is collected via the site (analytics counts) | LOW | Footer should also include a copyright line and, ideally, a contact/support email — B2B buyers look for "is there a real company behind this." |
| Meta title/description + Open Graph tags + favicon | Already locked as SEO basics, but worth flagging: OG image matters specifically because brokerage decision-makers often share the link internally (email/Slack) before clicking — a broken/generic OG preview undercuts trust before the click | LOW | Use one static OG image sized 1200x630; don't skip this even though it feels cosmetic. |
| Sitemap.xml + robots.txt | Already locked; table stakes for any indexed marketing site | LOW | Trivial in Astro via `@astrojs/sitemap`. |
| Clear "who this is for" framing (brokerage owner/admin, not agents/consumers) | The audience for this page is explicitly a brokerage decision-maker, not an individual agent or a home-buying consumer — misaligned framing (e.g., consumer-facing "find your dream home" language) actively repels the actual buyer | LOW | This is a B2B admin/operator sell, not a real estate listings site. Copy must speak to running a brokerage, not browsing homes. |
| Visible, obvious secondary path ("Log in") separate from primary CTA | Returning brokerage staff/owners will hit the marketing domain by mistake or via bookmark; without a visible login path they bounce or get stuck trying "Get Started" and hitting a signup flow | LOW | Already locked in nav; worth confirming it's visually secondary (not competing) to "Get Started." |
| Accessible semantic structure (heading hierarchy, alt text, focus states) | Baseline per CLAUDE.md frontend philosophy; also affects SEO crawlability | LOW | One `<h1>` in hero, sequential `<h2>`s per section. Icon-only elements need `aria-label` or accompanying text (already true given icon+text pairs). |

### Differentiators (Worth Doing Well, Not Just Present)

These won't make-or-break trust, but they're where a small B2B SaaS page actually moves conversion rate from "generic" to "credible."

| Element | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Concrete before/after or problem-framing copy in hero/value-prop | "Your listings live in five different tools your agents half-check" → "One shared workspace" is dramatically more persuasive than abstract feature lists — this is the single highest-leverage copywriting lever per research | LOW (copywriting effort, not engineering) | Costs nothing to build; costs real thought to write well. Worth spending disproportionate effort here relative to visual polish. |
| Product screenshot or lightweight visual (not stock photography) of the actual dashboard/group view | Real B2B buyers trust product reality over generic illustration; even one well-cropped real screenshot outperforms abstract hero art | LOW-MEDIUM | Use an existing frontend screen (e.g., a group dashboard or listing view) styled/cropped for the hero or feature section. Avoid free stock-photo "people looking at laptop" imagery — actively signals generic/templated to a discerning buyer. |
| Subtle scroll-triggered entrance animation / hover microinteractions on feature cards | Signals product craft and engineering quality — a proxy trust signal ("if the marketing site is this polished, the product probably is too") | LOW | Astro supports this cheaply with CSS `@media (prefers-reduced-motion)`-respecting transitions; keep it restrained, not "flashy SaaS template" energy. |
| Multiple CTA opportunities at natural scroll-stop points (not just top+bottom) | Buyers convert where their attention peaks, not necessarily at the very top or very bottom | LOW | E.g., a CTA after the value-prop section in addition to hero and closing CTA — still only ONE CTA style/label, just repeated. |
| Founder-market credibility framing without fabricated social proof | Since there are no real customer logos/testimonials yet (see anti-features), a short, honest framing line ("Built for independent and growing brokerages") substitutes for social proof without lying | LOW | This is a copy decision, not a feature — flag for whoever writes final copy. |
| Distinct visual identity from the in-app SPA while still using the same Slate palette/brand | Astro site should feel like "the same company" but doesn't need to be pixel-identical to the app shell — some marketing-specific flourish (larger type scale, more whitespace, generous section padding) helps it read as a marketing page, not an app screen | LOW | Already implied by the separate-project decision; worth stating explicitly as an intentional choice, not an inconsistency. |

### Anti-Features (Would Hurt Conversion or Don't Fit This Page)

| Anti-Feature | Why It Seems Appealing | Why It's Problematic Here | Alternative |
|--------------|------------------------|----------------------------|-------------|
| Fake/placeholder testimonials or customer logos | "Social proof always helps conversion" | Fabricated quotes or logo walls are a trust-destroying move the moment a prospect recognizes them as fake — worse than having none at all, and this is explicitly a small/new product | Omit the section entirely for this milestone. Add real testimonials/logos as a later milestone once actual brokerage customers exist. |
| Pricing section/table | "Buyers want to see price before clicking" | Already explicitly decided against — tier data lives only in the in-app wizard; a landing-page pricing table would drift out of sync with `AppConstants::PLAN_TIERS` the moment tiers change (exactly the kind of drift this codebase has fought before — see plan-tier string union consolidation issue in PROJECT.md) | Keep pricing entirely inside the `/create` wizard, which already fetches live tier data via `GET /v1/onboarding/plan_tiers`. |
| Multi-page marketing site (About, Blog, Case Studies, Docs nav items) | "More content = more SEO surface, more credibility" | Explicitly locked as single scrolling page; a nav promising pages that don't exist (or thin/empty pages) reads as unfinished and adds real build scope for zero validated demand | Ship the one-pager now; add a blog/docs subdirectory only if/when there's content strategy and bandwidth to sustain it. |
| Live chat widget / chatbot | "Reduces friction, answers objections in real time" | For a 1-page site with a single clear CTA, a chat widget is unstaffed-support theater — an unanswered chat bubble signals neglect, and it's one more third-party script hurting load performance and Vercel Analytics cleanliness | Rely on the CTA + a support/contact email in the footer. Add live chat later if support volume justifies it. |
| Autoplay video/hero background video | "Feels modern, shows the product in motion" | Heavy asset for a static Astro site optimized for fast load; autoplay video is also a common accessibility/annoyance complaint and works against "5-second clarity" if it distracts from the headline | Use a static product screenshot or lightweight illustration instead; if video is wanted later, make it click-to-play, not autoplay. |
| Newsletter signup / email capture form separate from the primary CTA | "Captures leads not ready to convert yet" | Adds a second conversion goal that competes with and dilutes the single "Get Started" CTA — research consensus is B2B landing pages convert best with ONE primary goal; also requires new backend/email infra out of scope for this milestone | If a lighter "not ready yet" path is wanted, it should still route to something CTA-adjacent (e.g., a mailto or a "Log in" if they're already a user) rather than a new lead-gen form/database. |
| Interactive product demo / embedded sandbox on the landing page | "Let them try before they sign up" | High engineering cost, requires exposing a working slice of the actual multi-tenant app publicly, and contradicts the "static Astro site independent of frontend/ SPA" architecture decision already locked | The `/create` wizard IS the low-friction trial path already — "Get Started" routes straight into it. |
| Cookie consent banner / heavy compliance tooling for this launch | "GDPR/legal compliance" | Vercel Analytics as currently used is typically cookieless/privacy-friendly by default (Vercel's own analytics doesn't use client-side cookies) — bolting on a full consent-management platform for a marketing-only static site with no forms is disproportionate scope for this milestone | Confirm Vercel Analytics' cookie-free posture (do not assume — verify at implementation time) and note any consent requirement in the Privacy Policy's cookie section rather than adding a banner now. Flag as a phase-specific research item if the team wants to double check regional (e.g. Quebec Law 25, given `.ca` domain) obligations. |
| Duplicating full plan/tier feature lists on the landing page "features" section | "Shows everything the product does" | Already-decided no-pricing constraint implies no tier-gated feature comparison either; doing so on a static site guarantees drift against `AppConstants::PLAN_TIERS` the moment a tier's capabilities change, and turns the "how it works" section into a feature-dump instead of a scannable value pitch | Keep the features/how-it-works section to 3-6 universal value props (works for any tier), not a tier-by-tier capability matrix. |

---

## Feature Dependencies

```
Hero (value prop + primary CTA)
    └──requires──> Clear audience framing (brokerage owner/admin copy decision)

Features/How-it-works section
    └──enhances──> Hero (reinforces claim with specifics)

Closing CTA
    └──depends on──> Same CTA copy/destination as Hero (consistency requirement, not a build dependency)

Footer (legal links)
    └──requires──> Privacy Policy page + Terms of Service page (must exist before footer links can resolve)

SEO basics (meta/OG/sitemap/robots.txt)
    └──independent of──> page content (can be built in parallel with content)

Vercel Analytics
    └──may affect──> Privacy Policy "Cookies/Analytics" section content (verify Vercel Analytics' data practices before writing that section's specifics)

Pricing section ──conflicts──> Locked "no pricing" decision (explicitly excluded, not deferred — do not build)
Testimonials/logos ──conflicts──> No real customers yet (explicitly excluded for this milestone, candidate for a later milestone)
```

### Dependency Notes

- **Footer requires Privacy Policy + ToS pages:** the footer is part of the single-page layout, but it links out to two standalone pages that must exist and be routable before the footer ships — sequence legal pages alongside or before the footer, not after.
- **SEO basics are independent:** sitemap/robots/meta can be scaffolded on Astro's default template before final copy is locked, so this doesn't block on content decisions.
- **Vercel Analytics affects legal copy:** confirm what data Vercel Analytics actually collects (page views, referrers, etc.) before finalizing the Privacy Policy's "Cookies and Tracking" section — don't write generic boilerplate that overstates or understates what's actually collected.

---

## MVP Definition

### Launch With (v1 — this milestone)

- [ ] Hero section: headline (audience + outcome in one line), subhead, primary CTA "Get Started", secondary "Log in"
- [ ] Value proposition section: 1-3 outcome-framed statements, not feature lists
- [ ] Features/how-it-works: 3-6 icon+text pairs covering core value (listings, groups/collaboration, multi-tenant workspace)
- [ ] Closing CTA section: restates primary CTA, no new copy/decision points
- [ ] Minimal top nav: logo, Log in, Get Started (no other links)
- [ ] Footer: Privacy Policy link, Terms of Service link, copyright line, contact/support email
- [ ] Privacy Policy page (placeholder boilerplate, flagged pending legal review)
- [ ] Terms of Service page (placeholder boilerplate, flagged pending legal review)
- [ ] Meta title/description, OG tags + one static OG image, favicon
- [ ] sitemap.xml, robots.txt
- [ ] Vercel Analytics wired in
- [ ] Mobile-responsive layout, Slate color scheme matching `/create`

### Add After Validation (v1.x — once real customers/data exist)

- [ ] Real testimonials/customer logos (only once actual brokerage customers exist and consent to being named)
- [ ] Product screenshot refresh cadence (update hero/feature imagery as the actual app UI evolves)
- [ ] A/B test alternate hero headlines once there's enough traffic to measure

### Future Consideration (v2+ — do not build now)

- [ ] Blog/content marketing section — only with a real content strategy
- [ ] Case studies/customer stories pages
- [ ] Pricing page — only if the product decision to expose self-serve pricing publicly changes (currently deliberately gated behind the wizard)
- [ ] Interactive demo/sandbox

---

## Feature Prioritization Matrix

| Element | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hero clarity + consistent CTA | HIGH | LOW | P1 |
| Outcome-framed copy (vs feature-dump) | HIGH | LOW (writing effort) | P1 |
| Footer + legal pages | HIGH (trust/compliance) | LOW-MEDIUM | P1 |
| SEO basics (meta/OG/sitemap/robots) | MEDIUM | LOW | P1 |
| Real product screenshot in hero/features | MEDIUM-HIGH | LOW-MEDIUM | P2 |
| Scroll/hover microinteractions | LOW-MEDIUM | LOW | P2 |
| Multiple CTA touchpoints down the scroll | MEDIUM | LOW | P2 |
| Fake social proof | NEGATIVE | — | Do not build |
| Pricing table | NEGATIVE (drift risk) | — | Do not build |
| Live chat widget | LOW/NEGATIVE | MEDIUM | Do not build |

**Priority key:** P1 = must have for launch, P2 = should have, add when possible, P3 = nice to have/future.

---

## Privacy Policy & Terms of Service — Structural Requirements

The milestone explicitly wants boilerplate/placeholder legal text (flagged pending real legal review), but the page **structure** (section headings) should already match what a real SaaS Privacy Policy / ToS needs, so the later legal-review pass is a text-only edit, not a re-architecture. Confidence: MEDIUM (structure is consistent across multiple SaaS legal-template sources; exact clause wording is explicitly out of scope since it's placeholder).

### Privacy Policy — recommended section headings

1. **Introduction / Overview** — who the policy covers (RealtyBase, its brokerage customers, and their end users), effective date, placeholder-pending-review notice at the top
2. **Definitions** — key terms (e.g., "Personal Data," "Brokerage," "Account," "Service")
3. **Information We Collect** — categories: account/contact info, brokerage/tenant data, usage/analytics data (tie to Vercel Analytics), cookies (if any)
4. **How We Use Information** — service delivery, communications, analytics, security
5. **How Information Is Shared** — sub-processors/vendors (e.g., AWS Cognito, hosting, analytics), no-sale-of-data statement
6. **Data Retention** — how long data is kept, deletion practices (tie loosely to existing soft-delete/`acts_as_paranoid` posture if relevant, though this is app-level not marketing-site-level)
7. **Cookies and Tracking Technologies** — specifics pending confirmation of what Vercel Analytics actually collects
8. **Data Security** — general statement of safeguards
9. **Your Rights and Choices** — access/correction/deletion requests; regional carve-outs placeholder (e.g., GDPR/CCPA/Quebec Law 25 given the `.ca` domain — flag as pending legal review rather than asserting specific compliance)
10. **Children's Privacy** — standard not-directed-at-children statement
11. **International Data Transfers** — placeholder if applicable
12. **Changes to This Policy** — how updates will be communicated
13. **Contact Us** — support/legal contact email

### Terms of Service — recommended section headings

1. **Introduction / Acceptance of Terms** — placeholder-pending-review notice at the top
2. **Definitions** — "Service," "Account," "Brokerage," "User," "Content"
3. **Eligibility / Account Registration** — who can sign up (brokerage owners/admins), account accuracy obligations
4. **Description of Service** — brief, non-binding description of what RealtyBase provides
5. **Subscription Plans and Billing** — placeholder only; explicitly do not hardcode Free/Independent/Growth pricing here since pricing is excluded from the marketing site and lives in-app — keep this section generic ("plans and fees as described at time of purchase") to avoid drift
6. **User Responsibilities / Acceptable Use** — prohibited conduct, data accuracy for listings, no unauthorized access
7. **Intellectual Property** — ownership of the Service vs. customer-owned brokerage data/content
8. **Data Ownership and Privacy** — cross-reference to the Privacy Policy
9. **Termination** — by user, by RealtyBase, effect of termination
10. **Disclaimers and Limitation of Liability** — standard "as is" language, placeholder pending real legal review
11. **Indemnification** — standard boilerplate
12. **Governing Law and Dispute Resolution** — placeholder jurisdiction (flag: confirm with real legal counsel given `.ca` domain likely implies Canadian jurisdiction preference)
13. **Changes to Terms** — how updates will be communicated
14. **Contact Us** — support/legal contact email

### Notes for implementation

- Both pages should carry a clearly visible, non-hidden banner/callout (not just a footer footnote) stating the text is placeholder/template content pending legal review — this was explicitly required by the milestone decision, not just a nice-to-have.
- Do not let the ToS "Subscription Plans and Billing" section enumerate specific prices/seat caps — that data already has one source of truth (`AppConstants::PLAN_TIERS`, surfaced via `GET /v1/onboarding/plan_tiers`) and hardcoding a second copy in static marketing-site legal text recreates the exact "N independent declarations of the same fact" drift problem already flagged as tech debt elsewhere in this project (see PROJECT.md's plan-tier string union note).
- Both pages are static Astro pages with no forms/interactivity — LOW complexity to build once headings/placeholder copy exist.

---

## Sources

- [12 Landing Page Best Practices of 2026 You Need — Leadfeeder](https://www.leadfeeder.com/blog/conversion-optimization/landing-pages-convert/)
- [Best Practices for Designing B2B SaaS Landing Pages – 2026 — Genesys Growth](https://genesysgrowth.com/blog/designing-b2b-saas-landing-pages)
- [B2B SaaS Landing Pages: Strategy for More Demos (2026) — Apexure](https://www.apexure.com/blog/b2b-saas-marketing-the-right-landing-page-strategy/)
- [B2B SaaS Landing Page Benchmarks & Conversion Guide — Growthspree](https://www.growthspreeofficial.com/blogs/b2b-saas-landing-page-best-practices-demo-conversion-2026)
- [High-Converting SaaS Landing Pages: 2026 Best Practices — SaaS Hero](https://www.saashero.net/design/enterprise-landing-page-design-2026/)
- [18 B2B SaaS Landing Page Best Practices That Convert — SaaS Hero](https://www.saashero.net/design/saas-landing-page-best-practices/)
- [B2B SaaS Landing Page Checklist — Powered by Search](https://www.poweredbysearch.com/learn/b2b-saas-landing-page-checklist/)
- [Creating B2B SaaS Landing Pages: A Breakdown with Examples — First Page Sage](https://firstpagesage.com/seo-blog/creating-b2b-saas-landing-pages/)
- [The Ultimate B2B SaaS Landing Page Formula — Cortes Design](https://www.cortes.design/post/b2b-saas)
- [SaaS Privacy Policy Template — TermsFeed](https://www.termsfeed.com/blog/sample-saas-privacy-policy-template/)
- [SaaS Terms & Conditions Template — TermsFeed](https://www.termsfeed.com/blog/sample-saas-terms-conditions-template/)
- [SaaS Privacy Policy Template — PrivacyPolicyGenerator.info](https://www.privacypolicygenerator.info/sample-saas-privacy-policy-template/)
- [Free SaaS Privacy Policy Template — GetTerms.io](https://getterms.io/templates/saas-privacy-policy-template)
- `.planning/PROJECT.md` — existing plan-tier drift precedent, locked milestone scope, existing stack

---
*Feature research for: B2B SaaS marketing landing site (RealtyBase v1.14)*
*Researched: 2026-07-30*

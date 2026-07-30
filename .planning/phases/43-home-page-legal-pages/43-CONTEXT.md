# Phase 43: Home Page & Legal Pages - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the complete, accessible marketing home page (hero, value prop, features/how-it-works, closing CTA, nav, footer) plus two legal pages (Privacy Policy, Terms of Service) with clearly-flagged placeholder text — building on Phase 42's scaffold (`BaseLayout.astro`, Slate tokens, `landing/` project). No SEO meta/OG/sitemap work (Phase 44), no Vercel project setup (Phase 45), no domain cutover (Phase 46).

</domain>

<decisions>
## Implementation Decisions

### Brand Mark
- **D-01:** Nav/header uses a text wordmark — "RealtyBase" set in the Slate primary color, clean sans-serif. No logo image asset. (No company logo exists anywhere in the codebase — `VITE_BRAND_LOGO_URL` currently points at one specific test brokerage's uploaded logo, id 4914, not a company brand mark; do not reuse that URL or asset.)

### CTA & Motion
- **D-02:** Add a second "Get Started" CTA touchpoint after the value-prop section, in addition to the hero and closing CTAs (already locked). Same copy/style as the other two — not a new goal.
- **D-03:** Any hover/scroll polish is CSS-only (`:hover`, `transition`, respecting `prefers-reduced-motion`) — no JavaScript, no client-side hydration. This honors Phase 42's "zero JS by default" lock. Do not add a JS animation library.

### Feature Section Content
- **D-04:** The features/how-it-works section covers exactly these 7 capabilities (icon+text pairs, lucide icons per the original ticket decision):
  1. MLS/board-synced listings — listings sync automatically from the brokerage's connected MLS/RETS board, no manual re-entry
  2. Group collaboration — agents organize listings into groups with shared comments, ratings, documents, and dates
  3. Role-based access — owner/admin/agent tiers control who can manage listings, invite staff, configure the brokerage
  4. Multi-tenant isolation — each brokerage gets its own fully isolated, secure workspace
  5. Custom domain — brokerages can run the platform on their own branded domain instead of a shared subdomain
  6. Client sharing — invite clients into specific groups to view curated listings directly
  7. Smart filter-set/client pairing — filter sets automatically pair client groups with matching listings
- **D-05:** 7 is intentionally over the research-recommended 3-6 for scanability — user explicitly confirmed keeping all 7 rather than trimming. Layout should group related pairs (e.g., "Group collaboration" + "Multi-tenant isolation") visually so 7 doesn't read as crowded — left to planner/executor's layout judgment, not a re-open of scope.

### Hero & Value-Prop Copy
- **D-06:** Hero headline leads with the "scattered tools/data" pain point — fragmentation: listings, client coordination, and board data spread across spreadsheets, group texts, and disconnected tools; RealtyBase unifies it into one workspace. This is the framing angle, not final copy — actual headline/subhead wording is drafted during planning/execution, grounded in `.planning/PROJECT.md` and this angle, then reviewed before ship (per the original ticket's "initial draft, reviewed/edited before ship" instruction).
- **D-07:** Value prop and feature-pair copy must stay outcome-framed (what changes for the brokerage), not feature-dump language, per FEATURES.md's table-stakes guidance.

### Contact Info & Legal Placeholder
- **D-08:** Footer and both legal pages use `hello@realtybase.ca` as the contact/support email.
- **D-09:** Legal pages use "RealtyBase" (or "RealtyBase Inc.") as the placeholder legal entity name, clearly flagged pending real legal review — same as the rest of the placeholder text (banner + noindex, per Phase 42's REQUIREMENTS.md LEGAL-03/LEGAL-04, to be implemented in this phase).

### Claude's Discretion
- Exact hero/subhead/feature-pair copy wording — grounded in D-06/D-07's framing, drafted during planning/execution.
- Visual grouping/layout of the 7 feature pairs (per D-05).
- Whether "RealtyBase" or "RealtyBase Inc." reads better in legal-page boilerplate — pick whichever matches other placeholder SaaS legal template conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (this milestone, v1.14)
- `.planning/research/FEATURES.md` — table stakes / differentiators / anti-features for the landing page; MVP definition list; full Privacy Policy (13 sections) and Terms of Service (14 sections) recommended headings with implementation notes (esp. ToS §5 must stay generic on pricing — no hardcoded tier prices)
- `.planning/research/SUMMARY.md` — executive summary, phase breakdown rationale
- `.planning/research/PITFALLS.md` — Pitfall 5 (placeholder legal text mistaken for final — needs visible banner + noindex), Pitfall 3 (cross-origin CTA absolute-URL requirement)
- `.planning/research/ARCHITECTURE.md` — recommended component split (Hero, ValueProp, FeatureGrid, ClosingCTA, SiteHeader, SiteFooter)

### Prior phase
- `.planning/phases/42-scaffold-stack-setup/42-CONTEXT.md` — D-01 (bare scaffold, header/footer deliberately deferred to this phase), D-02 (TypeScript convention)
- `.planning/phases/42-scaffold-stack-setup/42-SUMMARY.md` (x3, plans 01-03) — what actually exists in `landing/` right now: `BaseLayout.astro`, `global.css` with merged Slate tokens, `index.astro` (currently a bare proof-of-tokens page to be replaced with real content)
- `.planning/phases/42-scaffold-stack-setup/42-REVIEW.md` + `42-REVIEW-FIX.md` — `favicon_transparent.png` is broken (fully transparent); `BaseLayout.astro`'s favicon now points to `favicon.ico` instead. Do not reintroduce `favicon_transparent.png` anywhere in this phase's markup.

### Project-level
- `.planning/PROJECT.md` — full list of validated/shipped capabilities (source for D-04's feature descriptions — verify each claim against actual REQ-IDs/phases before writing copy)
- `.planning/REQUIREMENTS.md` — LAND-01–06, LAND-08, LEGAL-01–04 (this phase's mapped requirements)
- `.planning/ROADMAP.md` — Phase 43 entry (goal, success criteria, dependencies)

### CTA targets (verified working, from original grill-me interview)
- "Get Started" → `app.realtybase.ca/create` (anonymous-accessible, main-domain-only — confirmed in `frontend/src/router/main.tsx`)
- "Log in" → `app.realtybase.ca/auth/login` (anonymous-accessible, any domain — confirmed in `frontend/src/router/auth/auth.tsx`)
- Both are cross-origin absolute URLs from `landing/`'s perspective (different domain) — use full `https://app.realtybase.ca/...` URLs, not relative paths (Pitfall 3)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `landing/src/layouts/BaseLayout.astro` — existing shared shell (meta, favicon, Analytics slot placeholder) from Phase 42; extend, don't replace
- `landing/src/styles/global.css` — Slate tokens already wired; use existing `--primary`/`--background`/`--foreground`/`--card`/`--border`/`--sidebar` custom properties, don't invent new colors
- `lucide-react`/lucide icon set — the app's only permitted icon library (per CLAUDE.md); landing/ is a separate Astro project but should use the same icon set (lucide has an Astro/vanilla-compatible package) for visual consistency

### Established Patterns
- `frontend/tsconfig.json` strict-TS convention — already mirrored in `landing/tsconfig.json` per Phase 42 D-02
- Astro file-based routing (`src/pages/*.astro`) — `privacy.astro` and `terms.astro` are new sibling routes to `index.astro`

### Integration Points
- `index.astro` (currently the Phase 42 bare proof-of-tokens page) gets replaced with the real home page composed of new components (Hero, ValueProp, FeatureGrid, ClosingCTA, SiteHeader, SiteFooter) per ARCHITECTURE.md's suggested split
- Footer links to `/privacy` and `/terms` — both routes must exist before footer ships (FEATURES.md dependency note)

</code_context>

<specifics>
## Specific Ideas

Hero headline direction (D-06): lead with fragmentation/scattered-tools pain point, not a generic "all-in-one platform" framing. Example angle (not final copy): "Your listings, your groups, your board data — currently living in five different places" → "One workspace." Actual wording to be drafted grounded in real PROJECT.md capabilities, then reviewed before ship.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `arch-brokerage-listing-access.md` ("Rethink listing access model — BrokerageEstate vs board credential JOIN") — matched Phase 43 by keyword ("app", "estate") only, score 0.6, same as Phase 42. Reviewed and confirmed unrelated: backend listing-access architecture debt, no connection to the marketing site. Left untouched in `.planning/todos/pending/`.

</deferred>

---

*Phase: 43-Home Page & Legal Pages*
*Context gathered: 2026-07-30*

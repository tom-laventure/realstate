# Phase 46: Apex Domain Cutover Runbook - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

A written, reviewable runbook (documentation only — no DNS/domain changes executed this milestone) describing exactly how to cut `realtybase.ca` over from the old `frontend` Vercel project to the new `landing/` Vercel project: a pre-cutover backend/CORS/DB audit checklist, TTL-lowering guidance, the Vercel dashboard steps to detach the apex from `frontend` and attach it to `landing/`, and a post-cutover verification section. Maps to REQUIREMENTS.md: DEPLOY-03.

</domain>

<decisions>
## Implementation Decisions

### Backend audit depth
- **D-01:** The runbook names concrete, already-identified findings explicitly (not just a generic "grep and review" instruction). Specifically: `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:77` — `FRONTEND_URL` fallback defaults to `"https://realtybase.ca"` (bare apex), used only when Google Calendar OAuth `state_data[:frontend_origin]` is absent. Include the file:line, what it does, and a recommended fix (e.g. change the fallback or require `frontend_origin` to always be present). Flag that this is a snapshot as of 2026-07-31 and should be re-verified (re-grep) at actual cutover time since code may drift before then.
- **D-02:** A read-only DB query was run now (`bin/rails runner`) against the local dev database to establish today's baseline: `BrokerageDomain.where(domain: ['realtybase.ca', 'www.realtybase.ca'])` returned **empty** — no row references either bare apex or `www`. Bake this confirmed-empty finding into the runbook as today's baseline, with an explicit caveat that this checked the **local dev DB only** — production must be independently re-verified (via the same query against production, e.g. through Rails console access on the production environment) at actual cutover time, not assumed identical.
- Other backend files scouted and confirmed **not** stale-apex issues (all correctly key off `PORTAL_DOMAIN=app.realtybase.ca`, a subdomain, not bare apex): `backend/config/initializers/cors.rb`, `backend/app/middleware/domain_redirect_middleware.rb`, `backend/app/controllers/concerns/main_domain_only.rb`, `backend/app/controllers/concerns/brokerage_auth.rb`. `APP_BASE_DOMAIN` defaulting to `realtybase.ca` in `domains_controller.rb`/`brokerages_controller.rb` is expected/correct (used to construct brokerage subdomains like `foo.realtybase.ca`) — not a finding, note this explicitly in the runbook so it isn't mistaken for a bug during the audit.

### DNS provider specifics
- **D-03:** DNS for `realtybase.ca` is Vercel-managed (nameservers point at Vercel) — the runbook should give exact Vercel-dashboard-specific steps, not generic registrar-agnostic CNAME/A-record language.
- **D-04:** `realtybase.ca` (bare apex) is **currently attached as a custom domain to the `frontend` Vercel project** (the old portal). The runbook's Vercel section must be a **detach-then-attach** sequence — remove the domain from `frontend`, then add it to `landing/` (the `realstate` Vercel project, per Phase 45) — not a fresh "add domain" step assuming a blank slate.
- **D-05:** `www.realtybase.ca` is **not** attached to `frontend` (confirmed by user) — out of scope. The runbook covers the bare apex only; no `www` handling needed.

### Runbook location & format
- **D-06:** File location: `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md` — phase-directory artifact, consistent with this milestone's GSD planning-doc convention (committed to the monorepo root per CLAUDE.md).
- **D-07:** Format: **sectioned**, not a single flat checklist. Sections: Pre-cutover audit (backend/CORS/DB findings from D-01/D-02 + TTL-lowering guidance), Vercel dashboard steps (detach from `frontend`, attach to `landing/`, per D-04), DNS verification, Post-cutover verification (per D-08 below). Each section independently checkable/skippable, mirroring how ROADMAP.md Phase 46 already breaks success criteria #1–4 into distinct concerns.

### Post-cutover verification scope
- **D-08:** Include a post-cutover verification section beyond the strict ROADMAP success-criteria minimum (DNS changes, Vercel steps, audit checklist item, TTL note). Cover PITFALLS.md Pitfall 2's cache/index/cookie debt concerns specifically: `curl -I` against the apex to confirm it serves the Astro site's headers (not cached old-portal content), Google Search Console re-crawl request + sitemap resubmission for the apex property, and a check for any stale cookie scoped to `Domain=.realtybase.ca` from the old portal.
- **D-09:** The post-cutover section stays **strictly to Pitfall 2's scope** (cache/index/cookie). Do **not** fold in verifying the Vercel Web Analytics toggle or preview-`noindex` behavior — those are separate, already-tracked deferred follow-ups from Phase 45 (STATE.md Deferred Items D-04 and "Known-unobserved"), unrelated to domain-cutover mechanics. Leave them where they already are; don't blur this runbook's focus by referencing them.

### Claude's Discretion
- Exact wording/formatting of the runbook's step-by-step instructions (Vercel dashboard navigation copy, curl command syntax) — implementation detail for planning/execution.
- Recommended specific TTL value and lead time to suggest lowering to ahead of cutover — grounded in Vercel DNS defaults, decided during planning/execution, not locked here.
- Exact SQL/`rails runner` command syntax to give the human for the production DB re-check at actual cutover time (per D-02) — mirror the command already run for the dev-DB baseline.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Requirements — DEPLOY-03 exact requirement text ("documented manual follow-up — not executed in this milestone")
- `.planning/ROADMAP.md` Phase 46 section — goal, 4 success criteria, depends-on Phase 45

### Milestone Research (directly covers this phase)
- `.planning/research/PITFALLS.md` Pitfall 2 ("Apex domain cutover ships DNS/cache/index debt from the previous portal") — primary technical content for the entire runbook: stale DNS/edge cache, search index debt, apex-scoped cookies, backend config drift (`BrokerageAuth`/`MainDomainOnly`/`DomainRedirectMiddleware` resolving off `Host` header against `BrokerageDomain` rows). Drives D-01, D-02, D-08, D-09 above.
- `.planning/research/PITFALLS.md` Pitfall 4 — canonical host form (`site: 'https://realtybase.ca'`, bare apex not `www`) already locked in `astro.config.mjs` per Phase 44; confirms D-05's `www`-out-of-scope decision is consistent with the already-shipped sitemap config.
- `.planning/research/PITFALLS.md` "Looks Done But Isn't" checklist, "Apex domain cutover" row — the exact verification bar (`curl -I`, backend config audit, search-result staleness) this runbook's post-cutover section (D-08) must satisfy.
- `.planning/research/PITFALLS.md` Pitfall-to-Phase Mapping table, "Apex domain cutover debt" row — confirms this is the last phase, after the site is verified elsewhere, with an explicit backend-config-audit requirement.

### Prior Phase Decisions (carried forward)
- `.planning/phases/45-vercel-project-setup-preview-verification/45-CONTEXT.md` D-01 — Claude has no authenticated Vercel dashboard/CLI session; established pattern of Claude producing an exact ordered runbook for the user to execute manually and report back. Same execution-mode pattern applies here (runbook-only, no execution).
- `.planning/phases/45-vercel-project-setup-preview-verification/45-CONTEXT.md` D-03/D-04 — the `landing/`/`realstate` Vercel project has no Deployment Protection and no custom domain attached as of Phase 45 close (Web Analytics toggle deferred, non-blocking) — confirms the attach-side of the D-04 detach-then-attach sequence starts from a clean target project.
- `.planning/STATE.md` Blockers/Concerns — "exact current state of backend `BrokerageDomain` rows / CORS allowlist / `MainDomainOnly` config referencing bare `realtybase.ca` is not yet enumerated — needs first-party investigation when Phase 46 is planned, not assumed from research alone." This discussion's D-01/D-02 close that open item with concrete findings.

### Codebase (scouted during this discussion — first-party investigation per STATE.md above)
- `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:77` — the one confirmed stale-apex finding (D-01)
- `backend/app/models/brokerage_domain.rb` — `BrokerageDomain` model/scopes; `visible_ordered`/`routable` scopes referenced by DB audit query (D-02)
- `backend/config/initializers/cors.rb`, `backend/app/middleware/domain_redirect_middleware.rb`, `backend/app/controllers/concerns/main_domain_only.rb`, `backend/app/controllers/concerns/brokerage_auth.rb` — all confirmed correctly scoped to `PORTAL_DOMAIN`/`app.realtybase.ca`, not bare apex (not findings)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The `bin/rails runner "puts BrokerageDomain.where(domain: [...]).to_a.inspect"` command used for the dev-DB baseline check (D-02) — the runbook should give this exact command (adapted for production access) as the human's cutover-time re-check step.

### Established Patterns
- `PORTAL_DOMAIN` (default `app.realtybase.ca`) and `APP_BASE_DOMAIN` (default `realtybase.ca`) are the two env vars that govern domain-aware backend behavior — `PORTAL_DOMAIN` for main-domain/CORS/redirect logic, `APP_BASE_DOMAIN` for constructing brokerage subdomains. The runbook's audit section should reference both by name so the human checks actual production env var values, not just code defaults.
- All three existing Vercel projects (`frontend`, `auth-callback`, `landing`/`realstate`) are configured entirely via dashboard-level Root Directory settings, not in git (per Phase 45 code_context) — consistent with this phase's Vercel steps also being dashboard-only, no `vercel.json` changes.

### Integration Points
- None — this phase produces documentation only; no source files in `backend/`, `frontend/`, or `landing/` are modified.

</code_context>

<specifics>
## Specific Ideas

No specific visual/copy references — this phase is a pure operational runbook, no UI or marketing content.

</specifics>

<deferred>
## Deferred Ideas

None raised during this discussion — stayed within phase scope.

### Reviewed Todos (not folded)
- `arch-brokerage-listing-access.md` ("Rethink listing access model — BrokerageEstate vs board credential JOIN") — matched Phase 46 by keyword ("board", "access", "backend") only, score 0.6, same low-relevance match as Phases 42–44. Reviewed and confirmed unrelated: backend listing-access architecture debt, no connection to apex domain cutover. Left untouched in `.planning/todos/pending/`.

</deferred>

---

*Phase: 46-Apex Domain Cutover Runbook*
*Context gathered: 2026-07-31*

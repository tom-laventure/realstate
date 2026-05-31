# Phase 23: 301 Redirect & Primary Domain Enforcement - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

A Rails Rack middleware intercepts every request before BrokerageAuth runs. If the request domain is a known non-primary domain for a brokerage (any status except decommissioned and pending), the middleware issues a 301 redirect to the same path on the brokerage's current primary domain. Frozen custom domains are included — they redirect to the subdomain (which is primary after a plan downgrade). All system-generated email links already use the primary domain at send time; Phase 23 closes DPRI-03 with test coverage only (no mailer code changes needed).

</domain>

<decisions>
## Implementation Decisions

### Redirect Triggers — Which domains redirect

- **D-01:** Active non-primary domains → 301 redirect to primary domain + same path. This is the core DPRI-04 behavior.
- **D-02:** Phasing-out non-primary domains → also redirect immediately to primary. Phasing-out is still in the `routable` scope, but if the domain is not primary, there is no reason to keep sending traffic to a dying domain.
- **D-03:** A phasing-out domain that IS the current primary → pass through. It's still the canonical URL; the owner must promote a new primary before this one is decommissioned.
- **D-04:** Frozen custom domains → redirect to primary domain (which is the subdomain after DPRD-03 ran in Phase 22). Same middleware path as D-01/D-02 — no special frozen branch needed since subdomain is already primary.
- **D-05:** Pending (unverified) domains → pass through to BrokerageAuth, which 404s them. Pending domains are not live; a 404 is the correct signal during DNS setup. No redirect.
- **D-06:** Decommissioned and unknown domains → pass through to BrokerageAuth (404). No redirect.

### Middleware Design

- **D-07:** Request host extraction uses Origin-first, Host header as fallback — identical to `BrokerageAuth#extract_domain_from_request` and `MainDomainOnly`. Consistent with the codebase's Origin-canonical pattern (decision 01-03).
- **D-08:** Skip conditions: main domain (APP_BASE_DOMAIN) passes through — BrokerageAuth handles it separately. Primary domains pass through. No additional skip conditions (no health-check path carve-outs, no dev environment overrides — dev already uses localhost which is not in the DB).
- **D-09:** The DB query in the middleware must include frozen domains (not just the `routable` scope). Query: `BrokerageDomain.where(status: [:active, :phasing_out, :frozen]).find_by(domain: host)`. If the result is `nil` or `pending` or `decommissioned` → pass through.
- **D-10:** Primary domain lookup for the redirect target: `brokerage.brokerage_domains.where(is_primary: true).first.domain`. This is the same pattern used in both mailers.
- **D-11:** Middleware file: `app/middleware/domain_redirect_middleware.rb`. Registered in `config/application.rb` via `config.middleware.insert_before ActionDispatch::Static, DomainRedirectMiddleware` (or equivalent early position — before BrokerageAuth runs).
- **D-12:** HTTP status: 301 (Permanent Redirect) for all methods, as specified in success criteria. Location header: `https://#{primary_domain}#{path}` preserving query string.

### DPRI-03 — Email Links

- **D-13:** Both `InvitationMailer` and `DomainMailer` already call `primary_domain` at send time. DPRI-03 is code-complete from Phase 22. Phase 23's deliverable for DPRI-03 is: integration tests that assert invitation emails and domain health/notification emails use the primary domain URL. No mailer code changes.
- **D-14:** `primary_domain` helper remains duplicated across the two mailers (not extracted to ApplicationMailer). Extraction deferred until a third caller exists — existing STATE.md decision stands.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DPRI-03, DPRI-04, DPRD-02 (the three requirements this phase closes)

### Domain Model & State Machine
- `backend/app/models/brokerage_domain.rb` — domain statuses (`active`, `phasing_out`, `frozen`, `pending`, `decommissioned`), `is_primary` field, `routable` scope (active + phasing_out only)
- `backend/app/controllers/concerns/brokerage_auth.rb` — `extract_domain_from_request` (Origin-first logic to replicate in middleware), `main_domain_request?` (skip condition)

### Existing Middleware Patterns
- `backend/app/controllers/concerns/main_domain_only.rb` — Origin-first host extraction pattern; structural reference for the new middleware
- `backend/config/application.rb` — where to register the new middleware

### Mailers (DPRI-03 reference)
- `backend/app/mailers/domain_mailer.rb` — `primary_domain` helper + existing tests to extend
- `backend/app/mailers/invitation_mailer.rb` — `primary_domain` helper; DPRI-03 test coverage needed here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BrokerageAuth#extract_domain_from_request`: Origin-first host extraction. Copy this logic verbatim into the middleware (D-07).
- `BrokerageAuth#main_domain_request?`: Main-domain skip logic. Replicate in middleware for the pass-through condition (D-08).
- Both mailers' `primary_domain` method: Shows the exact query to find the primary domain — `brokerage.brokerage_domains.where(is_primary: true).where.not(domain: 'localhost').first&.domain`.

### Established Patterns
- No `app/middleware/` directory exists yet — create it with the new file.
- `BrokerageDomain` does NOT use `acts_as_paranoid` — no `.without_deleted` needed on domain queries (per STATE.md Phase 22 decisions).
- `routable` scope covers active + phasing_out. The middleware query must explicitly include `frozen` (not in routable). Pending and decommissioned must be excluded from redirect logic (pass through).

### Integration Points
- Middleware registers before `ActionDispatch::Static` (or as early in the stack as possible) so it runs before any Rails controller logic including BrokerageAuth.
- Rack middleware receives `env` hash; extract `Origin` from `env['HTTP_ORIGIN']` and `Host` from `env['HTTP_HOST']`.
- Redirect response: `[301, {'Location' => redirect_url, 'Content-Type' => 'text/plain'}, ['Moved Permanently']]`.

</code_context>

<specifics>
## Specific Ideas

No specific UI references — this is a pure backend phase (no frontend changes).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-301-Redirect-Primary-Domain-Enforcement*
*Context gathered: 2026-05-30*

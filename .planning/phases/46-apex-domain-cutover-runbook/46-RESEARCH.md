# Phase 46: Apex Domain Cutover Runbook - Research

**Researched:** 2026-07-31
**Domain:** Vercel domain reassignment (project-to-project) + DNS TTL practice + Rails multi-tenant backend config audit
**Confidence:** HIGH (Vercel dashboard mechanics, DNS/TTL practice, all codebase claims — verified by reading source and cross-checking official Vercel docs) / MEDIUM (exact current Vercel TTL value on this specific domain — cannot be verified without dashboard access)

## Summary

This phase produces a single markdown runbook — no code, no DNS, no Vercel changes execute. The runbook's four sections (pre-cutover audit, Vercel dashboard steps, DNS verification, post-cutover verification) are almost entirely pre-determined by decisions already locked in `46-CONTEXT.md` (D-01 through D-09): the backend audit found exactly one stale-apex reference (`google_oauth_controller.rb:77`), the dev DB baseline is confirmed empty, DNS is Vercel-managed (nameservers, not registrar A-records), and the apex is currently attached to `frontend` and must be detached-then-attached to `landing`. This research fills in the *mechanics* CONTEXT.md left to Claude's discretion: the exact current Vercel dashboard flow for reassigning a domain between two projects in the same team, what "DNS change" actually means when nameservers are Vercel-managed (there is no registrar-side record to edit — TTL and the underlying A-record are Vercel-internal and update automatically on reassignment), current TTL-lowering guidance, and a rollback sequence.

The single most important mechanical finding: **because `realtybase.ca`'s nameservers already point at Vercel (`ns1.vercel-dns.com`/`ns2.vercel-dns.com`, confirmed by D-03 and required for this platform's existing wildcard-subdomain routing), the "DNS change" in this cutover is not a registrar A-record edit.** It is a Vercel dashboard domain reassignment (Settings → Domains: remove from `frontend`, add to `landing`), and Vercel's own DNS records for the domain (managed under the team-level Domains page) update automatically. Vercel's default TTL for its own managed DNS records is 60 seconds — already short. The classic "lower TTL 24–48h ahead" advice from generic DNS-migration guides is written for registrar-controlled zones with resolver-visible propagation delay; it still has a role here (as a defensive check that no custom, higher TTL was manually set on this record, and as a safety margin for any *external* resolver caches that saw the record before this session), but it is not the dominant risk in this specific cutover the way it would be for a non-Vercel-managed zone.

**Primary recommendation:** Write the runbook as a checklist-per-section markdown file at `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md`, matching the phase's locked D-06/D-07 decisions. Every step must be phrased as an instruction to a human with Vercel dashboard + production Rails console access — Claude has neither (established pattern from Phase 45 D-01) — and every finding must carry its "verified as of 2026-07-31, re-check at actual cutover time" caveat, since code and DNS state can both drift before the runbook is executed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Apex domain → Vercel project binding | CDN / Static (Vercel platform) | — | Vercel's team-level Domains registry owns which project an apex domain routes to; this is a dashboard/API-level assignment, not application code |
| DNS record management for `realtybase.ca` | CDN / Static (Vercel-managed DNS) | — | Nameservers already delegate to Vercel; Vercel auto-manages the underlying A/ALIAS record on reassignment, no registrar-side record to hand-edit |
| Brokerage tenancy resolution off `Host`/`Origin` header | API / Backend | — | `BrokerageAuth`, `MainDomainOnly`, `DomainRedirectMiddleware` all resolve tenancy server-side from request headers against `BrokerageDomain` rows and `PORTAL_DOMAIN`/`APP_BASE_DOMAIN` env vars — this is what the pre-cutover audit inspects |
| CORS allowlist for cross-origin requests to the API | API / Backend | — | `backend/config/initializers/cors.rb` checks `Origin` host against `PORTAL_DOMAIN`, `BrokerageDomain` rows, and one hardcoded `auth.realtybase.ca` entry — audited in this runbook |
| Google Calendar OAuth redirect destination | API / Backend | Browser / Client (redirect target) | `google_oauth_controller.rb#callback` computes the post-OAuth redirect URL server-side from cached `frontend_origin` or a hardcoded fallback — this is the one confirmed stale-apex finding (D-01) |
| Search engine re-indexing / cache staleness | Browser / Client + external (Google Search Console) | — | Outside this codebase entirely; runbook documents it as a post-cutover verification step, not a code or DNS change |
| This runbook document itself | Documentation (`.planning/`) | — | No runtime tier — pure repo artifact, git-committed |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Backend audit depth**
- D-01: The runbook must name the concrete finding explicitly: `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb:77` — `FRONTEND_URL` fallback defaults to `"https://realtybase.ca"` (bare apex), used only when Google Calendar OAuth `state_data[:frontend_origin]` is absent. Include file:line, what it does, and a recommended fix. Flag as a 2026-07-31 snapshot, re-verify (re-grep) at actual cutover time.
- D-02: A read-only `bin/rails runner` query against the local dev DB (`BrokerageDomain.where(domain: ['realtybase.ca', 'www.realtybase.ca'])`) returned **empty** — no row references either bare apex or `www`. Bake this into the runbook as today's baseline with an explicit caveat: dev DB only, production must be independently re-verified via the same query at actual cutover time.
- Other backend files scouted and confirmed **not** stale-apex issues (correctly key off `PORTAL_DOMAIN=app.realtybase.ca`): `backend/config/initializers/cors.rb`, `backend/app/middleware/domain_redirect_middleware.rb`, `backend/app/controllers/concerns/main_domain_only.rb`, `backend/app/controllers/concerns/brokerage_auth.rb`. `APP_BASE_DOMAIN` defaulting to `realtybase.ca` in `domains_controller.rb`/`brokerages_controller.rb` is expected/correct (constructs brokerage subdomains) — note explicitly so it isn't mistaken for a bug during audit.

**DNS provider specifics**
- D-03: DNS for `realtybase.ca` is Vercel-managed (nameservers point at Vercel) — give exact Vercel-dashboard-specific steps, not generic registrar-agnostic CNAME/A-record language.
- D-04: `realtybase.ca` (bare apex) is **currently attached as a custom domain to the `frontend` Vercel project**. The Vercel section must be a **detach-then-attach** sequence — remove from `frontend`, then add to `landing/`/`realstate` project — not a fresh "add domain" step.
- D-05: `www.realtybase.ca` is **not** attached to `frontend` (confirmed by user) — out of scope. Bare apex only.

**Runbook location & format**
- D-06: File location: `.planning/phases/46-apex-domain-cutover-runbook/46-RUNBOOK.md`.
- D-07: Format: sectioned, not a flat checklist. Sections: Pre-cutover audit (backend/CORS/DB findings + TTL guidance), Vercel dashboard steps (detach/attach), DNS verification, Post-cutover verification. Each section independently checkable/skippable.

**Post-cutover verification scope**
- D-08: Include a post-cutover section covering PITFALLS.md Pitfall 2's cache/index/cookie concerns: `curl -I` against apex confirming Astro headers (not cached old-portal content), Google Search Console re-crawl request + sitemap resubmission, check for stale cookie scoped to `Domain=.realtybase.ca`.
- D-09: Stay strictly to Pitfall 2's scope (cache/index/cookie). Do **not** fold in Web Analytics toggle or preview-`noindex` — those are separate, already-tracked Phase 45 deferred items.

### Claude's Discretion
- Exact wording/formatting of step-by-step instructions (Vercel dashboard navigation copy, curl command syntax).
- Recommended specific TTL value and lead time ahead of cutover — grounded in Vercel DNS defaults, decided during planning/execution.
- Exact SQL/`rails runner` command syntax for the production DB re-check at cutover time — mirror the dev-DB baseline command.

### Deferred Ideas (OUT OF SCOPE)
None raised during discussion — stayed within phase scope. (One reviewed-but-unrelated todo: `arch-brokerage-listing-access.md`, confirmed unrelated to apex domain cutover, left untouched.)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-03 | Apex domain cutover steps (DNS, Vercel domain assignment, backend `BrokerageDomain`/CORS audit for stale bare-apex references) are written up as a documented manual follow-up — not executed in this milestone | This entire research doc — Vercel detach/attach mechanics (Architecture Patterns), TTL practice (Common Pitfalls), the two confirmed backend findings (D-01/D-02, carried from CONTEXT.md), and rollback steps (Code Examples) give the planner everything needed to spec the runbook's four sections without further investigation |

## Project Constraints (from CLAUDE.md)

- **No unrequested destructive git actions.** This phase's plan must not execute any DNS/Vercel change — the CONTEXT.md boundary and DEPLOY-03 requirement text both say "documented manual follow-up, not executed this milestone." Any plan task that adds/removes a Vercel domain, edits DNS, or modifies `BrokerageDomain` rows would violate the phase boundary, not just CLAUDE.md.
- **Confirm before commit.** Per user memory (`feedback_confirm_before_commit.md`), the runbook commit itself should still go through the standard git confirmation flow used elsewhere in this milestone (`commit_docs: true` in config.json already governs `.planning/` commits — no special override needed here since only documentation is touched).
- **Notion ticket status sync.** If a Notion ticket tracks Phase 46 / DEPLOY-03, move it to `In Review` once the runbook is written and pending verification, then `Done` once committed — per the standing CLAUDE.md policy. (No ticket ID was surfaced in this research; the planner/executor should check for one.)
- **Sub-repo commit boundaries.** This phase touches only `.planning/` (monorepo root) — no `backend/` or `frontend/` commits are expected, since no code changes.

## Standard Stack

Not applicable in the conventional sense — this phase produces one markdown file, no packages, no dependencies, no code. No `## Package Legitimacy Audit` section is included because no external packages are installed by this phase.

## Architecture Patterns

### Runbook Document Structure (per D-06/D-07)

```
.planning/phases/46-apex-domain-cutover-runbook/
└── 46-RUNBOOK.md
    ├── ## Pre-Cutover Audit          (backend findings D-01/D-02 + TTL check)
    ├── ## Vercel Dashboard Steps      (detach from `frontend`, attach to `landing`/`realstate`)
    ├── ## DNS Verification            (confirm resolution post-attach)
    └── ## Post-Cutover Verification   (curl -I, Search Console, cookie check — Pitfall 2 scope)
```

Each section is independently checkable/skippable — a human executing this runbook weeks or months from now should be able to jump to "Vercel Dashboard Steps" without re-reading the audit section, and each section states its own preconditions.

### The Vercel Domain Reassignment Flow (verified against current official docs, 2026-07-31)

Since `realtybase.ca` is **already** attached to the `frontend` project (D-04) and DNS nameservers already point at Vercel (D-03), this is a same-team, project-to-project domain move — not a fresh domain onboarding. Two documented paths exist:

**Path A — Remove-then-add (simpler, has a documented downtime caveat):**
1. Open the `frontend` Vercel project → Settings → Domains.
2. Locate `realtybase.ca`, remove it from this project.
3. Open the `landing` (a.k.a. `realstate`, per Phase 45) Vercel project → Settings → Domains.
4. Click **Add**, type `realtybase.ca` (bare apex, no `www`, no protocol), submit.
5. Because nameservers are already Vercel's, no external DNS record edit is required — Vercel auto-provisions the record and SSL certificate for the domain under its new project assignment. [CITED: vercel.com/docs/domains/working-with-domains]
6. Vercel's own community/support guidance notes this path **"could potentially end up with some site down-time"** between steps 2 and 4 — the window where the domain is unassigned from any project. [CITED: vercel.com/docs/domains/working-with-domains/transfer-your-domain]

**Path B — Vercel's "Transfer Project" domain-preserving flow (zero-downtime, but transfers the whole *project*, not just the domain):**
- Vercel also documents a **Transfer Project** feature (Project Settings → General → Transfer Project) that moves an entire project (and its attached domains) between teams/accounts with "zero downtime." This is **not applicable here** — it transfers a whole project between *accounts/teams*, not a single domain between two *projects already in the same team*. Included for completeness so the human doesn't confuse it with what's needed. [CITED: vercel.com/docs/projects/transferring-projects]

**Recommendation for the runbook:** Document Path A (remove-then-add) as the actual mechanism, since that's what D-04 already establishes is needed (`frontend` → `landing`, same team, two separate long-lived projects — not a one-time account transfer). Explicitly flag the brief downtime window this creates as a known, accepted tradeoff of this cutover (worth doing at a low-traffic time), and note the Vercel REST API's "Move a Project Domain" endpoint exists as an alternative if the human prefers a single atomic API call over two dashboard clicks — mention it as an option, not the primary path, since this repo's established pattern (Phase 45 D-01) is dashboard-only execution by the human, not Claude-driven API calls. [CITED: vercel.com/docs/rest-api/reference/endpoints/projects/move-a-project-domain]

### Nameservers vs. A-Record — why this matters for "DNS changes required" (Success Criterion 1)

Two methods exist for pointing a domain at Vercel: [CITED: vercel.com/docs/domains/working-with-domains]
- **A-record method:** registrar keeps its own nameservers; you manually add an A record (commonly `76.76.21.21`, but Vercel displays the exact value per-domain — never hardcode from a third-party guide) plus a CNAME for `www`.
- **Nameservers method:** registrar's nameservers are changed to `ns1.vercel-dns.com`/`ns2.vercel-dns.com`; Vercel then manages all records automatically, including apex, and this is the **only** method Vercel supports for wildcard subdomains (required for this platform's per-brokerage `*.realtybase.ca` subdomains). [CITED: vercel.com/docs/domains/working-with-nameservers]

D-03 already confirms this platform uses the nameservers method (consistent with the wildcard-subdomain requirement above — a platform issuing `acme.realtybase.ca`, `foo.realtybase.ca`, etc. per-brokerage could not function on the A-record method alone). **Consequence for the runbook:** "the DNS changes required" (Success Criterion 1) is not a registrar-panel task — it's entirely the Vercel dashboard domain-reassignment in Path A above. The runbook should say this explicitly so a human doesn't go looking for a registrar login that isn't the relevant surface.

### Existing Wildcard/Subdomain Interaction (flagged per task instructions)

Because nameservers are Vercel's, the wildcard record enabling `*.realtybase.ca` brokerage subdomains and the apex domain assignment are **independent** entries under the same Vercel-managed zone — reassigning the apex's *project* target does not touch the wildcard record's *project* target (`frontend`, unchanged by this phase). Confirm this explicitly during the runbook's DNS Verification section: after cutover, spot-check that an existing brokerage subdomain (e.g. whichever one is used for manual QA) still resolves to `frontend` unaffected, alongside confirming the apex now resolves to `landing`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verifying DNS propagation | A custom polling script | `dig realtybase.ca` / `curl -I` (already specified by D-08) and Vercel's own dashboard "Valid Configuration" indicator | Vercel's dashboard already surfaces domain-validation state per-domain; no need to build tooling for a one-time manual cutover |
| Cutover automation | A script that calls the Vercel API to detach/attach programmatically | Manual dashboard steps, per the established Phase 45 pattern (D-01: Claude has no authenticated Vercel session) | This is a one-time, low-frequency, high-blast-radius operation on a live production apex domain — a human should drive it interactively, not a script run once and never reviewed again |

**Key insight:** this phase is documentation, not tooling — the "don't hand-roll" instinct here is really "don't over-engineer the runbook into a script when a human with dashboard access executing a checklist is the safer, already-established pattern for this milestone."

## Common Pitfalls

### Pitfall 1: Treating "lower the TTL" as a registrar-zone task when the zone is Vercel-managed
**What goes wrong:** Generic DNS-migration guidance (lower TTL to 300s or less, 24–48h ahead of a 24h-TTL record) assumes a registrar-controlled zone where the human edits a TTL field in a registrar panel. On a Vercel-managed zone (nameservers pointed at Vercel), the underlying record for a domain assignment is managed internally by Vercel, and Vercel's own default TTL for its managed DNS records is 60 seconds already — one of the lowest defaults in the industry. [CITED: vercel.com/kb/guide/how-to-manage-vercel-dns-records]
**Why it happens:** TTL-lowering is boilerplate advice copied from generic cutover checklists without checking whether the specific DNS provider already defaults to a low value.
**How to avoid:** The runbook's pre-cutover audit should include a step to actually check the *current* TTL on record for `realtybase.ca` (`dig realtybase.ca A` or the Vercel dashboard's DNS Records / Advanced Settings page under the team-level Domains view) rather than assuming either "it needs lowering" or "it's already fine." If it's already at or near Vercel's 60s default, no action is needed beyond confirming that. If a custom, higher TTL was manually set at some point, lower it with the standard lead time (industry guidance: for a 1-hour TTL, lower to ~300s at least 1–2 hours ahead; for a 24-hour TTL, lower at least 24–48h ahead) [MEDIUM confidence, general DNS practice not Vercel-specific — CITED: dev.to/dnsassistant/dns-ttl-best-practices-how-to-choose-the-right-values-4jni], then restore the prior TTL after cutover is confirmed stable if it was intentionally set higher for a reason.
**Warning signs:** Runbook says "lower TTL to 300s" without first checking what it currently is — wastes a step or, worse, gives false confidence that a TTL change is doing meaningful work on a zone where Vercel already controls propagation speed.

### Pitfall 2: Assuming remove-then-add domain reassignment is instant/zero-downtime
**What goes wrong:** Between removing `realtybase.ca` from `frontend` and adding it to `landing`, the domain is briefly unassigned from any Vercel project. Vercel's own community guidance explicitly flags this path as having potential downtime, contrasted with the (inapplicable-here) whole-project Transfer feature that's zero-downtime by design. [CITED: vercel.com/docs/domains/working-with-domains/transfer-your-domain]
**Why it happens:** "Just move the domain" reads as a single atomic action; it's actually two sequential dashboard operations with a gap between them.
**How to avoid:** Document the two steps as immediately sequential in the runbook (do them back-to-back in one sitting, not "detach today, attach next week"), and schedule for a low-traffic window given this is a marketing/landing apex, not the transactional app (`app.realtybase.ca`, unaffected by this cutover).
**Warning signs:** A gap of more than a few minutes between the detach and attach steps; anyone hitting `realtybase.ca` during that window sees a Vercel "domain not found"/DNS error rather than either app.

### Pitfall 3: Confusing the FRONTEND_URL fallback bug's actual trigger condition
**What goes wrong:** `google_oauth_controller.rb:77`'s fallback (`ENV.fetch("FRONTEND_URL", "https://realtybase.ca")`) only fires when `state_data[:frontend_origin]` is absent from the 10-minute Rails cache entry written in `#authorize` (line 22, from the request's `Origin` header at OAuth-initiation time). In the overwhelming majority of real flows this cache entry is present (same 10-minute window as the Google OAuth round-trip), so this bug is **latent, not currently observed in normal traffic** — it only manifests if the cache entry expires/evicts before the callback returns (Rails cache eviction under memory pressure, or a user pausing >10 minutes mid-consent-screen). Someone auditing this could wrongly conclude "this never fires, skip the fix."
**Why it happens:** The bug is a fallback-of-a-fallback — easy to deprioritize because it's not the primary code path.
**How to avoid:** The runbook should still list it as a required fix (per D-01, not optional), because after cutover the fallback's default value changes meaning: today `https://realtybase.ca` accidentally-but-harmlessly points at the *old portal itself* (frontend project, same domain host as the app) — so a rare fallback-triggered redirect currently still lands somewhere plausible. **After cutover, the same fallback would redirect an authenticated user's browser to the marketing landing site instead of the app**, which is a visibly broken experience (rare, but a real regression introduced specifically by this cutover, not merely a pre-existing bug). Recommended fix per D-01: either set `FRONTEND_URL` production env var to `https://app.realtybase.ca` explicitly, or change the code-level default from `"https://realtybase.ca"` to `"https://app.realtybase.ca"` (a one-line, low-risk fix — the runbook should recommend doing this as its own tiny pre-cutover code change, separate from and prior to the DNS/Vercel cutover itself).
**Warning signs:** A user reports landing on the marketing site mid-Google-Calendar-connect flow with no error, just an unexpected page.

### Pitfall 4: Assuming the "stale cookie" check is a codebase grep
**What goes wrong:** D-08 calls for checking for any stale cookie scoped to `Domain=.realtybase.ca`. A grep of `frontend/src` and `backend/app` for cookie-setting code (`document.cookie`, `js-cookie`, `Cookies.`, Rails `cookies[...]`) returns **zero matches** [VERIFIED: grep, this repository, 2026-07-31] — this codebase's AWS Amplify/Cognito auth uses browser storage (localStorage/sessionStorage), not cookies, for tokens. A human might read "grep the codebase for cookie code" as the verification step and conclude "confirmed clean" from the grep alone.
**Why it happens:** The absence of cookie-setting code in the *current* codebase doesn't prove no cookie was ever set by a prior version of the app, a third-party script, or manual testing — cookies persist in a user's browser independent of what the current deployed code does.
**How to avoid:** Frame this specifically as a **browser-side check** (DevTools → Application → Cookies, on an actual browser that has visited `realtybase.ca` before), not a repo grep — the grep is useful supporting evidence (confirms the current app has no mechanism to *set* such a cookie going forward) but does not substitute for checking an actual browser's cookie jar.
**Warning signs:** Runbook step says "grep confirmed no cookies" and treats that as sufficient — should instead say "grep confirms the codebase sets no such cookie today; independently check DevTools on a browser with prior history at this domain."

## Code Examples

### Dev-DB baseline query (D-02), to be re-run against production at cutover time

```ruby
# Source: 46-CONTEXT.md D-02, command already run against local dev DB (returned empty)
# Re-run against PRODUCTION at actual cutover time — do not assume dev/prod parity.
bin/rails runner "puts BrokerageDomain.where(domain: ['realtybase.ca', 'www.realtybase.ca']).to_a.inspect"
```

### Post-cutover header verification (D-08)

```bash
# Bypass local browser cache entirely — confirms what Vercel is actually serving.
curl -I https://realtybase.ca

# Expect Astro/Vercel static-site headers (e.g. `server: Vercel`, no old-portal
# React SPA markers). Compare against the known-good signals already used to
# verify `landing/` in Phase 45 (astro build markers, absent CRA negatives).
```

### Stale-apex grep re-check (D-01), to be re-run at actual cutover time since code may drift

```bash
# Source: 46-CONTEXT.md D-01 — re-verify this finding is still the only one
grep -rn "realtybase\.ca" backend/app backend/config | grep -v "app\.realtybase\|PORTAL_DOMAIN\|APP_BASE_DOMAIN"
```

### Rollback (if cutover causes issues)

```
# Rollback is the same detach/attach mechanism, reversed:
1. landing (realstate) project → Settings → Domains → remove `realtybase.ca`
2. frontend project → Settings → Domains → add `realtybase.ca` back
# No DB/data changes were made by the cutover itself (no BrokerageDomain rows
# touched per D-02's confirmed-empty baseline), so rollback is DNS/Vercel-only —
# no data migration or backup/restore step is needed.
```
[ASSUMED: this rollback sequence — not verified against a real Vercel dashboard session, inferred from the documented remove/add mechanics above. Low risk: same operations as the forward cutover, same team, same two projects.]

## State of the Art

Not applicable — this is a one-time operational runbook for a specific existing domain/project setup, not a library or framework with version history.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel's default managed-DNS TTL is 60 seconds and applies to this domain's apex record today | Common Pitfalls, Pitfall 1 | Low — the runbook still instructs checking current TTL directly (`dig`/dashboard) before deciding whether to lower it, so a wrong assumption here is self-correcting at execution time, not load-bearing |
| A2 | The remove-then-add domain move (Path A) is the correct/necessary mechanism, vs. some other Vercel feature that could move just a domain with zero downtime between two projects in the same team | Architecture Patterns | Medium — if a superior zero-downtime mechanism exists that this research missed, the runbook would recommend an unnecessarily riskier path. Mitigated by also documenting the REST API "Move a Project Domain" endpoint as an alternative worth the human checking at execution time |
| A3 | Rollback requires no data/DB changes because D-02's baseline confirmed no `BrokerageDomain` row references the apex | Code Examples, Rollback | Low — directly follows from an already-locked CONTEXT.md finding (D-02), not new speculation |
| A4 | No Notion ticket currently exists/is linked for Phase 46 / DEPLOY-03 | Project Constraints | Low — informational only; the planner/executor should verify independently since this research had no Notion access in scope |

**If this table is empty:** N/A — see entries above.

## Open Questions (RESOLVED)

1. **Exact current TTL value on `realtybase.ca`'s apex record**
   - What we know: Vercel's platform default for its managed DNS is 60 seconds; nameservers are confirmed Vercel's (D-03).
   - What's unclear: Whether this specific record was ever manually overridden to a higher TTL at some point in this project's history — cannot be checked without dashboard/`dig` access, which this research session doesn't have.
   - Recommendation: The runbook's Pre-Cutover Audit section should include "run `dig realtybase.ca A` or check the Vercel dashboard's DNS Records page for the current TTL" as its own checklist item, before deciding whether a TTL-lowering step is even necessary.
   - RESOLVED: deferred to runbook Section 1.6 as an executor checklist item (46-RUNBOOK.md, Plan 46-01 Task 1) — the fact can only be observed at execution time, not planning time.

2. **Whether a Notion ticket exists tracking DEPLOY-03 / Phase 46**
   - What we know: CLAUDE.md's Notion sync policy applies to any work tracing back to a ticket.
   - What's unclear: No ticket ID surfaced during this research (not in scope for a codebase/docs research pass).
   - Recommendation: Planner/executor should check the "RealtyBase Tasks" Notion database for a matching ticket before/after this runbook is written, and update its status per the standing policy if one exists.
   - RESOLVED: administrative, not runbook content — tracked separately via the standing Notion sync policy at phase execution/commit checkpoints, not a planning blocker.

## Environment Availability

Skipped — this phase has no external tool/service dependencies for its own execution (writing a markdown file). The runbook's *future* execution (by a human, outside this milestone) depends on Vercel dashboard access and production Rails console access, but auditing those is explicitly out of scope for this documentation-only phase — the runbook itself should state these as preconditions for whoever executes it later, rather than this research probing for them now.

## Validation Architecture

Skipped — `.planning/config.json` sets `workflow.nyquist_validation: false` explicitly.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled per protocol), but this phase makes no code or config changes — it produces documentation only. The relevant security content is what the runbook's audit *documents* about the existing system, not a new control this phase implements.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V4 Access Control | Yes (documentation subject, not implementation) | The runbook documents (does not modify) how `BrokerageAuth`/`MainDomainOnly`/`DomainRedirectMiddleware` resolve tenancy from `Origin`/`Host` headers against `BrokerageDomain` rows and `PORTAL_DOMAIN` — the audit's purpose is confirming no stale apex reference weakens this boundary post-cutover |
| V5 Input Validation | No | Not touched by this phase — `BrokerageDomain#valid_domain_format` validation already exists and is unchanged |
| V6 Cryptography | No | Not applicable — no crypto/secrets work in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Stale `BrokerageDomain`/CORS reference to bare apex granting unintended cross-origin API access after cutover | Elevation of Privilege / Spoofing | Pre-cutover audit (D-01/D-02, this phase's core deliverable) — confirm no row/allowlist entry still treats bare apex as an active brokerage-routable or CORS-trusted origin |
| OAuth redirect fallback landing an authenticated session on the wrong post-cutover origin | Information Disclosure (low severity here — redirect target only, no token leakage since Amplify/Cognito doesn't use apex-scoped cookies) | Pitfall 3 above — fix the `FRONTEND_URL` fallback default before/alongside cutover |

## Sources

### Primary (HIGH confidence)
- Codebase inspection, this repository (2026-07-31): `backend/app/models/brokerage_domain.rb`, `backend/config/initializers/cors.rb`, `backend/app/middleware/domain_redirect_middleware.rb`, `backend/app/controllers/concerns/main_domain_only.rb`, `backend/app/controllers/concerns/brokerage_auth.rb`, `backend/app/controllers/v1/account/calendar/google_oauth_controller.rb`, `landing/astro.config.mjs`, `landing/vercel.json`
- `.planning/phases/46-apex-domain-cutover-runbook/46-CONTEXT.md` — all locked decisions D-01 through D-09
- `.planning/research/PITFALLS.md` — Pitfall 2 (primary source for this entire runbook's content), Pitfall 4, "Looks Done But Isn't" checklist, Pitfall-to-Phase Mapping
- `.planning/phases/45-vercel-project-setup-preview-verification/45-CONTEXT.md`, `45-02-SUMMARY.md` — confirms `landing`/`realstate` project has no custom domain, no Deployment Protection as of Phase 45 close

### Secondary (MEDIUM confidence)
- [Vercel: Working with domains](https://vercel.com/docs/domains/working-with-domains) — A-record vs. nameservers method
- [Vercel: Working with nameservers](https://vercel.com/docs/domains/working-with-nameservers) — wildcard subdomains require nameservers method
- [Vercel: Transferring Domains to Another Team or Project](https://vercel.com/docs/domains/working-with-domains/transfer-your-domain) — remove-then-add downtime caveat vs. Transfer Project zero-downtime path
- [Vercel: Managing DNS Records](https://vercel.com/docs/domains/managing-dns-records) / [How can I manage my Vercel DNS records?](https://vercel.com/kb/guide/how-to-manage-vercel-dns-records) — 60-second default TTL for Vercel-managed records
- [Vercel: Move a Project Domain (REST API)](https://docs.vercel.com/docs/rest-api/reference/endpoints/projects/move-a-project-domain) — API alternative to dashboard remove/add
- [Vercel: Transferring a project](https://vercel.com/docs/projects/transferring-projects) — confirms Transfer Project moves whole projects between accounts/teams, not applicable to this same-team domain move
- [DNS TTL Best Practices: How to Choose the Right Values](https://dev.to/dnsassistant/dns-ttl-best-practices-how-to-choose-the-right-values-4jni) — general TTL-lowering lead-time guidance (not Vercel-specific)

### Tertiary (LOW confidence)
- Vercel Community forum threads on apex domain "Invalid Configuration" and cross-project domain moves — used only to corroborate the downtime caveat already stated in official docs, not as a standalone source

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no packages/dependencies in this phase
- Architecture (Vercel domain reassignment mechanics): HIGH — cross-verified across three official Vercel doc pages plus community corroboration
- Backend audit findings (D-01/D-02): HIGH — directly inherited from CONTEXT.md's already-completed first-party investigation, independently re-confirmed by re-reading the cited files in this session
- TTL guidance: MEDIUM — Vercel's 60s default is HIGH confidence (official docs), but the *current* TTL on this specific record is unverified (no dashboard access this session)
- Pitfalls: HIGH — grounded in `.planning/research/PITFALLS.md` Pitfall 2 (already MEDIUM-confidence-rated there for apex-cutover cache/cookie specifics) plus this session's own codebase verification (e.g. the cookie-grep finding, the OAuth fallback trigger-condition analysis)

**Research date:** 2026-07-31
**Valid until:** Re-verify DNS/Vercel dashboard mechanics and the D-01/D-02 backend findings at actual cutover execution time — this is an operational runbook for a future manual action, not a stable library integration, so "valid until" is effectively "valid until re-checked immediately before execution," not a fixed day count.

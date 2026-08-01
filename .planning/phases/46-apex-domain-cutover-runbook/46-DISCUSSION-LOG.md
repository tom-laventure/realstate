# Phase 46: Apex Domain Cutover Runbook - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 46-Apex Domain Cutover Runbook
**Areas discussed:** Backend audit depth, DNS provider specifics, Runbook location & format, Post-cutover verification scope

---

## Backend audit depth

| Option | Description | Selected |
|--------|-------------|----------|
| Name it explicitly | Bake in exact file:line, what it does, recommended fix | ✓ |
| Generic checklist only | Just say "grep and review" — no baked-in findings | |
| Both | Name today's findings AND include generic re-grep instruction | |

**User's choice:** Name it explicitly — `google_oauth_controller.rb:77`'s `FRONTEND_URL` fallback defaults to bare `https://realtybase.ca`.

| Option | Description | Selected |
|--------|-------------|----------|
| Query now, bake in result | Run read-only rails runner query now, record today's baseline | ✓ |
| Checklist step only | Give the human the query to run themselves at cutover time | |

**User's choice:** Query now, bake in result. Query executed: `BrokerageDomain.where(domain: ['realtybase.ca', 'www.realtybase.ca'])` → empty result against local dev DB.
**Notes:** Caveat added — this only checked the local dev DB; production must be independently re-verified at cutover time.

---

## DNS provider specifics

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare | DNS managed through Cloudflare | |
| Vercel DNS | Nameservers point at Vercel | ✓ |
| Namecheap/GoDaddy/other registrar | DNS managed through registrar panel | |

**User's choice:** Vercel DNS.

| Option | Description | Selected |
|--------|-------------|----------|
| Currently on frontend project | Apex assigned to old portal today | ✓ |
| Not currently assigned anywhere | Apex isn't attached to any project | |
| Not sure / check during execution | Include a check-first step | |

**User's choice:** Currently on frontend project — runbook needs detach-then-attach, not a fresh add.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, www is on frontend too | Both apex and www attached to old portal | |
| No, only bare apex is on frontend | www not in play | ✓ |
| Not sure / check during execution | Include a check-first step covering both | |

**User's choice:** No, only bare apex is on frontend — www out of scope.

---

## Runbook location & format

| Option | Description | Selected |
|--------|-------------|----------|
| Phase directory | `.planning/phases/46-.../46-RUNBOOK.md`, GSD convention | ✓ |
| Permanent repo docs/ folder | `docs/runbooks/apex-domain-cutover.md` | |

**User's choice:** Phase directory.

| Option | Description | Selected |
|--------|-------------|----------|
| Sectioned | Grouped by concern (audit / Vercel / DNS / post-cutover) | ✓ |
| Single flat checklist | One linear numbered list | |

**User's choice:** Sectioned.

---

## Post-cutover verification scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include it | curl -I checks, Search Console re-crawl, stale-cookie check | ✓ |
| No, strictly success-criteria only | Keep to the 4 ROADMAP success criteria only | |

**User's choice:** Yes, include it — Pitfall 2's cache/index/cookie debt concerns.

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly Pitfall 2 scope | Cache/index/cookie only | ✓ |
| Include a note referencing both | Cross-reference Web Analytics + preview-noindex follow-ups | |

**User's choice:** Strictly Pitfall 2 scope — Web Analytics toggle and preview-noindex spot-check stay as separate, already-tracked Phase 45 deferred items.

---

## Claude's Discretion

- Exact wording/formatting of runbook steps (Vercel dashboard navigation copy, curl command syntax)
- Recommended specific TTL value and lead time
- Exact production DB re-check command syntax (mirroring the dev-DB baseline command)

## Deferred Ideas

None raised during this discussion — stayed within phase scope.

Reviewed but not folded: `arch-brokerage-listing-access.md` (unrelated backend architecture todo, low-relevance keyword match only).

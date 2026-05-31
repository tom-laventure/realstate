# Phase 23: 301 Redirect & Primary Domain Enforcement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 23-301-Redirect-Primary-Domain-Enforcement
**Areas discussed:** Phasing-out redirect behavior, Pending domain handling, Middleware skip conditions

---

## Phasing-out redirect behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — redirect immediately | Non-primary phasing-out domains redirect to primary. Consistent with DPRI-04: non-primary = redirect. | ✓ |
| No — let it serve until decommissioned | Phasing-out is still routable; keep serving normally until decommission. | |

**User's choice:** Redirect immediately for non-primary phasing-out domains.
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Let it serve — it's still primary | Phasing-out primary domains pass through. Owner must set a new primary before decommission. | ✓ |
| Redirect to subdomain fallback | Even primary phasing-out domains redirect to the subdomain. | |

**User's choice:** Let a phasing-out primary domain serve normally (it's still the canonical URL).
**Notes:** None.

---

## Pending domain handling

| Option | Description | Selected |
|--------|-------------|----------|
| Pass through — let BrokerageAuth 404 it | Pending domains are not live. A 404 signals "not ready" during DNS setup. Simpler middleware. | ✓ |
| Redirect to primary | Graceful — redirect if we can find the brokerage via the pending domain record. | |

**User's choice:** Pass through to BrokerageAuth (404). No redirect for pending domains.
**Notes:** None.

---

## Middleware skip conditions

| Option | Description | Selected |
|--------|-------------|----------|
| No extra skips | Skip only main domain and primary domains. Unknown/decommissioned fall through. | ✓ |
| Also skip health-check paths | Carve out /up, /healthz, /ping for load balancers hitting all domain variants. | |

**User's choice:** No extra skips.
**Notes:** None.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Origin-first, Host as fallback | Consistent with BrokerageAuth and MainDomainOnly. Origin is the canonical tenant identifier. | ✓ |
| Host header only | Simpler for Rack middleware; Host is always present. | |

**User's choice:** Origin-first (same pattern as BrokerageAuth).
**Notes:** None.

---

## Claude's Discretion

- **DPRI-03 scope:** Both mailers already implement `primary_domain` at send time. No mailer code changes needed — Phase 23 delivers integration test coverage only. This was identified during codebase scout (not user-raised).
- **Middleware file location:** `app/middleware/domain_redirect_middleware.rb` — standard Rails convention.
- **DB query scope for frozen domains:** `BrokerageDomain.where(status: [:active, :phasing_out, :frozen])` — extends beyond `routable` scope to catch frozen custom domains (DPRD-02).
- **HTTP status:** 301 as specified in success criteria.

## Deferred Ideas

None — discussion stayed within phase scope.

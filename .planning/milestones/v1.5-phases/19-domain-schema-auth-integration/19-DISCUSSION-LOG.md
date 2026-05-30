# Phase 19: Domain Schema & Auth Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 19-domain-schema-auth-integration
**Areas discussed:** Migration structure, DB uniqueness strategy, Reserved slug list, Routing field transition

---

## Migration Structure

### Q1: Schema + backfill in one migration or two?

| Option | Description | Selected |
|--------|-------------|----------|
| One migration (schema + backfill) | Atomic, simple, rollback reverts both | ✓ |
| Two migrations (schema first, then data) | Safer for large tables, separate reversibility | |
| You decide | Claude picks | |

**User's choice:** One migration (schema + backfill)
**Notes:** Table is small (dev/early SaaS stage), atomic transaction preferred.

### Q2: DB-level defaults on new columns?

| Option | Description | Selected |
|--------|-------------|----------|
| DB defaults on all 3 required columns | domain_type: 'subdomain', status: 'active', is_primary: false | ✓ |
| No DB defaults, rely on model/validation | Rails must supply values on every insert | |
| You decide | Claude picks | |

**User's choice:** DB defaults on all 3 required columns
**Notes:** Safest approach — any insert that omits columns gets a sensible DB-level default.

---

## DB Uniqueness Strategy

### Q1: How to enforce uniqueness for non-decommissioned domains?

| Option | Description | Selected |
|--------|-------------|----------|
| Partial DB index (Recommended) | WHERE status != 'decommissioned'; race-condition-safe | ✓ |
| AR-level validation only | Conditional uniqueness validator; not race-safe | |

**User's choice:** Partial DB index
**Notes:** Drop existing full unique index, add partial unique index. AR validator mirrors it.

### Q2: Uniqueness error message wording?

| Option | Description | Selected |
|--------|-------------|----------|
| Generic: 'is already taken' | Standard Rails; does not reveal owner | ✓ |
| Custom: 'is not available' | Slightly more neutral | |
| You decide | Claude picks | |

**User's choice:** Generic: 'is already taken'
**Notes:** Satisfies DMOD-03 privacy requirement.

---

## Reserved Slug List

### Q1: Which reserved words to block?

| Option | Description | Selected |
|--------|-------------|----------|
| Standard infra words only | admin, api, www, mail, smtp, ftp, staging, dev, test, app, auth, login, signup, dashboard, static, assets, cdn, docs, help, support, status | ✓ |
| Minimal list | Only words the platform uses today | |
| You decide / custom list | User-provided | |

**User's choice:** Standard infra words only
**Notes:** 21-word list covering both current and near-future infra words.

### Q2: Where should the reserved words list live?

| Option | Description | Selected |
|--------|-------------|----------|
| Constant in the model (Recommended) | BrokerageDomain::RESERVED_SLUGS; co-located with validation | ✓ |
| Config file / initializer | Easier to update without touching model | |

**User's choice:** Constant in the model
**Notes:** Simplest, co-located with the validation that uses it.

---

## Routing Field Transition

### Q1: Drop `verified: true` from BrokerageAuth or keep it?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop verified from routing (Recommended) | BrokerageAuth uses status only | |
| Keep both: status AND verified | Belt-and-suspenders | |
| Other (free text) | "domains should not be active until they are verified" | ✓ |

**User's choice:** Free-text: "domains should not be active until they are verified"
**Notes:** User wants verified-before-active enforced, but at the model level (not redundantly in BrokerageAuth). BrokerageAuth routes by status only, trusting the model invariant.

### Q2: How to enforce verified-before-active?

| Option | Description | Selected |
|--------|-------------|----------|
| Model-level validation (Recommended) | BrokerageDomain validates: status can't be 'active' unless verified == true. BrokerageAuth trusts this. | ✓ |
| Dual check in BrokerageAuth | Both status AND verified checked on every request | |

**User's choice:** Model-level validation
**Notes:** Single source of truth in the model. BrokerageAuth is clean.

### Q3: Named scope `.routable` or inline in BrokerageAuth?

| Option | Description | Selected |
|--------|-------------|----------|
| Named scope `.routable` (Recommended) | BrokerageDomain.routable = where(status: [:active, :phasing_out]) | ✓ |
| Inline in BrokerageAuth | where(status: [:active, :phasing_out]) directly in concern | |

**User's choice:** Named scope `.routable`
**Notes:** Single source of truth for routing logic; easier to maintain if status semantics evolve.

---

## Claude's Discretion

- Rails `enum` macro chosen for `domain_type` and `status` (not asked — consistent with AR convention and gives useful predicate methods)
- `phase_out_at` set as nullable with no DB default (no discussion needed, obvious from requirement)
- `BrokerageDomain.active` scope rename noted as implementation detail to handle during execution (enum clash)

## Deferred Ideas

- DNS verification for custom domains → v1.6 milestone (already in STATE.md)
- Server-side 301 redirect at Caddy layer → v1.6 milestone
- `acts_as_paranoid` on `BrokerageDomain` → not in scope for this phase

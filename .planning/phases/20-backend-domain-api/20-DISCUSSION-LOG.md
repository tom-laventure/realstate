# Phase 20: Backend Domain API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 20-backend-domain-api
**Areas discussed:** Domain response format, Phase-out logic placement, Existing verify DNS action, Owner-only vs admin gating

---

## Domain Response Format

### Q1: Serializer vs inline hash

| Option | Description | Selected |
|--------|-------------|----------|
| AMS Serializer | Consistent with project pattern (BrokerageSerializer, GroupSerializer, etc.) | ✓ |
| Inline hash | Matches existing domains index style; no new file | |
| You decide | Claude picks based on project conventions | |

**User's choice:** AMS Serializer

### Q2: Fields to expose

| Option | Description | Selected |
|--------|-------------|----------|
| Lifecycle fields only | id, domain, domain_type, status, is_primary, phase_out_at | ✓ |
| Lifecycle + verification fields | Add verified, verified_at, verification_token | |

**User's choice:** Lifecycle fields only — no verification fields since DNS verification is deferred to v1.6.

### Q3: Collection response wrapping

| Option | Description | Selected |
|--------|-------------|----------|
| Root-key wrapped { domains: [...] } | Consistent with :json AMS adapter convention | ✓ |
| Top-level array | Simpler but inconsistent | |

**User's choice:** Root-key wrapped

### Q4: Mutation response shape

| Option | Description | Selected |
|--------|-------------|----------|
| Full updated domain + all brokerage domains | { domain: <updated>, domains: <all> } — one round trip | ✓ |
| Return only the updated domain | Frontend must re-fetch the list separately | |

**User's choice:** Return both updated domain and all active+phasing_out domains

---

## Phase-out Lifecycle Logic

### Q1: Logic placement

| Option | Description | Selected |
|--------|-------------|----------|
| Model methods on BrokerageDomain | Fat model, lean controller; no new file | ✓ |
| DomainLifecycleService | Separate service object like GeocodingService | |
| Inline in controller | Simpler initially, controller becomes long | |

**User's choice:** Model methods

### Q2: phase_out_at timing

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly 30 days (30.days.from_now) | Simple, precise | ✓ |
| 30 days rounded to end of day | Friendlier but more complex | |

**User's choice:** Exactly 30 days from API call time

### Q3: Immediate decommission fields

| Option | Description | Selected |
|--------|-------------|----------|
| Set both status: decommissioned AND deleted_at: now | Matches REQUIREMENTS spec exactly | ✓ |
| Set status: decommissioned only | Uniqueness partial index already excludes decommissioned | |

**User's choice:** Both fields — matches DMOD-14 spec and manual soft-delete pattern

### Q4: set_primary transaction

| Option | Description | Selected |
|--------|-------------|----------|
| Single DB transaction | Atomic demotion + promotion; prevents inconsistent state | ✓ |
| Two separate updates | Simpler but risks crash between updates | |

**User's choice:** Single transaction

---

## Existing Verify DNS Action

### Q1: Remove vs keep

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it | Clean slate; DNS deferred to v1.6; no dead routes | ✓ |
| Leave it in place | Safe, zero churn, v1.6 team can extend | |
| Move to ops namespace | Relocate instead of remove | |

**User's choice:** Remove — DNS verification is deferred to v1.6 and the verify action is dead code since verified is no longer the routing gate.

---

## Owner-only vs Admin Gating

### Q1: Mutation action gating

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-only for all mutations | High-impact, irreversible; old controller already gated to owners | ✓ |
| Admin for read, owner for mutations | Split gating | |
| Admin for all actions | Simpler but too permissive | |

**User's choice:** Owner-only for all mutations (PATCH /subdomain, POST /custom, DELETE, PATCH /set_primary)

### Q2: Index gating

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-only (consistent) | Simpler — same gate for all | |
| Admin can read, owner can mutate | Cleaner read-vs-write permission model | ✓ |

**User's choice:** Admin can read (index), owner required for mutations

---

## Claude's Discretion

None — all gray areas had clear user decisions.

## Deferred Ideas

- DNS verification for custom domains → v1.6 milestone
- `verified` column UI exposure → DNS verification milestone
- Ops namespace domain management → left as-is in Phase 20

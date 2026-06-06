# Phase 27: Backend Enrichment + Frontend Types - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 27-backend-enrichment-frontend-types
**Areas discussed:** Role count mapping, Frontend field optionality

---

## Role Count Mapping

### What counts as agent_count?

| Option | Description | Selected |
|--------|-------------|----------|
| agent only | Count only memberships with role = 'agent' | |
| agent + staff | Staff and agents both count toward team size | |
| agent, staff, owner, admin | All non-client members | ✓ |

**User's choice:** agent + staff + owners — "agent might not be the best label for it, Admin might be better"
**Notes:** User wanted a broader count than just 'agent'; ultimately agreed to rename the field.

---

### Field name for the broader count

| Option | Description | Selected |
|--------|-------------|----------|
| member_count | Neutral label for all non-client members | ✓ |
| agent_count | Keep original REQUIREMENTS.md label | |

**User's choice:** member_count
**Notes:** `agent_count` was renamed to `member_count` because the count includes owners, admins, and staff — not just agents.

---

### What counts as client_count?

| Option | Description | Selected |
|--------|-------------|----------|
| client only | Count memberships with role = 'client' only | ✓ |
| client + staff | Include staff in client count | |

**User's choice:** client only

---

### Are admin members excluded from all counts?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, exclude admins | Admins are management, not counted | |
| Count admins as agents | Include admin-role members in agent count | ✓ |

**User's choice:** Count admins in the team count (now member_count)
**Notes:** Combined with the answer above — admins roll into member_count.

---

### Do owners appear in both the names array AND member_count?

| Option | Description | Selected |
|--------|-------------|----------|
| Both (names array + counted) | Owners are full members — include in both | ✓ |
| Names only, not counted | Owners shown by name but not in count | |

**User's choice:** Both

---

### Include self in count?

| Option | Description | Selected |
|--------|-------------|----------|
| Include self in count | No self-exclusion; simpler query | ✓ |
| Exclude self | Requesting user excluded from counts | |

**User's choice:** Include self

---

### Soft-deleted members in counts?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, exclude deleted | Use .without_deleted consistently | ✓ |
| Include deleted | Historical headcount | |

**User's choice:** Exclude deleted (consistent with codebase conventions)

---

## Frontend Field Optionality

### Required vs optional fields?

| Option | Description | Selected |
|--------|-------------|----------|
| Required | Cleaner downstream code, no nullish checks | ✓ |
| Optional (?) | Backwards-compatible | |

**User's choice:** Required fields

---

### Redux initial state handling?

| Option | Description | Selected |
|--------|-------------|----------|
| No special handling needed | Initial [] has no items to validate | ✓ |
| Add default values to initial state | Add defaults for type satisfaction | |

**User's choice:** No special handling needed

---

## Claude's Discretion

- Backend query implementation: inline enrichment vs. Query Object — implementer's choice
- Serializer vs. inline hash: keep inline hash (existing pattern for this controller)

## Deferred Ideas

None — discussion stayed within phase scope.

# Phase 30: Backend RBAC Enforcement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 30-Backend RBAC Enforcement
**Areas discussed:** Un-enumerated endpoints (Estates search/cities), Test coverage scope

---

## Un-enumerated endpoints (Estates search/cities)

| Option | Description | Selected |
|--------|-------------|----------|
| Allow agent (treat as read-only) | Consistent with the broader "agent gets read access everywhere" spirit of the milestone goal in PROJECT.md. Low risk — GET-only, brokerage-scoped, no data beyond what agent can already see via groups. | ✓ |
| Leave owner/admin only (default-deny) | Since it's not explicitly enumerated in REQUIREMENTS.md, don't grant it. Matches a conservative "only open what's explicitly required" security posture — can be added later if agents actually need it. | |

**User's choice:** Allow agent (treat as read-only)
**Notes:** `/v1/admin/estates/search` and `/v1/admin/estates/cities` (top-level `EstatesController`, not the group-scoped one) aren't in RBAC-01/02/03. Treated as part of the same read-only tier as boards/activity.

---

## Test coverage scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full matrix coverage (recommended) | Extend `admin_authorization_test.rb` to assert agent gets 2xx on every group-scoped + read-only endpoint listed in RBAC-01/02, and 403 on every write endpoint in RBAC-03 — plus fix the one contradicting assertion. Verifiable against the phase's exact success criteria. | ✓ |
| Minimal fix | Just flip the one now-incorrect assertion (agent should get 200, not 403, on GET /v1/admin/users). Leave broader matrix coverage for a later verification pass. | |

**User's choice:** Full matrix coverage (recommended)
**Notes:** Existing test `admin_authorization_test.rb:21-26` currently asserts agent gets 403 on `GET /v1/admin/users` — this must flip to 200 once RBAC-02 lands. Flagged as a blocking pre-existing test that will go red otherwise.

---

## Claude's Discretion

- Exact mechanism for splitting `require_admin!` into read/write/group tiers (implementation detail — researcher/planner to design, following the existing `require_owner!` override pattern).
- Naming of any new before_action/method for the "owner/admin/agent read" tier.
- 403 response body shape for new checks — match existing `require_admin!` shape (`{ error: { code: "forbidden", message: "..." } }`).

## Deferred Ideas

None — discussion stayed within phase scope. `staff` role permissions and new granular `Permission` values were already recorded as Out of Scope in REQUIREMENTS.md prior to this discussion.

# Phase 30: Backend RBAC Enforcement - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-only. The `agent` role must be recognized by `V1::Admin::BaseController` and every controller it powers:
- Full CRUD on all group-scoped endpoints (`groups`, `group/users`, `group/filter_sets`, `group/estates`, `group/invitations`)
- Read-only (2xx) on `users#index/show`, `brokerages#show`, `domains#index/verify`, `boards#index`, `board_credentials#index`, `activity#stats/index`
- HTTP 403 on every other write endpoint (`users#update/destroy`, `brokerages#update`, domain mutations, `board_credentials#create/update/destroy`, brokerage-level invitations)

This phase enforces the backend boundary before any frontend surface is unlocked (Phases 31/32 depend on this). No frontend changes, no new `Permission` values, no `staff` role work — those are explicitly out of scope for v1.10.

</domain>

<decisions>
## Implementation Decisions

### Un-enumerated endpoints
- **D-01:** `/v1/admin/estates/search` and `/v1/admin/estates/cities` (top-level `V1::Admin::EstatesController`, distinct from the group-scoped `group/estates` controller) are NOT listed in RBAC-01/02/03. Decision: grant `agent` read access to these too, consistent with the milestone's "full read access everywhere" framing in PROJECT.md. Treat them as part of the same read-only tier as `boards#index` / `activity#index`.

### Test coverage
- **D-02:** This phase must extend `backend/test/integration/admin_authorization_test.rb` (or equivalent) to cover the full new agent permission matrix — 2xx on every group-scoped and read-only endpoint, 403 on every write endpoint outside Groups scope — not just a minimal fix.
- **D-03 (blocking, must fix):** `admin_authorization_test.rb` currently has a test asserting `"agent role receives 403 on GET /v1/admin/users"` (line 21-26). This assertion is now WRONG under RBAC-02 and must be flipped to expect 200. This is a pre-existing test that will fail once the base authorization change lands — do not leave it red.

### Claude's Discretion
- Exact mechanism for splitting `require_admin!` into read/write/group tiers (e.g., broadening the base check and layering `skip_before_action` + a narrower write-only check per controller, following the existing `require_owner!` override pattern already used in `BrokeragesController` and `DomainsController`) — implementation detail, not a user decision.
- Naming of any new before_action/method introduced for the "owner/admin/agent read" tier.
- Response body shape for new 403s — match the existing `{ error: { code: "forbidden", message: "..." } }` shape used by `require_admin!` today (do not introduce a third format alongside `require_owner!`'s inconsistent `{ error: "..." }` shape — that inconsistency is pre-existing and out of scope to fix here).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Role & access-control reference
- `.planning/ROLES.md` — role definitions, current enforcement state, and known gaps. Confirms `agent` has "no dedicated backend check yet — falls through to whatever the endpoint requires" and that `require_owner!`/`require_admin!` are the only two shared checks today.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — RBAC-01, RBAC-02, RBAC-03 (exact endpoint enumeration), Out of Scope table (staff role, new Permission values)
- `.planning/ROADMAP.md` — Phase 30 goal, success criteria, dependency note (Phase 31/32 depend on this phase landing first)
- `.planning/PROJECT.md` — Key Decisions table (`Admin::BaseController#require_admin!` — imperative, no gem), Constraints section (soft deletes, serializer N+1, testing conventions)

No other external specs/ADRs — requirements fully captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/controllers/v1/admin/base_controller.rb` — defines `require_admin!` (owner/admin only, default `before_action`) and `require_owner!` (owner only). Both use the same `BrokerageMembership.without_deleted.find_by(...)` lookup pattern — reuse this pattern for any new agent-aware check, per the "converge toward the shared pattern" guidance in ROLES.md.
- `backend/app/controllers/v1/admin/brokerages_controller.rb` and `domains_controller.rb` already demonstrate the override pattern this phase needs: `skip_before_action :require_admin!, only: [...]` + a narrower `before_action` for the tightened action. Follow this exact pattern rather than inventing a new one.
- `backend/test/factories/brokerage_memberships.rb` already has an `:agent` trait — no factory work needed.
- `backend/test/integration/admin_authorization_test.rb` already has `@owner`, `@admin`, `@agent`, `@client` fixtures set up with `auth_headers_for` helper — extend this file rather than creating a new one.

### Established Patterns
- All 13 `V1::Admin::*` controllers inherit `V1::Admin::BaseController` and get `require_admin!` by default — a base-controller change automatically propagates to every controller unless explicitly overridden.
- Group-scoped controllers (`GroupsController`, `Group::EstatesController`, `Group::FilterSetsController`, `Group::InvitationsController`, `Group::UsersController`) currently have NO per-action override — they rely entirely on the base `require_admin!`. If the base check is broadened to include `agent`, these five controllers get full agent CRUD "for free" with zero controller-level changes — matches RBAC-01 exactly.
- `V1::Admin::InvitationsController` (brokerage-level, distinct from `group/invitations`) must stay fully blocked for `agent` — watch for this specifically if the base check is broadened, since it would otherwise accidentally open `index`/`create` to agent, which violates ACCESS-07/RBAC-03 ("no view, no create").

### Integration Points
- `AppConstants::BROKERAGE_ROLES` (`backend/app/constants/roles.rb`) already includes `agent` — no schema or constant changes needed, this is purely a controller-authorization change.

</code_context>

<specifics>
## Specific Ideas

No UI or visual references — this is a backend-only enforcement phase. The two decisions above (unlisted endpoints, test coverage depth) are the only points where the user made an explicit call beyond what REQUIREMENTS.md already locks down.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (`staff` role permissions and new granular `Permission` values are already recorded as Out of Scope in REQUIREMENTS.md, not raised as new ideas here.)

</deferred>

---

*Phase: 30-Backend RBAC Enforcement*
*Context gathered: 2026-07-09*

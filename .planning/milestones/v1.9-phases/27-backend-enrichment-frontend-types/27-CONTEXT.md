# Phase 27: Backend Enrichment + Frontend Types - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `GET /v1/account/admin_brokerages` to return per-brokerage stats (`client_count`, `member_count`, `owners`) with no additional network requests. Update the frontend `AdminBrokerage` TypeScript interface to match the enriched shape so Phase 28 can consume the data without type errors.

No UI changes in this phase — data layer and types only.

</domain>

<decisions>
## Implementation Decisions

### Role Count Mapping

- **D-01:** `client_count` = count of active (non-deleted) memberships with `role = 'client'` for each brokerage.
- **D-02:** `member_count` (not `agent_count`) = count of active memberships with `role IN ('agent', 'staff', 'owner', 'admin')` for each brokerage. The label `agent_count` was rejected — "member" better reflects the mix of roles it covers.
- **D-03:** `owners` = array of `{first_name, last_name}` for active memberships with `role = 'owner'`. Owners also appear in `member_count` (double-counted intentionally — they are full members).
- **D-04:** Soft-deleted memberships (`deleted_at IS NOT NULL`) are excluded from all counts and the owners array. Use `.without_deleted` consistent with all other queries in the codebase.
- **D-05:** The requesting user is included in their own counts (no self-exclusion). Simplifies the query and gives accurate brokerage headcount.
- **D-06:** If a brokerage has no owners, `owners` returns `[]` (empty array).

### Backend Response Shape

- **D-07:** The enriched response shape per brokerage is:
  ```json
  {
    "id": 1,
    "name": "Acme Realty",
    "role": "owner",
    "client_count": 12,
    "member_count": 5,
    "owners": [
      {"first_name": "Alice", "last_name": "Smith"},
      {"first_name": "Bob", "last_name": "Jones"}
    ]
  }
  ```
- **D-08:** Fetch all memberships for all admin brokerages in one bulk query (group by `brokerage_id` in Ruby) to avoid N+1. Do NOT query per brokerage. This follows the established N+1 prevention pattern from CLAUDE.md.

### Frontend Types

- **D-09:** The new fields `clientCount`, `memberCount`, and `owners` are **required** (not optional `?`) on the `AdminBrokerage` interface. The endpoint always returns them; optional fields would force unnecessary nullish checks in Phase 28 card components.
- **D-10:** `owners` type: `{ firstName: string; lastName: string }[]`
- **D-11:** No changes needed to Redux initial state — the initial `adminBrokerages: []` has no items, so the new required fields on the item type cause no TypeScript errors.
- **D-12:** Update `frontend/src/assets/types/adminBrokerageType.ts` in-place. No new interface needed.

### Claude's Discretion

- Backend query implementation detail (inline `filter_map` enrichment vs. a new Query Object): implementer may choose. Inline with one bulk membership fetch is acceptable given the small scope; a Query Object is also fine if the logic gets complex.
- Serializer vs. inline hash: keep inline hash for now — the existing controller uses this pattern and a full AMS serializer adds overhead for what's just one endpoint.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DASH-01, DASH-02 define what must be returned and the interface fields required

### Architecture Constraints
- `CLAUDE.md` §"Serialization & N+1 Prevention" — bulk-compute per-record data in the controller, pass via instance options; serializers must not perform per-record DB queries
- `CLAUDE.md` §"Soft Deletes" — every query must use `.without_deleted`; joined models must also be guarded

### Existing Code
- `backend/app/controllers/v1/account/admin_brokerages_controller.rb` — current implementation to be extended
- `frontend/src/assets/types/adminBrokerageType.ts` — interface to be updated
- `frontend/src/assets/types/roleType.ts` — UserRole union (`'owner' | 'admin' | 'agent' | 'staff' | 'client'`)
- `frontend/src/store/hooks/Account/useFetchAdminBrokerages.ts` — hook consuming the endpoint
- `frontend/src/containers/portal/BrokerageSelection.tsx` — component consuming AdminBrokerage (will use new fields in Phase 28)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BrokerageMembership` model: has `role`, `user_id`, `brokerage_id`, `deleted_at` — all needed for the bulk fetch
- `User` model: has `first_name`, `last_name` — needed for owners array
- `UserRole` type in `roleType.ts`: already defines all 5 roles — use it in the new owners response type if needed

### Established Patterns
- N+1 prevention: bulk fetch all memberships for all relevant brokerage IDs in one query, group by `brokerage_id` in Ruby — mirrors the pattern used in collection endpoints with stats
- Soft deletes: always `.without_deleted` on every model in the query chain
- Frontend response shape: Axios interceptor applies `camelcaseKeys` automatically — backend returns `snake_case`, frontend receives `camelCase` with no manual conversion

### Integration Points
- Controller `index` action: add a second bulk query for all brokerage memberships keyed by brokerage ID; merge stats into the existing `filter_map` response hash
- `adminBrokerageType.ts`: three new required fields — `clientCount: number`, `memberCount: number`, `owners: { firstName: string; lastName: string }[]`
- Redux `activeBrokerage` reducer already stores `AdminBrokerage[]` — no shape changes needed at the store/reducer level, only the type definition

</code_context>

<specifics>
## Specific Ideas

- The field renamed from `agent_count` → `member_count` was a deliberate naming decision made during discussion. REQUIREMENTS.md uses `agent_count` but the user confirmed `member_count` is the correct label given that owners, admins, and staff are all included.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 27-Backend Enrichment + Frontend Types*
*Context gathered: 2026-06-05*

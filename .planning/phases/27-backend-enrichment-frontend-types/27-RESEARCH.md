# Phase 27: Backend Enrichment + Frontend Types - Research

**Researched:** 2026-06-05
**Domain:** Rails controller enrichment / TypeScript interface extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `client_count` = count of active (non-deleted) memberships with `role = 'client'` per brokerage.
- **D-02:** `member_count` = count of active memberships with `role IN ('agent', 'staff', 'owner', 'admin')` per brokerage. Label `member_count` is final — `agent_count` was rejected.
- **D-03:** `owners` = array of `{first_name, last_name}` for active memberships with `role = 'owner'`. Owners are also counted in `member_count`.
- **D-04:** Soft-deleted memberships (`deleted_at IS NOT NULL`) are excluded from all counts and the owners array. Use `.without_deleted`.
- **D-05:** The requesting user is included in their own counts (no self-exclusion).
- **D-06:** If a brokerage has no owners, `owners` returns `[]`.
- **D-07:** Enriched per-brokerage response shape: `{id, name, role, client_count, member_count, owners: [{first_name, last_name}]}`.
- **D-08:** One bulk membership query for all admin brokerage IDs; group by `brokerage_id` in Ruby. No per-brokerage queries.
- **D-09:** New frontend fields `clientCount`, `memberCount`, `owners` are **required** (not optional `?`).
- **D-10:** `owners` TypeScript type: `{ firstName: string; lastName: string }[]`.
- **D-11:** No changes to Redux initial state — initial `adminBrokerages: []` causes no TypeScript errors.
- **D-12:** Update `frontend/src/assets/types/adminBrokerageType.ts` in-place. No new interface needed.

### Claude's Discretion

- Backend query implementation: inline `filter_map` enrichment OR a new Query Object. Inline with one bulk membership fetch is acceptable.
- Serializer vs. inline hash: keep inline hash — existing controller uses this pattern; a full AMS serializer is overkill for one endpoint.

### Deferred Ideas (OUT OF SCOPE)

None.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | `GET /v1/account/admin_brokerages` returns per-brokerage stats (client count, member count, owner names) without additional network requests | Backend: one bulk membership query + `group_by` in Ruby; inline hash enrichment in `filter_map` |
| DASH-02 | Frontend `AdminBrokerage` interface includes `clientCount`, `memberCount`, and `owners` fields | TypeScript: extend `adminBrokerageType.ts` in-place; camelCase conversion handled by Axios interceptor |

Note: REQUIREMENTS.md uses `agentCount` (DASH-02) but user confirmed during discussion that `memberCount` is the correct final label (D-02 in CONTEXT.md). CONTEXT.md locked decision overrides REQUIREMENTS.md wording.

</phase_requirements>

---

## Summary

Phase 27 is a focused data-layer enrichment with zero UI surface. The existing `GET /v1/account/admin_brokerages` endpoint currently returns `{id, name, role}` per brokerage — this phase adds `client_count`, `member_count`, and `owners` to each entry. The frontend `AdminBrokerage` TypeScript interface then grows three required fields so Phase 28 card components can consume them without nullish checks.

The backend change is a single bulk query: fetch all `BrokerageMembership` records (excluding soft-deleted) for all brokerage IDs the requesting user admins, then `group_by(:brokerage_id)` in Ruby. Within the existing `filter_map` loop, derive counts and owners from the in-memory group — no per-brokerage database hits. This is the canonical N+1 prevention pattern in this codebase.

The frontend change is surgical: two new numeric fields and one typed array added to a 7-line interface. The Axios interceptor already converts `snake_case` to `camelCase`, so `client_count` arrives as `clientCount` with no manual conversion. The Redux reducer, initial state, and all downstream consumers (`BrokerageSelection.tsx`) require no changes in this phase — they will consume the new fields in Phase 28.

**Primary recommendation:** Extend the controller `index` action with one additional `BrokerageMembership.without_deleted.includes(:user).where(brokerage_id: brokerage_ids)` query; enrich inline via Ruby `group_by`. Update the TypeScript interface in-place. Ship.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bulk membership count + owner fetch | API / Backend | — | Aggregate queries belong in the API layer; the frontend must not make per-brokerage sub-requests |
| N+1 prevention (group_by in Ruby) | API / Backend | — | All per-record stats are computed in-controller from a pre-fetched collection |
| snake_case → camelCase conversion | Frontend (Axios interceptor) | — | Global interceptor handles this; no per-call conversion |
| TypeScript interface update | Frontend | — | Type system enforcement at compile time; no runtime impact |
| Redux store shape | Frontend | — | `activeBrokerage.ts` already typed as `AdminBrokerage[]`; updating the interface propagates automatically |

---

## Standard Stack

### Core (all verified in codebase — [VERIFIED: codebase grep])

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rails / ActiveRecord | 7.1 | ORM, bulk queries, acts_as_paranoid | Established project stack |
| acts_as_paranoid | — | Soft-delete scoping via `.without_deleted` | Required for all user-facing models |
| TypeScript | — | Interface definitions in `assets/types/` | Established frontend type system |

No new dependencies required for this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
GET /v1/account/admin_brokerages
         |
         v
AdminBrokeragesController#index
         |
         +-- Query 1 (existing): BrokerageMembership.without_deleted
         |     .includes(:brokerage)
         |     .where(user_id: Current.user.id, role: ['admin','owner'])
         |     -> admin_memberships (N rows)
         |
         +-- Query 2 (new): BrokerageMembership.without_deleted
         |     .includes(:user)
         |     .where(brokerage_id: brokerage_ids)
         |     -> all_memberships (M rows, one query)
         |
         +-- Ruby group_by(:brokerage_id)
         |     -> memberships_by_brokerage (Hash)
         |
         +-- filter_map over admin_memberships
               |
               +-- for each brokerage_id: derive from memberships_by_brokerage[id]
               |     client_count   = records where role == 'client'
               |     member_count   = records where role IN non-client roles
               |     owners         = records where role == 'owner', map {first_name, last_name}
               |
               +-- return enriched hash per brokerage
         |
         v
JSON response: {admin_brokerages: [{id, name, role, client_count, member_count, owners}]}
         |
         v
Axios interceptor (camelcaseKeys deep)
         |
         v
Frontend: {adminBrokerages: [{id, name, role, clientCount, memberCount, owners}]}
         |
         v
AdminBrokerage TypeScript interface (updated in-place)
         |
         v
Redux: activeBrokerage.adminBrokerages[] (no reducer changes)
```

### Recommended Project Structure

No structural changes. Both files already exist and are modified in-place:

```
backend/app/controllers/v1/account/
└── admin_brokerages_controller.rb   # extend index action

frontend/src/assets/types/
└── adminBrokerageType.ts            # add 3 required fields
```

### Pattern 1: Bulk Membership Query + Ruby group_by (N+1 Prevention)

**What:** Fetch all related rows in one query; partition into a Hash in Ruby; never query inside a loop.

**When to use:** Any time you need per-record stats for a collection of parent records.

**Example (adapted for this phase):**

```ruby
# Source: CLAUDE.md §"Serialization & N+1 Prevention" + codebase pattern
# Step 1: collect the brokerage IDs we care about
brokerage_ids = admin_memberships.filter_map { |m| m.brokerage_id }

# Step 2: one bulk query — includes(:user) to avoid N+1 when reading first_name/last_name
all_memberships = BrokerageMembership
  .without_deleted
  .includes(:user)
  .where(brokerage_id: brokerage_ids)

# Step 3: partition in Ruby — zero additional queries
memberships_by_brokerage = all_memberships.group_by(&:brokerage_id)

# Step 4: enrich in filter_map
admin_memberships.filter_map do |m|
  next if m.brokerage.nil?
  group = memberships_by_brokerage[m.brokerage_id] || []

  client_count = group.count { |r| r.role == 'client' }
  member_roles = %w[agent staff owner admin]
  member_count = group.count { |r| member_roles.include?(r.role) }
  owners = group
    .select { |r| r.role == 'owner' }
    .map    { |r| { first_name: r.user.first_name, last_name: r.user.last_name } }

  {
    id: m.brokerage.id,
    name: m.brokerage.name,
    role: m.role,
    client_count: client_count,
    member_count: member_count,
    owners: owners
  }
end
```

**Critical:** `includes(:user)` on the bulk query is mandatory. Without it, accessing `r.user.first_name` inside the Ruby loop triggers one query per membership record (N+1).

### Pattern 2: Soft-Delete Guard on Joined Model

**What:** When querying `BrokerageMembership` and accessing `.user`, guard both models.

**When to use:** Every query that joins across models where either side can be soft-deleted.

**Example:**

```ruby
# Source: CLAUDE.md §"Soft Deletes"
# BrokerageMembership is guarded by .without_deleted
# User is acts_as_paranoid — includes(:user) loads only non-deleted users by default
# via AR's default scope on the User model (acts_as_paranoid adds deleted_at IS NULL scope)
BrokerageMembership.without_deleted.includes(:user).where(brokerage_id: ids)
```

**Note:** `acts_as_paranoid` adds a default scope (`deleted_at IS NULL`) to models that include it. `User` uses `acts_as_paranoid`, so `includes(:user)` already excludes deleted users. The explicit `.without_deleted` on `BrokerageMembership` handles the join-side guard.

### Pattern 3: TypeScript Interface Extension (In-Place)

**What:** Add required fields directly to existing interface; no new file, no optional fields.

**When to use:** When the endpoint always returns the fields and downstream consumers need no nullish checks.

```typescript
// Source: CLAUDE.md §"Frontend Architecture" + existing adminBrokerageType.ts
import UserRole from './roleType'

export interface AdminBrokerage {
    id: number
    name: string
    role: UserRole
    clientCount: number
    memberCount: number
    owners: { firstName: string; lastName: string }[]
}
```

**camelCase conversion:** The Axios interceptor (`assets/axios/axios.ts`) applies `camelcaseKeys(response.data, { deep: true })` globally. Backend returns `client_count` → frontend receives `clientCount`. Never call `camelcaseKeys` manually in hooks or API modules.

### Anti-Patterns to Avoid

- **Per-brokerage query inside loop:** `admin_memberships.each { |m| BrokerageMembership.where(brokerage_id: m.brokerage_id).count }` — this is the exact N+1 this phase avoids.
- **Missing `includes(:user)`:** Calling `r.user.first_name` without eagerly loading `:user` triggers one SELECT per membership.
- **Missing `.without_deleted` on the bulk query:** The second query must also use `.without_deleted`, not just the first one. Soft-deleted memberships must be excluded from both client counts and owner arrays.
- **Optional fields in TypeScript:** Using `clientCount?: number` forces Phase 28 consumers to add unnecessary `?.` chains. Fields are required per D-09.
- **Manually calling `camelcaseKeys` in the API module:** The interceptor already does this. A second call causes double-conversion errors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Soft-delete scoping | Manual `WHERE deleted_at IS NULL` | `.without_deleted` | acts_as_paranoid already defines this; manual WHERE clauses drift out of sync |
| camelCase conversion | `camelcaseKeys` in hook/API | Axios interceptor (already configured) | Global interceptor in `assets/axios/axios.ts` handles all responses |
| Counting roles | SQL `COUNT GROUP BY role` subquery | Ruby `group.count { |r| r.role == 'client' }` on in-memory collection | In-memory operation on a small per-brokerage set; avoids a third query |

**Key insight:** The membership set per admin user is small (typically < 5 brokerages, < 200 total memberships across all of them). In-memory Ruby operations on an eagerly-loaded collection are faster and simpler than N+1 SQL counts.

---

## Common Pitfalls

### Pitfall 1: N+1 on `r.user` Inside the filter_map Loop

**What goes wrong:** The bulk membership query fetches `BrokerageMembership` rows but does not eagerly load `User`. When the `filter_map` loop calls `r.user.first_name` for each owner, Rails fires one `SELECT * FROM users WHERE id = ?` per row.

**Why it happens:** `includes(:user)` is easy to omit when the query is written incrementally.

**How to avoid:** Always include `.includes(:user)` on the bulk membership query. Verify with `to_sql` or `bullet` gem output.

**Warning signs:** Log shows `SELECT * FROM users WHERE id = X` repeated with different IDs.

### Pitfall 2: Soft-Delete Leakage on Bulk Query

**What goes wrong:** The second bulk query (`BrokerageMembership.where(brokerage_id: ...)`) lacks `.without_deleted`, causing deleted memberships to appear in counts and the owners array.

**Why it happens:** `.without_deleted` on the first query does not propagate to subsequent queries.

**How to avoid:** Both queries must explicitly call `.without_deleted`. No query on `BrokerageMembership` should omit it.

**Warning signs:** Counts higher than expected; owners array includes users who were removed from the brokerage.

### Pitfall 3: Empty `brokerage_ids` Array Causing Full-Table Scan

**What goes wrong:** If the user has no admin memberships, `brokerage_ids` is `[]`. `BrokerageMembership.where(brokerage_id: [])` on some databases returns all rows (or generates a bad query).

**Why it happens:** ActiveRecord with an empty array `WHERE brokerage_id IN ()` is handled differently per DB adapter, but it is semantically wrong and wasteful.

**How to avoid:** Guard with an early return or check: if `brokerage_ids.empty?`, skip the second query and return `[]`.

```ruby
return render json: { admin_brokerages: [] } if brokerage_ids.empty?
```

**Warning signs:** Unusually slow response when the user has zero admin memberships; full table scan in logs.

### Pitfall 4: TypeScript `activeBrokerage` Reducer Stores Stale Shape

**What goes wrong:** After the interface update, the Redux `activeBrokerage` slice stores `AdminBrokerage | null` as its `activeBrokerage` field. If a previously serialized Redux state (e.g., in tests or session restore) has the old shape, TypeScript does not catch the runtime mismatch.

**Why it happens:** TypeScript validates at compile time; runtime Redux state may have been hydrated from an older shape.

**How to avoid:** Per D-11, no reducer changes are needed. The initial state is `activeBrokerage: null` and `adminBrokerages: []` — both empty, so no stale data. This is not a runtime concern in this codebase (no Redux persistence/rehydration configured). Flag as LOW risk.

**Warning signs:** TypeScript error at compile time if consumers access `brokerage.clientCount` before they are typed as required fields on the interface.

---

## Code Examples

### Current Controller (baseline for extension)

```ruby
# Source: [VERIFIED: codebase read] backend/app/controllers/v1/account/admin_brokerages_controller.rb
def index
  memberships = BrokerageMembership
    .without_deleted
    .includes(:brokerage)
    .where(user_id: Current.user.id, role: %w[admin owner])

  render json: {
    admin_brokerages: memberships.filter_map { |m|
      next if m.brokerage.nil?
      {id: m.brokerage.id, name: m.brokerage.name, role: m.role}
    }
  }
end
```

### Enriched Controller (target state)

```ruby
# Source: derived from CONTEXT.md decisions + CLAUDE.md patterns [ASSUMED: specific Ruby syntax]
def index
  admin_memberships = BrokerageMembership
    .without_deleted
    .includes(:brokerage)
    .where(user_id: Current.user.id, role: %w[admin owner])

  brokerage_ids = admin_memberships.filter_map(&:brokerage_id)

  if brokerage_ids.empty?
    return render json: { admin_brokerages: [] }
  end

  all_memberships = BrokerageMembership
    .without_deleted
    .includes(:user)
    .where(brokerage_id: brokerage_ids)

  memberships_by_brokerage = all_memberships.group_by(&:brokerage_id)
  member_roles = %w[agent staff owner admin]

  render json: {
    admin_brokerages: admin_memberships.filter_map { |m|
      next if m.brokerage.nil?
      group = memberships_by_brokerage[m.brokerage_id] || []
      {
        id: m.brokerage.id,
        name: m.brokerage.name,
        role: m.role,
        client_count: group.count { |r| r.role == "client" },
        member_count: group.count { |r| member_roles.include?(r.role) },
        owners: group
          .select { |r| r.role == "owner" }
          .map { |r| { first_name: r.user.first_name, last_name: r.user.last_name } }
      }
    }
  }
end
```

### Updated TypeScript Interface (target state)

```typescript
// Source: [VERIFIED: codebase read] frontend/src/assets/types/adminBrokerageType.ts (current)
// Updated per D-09, D-10, D-12
import UserRole from './roleType'

export interface AdminBrokerage {
    id: number
    name: string
    role: UserRole
    clientCount: number
    memberCount: number
    owners: { firstName: string; lastName: string }[]
}
```

---

## State of the Art

No framework-level changes in this phase. All patterns are from the existing codebase.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-brokerage stats (none, N/A) | Bulk membership query + Ruby group_by | Phase 27 | Eliminates future N+1 |
| `AdminBrokerage` with 3 fields | `AdminBrokerage` with 6 fields | Phase 27 | Enables Phase 28 card components |

---

## Downstream Consumer Impact Analysis

**`BrokerageSelection.tsx`** — reads `adminBrokerages` from Redux and renders brokerage buttons. Currently accesses only `brokerage.id`, `brokerage.name`, and `brokerage.role`. The new required fields (`clientCount`, `memberCount`, `owners`) exist on the object but are not accessed in Phase 27. TypeScript compile will succeed because the data shape satisfies the updated interface. No code changes needed in this file for Phase 27.

**`activeBrokerage.ts` (Redux reducer)** — typed as `AdminBrokerage | null` and `AdminBrokerage[]`. After the interface update, both types automatically require the new fields. The initial state uses `null` and `[]` — no value instances, so no type errors. [VERIFIED: codebase read]

**`fetchAdminBrokerages.ts`** — `FetchAdminBrokeragesResponse` is `{ adminBrokerages: AdminBrokerage[] }`. No change needed; the interface update propagates automatically through the type reference.

**`useFetchAdminBrokerages.ts`** — thin wrapper returning `fetchAdminBrokerages` directly. No change needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `acts_as_paranoid` adds a default scope to `User` model that excludes deleted users when loaded via `includes(:user)` | Common Pitfalls / Pattern 2 | If User does not apply the default scope through associations, deleted users could appear in the owners array — add explicit guard |
| A2 | The Ruby `group_by` + in-memory filter approach is performant given the expected data volume (small number of admin brokerages per user) | Architecture Patterns | If a super-admin manages hundreds of brokerages, a SQL COUNT + GROUP BY approach would be more efficient |
| A3 | `BrokerageMembership.where(brokerage_id: [])` produces an empty result rather than a full-table scan on SQLite/PostgreSQL in Rails 7.1 | Common Pitfalls | If it does not, the empty-guard early return becomes mandatory for correctness, not just optimization |

---

## Open Questions

1. **`acts_as_paranoid` default scope on User through associations**
   - What we know: `User` model calls `acts_as_paranoid` (verified). `acts_as_paranoid` adds `deleted_at IS NULL` to the model's default scope.
   - What's unclear: Whether `includes(:user)` on a `BrokerageMembership` query respects the `User` default scope when loading through the association.
   - Recommendation: Add an explicit `.where(users: { deleted_at: nil })` to the bulk query as a defensive guard if unsure, or verify with a quick Rails console test during implementation. Risk is LOW in practice (deleted users are rare in this context).

2. **`REQUIREMENTS.md` says `agentCount` but CONTEXT.md D-02 says `memberCount`**
   - What we know: User explicitly chose `member_count` during the discuss phase (CONTEXT.md D-02). REQUIREMENTS.md has not been updated.
   - What's unclear: Whether REQUIREMENTS.md should be updated to reflect the name change before or after planning.
   - Recommendation: Plan should implement `member_count` / `memberCount` per the locked decision. REQUIREMENTS.md update is a documentation cleanup task — include it in the plan as a one-liner task.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code changes (controller extension + TypeScript interface update) with no external tool, service, or runtime dependencies beyond the existing Rails and Node.js stack.

---

## Project Constraints (from CLAUDE.md)

All directives that apply to this phase:

| Directive | Applies | Enforcement |
|-----------|---------|-------------|
| Always use `.without_deleted` on every query including joined models | Yes — both membership queries | MANDATORY on bulk query |
| Bulk-compute per-record data in controller; never query per-record | Yes — the entire enrichment strategy | MANDATORY |
| Serializers must not perform per-record DB queries | Partial — no serializer used here (inline hash per discretion decision) | N/A for inline hash |
| Never call `camelcaseKeys` in hooks or API modules | Yes — `fetchAdminBrokerages.ts` must not add conversion | MANDATORY |
| Icons: lucide-react only | No UI changes in this phase | N/A |
| Styling: Tailwind CSS | No UI changes in this phase | N/A |
| Define domain interfaces in `assets/types/` | Yes — updating existing file | Already compliant |
| Soft-delete guard on joined models: explicit `WHERE deleted_at IS NULL` | Yes — if joining User, consider explicit guard | See Pitfall 1 / Open Question 1 |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase read] `backend/app/controllers/v1/account/admin_brokerages_controller.rb` — current controller implementation
- [VERIFIED: codebase read] `backend/app/models/brokerage_membership.rb` — model structure
- [VERIFIED: codebase read] `backend/app/models/brokerage.rb` — associations
- [VERIFIED: codebase read] `backend/app/models/user.rb` — `first_name`, `last_name` columns, `acts_as_paranoid`
- [VERIFIED: codebase read] `backend/db/schema.rb` — `brokerage_memberships` columns: `role`, `user_id`, `brokerage_id`, `deleted_at`; `users` columns: `first_name`, `last_name`, `deleted_at`
- [VERIFIED: codebase read] `frontend/src/assets/types/adminBrokerageType.ts` — current interface shape
- [VERIFIED: codebase read] `frontend/src/assets/types/roleType.ts` — `UserRole` union type
- [VERIFIED: codebase read] `frontend/src/store/reducers/activeBrokerage.ts` — Redux state shape, confirms D-11
- [VERIFIED: codebase read] `frontend/src/containers/portal/BrokerageSelection.tsx` — downstream consumer, confirmed no Phase 27 changes needed
- [VERIFIED: codebase read] `.planning/config.json` — `nyquist_validation: false` → Validation Architecture section omitted
- [VERIFIED: codebase read] `CLAUDE.md` — all architectural constraints applied

### Secondary (MEDIUM confidence)
- [CITED: CONTEXT.md D-01 through D-12] — all locked decisions from discuss phase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase
- Architecture patterns: HIGH — derived directly from existing controller code + CLAUDE.md rules
- Pitfalls: HIGH — derived from CLAUDE.md explicit warnings + codebase patterns
- TypeScript impact: HIGH — all affected files read and analyzed

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable Rails/TypeScript patterns)

# Phase 19: Domain Schema & Auth Integration - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-only phase. Extend `brokerage_domains` with 4 lifecycle columns (`domain_type`, `status`, `is_primary`, `phase_out_at`), backfill all existing rows as active primary subdomains, add subdomain slug validation with a reserved-words list, update `BrokerageAuth` to resolve by status (via a named scope), and update the Caddy TLS endpoint to filter by `status: active`. No frontend changes.

Requirements in scope: DMOD-01, DMOD-02, DMOD-03, DMOD-04, DINT-03, DINT-04.

</domain>

<decisions>
## Implementation Decisions

### Migration Structure
- **D-01:** Schema changes (4 new columns) and data backfill (DMOD-02) live in **one migration file**. Single atomic transaction — rollback reverts both schema and data.
- **D-02:** All three required columns get **DB-level defaults**: `domain_type` defaults to `'subdomain'`, `status` defaults to `'active'`, `is_primary` defaults to `false`. Any insert that omits these gets a safe value without relying on Rails.
- **D-03:** `phase_out_at` is nullable with no default (it's only set when a domain transitions to phasing-out).

### DB Uniqueness Strategy
- **D-04:** **Drop the current full unique index** on `domain` and replace it with a **partial unique index** (`WHERE status != 'decommissioned'`). Enforced at the DB level — race-condition-safe. The AR `validates :domain, uniqueness:` validator mirrors this with a `conditions: -> { where.not(status: 'decommissioned') }` lambda.
- **D-05:** Uniqueness violation error message: **'is already taken'** (standard Rails wording). Does not reveal which brokerage owns the domain.

### Subdomain Slug Validation
- **D-06:** Reserved words list (DMOD-04) is a **constant in the model** (`BrokerageDomain::RESERVED_SLUGS`). The full list:
  ```
  admin, api, www, mail, smtp, ftp, staging, dev, test, app, auth, login,
  signup, dashboard, static, assets, cdn, docs, help, support, status
  ```
- **D-07:** Subdomain slug format validation: alphanumeric and hyphens only (`/\A[a-z0-9-]+\z/`), no leading/trailing hyphens. Error message if reserved: "is reserved and cannot be used as a brokerage subdomain".

### Routing Field Transition
- **D-08:** `BrokerageAuth` uses a **named scope `BrokerageDomain.routable`** (`where(status: [:active, :phasing_out])`) instead of the current `find_by(domain:, verified: true)`. BrokerageAuth calls `BrokerageDomain.routable.find_by(domain:)`.
- **D-09:** The "verified before active" invariant is enforced at the **model level** (validation: cannot set `status: active` unless `verified == true`). BrokerageAuth trusts this invariant and does not redundantly re-check `verified`.
- **D-10:** `DomainsController#check` (Caddy TLS endpoint) is updated to use `BrokerageDomain.where(status: :active)` (no longer checking `deleted_at: nil` or `verified: true` directly — status encapsulates both concerns via model invariant).
- **D-11:** The `verified` column is **not removed** — it remains for future DNS verification work (v1.6 milestone) and is still set by `verify!` / `unverify!`. It's just no longer the routing gate.

### Enum Implementation
- **D-12:** Rails `enum` macro for both `domain_type` and `status`. Gives `.active`, `.phasing_out`, `.decommissioned` scopes and `record.active?` predicates without extra code. Prefix with `status_` / `domain_type_` to avoid name collisions if needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §DMOD-01 through DMOD-04, DINT-03, DINT-04 — Full requirement text for this phase

### Existing Code (must read before touching)
- `backend/app/models/brokerage_domain.rb` — current model: scopes, validations, `verify!` method
- `backend/app/controllers/concerns/brokerage_auth.rb` — concern being updated (DINT-03)
- `backend/app/controllers/v1/domains_controller.rb` — Caddy TLS endpoint being updated (DINT-04)
- `backend/db/schema.rb` §brokerage_domains — current columns and indexes to understand what's changing
- `backend/test/factories/brokerage_domains.rb` — factory to update after schema change
- `backend/test/integration/brokerage_auth_main_domain_test.rb` — integration tests that must continue to pass
- `backend/test/integration/tenant_isolation_test.rb` — integration tests that must continue to pass

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BrokerageDomain#verify!` / `#unverify!` — existing methods; stay as-is, just no longer gate routing
- `BrokerageDomain.active` scope — currently `where(deleted_at: nil)`; will need renaming or replacement since `active` will be claimed by the Rails enum for `status: active`
- `BrokerageDomain.verified` / `.unverified` scopes — keep for DNS verification use, but no longer used in routing path

### Established Patterns
- Rails `enum` is not currently used elsewhere in the project (roles use string validation). Adding it here sets a new pattern — use prefix option if `active?` / `phasing_out?` methods conflict with existing method names.
- Migration convention: timestamp-prefixed files in `backend/db/migrate/`, format `YYYYMMDDHHMMSS_description.rb`
- `acts_as_paranoid` is NOT on `BrokerageDomain` — `deleted_at` is a plain column managed manually. Keep this pattern; don't add `acts_as_paranoid` in this phase.

### Integration Points
- `BrokerageAuth` is included in every authenticated controller — the scope change in DINT-03 affects all tenant-resolved requests. Must test thoroughly.
- Caddy TLS endpoint `GET /v1/domains/check` is called by the reverse proxy before TLS is established — no auth. DINT-04 update must not break TLS provisioning for existing domains.
- Factory update: `brokerage_domains.rb` factory needs `domain_type: :subdomain, status: :active, is_primary: true` added as defaults so all existing tests continue to work.

</code_context>

<specifics>
## Specific Ideas

- User confirmed: **domains must be verified before they can become `status: active`** — enforced as a model-level validation (not redundantly in BrokerageAuth).
- Reserved slug list is the "standard infra words only" set: `admin, api, www, mail, smtp, ftp, staging, dev, test, app, auth, login, signup, dashboard, static, assets, cdn, docs, help, support, status`.
- The `BrokerageDomain.active` scope name will conflict with the Rails enum's generated `.active` scope — rename the existing scope (e.g., to `.not_deleted` or just drop it in favor of the status-based `.active` enum scope).

</specifics>

<deferred>
## Deferred Ideas

- DNS verification for custom domains — explicitly deferred to v1.6 milestone (noted in STATE.md)
- Server-side HTTP 301 redirect at the Caddy layer — client-side on app init is sufficient for this milestone
- `acts_as_paranoid` on `BrokerageDomain` — not added in this phase; `deleted_at` remains a plain manually-managed column

</deferred>

---

*Phase: 19-domain-schema-auth-integration*
*Context gathered: 2026-05-27*

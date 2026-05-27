---
phase: 19
status: issues_found
files_reviewed: 6
depth: standard
findings:
  critical: 3
  warning: 3
  info: 0
  total: 6
---

# Code Review — Phase 19: domain-schema-auth-integration

## Files Reviewed

- `backend/db/migrate/20260527000001_add_lifecycle_columns_to_brokerage_domains.rb`
- `backend/db/schema.rb`
- `backend/app/models/brokerage_domain.rb`
- `backend/app/controllers/concerns/brokerage_auth.rb`
- `backend/app/controllers/v1/domains_controller.rb`
- `backend/test/factories/brokerage_domains.rb`

---

## Critical Issues

### CR-01 — `BrokerageDomain` missing `acts_as_paranoid` — soft-deleted records leak into tenant routing

**File:** `backend/app/models/brokerage_domain.rb` line 1
**Confidence:** 95

The `brokerage_domains` table has a `deleted_at` column (schema.rb). Every sibling user-facing model (`Brokerage`, `User`, `Group`, `Estate`, `BrokerageMembership`) declares `acts_as_paranoid`. `BrokerageDomain` does not.

Without `acts_as_paranoid`, the `routable` scope — used by `BrokerageAuth#resolve_brokerage` — returns soft-deleted domain records. A deleted domain continues to map incoming requests to a brokerage. `Admin::DomainsController` manually compensates with `where(deleted_at: nil)`, confirming the intent is soft-delete awareness but the fix is applied inconsistently in the wrong layer.

**Fix:**
```ruby
class BrokerageDomain < ApplicationRecord
  acts_as_paranoid
  # ...
end
```

Remove the manual `where(deleted_at: nil)` guards in `Admin::DomainsController` — they become redundant.

---

### CR-02 — `routable` scope does not guard `verified: true` — unverified domains resolve as tenants

**File:** `backend/app/models/brokerage_domain.rb` line 23 / `backend/app/controllers/concerns/brokerage_auth.rb` lines 32–35
**Confidence:** 85

```ruby
scope :routable, -> { where(status: [:active, :phasing_out]) }
```

The `status_requires_verified` validation only blocks setting `status: active` on unverified domains — it does NOT guard `phasing_out`. A domain can be created with `status: "phasing_out"` and `verified: false`, bypass the validation, match `routable`, and resolve as a live tenant before the domain is confirmed.

**Fix:**
```ruby
scope :routable, -> { where(status: [:active, :phasing_out], verified: true) }
```

---

### CR-03 — Caddy TLS ask endpoint does not require `verified: true` — premature certificate provisioning

**File:** `backend/app/controllers/v1/domains_controller.rb` line 15
**Confidence:** 82

```ruby
exists = BrokerageDomain.status_active.exists?(domain: domain)
```

This unauthenticated endpoint is the Caddy on-demand TLS gate — a 200 response causes Caddy to provision an ACME certificate for the domain. It checks `status: "active"` only, not `verified: true`. An unverified domain that reaches `active` status (through a seeded record or direct DB insertion) will receive a TLS certificate before the operator has confirmed DNS control.

**Fix:**
```ruby
exists = BrokerageDomain.status_active.where(verified: true).exists?(domain: domain)
```

---

## Warning Issues

### WR-01 — Migration bulk-sets `is_primary = true` for all rows — incorrect for multi-domain brokerages

**File:** `backend/db/migrate/20260527000001_add_lifecycle_columns_to_brokerage_domains.rb` lines 8–11
**Confidence:** 82

```sql
UPDATE brokerage_domains SET domain_type = 'subdomain', status = 'active', is_primary = true
```

Every existing row is unconditionally marked as primary. Any brokerage with more than one domain record ends up with multiple `is_primary = true` rows. No DB-level uniqueness constraint enforces one primary per brokerage, silently producing invalid state.

**Fix:** Select one domain per brokerage (oldest by `created_at`) before setting `is_primary = true`, and add a partial unique index:
```ruby
add_index :brokerage_domains, :brokerage_id,
  unique: true,
  where: "is_primary = true",
  name: "index_brokerage_domains_one_primary_per_brokerage"
```

---

### WR-02 — Onboarding domain availability check counts decommissioned/soft-deleted domains as taken

**File:** `backend/app/controllers/v1/onboarding/domains_controller.rb` lines 19, 24
**Confidence:** 85

```ruby
result[:subdomain] = !BrokerageDomain.exists?(domain: full_host)
```

Unscoped `exists?` matches decommissioned and soft-deleted domains. A retired subdomain appears as "already taken" permanently, blocking that slug for new brokerages even after the original is offboarded.

**Fix:**
```ruby
active_scope = BrokerageDomain.without_deleted.where.not(status: :decommissioned)
result[:subdomain]    = !active_scope.exists?(domain: full_host)
result[:custom_domain] = !active_scope.exists?(domain: custom_domain)
```

---

### WR-03 — CORS origin check uses unscoped `BrokerageDomain.exists?`

**File:** `backend/config/initializers/cors.rb` line 17
**Confidence:** 85

```ruby
BrokerageDomain.exists?(domain: host)
```

Runs on every request. Decommissioned and soft-deleted domains pass the CORS origin check, allowing cross-origin requests from origins that should no longer be valid after brokerage offboarding.

**Fix:** Use `routable` scope (which after CR-02 also enforces `verified: true`):
```ruby
BrokerageDomain.routable.exists?(domain: host)
```

---

## Info

### INFO-01 — `generate_verification_token` is public — should be private

**File:** `backend/app/models/brokerage_domain.rb` lines 35–37
**Confidence:** 70

`generate_verification_token` is defined above the `private` keyword and called only via `before_create`. Moving it under `private` matches Rails convention and prevents external callers from generating a new token outside the create lifecycle.

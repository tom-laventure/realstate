---
phase: 19-domain-schema-auth-integration
plan: "01"
subsystem: backend-db
tags: [migration, schema, brokerage_domains, domain-lifecycle]
dependency_graph:
  requires: []
  provides: [domain_type-column, status-column, is_primary-column, phase_out_at-column, partial-unique-index-brokerage_domains]
  affects: [BrokerageDomain, brokerage_domains-table]
tech_stack:
  added: []
  patterns: [up-down-migration, partial-unique-index, sql-backfill]
key_files:
  created:
    - backend/db/migrate/20260527000001_add_lifecycle_columns_to_brokerage_domains.rb
  modified:
    - backend/db/schema.rb
decisions:
  - "Used def up/def down instead of def change because the migration contains a raw SQL execute that cannot be auto-reversed"
  - "Backfill runs before index swap so UPDATE executes under the original full unique index (still present at that point)"
  - "Partial unique index uses WHERE status != 'decommissioned' to allow decommissioned domains to be re-used by other brokerages"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-27"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 19 Plan 01: Lifecycle Columns Migration for brokerage_domains Summary

**One-liner:** Atomic migration adds domain_type, status, is_primary, phase_out_at columns with SQL backfill and replaces full unique index with partial WHERE status != 'decommissioned'.

## What Was Built

A single atomic Rails migration (`20260527000001`) that:

1. Adds four lifecycle columns to `brokerage_domains`:
   - `domain_type` (string, not null, default: "subdomain")
   - `status` (string, not null, default: "active")
   - `is_primary` (boolean, not null, default: false)
   - `phase_out_at` (datetime, nullable)

2. Backfills all pre-existing rows unconditionally as `domain_type='subdomain', status='active', is_primary=true` — reflecting that all historical domains are active primary subdomains.

3. Drops the old full unique index (`index_brokerage_domains_on_domain`) and replaces it with a partial unique index (`index_brokerage_domains_on_domain_active_unique`) that only enforces uniqueness when `status != 'decommissioned'`. This allows decommissioned domains to be re-claimed by other brokerages in the future.

## Verification Results

- `rails db:migrate` ran with zero errors
- `BrokerageDomain.column_names` confirms all four columns present: `["domain_type", "status", "is_primary", "phase_out_at"]`
- `BrokerageDomain.all.map { |d| [d.domain_type, d.status, d.is_primary] }.uniq` returns `[["subdomain", "active", true]]`
- schema.rb updated: four new columns, old full unique index absent, new partial unique index present with `WHERE ((status)::text <> 'decommissioned'::text)`
- Rollback is clean: `def down` restores original full unique index before removing columns

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write the lifecycle columns migration | 92342f3 (backend) | db/migrate/20260527000001_add_lifecycle_columns_to_brokerage_domains.rb, db/schema.rb |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The partial unique index (T-19-01) is enforced at the DB level via the PostgreSQL constraint as designed. Backfill UPDATE (T-19-02) ran on a small table with no user-controllable input.

## Self-Check: PASSED

- [x] `backend/db/migrate/20260527000001_add_lifecycle_columns_to_brokerage_domains.rb` — FOUND
- [x] `backend/db/schema.rb` updated with four columns and new partial index — FOUND
- [x] backend commit 92342f3 — FOUND

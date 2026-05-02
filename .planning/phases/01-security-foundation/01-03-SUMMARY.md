---
phase: 01-security-foundation
plan: "03"
subsystem: infra-security
tags: [cors, rack-attack, rate-limiting, brokerage-domain, seeds]

# Dependency graph
requires:
  - 01-01 (solid_cache installed and Rails.cache = SolidCache::Store in all environments)
provides:
  - Dynamic CORS proc rejecting arbitrary origins (SEC-03 closed)
  - rack-attack throttle on POST /v1/sessions at 5 req/20s per IP (SEC-04 closed)
  - 429 JSON responder: { error: { code: "rate_limited", message: "..." } }
  - Dev domain seeds: localhost and gregoryrealtor.realstate.local for prime_realty
affects:
  - All cross-origin requests (CORS now requires BrokerageDomain record)
  - POST /v1/sessions (rate-limited per IP)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CORS proc: URI.parse rescue for malformed Origin headers; BrokerageDomain.exists?(domain:) check"
    - "rack-attack: Rack::Attack.cache.store = Rails.cache (SolidCache/PostgreSQL shared counter)"
    - "Dev seed idempotency: BrokerageDomain.insert_all with unique_by: :domain"

key-files:
  created:
    - backend/config/initializers/rack_attack.rb
    - backend/db/seeds/10_dev_domains.rb
  modified:
    - backend/config/initializers/cors.rb
    - backend/db/seeds.rb

key-decisions:
  - "D-05: CORS origins proc uses BrokerageDomain.exists?(domain:) — column name is domain not host"
  - "D-07/D-08: rack-attack throttle 5 req/20s per IP on POST /v1/sessions"
  - "D-12: throttled_responder returns [status, headers_hash, [body_string]] array"
  - "D-15: req.ip used (not req.env['REMOTE_ADDR']) — proxy-aware X-Forwarded-For"
  - "D-06: Dev seed uses insert_all with unique_by: :domain for idempotency"

requirements-completed:
  - SEC-03
  - SEC-04

# Metrics
duration: 2min
completed: "2026-05-02"
---

# Phase 1 Plan 03: CORS + Rate Limiting + Dev Seeds Summary

**Dynamic CORS proc against BrokerageDomain table, rack-attack throttle on login endpoint, and dev domain seeds — SEC-03 and SEC-04 closed**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-02T01:20:00Z
- **Completed:** 2026-05-02T01:21:27Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified — backend sub-repo)

## Accomplishments

- `cors.rb` wildcard removed; replaced with proc calling `BrokerageDomain.exists?(domain: host)` with `URI.parse` rescue for malformed Origin headers
- `rack_attack.rb` created: `Rack::Attack.cache.store = Rails.cache` (SolidCache), throttle `login/ip` at 5 req/20s on POST /v1/sessions via `req.ip`, JSON 429 responder with `{ error: { code: "rate_limited", message: "..." } }`
- `db/seeds/10_dev_domains.rb` created with idempotent `insert_all(unique_by: :domain)` for localhost and gregoryrealtor.realstate.local
- `db/seeds.rb` updated: load line and `seed_dev_domains!` call added after `seed_brokerages!`
- Verified: `Rails.cache.class` returns `SolidCache::Store` (Wave 1 dependency confirmed)
- Verified: dev domain records exist in DB after seeding
- Verified: CORS wildcard is gone, BrokerageDomain.exists? proc present
- Verified: rack_attack.rb syntax OK, all three key patterns present

## Task Commits

Each task committed atomically to the backend sub-repo:

1. **Task 1: Replace CORS wildcard with dynamic BrokerageDomain proc** — `5611b3f` (feat)
2. **Task 2: Create rack_attack.rb with throttle and JSON 429 responder** — `070a432` (feat)
3. **Task 3: Add dev domain seeds for localhost and gregoryrealtor.realstate.local** — `e3e6f43` (feat)

## Files Created/Modified

- `backend/config/initializers/cors.rb` — Replaced `origins "*"` with dynamic proc; URI.parse rescue; BrokerageDomain.exists?(domain:) lookup
- `backend/config/initializers/rack_attack.rb` — Created: cache store, throttle rule, JSON 429 responder
- `backend/db/seeds/10_dev_domains.rb` — Created: seed_dev_domains! function with localhost and gregoryrealtor.realstate.local
- `backend/db/seeds.rb` — Added load line for 10_dev_domains.rb and seed_dev_domains! call after seed_brokerages!

## Decisions Made

- D-05: CORS proc uses `domain:` keyword (not `host:`) — confirmed from schema.rb unique index on `brokerage_domains.domain`
- D-15: `req.ip` used in throttle key — reads X-Forwarded-For; correct behind Nginx/LB where REMOTE_ADDR is proxy IP
- D-06: `insert_all(unique_by: :domain)` makes seed idempotent — re-running `db:seed` does not raise uniqueness errors
- Wave 1 dependency confirmed: `Rails.cache` is `SolidCache::Store` before rack_attack.rb initializer runs

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all threat surfaces (T-03-01 through T-03-05) were already covered in the plan's threat model.

## Issues Encountered

Pre-existing `db:seed` failure (unrelated to this plan): `seed_users!` fails with `NotNullViolation` on `users.uid` column. This is a pre-existing seed issue that predates this plan. The dev domain seed function (`seed_dev_domains!`) was verified to work correctly via direct invocation with `rails runner`. Logged to deferred-items.

---
*Phase: 01-security-foundation*
*Completed: 2026-05-02*

## Self-Check: PASSED

- FOUND: backend/config/initializers/cors.rb (BrokerageDomain.exists? proc, no wildcard)
- FOUND: backend/config/initializers/rack_attack.rb (cache.store, throttle, responder)
- FOUND: backend/db/seeds/10_dev_domains.rb (localhost, gregoryrealtor.realstate.local)
- VERIFIED: `grep -c "BrokerageDomain.exists?(domain:"` = 1
- VERIFIED: `grep -c 'origins "*"'` = 0 (wildcard gone)
- VERIFIED: `bundle exec ruby -c cors.rb` = Syntax OK
- VERIFIED: `bundle exec ruby -c rack_attack.rb` = Syntax OK
- VERIFIED: `rails runner "puts Rails.cache.class"` = SolidCache::Store
- VERIFIED: BrokerageDomain.where(domain: ['localhost', 'gregoryrealtor.realstate.local']) returns both records
- FOUND: backend commit 5611b3f (Task 1)
- FOUND: backend commit 070a432 (Task 2)
- FOUND: backend commit e3e6f43 (Task 3)

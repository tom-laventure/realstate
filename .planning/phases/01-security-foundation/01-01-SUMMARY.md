---
phase: 01-security-foundation
plan: "01"
subsystem: infra
tags: [rack-attack, solid_cache, postgresql, rate-limiting, cache-store]

# Dependency graph
requires: []
provides:
  - rack-attack gem available (6.8.0)
  - solid_cache gem available (0.7.0)
  - solid_cache_entries table in PostgreSQL database
  - Rails.cache configured as SolidCache::Store in all three environments
  - Wave 2 (rack_attack.rb initializer) can safely set Rack::Attack.cache.store = Rails.cache
affects:
  - 01-02 (rack_attack.rb initializer depends on Rails.cache being SolidCache)

# Tech tracking
tech-stack:
  added:
    - rack-attack 6.8.0
    - solid_cache 0.7.0
  patterns:
    - "cache_store configured in environment files (not initializers) to guarantee ordering before rack_attack.rb"

key-files:
  created:
    - backend/db/migrate/20260502011121_create_solid_cache_entries.solid_cache.rb
    - backend/db/migrate/20260502011122_add_key_hash_and_byte_size_to_solid_cache_entries.solid_cache.rb
    - backend/db/migrate/20260502011123_add_key_hash_and_byte_size_indexes_and_null_constraints_to_solid_cache_entries.solid_cache.rb
    - backend/db/migrate/20260502011124_remove_key_index_from_solid_cache_entries.solid_cache.rb
  modified:
    - backend/Gemfile
    - backend/Gemfile.lock
    - backend/config/environments/development.rb
    - backend/config/environments/production.rb
    - backend/config/environments/test.rb
    - backend/db/schema.rb

key-decisions:
  - "D-07: rack-attack + solid_cache with PostgreSQL-backed shared cache — no Redis required"
  - "D-16: solid_cache:install:migrations generates tables; solid_cache:install skipped (would create unwanted config/cache.yml)"
  - "D-20: solid_cache uses same PostgreSQL DB as app — no separate database.yml entry needed"
  - "Pitfall 1: cache_store set in environment files not initializers — rack_attack.rb loads alphabetically before solid_cache.rb"

patterns-established:
  - "Cache config pattern: set config.cache_store in config/environments/*.rb, never in config/initializers/"

requirements-completed:
  - SEC-04

# Metrics
duration: 3min
completed: "2026-05-02"
---

# Phase 1 Plan 01: Cache Store Setup Summary

**rack-attack 6.8.0 and solid_cache 0.7.0 installed with PostgreSQL-backed SolidCache::Store wired as Rails.cache across all three environments**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-02T01:10:59Z
- **Completed:** 2026-05-02T01:14:02Z
- **Tasks:** 2
- **Files modified:** 7 (backend sub-repo)

## Accomplishments

- rack-attack and solid_cache gems added to Gemfile and bundled
- 4 solid_cache migration files generated and applied — `solid_cache_entries` table now in database
- All three environment files (development, production, test) set `config.cache_store = :solid_cache_store`
- Verified: `rails runner "puts Rails.cache.class"` prints `SolidCache::Store`
- Wave 2 (plan 01-02: rack_attack.rb initializer) is now unblocked

## Task Commits

Each task was committed atomically to the backend sub-repo:

1. **Task 1: Add rack-attack and solid_cache to Gemfile, run bundle install, apply migrations** - `e15aa40` (chore)
2. **Task 2: Set config.cache_store = :solid_cache_store in all three environments** - `45aef0b` (feat)

## Files Created/Modified

- `backend/Gemfile` - Added `gem "rack-attack"` and `gem "solid_cache"` near rack-cors
- `backend/Gemfile.lock` - Resolved rack-attack 6.8.0, solid_cache 0.7.0
- `backend/db/migrate/20260502011121_create_solid_cache_entries.solid_cache.rb` - Creates solid_cache_entries table
- `backend/db/migrate/20260502011122_add_key_hash_and_byte_size_to_solid_cache_entries.solid_cache.rb` - Adds key_hash and byte_size columns
- `backend/db/migrate/20260502011123_add_key_hash_and_byte_size_indexes_and_null_constraints_to_solid_cache_entries.solid_cache.rb` - Adds indexes and null constraints
- `backend/db/migrate/20260502011124_remove_key_index_from_solid_cache_entries.solid_cache.rb` - Removes old key index
- `backend/db/schema.rb` - Updated with solid_cache_entries table
- `backend/config/environments/development.rb` - Replaced conditional memory_store/null_store block with solid_cache_store
- `backend/config/environments/production.rb` - Replaced commented mem_cache_store with solid_cache_store
- `backend/config/environments/test.rb` - Replaced null_store with solid_cache_store

## Decisions Made

- D-07: No Redis — solid_cache uses PostgreSQL for shared cross-Puma-worker cache, consistent with solid_queue already in use
- D-16: Used `rails solid_cache:install:migrations` not `rails solid_cache:install` — the latter creates an unwanted `config/cache.yml` that would override environment file settings
- D-20: solid_cache shares the primary PostgreSQL connection pool — no separate database.yml entry added
- Pitfall guard: `config.cache_store` set in environment files (loaded before all initializers), NOT in `config/initializers/` — ensures `rack_attack.rb` sees SolidCache::Store when it copies `Rails.cache`

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. solid_cache uses the existing PostgreSQL connection.

## Next Phase Readiness

- Plan 01-02 (rack_attack.rb initializer) is unblocked: `Rails.cache` is `SolidCache::Store` and available before any initializer runs
- The initializer can safely set `Rack::Attack.cache.store = Rails.cache` and get the correct shared store
- All three environments are consistent — rate-limit counters in tests use the same code path as production

---
*Phase: 01-security-foundation*
*Completed: 2026-05-02*

---
phase: 23-301-redirect-primary-domain-enforcement
plan: 01
subsystem: api
tags: [rack, middleware, redirect, brokerage-domain, rails]

# Dependency graph
requires:
  - phase: 22-dns-verification-health-monitoring
    provides: BrokerageDomain frozen status, pending status, is_primary field
provides:
  - DomainRedirectMiddleware Rack middleware issuing 301 for non-primary domains
  - 10 integration tests covering D-01 through D-12 behaviors
  - Middleware registered before ActionDispatch::Static (after Rack::Cors)
affects: [24-domain-ui-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Rack middleware with ActionDispatch::Request for request inspection
    - explicit require_relative for middleware loaded at boot time before Zeitwerk
    - .includes(brokerage: :brokerage_domains) + in-memory .find for N+1 prevention in hot path

key-files:
  created:
    - backend/app/middleware/domain_redirect_middleware.rb
    - backend/test/middleware/domain_redirect_middleware_test.rb
  modified:
    - backend/config/application.rb

key-decisions:
  - "require_relative needed for middleware file at boot time — Zeitwerk autoload not yet active when application.rb runs"
  - "In-memory .find { |d| d.is_primary? } on eager-loaded collection avoids N+1 on every redirected request"
  - "insert_before ActionDispatch::Static positions middleware after Rack::Cors (position 2) — CORS preflight handled before redirect logic"

patterns-established:
  - "Rack middleware pattern: initialize(app), def call(env) returning @app.call(env) or Rack triple"
  - "Boot-time middleware: require_relative in application.rb before config.middleware.insert_before"
  - "Origin-first host extraction replicated from BrokerageAuth for consistency across request lifecycle"

requirements-completed: [DPRI-04, DPRD-02]

# Metrics
duration: 10min
completed: 2026-05-31
---

# Phase 23 Plan 01: 301 Redirect & Primary Domain Enforcement Summary

**Rack middleware issuing HTTP 301 from non-primary domains (active, phasing-out, frozen) to the brokerage's primary domain, preserving path and query string**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-31T00:42:53Z
- **Completed:** 2026-05-31T00:53:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `DomainRedirectMiddleware` intercepts every HTTP request at the Rack layer before any controller logic
- Explicit `where(status: [:active, :phasing_out, :frozen])` query includes frozen domains for DPRD-02 compliance
- 10 integration tests covering all D-01 through D-12 redirect and pass-through behaviors pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement DomainRedirectMiddleware** - `723ec39` (feat)
2. **Task 2: Register middleware and write integration tests** - `ed4b7c0` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/middleware/domain_redirect_middleware.rb` - Rack middleware issuing 301 for non-primary domains
- `backend/test/middleware/domain_redirect_middleware_test.rb` - 10 integration tests (D-01 through D-12)
- `backend/config/application.rb` - require_relative + config.middleware.insert_before registration

## Decisions Made

- `require_relative` added in application.rb before the `insert_before` call because Zeitwerk autoload is not yet active when application.rb runs at boot — the class must be resolvable at middleware registration time
- Middleware positioned via `insert_before ActionDispatch::Static` placing it at stack position 5 (between Rack::Sendfile and ActionDispatch::Static), after Rack::Cors (position 2) — CORS preflight OPTIONS requests are handled before any redirect logic runs
- Used `domain_record.brokerage.brokerage_domains.find { |d| d.is_primary? }` on the `.includes()`-loaded in-memory collection to avoid a second AR query per redirected request

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added require_relative to load middleware class at boot time**
- **Found during:** Task 2 (middleware registration)
- **Issue:** `NameError: uninitialized constant DomainRedirectMiddleware` at boot — Zeitwerk autoload is not yet active when `config/application.rb` runs, so the class constant was not available for `config.middleware.insert_before`
- **Fix:** Added `require_relative "../app/middleware/domain_redirect_middleware"` immediately before the `insert_before` line in application.rb
- **Files modified:** backend/config/application.rb
- **Verification:** `bin/rails test test/middleware/domain_redirect_middleware_test.rb` exits 0 with 10 passing tests
- **Committed in:** `ed4b7c0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was essential to make middleware loadable at boot. No scope creep.

## Issues Encountered

The pre-existing test suite had 51 errors and 7 failures before Phase 23 started (unrelated to this phase — BoardConnectFlowTest, serializer key ordering, etc.). After Phase 23 changes, the count remained 51 errors and decreased to 2 failures — no regressions introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All HTTP requests to non-primary active, phasing-out, and frozen domains now receive HTTP 301 to the primary domain + same path + query string
- Middleware positioned correctly after Rack::Cors (CORS preflight unaffected) and before ActionDispatch::Static (runs before any controller logic)
- Phase 24 (Domain UI Overhaul) can proceed — the redirect enforcement is live at the Rack layer

---

*Phase: 23-301-redirect-primary-domain-enforcement*
*Completed: 2026-05-31*

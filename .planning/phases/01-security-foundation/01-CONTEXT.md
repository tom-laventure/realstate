# Phase 1: Security Foundation - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all documented security issues, crashes, N+1 performance bugs, and tech debt items in the existing codebase. No new capabilities — every fix targets a known, documented problem. The platform exits this phase with server-side authorization enforcement, no hardcoded credentials, no injection risks, no console leakage, and correct cross-worker rate limiting.

</domain>

<decisions>
## Implementation Decisions

### RBAC Enforcement (SEC-01)

- **D-01:** Create `app/controllers/v1/admin/base_controller.rb` as `V1::Admin::BaseController < ApplicationController` — the class name must match the directory path for Rails autoloading. All 13 existing admin controllers inherit from it — 9 top-level (`activity`, `board_credentials`, `boards`, `brokerages`, `domains`, `estates`, `groups`, `invitations`, `users`) and 4 nested under `v1/admin/group/` (`estates`, `filter_sets`, `invitations`, `users`).
- **D-02:** `require_admin!` is the default `before_action` on `Admin::BaseController`. Checks that `BrokerageMembership` role is `owner` or `admin`; returns `{ error: { code: "forbidden", message: "..." } }` with HTTP 403 for any other role.
- **D-03:** `require_owner!` is also defined on `Admin::BaseController` (owner only). Used by stricter endpoints.
- **D-04:** `BrokeragesController` endpoints (update, destroy) use `require_owner!` — brokerage-wide settings are owner-only. `DomainsController` also uses `require_owner!` for all write actions (create, destroy) — domain configuration is brokerage structural config at the same sensitivity level. All other existing admin controllers use the default `require_admin!` inherited from the base.

### CORS Dynamic Proc (SEC-03)

- **D-05:** The `origins` proc extracts the host from the `Origin` header (strips scheme and port) and checks it against `BrokerageDomain.exists?(host: extracted_host)`.
- **D-06:** Two `BrokerageDomain` seed records are added to `db/seeds/` on the existing seeded test brokerage: `host: 'localhost'` AND `host: 'gregoryrealtor.realstate.local'`. After `db:seed`, both dev origins pass the CORS proc without manual intervention. The proc is uniform across all environments — no dev-only bypass logic.

### Rate Limiting (SEC-04)

- **D-07:** Add `rack-attack` and `solid_cache` gems. Configure `solid_cache` as `Rails.cache`; set `Rack::Attack.cache.store = Rails.cache` for shared cross-Puma-worker counting backed by PostgreSQL.
- **D-08:** Throttle: 5 requests per 20 seconds on `POST /v1/sessions`, keyed by IP. Exceeding the limit returns 429.
- **D-15:** Throttle key uses `req.ip` (proxy-aware — reads `X-Forwarded-For`), NOT `req.env["REMOTE_ADDR"]`. Behind Nginx or a load balancer, `REMOTE_ADDR` is the proxy IP; all users share one counter and 5 total attempts locks everyone out.

### Frontend 403 Handling (SEC-08)

- **D-09:** Axios interceptor distinguishes 403 types by response body: if `response.data.next_step === 'no-access'` → redirect to `/auth/brokerage-contact` (existing behavior). Any other 403 → redirect to dashboard + show error toast.
- **D-10:** Toast message: "You don't have permission to do that". User stays logged in (no token clear on 403).

### DEBT-04 Scope

- **D-11:** DEBT-04 is price-only: switch `GroupEstatesQuery` price range filtering and sorting to use `listing_details.price_numeric` (column already exists). No `strata_fees_numeric` migration in this phase — strata fees remain as-is.

### Rate Limiting Response (SEC-04)

- **D-12:** Rack::Attack returns a JSON body on 429: `{ error: { code: "rate_limited", message: "Too many login attempts. Try again later." } }` with `Content-Type: application/json`. Configured via `Rack::Attack.throttled_responder`.
- **D-13:** The sign-in component catches the 429 error and displays it as an inline form error ("Too many attempts, try again shortly."). The Axios interceptor does NOT add a 429 branch — the error bubbles up to the component.

### InvitationsController Action Exceptions (SEC-01 / SEC-06)

- **D-14:** `InvitationsController` adds two `skip_before_action` declarations after inheriting `Admin::BaseController`:
  - `skip_before_action :require_admin!, only: [:accept_invitation, :decline_invitation, :validate_token]` — these three actions are called by invitees who have no brokerage membership yet; `require_admin!` would block them with 403.
  - `skip_before_action :authenticate_cognito_user!, only: [:validate_token]` — `validate_token` is a public endpoint (called by anonymous invitees from an email link); it must remain unauthenticated.
  - `accept_invitation` and `decline_invitation` still require a valid Cognito JWT (they use `Current.user` to create `BrokerageMembership`) — only `require_admin!` is skipped for those two.

### solid_cache Setup Mechanics (SEC-04 / D-07 supplement)

- **D-16:** solid_cache setup path: add `gem "solid_cache"` to Gemfile → run `rails solid_cache:install:migrations` (generates the migration automatically, same pattern as `solid_queue` which produced `20260404180731_create_solid_queue_tables.rb`) → run `rails db:migrate` → configure `config/initializers/solid_cache.rb` to set `Rails.cache` and wire `Rack::Attack.cache.store = Rails.cache`.

### Pagination Concern Cleanup Scope (DEBT-07)

- **D-17:** Remove the **entire** `Pagination` concern (`backend/app/controllers/concerns/pagination.rb`) and its `include Pagination` from `ApplicationController`. All helpers (`per_page`, `page_no`, `paginate_offset`, `default_per_page`, `paginate` lambda) are confirmed unused — every controller computes `per_page` inline via `params[:per_page].to_i`. Full removal is safe and cleaner than removing the lambda alone.

### ESLint no-console Rule (DEBT-01)

- **D-18:** ESLint `no-console` rule set to `"error"` with `{ allow: ["warn", "error"] }` — blocks `console.log` (the debug noise), allows deliberate `console.warn` and `console.error`. CI fails on any `console.log` in production source files.
- **D-19:** ESLint config adds an override for `**/*.test.*` and `**/*.spec.*` patterns that disables the `no-console` rule — console output is useful when debugging failing tests and should not break CI.

### solid_cache Database Isolation (D-07 supplement)

- **D-20:** solid_cache uses the **same PostgreSQL database** as the app. No separate database entry in `database.yml` is added. The `rails solid_cache:install:migrations` migration creates cache tables in the main DB schema alongside the existing SolidQueue tables. One connection pool, zero ops overhead.

### Directory Rename Strategy (DEBT-02)

- **D-21:** The `usersAminView` → `usersAdminView` rename uses a two-step `git mv`: first rename to an intermediate temp name (`usersAminViewTemp`), then rename to the final target (`usersAdminView`). Required because macOS filesystems are case-insensitive — a single `git mv usersAminView usersAdminView` silently no-ops and leaves the directory unchanged in the index.

### BrokerageBoardCredential Status Enum (DEBT-03)

- **D-22:** Add `enum :status, { active: "active", invalid: "invalid" }` to `BrokerageBoardCredential`. The column is already a `string` type — no migration needed. Replaces the current string inclusion validation.

### Claude's Discretion

- All remaining requirements (SEC-02, SEC-05, SEC-06, SEC-07, PERF-01, PERF-02, PERF-03, DEBT-05, DEBT-06) are fully specified in REQUIREMENTS.md with no meaningful ambiguity. Claude implements them as documented.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` — All 17 Phase 1 requirements (SEC-01 through SEC-08, PERF-01 through PERF-03, DEBT-01 through DEBT-07) with exact implementation specs
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (5 must-be-true conditions)

### Codebase Context
- `.planning/codebase/CONCERNS.md` — Exact file paths and line numbers for every known issue; fix approaches for each; DO read before planning tasks
- `.planning/codebase/ARCHITECTURE.md` — Controller hierarchy, concern structure, query/serializer patterns, existing 403/401 handling

### Key Source Files (from CONCERNS.md)
- `backend/app/controllers/concerns/cognito_auth.rb` — Current auth/authorization concern; `Admin::BaseController` will work alongside it
- `backend/config/initializers/cors.rb` — Current `origins "*"` to be replaced
- `backend/app/controllers/v1/admin/` — All admin controllers to inherit from `Admin::BaseController`
- `backend/app/queries/group_estates_query.rb` — DEBT-04 target: lines 119–150 use `CAST(price AS REAL)`
- `frontend/src/assets/axios/axios.ts` — Axios interceptor for SEC-08 (403 handling)
- `frontend/src/components/common/form/signIn/signIn.tsx` — SEC-02 target (hardcoded credentials at lines 49, 68)
- `backend/app/controllers/v1/admin/invitations_controller.rb` — D-14: add skip_before_action for accept_invitation, decline_invitation, validate_token

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/controllers/concerns/brokerage_auth.rb` — Pattern for before_action role resolution; `require_admin!` follows the same structure
- `backend/app/models/current.rb` — `Current.user` already available in all controller actions; RBAC check reads `BrokerageMembership` from it
- `backend/app/controllers/concerns/pagination.rb` — `per_page` helper used by all 6 uncapped controllers; PERF-03 fixes happen here and in each controller
- `frontend/src/assets/axios/axios.ts` — Existing 401/403+no-access interceptor; D-09 adds a new branch to the existing 403 handler

### Established Patterns
- **Admin controllers inherit ApplicationController** — all 4 admin controllers currently use `include CognitoAuth` inline; after D-01, they inherit it from `Admin::BaseController`
- **`Current.user` not `current_user`** — SEC-06 fix follows this rule; all role checks use `Current.user`
- **BrokerageMembership for role** — role is on the membership join record, not the user. Check: `BrokerageMembership.find_by(user_id: Current.user.id, brokerage_id: Current.brokerage.id)&.role`
- **Rack::CORS proc** — `backend/config/initializers/cors.rb` uses the block syntax; the proc replaces the string argument to `origins`
- **SolidQueue = no Redis** — consistent with D-07; solid_cache completes the no-Redis story for all shared state

### Integration Points
- `Admin::BaseController` inserted between `ApplicationController` and all `v1/admin/**` controllers
- `solid_cache` initializer wired up in `config/initializers/` so `Rails.cache` resolves before `config/initializers/rack_attack.rb` runs
- Seed file addition: `db/seeds/` modular seeds — add a localhost domain seed file following the existing seed modular pattern

</code_context>

<specifics>
## Specific Ideas

- RBAC error response shape locked to: `{ error: { code: "forbidden", message: "..." } }` — matches the existing `no-access` error envelope pattern
- 403 toast is error variant (not warning) — "You don't have permission to do that"
- `require_owner!` method available on `Admin::BaseController` for future use; only `BrokeragesController` uses it in Phase 1

</specifics>

<deferred>
## Deferred Ideas

- `strata_fees_numeric` migration — mentioned in CONCERNS.md alongside DEBT-04 but excluded from this phase (price-only fix)
- Owner-only guards beyond `BrokeragesController` — `require_owner!` is ready but not applied to other endpoints until those controllers exist

</deferred>

---

*Phase: 1-Security Foundation*
*Context gathered: 2026-04-30*
*Context updated: 2026-05-01 — D-14 added (InvitationsController skip_before_action exceptions); D-15 added (Rack::Attack req.ip throttle key)*
*Context updated: 2026-04-30 — D-16 added (solid_cache install:migrations setup path); D-17 added (DEBT-07 scope expanded to full Pagination concern removal)*
*Context updated: 2026-05-01 — D-06 updated (two dev seed domains: localhost + gregoryrealtor.realstate.local); D-18 added (ESLint no-console error severity, allow warn+error); D-19 added (test file override for no-console); D-20 added (solid_cache same DB as app)*
*Context updated: 2026-05-01 — D-01 corrected (V1::Admin::BaseController, not Admin::BaseController); D-21 added (DEBT-02 two-step git mv for macOS); D-22 added (DEBT-03 string enum, no migration)*

# Phase 1: Security Foundation — Research

**Researched:** 2026-04-30
**Domain:** Rails 7.1 security hardening, rack-attack, solid_cache, CORS proc, RBAC, frontend 403 handling, TypeScript ESLint
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Create `app/controllers/v1/admin/base_controller.rb` as `V1::Admin::BaseController < ApplicationController` — the class name must match the directory path for Rails autoloading. All 13 existing admin controllers inherit from it.
- **D-02:** `require_admin!` is the default `before_action` on `Admin::BaseController`. Checks `BrokerageMembership` role is `owner` or `admin`; returns `{ error: { code: "forbidden", message: "..." } }` with HTTP 403.
- **D-03:** `require_owner!` is also defined on `Admin::BaseController` (owner only).
- **D-04:** `BrokeragesController` (update, destroy) and `DomainsController` (create, destroy) use `require_owner!`. All other admin controllers use default `require_admin!`.
- **D-05:** CORS `origins` proc extracts host from Origin header, checks `BrokerageDomain.exists?(domain: extracted_host)`.
- **D-06:** Two dev seed domains on the existing test brokerage (prime_realty, brokerage_id: 1): `host: 'localhost'` AND `host: 'gregoryrealtor.realstate.local'`. No dev-only bypass logic.
- **D-07:** Add `rack-attack` and `solid_cache` gems. `solid_cache` as `Rails.cache`; `Rack::Attack.cache.store = Rails.cache`.
- **D-08:** Throttle: 5 requests per 20 seconds on `POST /v1/sessions`, keyed by IP. Returns 429.
- **D-09:** Axios interceptor 403 branch: if `response.data.next_step === 'no-access'` → `/auth/brokerage-contact` (existing). Any other 403 → dashboard + toast "You don't have permission to do that".
- **D-10:** Toast message: "You don't have permission to do that". No logout on 403.
- **D-11:** DEBT-04 is price-only: `GroupEstatesQuery` price range filtering and sorting → `listing_details.price_numeric`. No `strata_fees_numeric` migration.
- **D-12:** Rack::Attack 429 JSON body: `{ error: { code: "rate_limited", message: "Too many login attempts. Try again later." } }` with `Content-Type: application/json`.
- **D-13:** Sign-in component catches 429 as inline form error ("Too many attempts, try again shortly."). Axios interceptor has NO 429 branch.
- **D-14:** `InvitationsController` adds `skip_before_action :require_admin!, only: [:accept_invitation, :decline_invitation, :validate_token]` and `skip_before_action :authenticate_cognito_user!, only: [:validate_token]`.
- **D-15:** Throttle key uses `req.ip` (reads `X-Forwarded-For`), NOT `req.env["REMOTE_ADDR"]`.
- **D-16:** solid_cache setup: `gem "solid_cache"` → `rails solid_cache:install:migrations` → `db:migrate` → initializer sets `Rails.cache`.
- **D-17:** Remove the **entire** `Pagination` concern and its `include Pagination` from `ApplicationController`. All 5 helpers are confirmed unused.
- **D-18:** ESLint `no-console` set to `"error"` with `{ allow: ["warn", "error"] }`.
- **D-19:** ESLint adds override for `**/*.test.*` and `**/*.spec.*` that disables `no-console`.
- **D-20:** solid_cache uses the **same PostgreSQL DB**. No separate `database.yml` entry.
- **D-21:** `usersAminView` → `usersAdminView` rename uses two-step `git mv` (temp name first).
- **D-22:** Add `enum :status, { active: "active", invalid: "invalid" }` to `BrokerageBoardCredential`. No migration needed (column already `string`).

### Claude's Discretion

All remaining requirements (SEC-02, SEC-05, SEC-06, SEC-07, PERF-01, PERF-02, PERF-03, DEBT-05, DEBT-06) are fully specified in REQUIREMENTS.md with no meaningful ambiguity. Claude implements them as documented.

### Deferred Ideas (OUT OF SCOPE)

- `strata_fees_numeric` migration
- `require_owner!` on controllers beyond `BrokeragesController` / `DomainsController`
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | `Admin::BaseController#require_admin!` enforces owner/admin role on all `/v1/admin/**`; 403 on other roles | D-01/D-02/D-03/D-04; 13 admin controller file paths verified |
| SEC-02 | Remove `defaultValue` email and password from sign-in component | Lines 49 and 68 in signIn.tsx confirmed with exact values |
| SEC-03 | CORS origins proc validates against `BrokerageDomain` records | rack-cors 2.0.2 proc syntax verified; column name is `domain` |
| SEC-04 | `POST /v1/sessions` rate-limited via rack-attack, PostgreSQL-backed | rack-attack 6.8.0; solid_cache 1.0.10; D-07/D-08/D-15 |
| SEC-05 | Remove dead `Group#order_estates` and related methods | Lines 33–66 in group.rb confirmed; SQL injection at line 58 verified |
| SEC-06 | `InvitationsController` crashes fixed — `current_user` → `Current.user` | Lines 71 and 163 confirmed in invitations_controller.rb |
| SEC-07 | `FilterSetsController#create` cleanup is group-scoped | Line 62 confirmed unscoped; line 99 shows correct scoped pattern |
| SEC-08 | Axios interceptor handles generic 403 → dashboard + toast | Current interceptor code verified; toast strategy documented |
| PERF-01 | EstateLike N+1 eliminated in both estates index actions | Both controllers confirmed missing `liked_ge_ids`; serializer fallback path confirmed |
| PERF-02 | EstateEventSerializer N+1 eliminated | ALREADY FIXED — `estate_events_controller#index` has `.includes(rsvps: :user)` at line 16 |
| PERF-03 | All 6 uncapped controllers enforce `[per_page.to_i, 100].min` | All 6 verified; exact lines documented |
| DEBT-01 | Remove all `console.log`; add ESLint `no-console` rule | All 6 occurrences verified; ESLint config format confirmed (.eslintrc.js) |
| DEBT-02 | Rename `usersAminView` → `usersAdminView`; update imports | 5 import files identified; two-step git mv required |
| DEBT-03 | Add `BrokerageBoardCredential` status enum | Model confirmed; column is `string`; current validation identified |
| DEBT-04 | `GroupEstatesQuery` price filtering → `price_numeric` | Lines 119–121 (filter) and 277–278 (sort) confirmed; `price_numeric` column with index verified |
| DEBT-05 | Delete `FilterByPopup` component | File confirmed dead — no imports found anywhere; `framer-motion` not in package.json |
| DEBT-06 | Lower brokerage domain log from `info` to `debug` | Line 13 in brokerage_auth.rb confirmed: `logger.info(...)` |
| DEBT-07 | Remove entire `Pagination` concern | All 5 helpers confirmed unused by grep; only `include Pagination` in ApplicationController |
</phase_requirements>

---

## Summary

Phase 1 is a pure bug-fix and hardening phase across 17 requirements. Every change targets a known, documented problem with a clear before/after. No new capabilities are added.

The backend work falls into four clusters: (1) RBAC enforcement via a new `V1::Admin::BaseController`, (2) security hardening (CORS proc, rack-attack rate limiting, SQL injection removal, crash fixes), (3) N+1 performance fixes in two estates index actions, and (4) tech debt removal (pagination concern, dead code, enum definition, price column migration). The frontend work covers: (5) hardcoded credentials removal, (6) Axios 403 interceptor upgrade with toast, (7) ESLint console rule, and (8) directory rename + dead component deletion.

Key gotchas: the `BrokerageDomain` column is `domain` (not `host` as stated in D-05 — the implementation uses `domain`). PERF-02 is already fixed in the current codebase. The Axios 403 toast requires `router.navigate` (not `window.location.href`) to avoid losing the toast on page reload. Initializer load order requires `config.cache_store = :solid_cache_store` to be set in environment files (not initializers) so `Rails.cache` is resolved before `rack_attack.rb` initializer runs.

**Primary recommendation:** Execute in waves — infrastructure setup (solid_cache + rack-attack) → backend security (base controller + CORS) → bug fixes + N+1 → frontend changes + debt cleanup. The BaseController is the highest-risk change because it touches all 13 admin controllers simultaneously.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RBAC enforcement | API/Backend (controller concern) | — | Server-side auth cannot be delegated; frontend guard is supplementary only |
| CORS origin validation | API/Backend (rack middleware) | — | Runs before any Rails code; DB lookup via proc |
| Rate limiting | API/Backend (rack middleware) | DB (solid_cache) | Counting happens in middleware layer; state in PostgreSQL |
| Axios 403 handling | Browser/Client (axios interceptor) | — | Client-side routing + toast notification |
| ESLint console rule | Build tooling (frontend) | — | Static analysis at CI level |
| Price filtering | API/Backend (query object) | DB | `price_numeric` column with index; query object owns SQL |
| N+1 precomputation | API/Backend (controller) | — | Controllers bulk-compute; serializers read from `instance_options` |

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| rack-cors | 2.0.2 | CORS header management | Already in Gemfile.lock; `origins` proc syntax verified |
| pagy | ~6.5 | Pagination | Already configured; `Pagy::DEFAULT[:items] = 10` in pagy.rb |
| active_model_serializers | existing | JSON serialization | `:json` adapter with root key; `instance_options` pattern |
| acts_as_paranoid | ~3.0 | Soft deletes | `.without_deleted` required on every query |

### New Gems (to add)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| rack-attack | 6.8.0 | Rate limiting | Latest as of 2025-10; auto-integrated into Rails |
| solid_cache | 1.0.10 | DB-backed cache store | Latest as of rubygems.org; Rails 7.1 compatible |

### Frontend (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| react-hot-toast | ^2.6.0 | Toast notifications | Singleton — can call from non-React modules |
| react-router-dom | existing | Client-side routing | `router.navigate()` available on the exported router instance |
| eslint | ^8.27.0 | Linting | `.eslintrc.js` format (NOT flat config) |

**Installation:**
```bash
# Backend
bundle add rack-attack
bundle add solid_cache
bundle install
rails solid_cache:install:migrations
rails db:migrate
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser Request
    │
    ▼
Rack Middleware Stack
    ├── Rack::Cors (origin proc → BrokerageDomain DB lookup)
    ├── Rack::Attack (throttle POST /v1/sessions → SolidCache counter in PostgreSQL)
    │
    ▼
Rails Controllers
    ├── BrokerageAuth (resolve_brokerage via domain)
    ├── CognitoAuth (verify JWT → Current.user)
    ├── V1::Admin::BaseController (require_admin! → BrokerageMembership role check)
    │       └── All 13 admin controllers (inherit)
    │
    ▼
Query Layer (GroupEstatesQuery → listing_details.price_numeric)
    │
    ▼
Serializer Layer (EstateSerializer → liked_ge_ids from instance_options)
    │
    ▼
JSON Response

Frontend Axios Interceptor
    ├── 401 → clearToken + window.location.href /auth/login
    ├── 403 + next_step=no-access → window.location.href /auth/brokerage-contact
    └── 403 other → router.navigate('/') + toast.error("You don't have permission to do that")
```

### Recommended Project Structure

No structural changes needed. New files:
```
backend/
├── app/controllers/v1/admin/base_controller.rb   (NEW — D-01)
├── config/initializers/rack_attack.rb            (NEW — D-07/D-08)
├── config/initializers/solid_cache.rb            (NEW — D-16)
└── db/seeds/10_dev_domains.rb                    (NEW — D-06)
```

### Pattern 1: V1::Admin::BaseController

The base controller inherits from `ApplicationController`, re-includes the two auth concerns (since `ApplicationController` does not include them), and defines `require_admin!` and `require_owner!` as private methods with a `before_action`.

```ruby
# app/controllers/v1/admin/base_controller.rb
module V1
  module Admin
    class BaseController < ApplicationController
      include CognitoAuth
      include BrokerageAuth
      include Pagy::Backend

      before_action :authenticate_cognito_user!
      before_action :require_admin!

      private

      def require_admin!
        membership = BrokerageMembership.find_by(
          user_id: Current.user.id,
          brokerage_id: Current.brokerage.id
        )
        unless membership && %w[owner admin].include?(membership.role)
          render json: { error: { code: "forbidden", message: "You do not have permission to perform this action." } },
                 status: :forbidden
        end
      end

      def require_owner!
        membership = BrokerageMembership.find_by(
          user_id: Current.user.id,
          brokerage_id: Current.brokerage.id
        )
        unless membership&.role == "owner"
          render json: { error: { code: "forbidden", message: "Owner access required." } },
                 status: :forbidden
        end
      end
    end
  end
end
```

**Inheritance change for each of the 13 admin controllers:**
```ruby
# BEFORE
class GroupsController < ApplicationController
  include CognitoAuth
  include BrokerageAuth
  include Pagy::Backend
  before_action :authenticate_cognito_user!

# AFTER
class GroupsController < V1::Admin::BaseController
  # Remove the 4 lines above — inherited from BaseController
```

**Critical:** `BrokeragesController` and `DomainsController` need `before_action :require_owner!, only: [...]` overriding the default `require_admin!` inherited from base:

```ruby
class BrokeragesController < V1::Admin::BaseController
  before_action :require_owner!, only: [:update, :destroy]
  skip_before_action :require_admin!, only: [:update, :destroy]
  # OR override with:
  prepend_before_action :require_owner!, only: [:update, :destroy]
```

**Simpler approach:** In `require_admin!`, check role; in the base controller, call `require_owner!` only when overridden. The cleanest Rails pattern is:

```ruby
# In BrokeragesController:
before_action :require_owner!, only: [:update, :destroy]
# require_admin! still runs for show — that's correct
# For update/destroy: both run. require_owner! renders 403 first if not owner.
# Actually both fire -- need to skip require_admin! for those actions too.
# Cleanest: skip then add:
skip_before_action :require_admin!, only: [:update, :destroy]
before_action :require_owner!, only: [:update, :destroy]
```

### Pattern 2: InvitationsController skip_before_action (D-14)

```ruby
class InvitationsController < V1::Admin::BaseController
  skip_before_action :require_admin!, only: [:accept_invitation, :decline_invitation, :validate_token]
  skip_before_action :authenticate_cognito_user!, only: [:validate_token]

  # NOTE: validate_token is also currently missing from before_action :authenticate_cognito_user!
  # The existing code has: before_action :authenticate_cognito_user!, only: [:create, :accept_invitation, :decline_invitation, :index, :validate, :destroy]
  # After inheriting BaseController, authenticate_cognito_user! runs for ALL actions
  # The skip_before_action :authenticate_cognito_user!, only: [:validate_token] handles this correctly
```

### Pattern 3: CORS Dynamic Proc

```ruby
# config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins do |source, _env|
      host = begin
        URI.parse(source).host&.downcase
      rescue URI::InvalidURIError
        nil
      end
      host.present? && BrokerageDomain.exists?(domain: host)
    end

    resource "*",
      headers: :any,
      methods: %i[get post put patch delete options head],
      expose: %i[Authorization access-token expired token-type uid client]
  end
end
```

**Warning:** The CORS proc fires a DB query on every cross-origin request. This is acceptable for the current scale but the query uses the `domain` column which has a unique index — it is fast.

### Pattern 4: rack-attack Configuration

```ruby
# config/initializers/rack_attack.rb
Rack::Attack.cache.store = Rails.cache

Rack::Attack.throttle("login/ip", limit: 5, period: 20.seconds) do |req|
  req.ip if req.path == "/v1/sessions" && req.post?
end

Rack::Attack.throttled_responder = lambda do |_request|
  [
    429,
    { "Content-Type" => "application/json" },
    [{ error: { code: "rate_limited", message: "Too many login attempts. Try again later." } }.to_json]
  ]
end
```

**Load order critical detail:** `Rack::Attack.cache.store = Rails.cache` must execute AFTER `Rails.cache` is configured. `config.cache_store = :solid_cache_store` must be set in `config/environments/` files (loaded before initializers), not in an initializer. See Pitfall 1.

### Pattern 5: solid_cache Initializer

```ruby
# config/environments/production.rb (and development.rb)
config.cache_store = :solid_cache_store

# config/initializers/solid_cache.rb
# No explicit initializer needed when cache_store is set in environments
# If additional config is needed:
# Rails.application.config.solid_cache.connects_to = nil  # uses primary DB
```

**For same-DB setup (D-20):** When no `config/cache.yml` exists and no `connects_to` is configured, solid_cache uses the primary database connection. No additional `database.yml` entry is needed.

### Pattern 6: Axios 403 Handler (D-09/D-10)

**Key constraint:** `axios.ts` is a plain TypeScript module, not a React component. It cannot use `useNavigate`. However, `react-router-dom`'s `createBrowserRouter` returns a router object with a `.navigate()` method callable outside React components.

```typescript
// frontend/src/assets/axios/axios.ts
import axios from 'axios'
import camelcaseKeys from 'camelcase-keys'
import { clearToken, getToken } from '@/lib/auth'
import toast from 'react-hot-toast'
import router from '@/router/main'  // ← import the router instance

// ... (existing code)

api.interceptors.response.use(
    (response) => ({
        ...response,
        data: camelcaseKeys(response.data, { deep: true })
    }),
    (error) => {
        if (error.response?.status === 401 && window.location.pathname !== '/auth/login') {
            clearToken()
            window.location.href = '/auth/login'
        }
        if (
            error.response?.status === 403 &&
            error.response?.data?.next_step === 'no-access' &&
            window.location.pathname !== '/auth/brokerage-contact'
        ) {
            window.location.href = '/auth/brokerage-contact'
        }
        // NEW BRANCH — generic 403 (no next_step, or next_step !== 'no-access')
        if (
            error.response?.status === 403 &&
            error.response?.data?.next_step !== 'no-access'
        ) {
            toast.error("You don't have permission to do that")
            router.navigate('/')
        }
        return Promise.reject(error)
    }
)
```

**Why `router.navigate('/')` not `window.location.href = '/'`:** `window.location.href` triggers a full page reload, which destroys the react-hot-toast state before the toast renders. `router.navigate('/')` performs a client-side navigation — the React tree stays mounted, the Toaster component remains, and the toast is visible.

**Note:** The toast library is `react-hot-toast` (confirmed in package.json). The `Toaster` is mounted in `main.jsx` before `RouterProvider`. Calling `toast.error()` outside React components is valid — `react-hot-toast` uses a global event bus, not React context.

### Pattern 7: EstateLike N+1 Fix (PERF-01)

**Dashboard estates controller (lines 108–126) — add `liked_ge_ids`:**
```ruby
# After the existing rejected_ge_ids computation (line 100–107):
liked_ge_ids = if ge_ids.any?
  EstateLike.where(user_id: Current.user.id, group_estate_id: ge_ids)
    .pluck(:group_estate_id)
    .to_set
else
  Set.new
end

# In the render call, add:
liked_ge_ids: liked_ge_ids,
```

**Admin estates controller (lines 85–99) — add `current_user` + `liked_ge_ids`:**
```ruby
# After date_counts computation:
liked_ge_ids = if ge_ids.any?
  EstateLike.where(user_id: Current.user.id, group_estate_id: ge_ids)
    .pluck(:group_estate_id)
    .to_set
else
  Set.new
end

# In the render call, add:
current_user: Current.user,
liked_ge_ids: liked_ge_ids,
```

The serializer already handles this correctly at line 73–74:
```ruby
liked_ge_ids = @instance_options[:liked_ge_ids]
return liked_ge_ids.include?(ge_id) if liked_ge_ids.respond_to?(:include?)
# Falls back to DB query only if liked_ge_ids not present
EstateLike.exists?(user: current_user, group_estate_id: ge_id)
```

### Pattern 8: GroupEstatesQuery Price Fix (DEBT-04)

**Current code (lines 113–122):**
```ruby
def filter_by_price_range(scope)
  min = @params[:min_price].presence
  max = @params[:max_price].presence
  return scope unless min || max

  s = scope.joins(:listing_detail)
  s = s.where("CAST(listing_details.price AS REAL) >= ?", min.to_f) if min
  s = s.where("CAST(listing_details.price AS REAL) <= ?", max.to_f) if max
  s
end
```

**Fixed code:**
```ruby
def filter_by_price_range(scope)
  min = @params[:min_price].presence
  max = @params[:max_price].presence
  return scope unless min || max

  s = scope.joins(:listing_detail)
  s = s.where("listing_details.price_numeric >= ?", min.to_f) if min
  s = s.where("listing_details.price_numeric <= ?", max.to_f) if max
  s
end
```

**Sort fix (lines 276–279):**
```ruby
# BEFORE
when "price-asc"
  scope.joins(:listing_detail).order("listing_details.price ASC, listing_details.list_price ASC")
when "price-desc"
  scope.joins(:listing_detail).order("listing_details.price DESC, listing_details.list_price DESC")

# AFTER
when "price-asc"
  scope.joins(:listing_detail).order("listing_details.price_numeric ASC NULLS LAST")
when "price-desc"
  scope.joins(:listing_detail).order("listing_details.price_numeric DESC NULLS LAST")
```

**`price_numeric` column:** `t.decimal "price_numeric", precision: 15, scale: 2` with index `index_listing_details_on_price_numeric` — confirmed in schema.rb.

### Pattern 9: ESLint no-console Rule

**Current `.eslintrc.js`:**
```javascript
module.exports = {
    env: { browser: true, es2021: true },
    extends: ['plugin:react/recommended'],
    // ...
    rules: {
        // indent: ['error', 'tab']
    }
}
```

**Updated `.eslintrc.js`:**
```javascript
module.exports = {
    env: { browser: true, es2021: true },
    extends: ['plugin:react/recommended'],
    parserOptions: { /* ... existing ... */ },
    plugins: ['react'],
    rules: {
        'no-console': ['error', { allow: ['warn', 'error'] }]
    },
    overrides: [
        {
            files: ['**/*.test.*', '**/*.spec.*'],
            rules: {
                'no-console': 'off'
            }
        }
    ]
}
```

### Pattern 10: Per-Page Cap (PERF-03)

The cap pattern is identical across all 6 controllers. Replace the uncapped `if per_page > 0` branch:

```ruby
# BEFORE (admin/invitations_controller.rb, admin/group/invitations_controller.rb,
#         admin/group/estates_controller.rb pattern):
per_page = params[:per_page].to_i
if per_page > 0
  @pagy, records = pagy(scope, items: per_page)
else
  @pagy, records = pagy(scope)
end

# AFTER
per_page = params[:per_page].to_i
items = per_page.positive? ? [per_page, 100].min : 10
@pagy, records = pagy(scope, items: items)
```

```ruby
# BEFORE (dashboard/group/estate_comments_controller.rb and estate_documents_controller.rb):
per_page = params[:per_page].to_i
@pagy, records = if per_page.positive?
  pagy(scope, items: per_page)
else
  pagy(scope)
end

# AFTER
per_page = params[:per_page].to_i
items = per_page.positive? ? [per_page, 100].min : 10
@pagy, records = pagy(scope, items: items)
```

```ruby
# BEFORE (dashboard/notifications_controller.rb):
per_page = params[:per_page].to_i
@pagy, notifications = if per_page.positive?
  pagy(scope, items: per_page)
else
  pagy(scope)
end

# AFTER
per_page = params[:per_page].to_i
items = per_page.positive? ? [per_page, 100].min : 10
@pagy, notifications = pagy(scope, items: items)
```

### Anti-Patterns to Avoid

- **Putting `require_admin!` before `authenticate_cognito_user!` fires:** `require_admin!` reads `Current.user` — it must run AFTER auth. The `before_action` ordering in `BaseController` ensures auth runs first.
- **Using `req.env["REMOTE_ADDR"]` as throttle key:** Returns proxy IP when behind Nginx. Use `req.ip` which reads `X-Forwarded-For` (D-15).
- **Setting `Rails.cache` in an initializer before `config.cache_store`:** Causes `Rack::Attack.cache.store = Rails.cache` to get the wrong store. Always set `config.cache_store` in `environments/*.rb`.
- **Using `window.location.href` for the 403 dashboard redirect:** Destroys toast state. Use `router.navigate('/')`.
- **Removing `include CognitoAuth` from admin controllers WITHOUT confirming BaseController includes it:** The `ApplicationController` does NOT include these concerns — they must be re-included in `BaseController`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting throttle counting | Custom in-memory counter | `rack-attack` + `Rails.cache` | Cross-worker safety, atomic increments, configurable periods |
| Cache store for rate limiting | Redis setup | `solid_cache` (PostgreSQL) | Same DB, no new infrastructure, consistent with SolidQueue pattern |
| Per-request CORS origin validation | Custom middleware | rack-cors proc | Handles preflight OPTIONS, handles Vary header, battle-tested |
| Toast notifications in TS module | Custom event bus | `react-hot-toast` global API | Already in project; `toast.error()` works outside React components |
| Client-side navigation in TS module | `window.location.href` | `router.navigate()` | Avoids full page reload; preserves React state including toast queue |

---

## PERF-02 Already Fixed

**Critical finding:** `EstateEventSerializer` N+1 (PERF-02) is **already fixed** in the current codebase. All three estate events controllers include `.includes(rsvps: :user)`:

- `estate_events_controller.rb` line 16: `.includes(:created_by_user, rsvps: :user)`
- `all_estate_events_controller.rb` line 21: `.includes(:created_by_user, group_estate: [{estate: :listing_detail}, :group], rsvps: :user)`
- `estate_events_feed_controller.rb` line 16: `.includes(:created_by_user, group_estate: {estate: :listing_detail}, rsvps: :user)`

When these associations are loaded, `object.association(:rsvps).loaded?` returns `true` in the serializer, and the DB fallback queries on lines 34 and 42 are never reached.

**Recommendation for planner:** PERF-02 should be a verification task only — confirm `.includes(rsvps: :user)` is present and the fallback is never triggered. Do NOT add a duplicate include.

---

## Exact File Inventory: All 13 Admin Controllers

**Top-level (9):**
```
backend/app/controllers/v1/admin/activity_controller.rb       — line 3: ApplicationController
backend/app/controllers/v1/admin/board_credentials_controller.rb  — line 3: ApplicationController
backend/app/controllers/v1/admin/boards_controller.rb         — line 3: ApplicationController
backend/app/controllers/v1/admin/brokerages_controller.rb     — line 3: ApplicationController  ← require_owner!
backend/app/controllers/v1/admin/domains_controller.rb        — line 5: ApplicationController  ← require_owner!
backend/app/controllers/v1/admin/estates_controller.rb        — line 3: ApplicationController
backend/app/controllers/v1/admin/groups_controller.rb         — line 3: ApplicationController
backend/app/controllers/v1/admin/invitations_controller.rb    — line 3: ApplicationController  ← skip actions
backend/app/controllers/v1/admin/users_controller.rb          — line 3: ApplicationController
```

**Nested under group/ (4):**
```
backend/app/controllers/v1/admin/group/estates_controller.rb    — line 4: ApplicationController
backend/app/controllers/v1/admin/group/filter_sets_controller.rb — line 4: ApplicationController
backend/app/controllers/v1/admin/group/invitations_controller.rb — line 4: ApplicationController
backend/app/controllers/v1/admin/group/users_controller.rb      — line 4: ApplicationController
```

**Current shared pattern (all 13 controllers have these 4 lines to remove):**
```ruby
include CognitoAuth
include BrokerageAuth
include Pagy::Backend        # NOT all have this — check per controller
before_action :authenticate_cognito_user!
```

**Controllers WITHOUT `include Pagy::Backend`:** `BrokeragesController`, `DomainsController`, `EstatesController`, `BoardsController`, `BoardCredentialsController`, `Group::UsersController`. These do NOT need `include Pagy::Backend` in `BaseController` — but including it there is harmless and eliminates inconsistency.

---

## Exact File Inventory: console.log Occurrences (DEBT-01)

All 6 occurrences verified from CONCERNS.md:

| File | Line | Statement |
|------|------|-----------|
| `frontend/src/config/amplify.ts` | 25 | `console.log('✅ Amplify Cognito configured')` |
| `frontend/src/containers/adminBoard/listingGroupAdminBoard/listingGroupDetailsAdminBoard/useListingGroupDetailsContext.tsx` | 142 | `console.log('page', page)` |
| `frontend/src/components/view/admin/usersAminView/UsersListView.tsx` | 64 | `console.log('Delete user', confirmPopup.id)` |
| `frontend/src/components/view/admin/usersAminView/memberAdminView/MemberDetailCard.tsx` | 18 | `console.log(dateString)` |
| `frontend/src/components/common/form/signIn/signIn.tsx` | 30 | `console.log(response)` |
| `frontend/src/components/common/popups/filterByPopup/FilterByPopup.tsx` | 12 | `console.log("Filters applied:", ...)` |

**Note:** The last file (`FilterByPopup.tsx`) is the same file being deleted for DEBT-05. Its console.log is eliminated automatically by the deletion. The planner can combine these (delete DEBT-05 file, don't remove console.log from it separately).

**Note:** `UsersListView.tsx` and `MemberDetailCard.tsx` are inside the `usersAminView` directory being renamed for DEBT-02. The rename task must happen BEFORE or simultaneously with console.log removal in those files.

---

## Exact File Inventory: usersAminView Imports (DEBT-02)

5 files import from `usersAminView`:

| File | Import path |
|------|------------|
| `frontend/src/containers/account/Account.tsx` | `@/components/view/admin/usersAminView/memberAdminView/MemberDetailCard` |
| `frontend/src/containers/account/Account.tsx` | `@/components/view/admin/usersAminView/memberAdminView/MemberGroupsList` |
| `frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx` | `@/components/view/admin/usersAminView/UsersListView` |
| `frontend/src/containers/adminBoard/usersAdminBoard/UsersAdminBoard.tsx` | `@/components/view/admin/usersAminView/InvitationsView` |
| `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx` | `@/components/view/admin/usersAminView/memberAdminView/MemberDetailCard` |
| `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/MemberAdminBoard.tsx` | `@/components/view/admin/usersAminView/memberAdminView/MemberGroupsList` |
| `frontend/src/containers/adminBoard/usersAdminBoard/memberAdminBoard/editMemberAdminBoard/EditMemberAdminBoard.tsx` | `@/components/view/admin/usersAminView/memberAdminView/EditMemberView` |

**Two-step git mv commands (D-21):**
```bash
git mv frontend/src/components/view/admin/usersAminView frontend/src/components/view/admin/usersAminViewTemp
git mv frontend/src/components/view/admin/usersAminViewTemp frontend/src/components/view/admin/usersAdminView
```

---

## Seed File Addition (D-06)

The seed pattern is `db/seeds/NN_name.rb` with a `seed_X!` function called from `db/seeds.rb`. The new file adds two `BrokerageDomain` records for `brokerage_id: 1` (prime_realty, already seeded):

```ruby
# db/seeds/10_dev_domains.rb
def seed_dev_domains!
  puts "Seeding dev domains..."
  domain_data = [
    {
      brokerage_id: SeedConstants::BROKERAGE_IDS[:prime_realty],
      domain: "localhost",
      verified: true,
      verified_at: Time.current,
      created_at: Time.current,
      updated_at: Time.current
    },
    {
      brokerage_id: SeedConstants::BROKERAGE_IDS[:prime_realty],
      domain: "gregoryrealtor.realstate.local",
      verified: true,
      verified_at: Time.current,
      created_at: Time.current,
      updated_at: Time.current
    }
  ]
  BrokerageDomain.insert_all(domain_data, unique_by: :domain)
  puts "✅ Created dev domains for prime_realty brokerage"
end
```

**`db/seeds.rb` update:** Add `load Rails.root.join("db/seeds/10_dev_domains.rb")` and call `seed_dev_domains!` inside the transaction.

**Domain validation:** Both `localhost` and `gregoryrealtor.realstate.local` pass `BrokerageDomain#valid_domain_format` validation (verified by regexp match test).

**Note:** The seed already has `127.0.0.1` for prime_realty. The CORS proc uses `URI.parse(origin).host` which extracts the hostname — for `http://localhost:3000`, host is `localhost`; for `http://127.0.0.1:8080`, host is `127.0.0.1`. Both domains are needed for dev to work correctly.

---

## Common Pitfalls

### Pitfall 1: Initializer Load Order for Rack::Attack.cache.store

**What goes wrong:** If `Rails.cache` is configured in a `config/initializers/solid_cache.rb` file, and `config/initializers/rack_attack.rb` runs first (alphabetically `r` < `s`), then `Rack::Attack.cache.store = Rails.cache` copies the unconfigured cache store (e.g., `NullStore` in dev).

**Why it happens:** Rails loads initializers in alphabetical order. `rack_attack.rb` comes before `solid_cache.rb`.

**How to avoid:** Set `config.cache_store = :solid_cache_store` in `config/environments/development.rb` AND `config/environments/production.rb` (and `test.rb` if needed). Environment files load before all initializers. `rack_attack.rb` can then safely do `Rack::Attack.cache.store = Rails.cache` because `Rails.cache` is already the SolidCache store.

**Warning signs:** Rate limiting doesn't persist across Puma workers; throttle counts reset on restart.

### Pitfall 2: require_admin! Fires Before Current.user Is Set

**What goes wrong:** If `require_admin!` is a `before_action` that runs before `authenticate_cognito_user!`, calling `Current.user.id` raises `NoMethodError` on nil.

**Why it happens:** `before_action` filters run in declaration order. If `require_admin!` is declared before `authenticate_cognito_user!` in `BaseController`, it fires first.

**How to avoid:** In `BaseController`, declare `before_action :authenticate_cognito_user!` BEFORE `before_action :require_admin!`. `BrokerageAuth`'s `before_action :resolve_brokerage` (added on include) also runs via `included do` — it runs at include time in declaration order.

**Correct order in BaseController:**
1. `BrokerageAuth` include → adds `before_action :resolve_brokerage`
2. `CognitoAuth` include → no implicit before_action (explicit only)
3. `before_action :authenticate_cognito_user!` → explicit declaration
4. `before_action :require_admin!` → explicit declaration

### Pitfall 3: Admin Controllers That Don't Need Pagy::Backend

**What goes wrong:** If `include Pagy::Backend` is added to `BaseController`, controllers that don't use pagy still work (harmless). But `Pagy::Backend` adds `pagy`, `pagy_array`, `pagy_metadata` — no conflicts expected.

**How to avoid:** Including it in `BaseController` is the cleanest approach since most admin controllers use it.

### Pitfall 4: 403 Toast Lost on Window.location.href Navigation

**What goes wrong:** `toast.error(msg)` followed immediately by `window.location.href = '/'` — the React component tree unmounts before the toast renders. No toast appears on the new page.

**How to avoid:** Use `router.navigate('/')` (imported from `@/router/main`) for client-side navigation. The React tree stays mounted; toast renders and persists until dismissed.

**Exception:** The existing `403 + no-access` redirect (`window.location.href = '/auth/brokerage-contact'`) is intentional — it's a full auth redirect and doesn't need a toast.

### Pitfall 5: BrokerageDomain Column Name Discrepancy in D-05

**What goes wrong:** D-05 mentions `BrokerageDomain.exists?(host: extracted_host)`. The actual DB column is `domain`, not `host`. Using `host:` silently returns false (AR ignores unknown keys or raises, depending on strict_loading).

**How to avoid:** Use `BrokerageDomain.exists?(domain: host)` in the CORS proc. [VERIFIED: schema.rb line 35: `t.string "domain", null: false`]

### Pitfall 6: InvitationsController Action Name Mismatch

**What goes wrong:** The existing `InvitationsController` has `before_action :authenticate_cognito_user!, only: [specific actions]`. After inheriting `BaseController`, `authenticate_cognito_user!` runs for ALL actions (not just those listed). The `skip_before_action :authenticate_cognito_user!, only: [:validate_token]` in D-14 handles this, but the existing selective `only:` list should be removed from the controller entirely since `BaseController` handles it.

**How to avoid:** When rewriting to inherit `BaseController`: remove the old `before_action :authenticate_cognito_user!, only: [...]` line entirely. The base's unconditional `before_action :authenticate_cognito_user!` runs for all. Then add the two `skip_before_action` declarations per D-14.

### Pitfall 7: Two-Step git mv Skipped on Linux

**What goes wrong:** The two-step git mv is required for macOS (case-insensitive FS). On Linux (case-sensitive), a single `git mv` works. However, if the WSL filesystem is on a Windows NTFS volume, it may behave like macOS. The two-step approach works on all systems and is safe on Linux too.

**How to avoid:** Always use the two-step rename per D-21 for portability.

---

## Runtime State Inventory

This phase is not a rename/refactor phase. Skipped.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | solid_cache, rate limiting | ✓ | (per DATABASE_URL) | — |
| Node.js + npm | ESLint, frontend linting | ✓ | (per system) | — |
| rack-attack gem | SEC-04 | ✗ | Not yet in Gemfile | Must add |
| solid_cache gem | SEC-04/D-16 | ✗ | Not yet in Gemfile | Must add |

**Missing dependencies with no fallback:**
- `rack-attack` (version 6.8.0) — must be added to Gemfile before SEC-04 tasks execute
- `solid_cache` (version 1.0.10) — must be added to Gemfile before D-16 tasks execute

Both gems must be added, bundled, and migrated BEFORE any task that references `Rack::Attack` or `Rails.cache = :solid_cache_store`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `CognitoAuth` concern (existing); rate limiting on login via rack-attack |
| V3 Session Management | no | JWT-based; out of scope for this phase |
| V4 Access Control | yes | `V1::Admin::BaseController#require_admin!` server-side enforcement |
| V5 Input Validation | yes | `BrokerageDomain.exists?` uses parameterized query (no injection) |
| V6 Cryptography | no | No crypto changes in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Brute-force login | Elevation of Privilege | rack-attack 5 req/20s on POST /v1/sessions |
| Cross-tenant admin API access (agent role) | Elevation of Privilege | `require_admin!` on all `/v1/admin/**` |
| CSRF-style cross-origin requests | Spoofing | CORS proc restricted to `BrokerageDomain` records |
| SQL injection via dead model methods | Tampering | Delete `Group#order_estates` and related (unparameterized string interpolation) |
| Hardcoded credentials in source code | Information Disclosure | Remove `defaultValue` from sign-in form |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `router.navigate('/')` is callable outside React components on a `createBrowserRouter` instance | Pattern 6 (Axios 403) | Toast appears but navigation doesn't work; fallback: use `window.location.href` and accept no toast |
| A2 | solid_cache defaults to primary DB when no `config/cache.yml` exists | Pattern 5 | Rate limiting counts stored in wrong DB or fails at startup |
| A3 | `rails solid_cache:install:migrations` generates a migration into the existing `db/migrate/` folder | Environment Availability | Migration may need to be created manually or via different command |

---

## Open Questions

1. **PERF-02 verification approach**
   - What we know: All 3 estate event controllers already have `.includes(rsvps: :user)`. The serializer fallback is guarded by `association(:rsvps).loaded?`.
   - What's unclear: Whether `without_deleted` on the includes scope causes the `loaded?` guard to return false (soft-delete scoping caveat).
   - Recommendation: Treat PERF-02 as a verification task. Confirm `association(:rsvps).loaded?` returns true after the includes. If it doesn't, the includes syntax may need adjustment.

2. **solid_cache:install vs solid_cache:install:migrations**
   - What we know: D-16 specifies `rails solid_cache:install:migrations`. The context7 docs show both `solid_cache:install` and `solid_cache:install:migrations` commands.
   - What's unclear: Whether `solid_cache:install` creates a `config/cache.yml` that would conflict with the same-DB approach.
   - Recommendation: Use `solid_cache:install:migrations` as specified in D-16. This generates only the migration, not the config file. Then configure via `config.cache_store` in environment files.

3. **dashboard/group/estates_controller per_page cap**
   - What we know: `pagy(estates_scope, items: params[:per_page].presence || 6)` on line 43 is also uncapped, but CONCERNS.md only lists 6 specific controllers for PERF-03.
   - What's unclear: Whether this controller should also receive the cap fix.
   - Recommendation: Planner should include it in PERF-03 scope as a 7th controller, since `params[:per_page].presence` passes arbitrary string values to Pagy.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct reads — all file paths and line numbers verified by reading actual source files
- `db/schema.rb` — column names, indexes, types confirmed
- `frontend/.eslintrc.js` — ESLint config format confirmed (.eslintrc.js, NOT flat config)
- `/rack/rack-attack` (Context7) — throttle syntax, custom responder, `req.ip` usage
- `/rails/solid_cache` (Context7) — install commands, cache_store config, same-DB setup
- rubygems.org API — rack-attack 6.8.0 (2025-10-14), solid_cache 1.0.10

### Secondary (MEDIUM confidence)
- rack-cors README (GitHub raw) — proc-based origins syntax `{ |source, env| bool }`
- Context7 rack-attack docs — `Rack::Attack.cache.store = Rails.cache` pattern

### Tertiary (LOW confidence — none)
All critical claims verified from codebase or official documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing gems version-checked from Gemfile.lock; new gems from rubygems.org
- Architecture: HIGH — all 13 controller files read directly; inheritance chain verified
- Pitfalls: HIGH — load order pitfall verified by checking file alphabetical ordering; router.navigate pattern verified from router/main.tsx

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable gems; no fast-moving dependencies)

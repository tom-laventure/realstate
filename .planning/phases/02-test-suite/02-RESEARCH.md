# Phase 2: Test Suite — Research

**Researched:** 2026-05-02
**Domain:** Minitest (Rails 7.1 integration tests), factory_bot_rails, shoulda-matchers, Vitest 4.x, MSW 2.x, @testing-library/react
**Confidence:** HIGH

---

## Project Constraints (from CLAUDE.md)

- No RSpec — Rails default Minitest only
- No Jest — Vitest only for frontend
- Backend test environment uses SQLite3 (per `config/database.yml`)
- `backend/` and `frontend/` are separate git repos; planning docs commit to monorepo root
- Soft deletes: `acts_as_paranoid` on all user-facing models — queries must guard `deleted_at`
- Authorization is imperative: `Current.user`, `Current.brokerage` via `ActiveSupport::CurrentAttributes`
- Icons: `lucide-react` only; Styling: Tailwind CSS utility classes
- All frontend imports use `@` alias (configured in `vite.config.ts`)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Backend test infrastructure: factory_bot_rails + shoulda-matchers installed; AuthHelper mints JWTs; Current.reset teardown prevents leakage | factory_bot_rails 6.5.1 and shoulda-matchers 7.0.1 verified in registry; TokenService.issue(user) confirmed in codebase; Current.reset confirmed as correct method on CurrentAttributes |
| TEST-02 | Integration test: Brokerage A JWT + Brokerage B Host header → 403 or 404 | BrokerageAuth raises RecordNotFound (404) if domain not found; CognitoAuth checks BrokerageMembership and returns 403 if not member |
| TEST-03 | Integration test: agent/client roles → 403 on all /v1/admin/** endpoints; owner/admin → 200 | V1::Admin::BaseController#require_admin! verified; BrokerageMembership.role checked against %w[owner admin] |
| TEST-04 | Integration test: FilterSetsController#create moves estates, destroys previous filter set estates scoped to correct group | FilterSetsController#create verified: group-scoped GroupEstate.where(group:, group_filter_set_id:).destroy_all |
| TEST-05 | Integration tests: GroupEstatesQuery price range filtering, sort by price, sort by rating | Price range via price_numeric verified; price sort verified (price-asc/price-desc); CRITICAL: rating sort case DOES NOT EXIST in apply_sort — only filter_by_min_user_rating/min_group_rating exist. Test must use rating filter, not rating sort |
| TEST-06 | Integration test: InvitationsController#create and #accept_invitation succeed without crashing | Controller uses Current.user throughout — crash was pre-Phase-1 fix; tests prove the fix holds |
| TEST-07 | Frontend test infrastructure: Vitest + jsdom + MSW installed; renderWithProviders; MSW lifecycle | Vitest 4.1.5 verified; MSW 2.14.2 verified (breaking change from 1.x); @testing-library/react upgrade needed |
| TEST-08 | Frontend tests: ProtectedRoute redirects unauthenticated users; RequireRole hides restricted UI | ProtectedRoute uses isAuthenticated() from localStorage; RequireRole uses useRole() hook (Redux state) |
| TEST-09 | Frontend tests: Google OAuth — "Sign in with Google" click calls signInWithRedirect; Hub event triggers session exchange | CRITICAL: signInWithRedirect component does NOT yet exist in codebase — Phase 2 must add GoogleSignInButton before testing it |
</phase_requirements>

---

## Summary

Phase 2 builds test infrastructure from scratch for both the Rails backend and the Vite/React frontend, then proves the highest-risk Phase 1 changes work correctly.

The backend side is well-understood: standard Rails Minitest with factory_bot_rails (6.5.1) and shoulda-matchers (7.0.1) for DSL sugar. The test environment already uses SQLite3 (confirmed in `config/database.yml`). The key challenge is the `AuthHelper` that must mint valid HS256 JWTs (using `TokenService.issue`) without an actual Cognito call, and the `BrokerageAuth` concern that resolves `Current.brokerage` from the `Host` header — so integration tests must set the `Host` header and seed `BrokerageDomain` records.

The frontend side requires adding Vitest 4.1.5 + jsdom + MSW 2.x to a project that currently has `@testing-library/react@13` (CRA/Jest-era) and no Vitest config. MSW has a major API change from 1.x to 2.x (handlers now use `http.get` not `rest.get`). A `renderWithProviders` helper must wrap React components in fresh `QueryClientProvider` + Redux `Provider` per test. TEST-09 requires a `GoogleSignInButton` component that calls `signInWithRedirect` — this component does not exist in the codebase and must be added in Phase 2 as a minimal stub (just enough to satisfy the test; full OAuth integration comes in Phase 4).

**Critical gap discovered:** TEST-05 requires "sort by rating" but `GroupEstatesQuery#apply_sort` has no rating sort case — only `filter_by_min_user_rating` and `filter_by_min_group_rating` filters exist. The test must target the rating _filter_ capability, not a sort. Or a rating sort case must be added to `apply_sort` as part of this phase. The planner must decide.

**Primary recommendation:** Backend plans: (1) gem install + AuthHelper, (2) tenant isolation + admin auth tests, (3) FilterSets + GroupEstatesQuery tests, (4) Invitations tests. Frontend plans: (5) Vitest config + renderWithProviders + MSW server, (6) ProtectedRoute + RequireRole tests, (7) GoogleSignInButton component + OAuth test.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JWT minting for tests | API / Backend | — | TokenService.issue lives in backend; tests call it directly |
| CurrentAttributes isolation | API / Backend | — | Current.reset is a Rails concern; must run in teardown of every test |
| Host header → tenant resolution | API / Backend | — | BrokerageAuth reads request.host; integration tests set Host header |
| Role enforcement (require_admin!) | API / Backend | — | V1::Admin::BaseController; checked via BrokerageMembership.role |
| Test DB (SQLite) | Database / Storage | — | Already configured in database.yml; isolation via transaction rollbacks |
| Component auth guards (ProtectedRoute, RequireRole) | Browser / Client | — | React components using localStorage token and Redux state |
| AWS Amplify mocking | Browser / Client | — | signInWithRedirect / fetchAuthSession mocked with vi.mock |
| MSW API mocking | Browser / Client | — | Intercepts fetch/XHR in jsdom; configured in test setup file |

---

## Standard Stack

### Core — Backend
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| factory_bot_rails | 6.5.1 | Test data factories | Rails standard; integrates with ActiveRecord; replaces fixtures | [VERIFIED: npm registry / gem search] |
| shoulda-matchers | 7.0.1 | Minitest matchers for validations/associations | One-liner assertions for model validations | [VERIFIED: gem search] |

**Already in Gemfile (test group):**
| Library | Version | Purpose |
|---------|---------|---------|
| webmock | (current) | HTTP request stubbing | [VERIFIED: backend/Gemfile line 64] |
| sqlite3 | >= 1.4 | Test database | [VERIFIED: backend/Gemfile line 65; database.yml test env] |
| debug | (current) | Debugging | [VERIFIED: backend/Gemfile line 62] |

### Core — Frontend
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.5 | Test runner (Vite-native) | No Jest transform overhead; compatible with Vite config | [VERIFIED: npm view vitest version] |
| jsdom | 25.x | DOM environment | Standard jsdom environment for Vitest | [VERIFIED: npm view jsdom version] |
| msw | 2.14.2 | API mocking in tests | Service worker mock; intercepts fetch in jsdom | [VERIFIED: npm view msw version] |
| @testing-library/react | 16.3.2 | React component rendering/querying | Current version for React 18; drops act() warnings | [VERIFIED: npm view] |
| @testing-library/user-event | 14.6.1 | Simulates real user interactions | Replaces fireEvent for realism | [VERIFIED: npm view] |
| @testing-library/jest-dom | 6.9.1 | DOM matchers (toBeInTheDocument etc.) | Works with Vitest via setup import | [VERIFIED: npm view] |

**Version note:** Current `package.json` has `@testing-library/react@^13.4.0` (CRA/Jest era). This must be upgraded to `^16.3.2` for Vitest + React 18 compatibility. Also `@types/node@^18` must be upgraded to `^20` to satisfy Vitest 4.x peer dependency.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/coverage-v8 | 4.1.5 | Code coverage (optional) | Add later if coverage reports needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| factory_bot_rails | fixtures | FactoryBot is far more flexible for variable test data |
| msw 2.x | nock / axios-mock-adapter | MSW mocks at network level (framework-agnostic), works with any HTTP library including Amplify |
| @testing-library/react | enzyme | @testing-library encourages testing user behavior, not implementation |

**Backend installation:**
```bash
# In backend/
bundle add factory_bot_rails shoulda-matchers --group test
bundle install
```

**Frontend installation:**
```bash
# In frontend/
npm install --save-dev vitest jsdom msw @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6 @vitest/coverage-v8 @types/node@^20
```

---

## Architecture Patterns

### System Architecture Diagram

```
Backend Tests                           Frontend Tests
─────────────────────────────────────   ──────────────────────────────────────
test/test_helper.rb                     vitest.config.ts
  └─ AuthHelper (mints JWT)               └─ environment: jsdom
  └─ Current.reset (teardown)             └─ setupFiles: [src/test/setup.ts]
  └─ factory_bot_rails                        └─ MSW server (beforeAll/afterEach/afterAll)
  └─ shoulda-matchers                         ��─ @testing-library/jest-dom matchers

Integration Tests                       Component Tests
  Host header → BrokerageAuth             renderWithProviders()
    └─ Current.brokerage set                └─ QueryClientProvider (fresh per test)
  Bearer JWT → CognitoAuth                  └─ Redux Provider (fresh store per test)
    └─ Current.user set                     └─ MemoryRouter (react-router-dom)
  Controller action → response          vi.mock('aws-amplify/auth') → mocked Amplify
```

### Recommended Project Structure
```
backend/
├── test/
│   ├── test_helper.rb           # factory_bot, shoulda-matchers config, AuthHelper, teardown
│   ├── factories/               # factory_bot factories
│   │   ├── users.rb
│   │   ├── brokerages.rb
│   │   ├── brokerage_domains.rb
│   │   ├── brokerage_memberships.rb
│   │   ├── groups.rb
│   │   ├── estates.rb
│   │   ├── listing_details.rb
│   │   ├── group_estates.rb
│   │   ├── group_filter_sets.rb
│   │   └── invitations.rb
│   └── integration/
│       ├── tenant_isolation_test.rb      # TEST-02
│       ├── admin_authorization_test.rb   # TEST-03
│       ├── filter_sets_test.rb           # TEST-04
│       ├── group_estates_query_test.rb   # TEST-05
│       └── invitations_test.rb           # TEST-06

frontend/
├── vitest.config.ts              # TEST-07 infrastructure
├── src/
│   ├── test/
│   │   ├── setup.ts              # MSW server lifecycle + jest-dom matchers
│   │   ├── server.ts             # MSW http handlers
│   │   └── renderWithProviders.tsx  # QueryClientProvider + Redux Provider helper
│   └── components/
│       └── auth/
│           └��─ GoogleSignInButton.tsx   # new component needed for TEST-09
│   └── components/common/guards/
│       ├── ProtectedRoute.test.tsx      # TEST-08
│       └── RequireRole.test.tsx         # TEST-08
│   └── components/auth/
│       └── GoogleSignInButton.test.tsx  # TEST-09
```

### Pattern 1: AuthHelper — JWT Minting Without Cognito

**What:** A test module that sets `Current.brokerage` and `Current.user`, then calls `TokenService.issue(user)` to produce a real HS256 JWT signed with `Rails.application.secret_key_base`.
**When to use:** Every integration test that calls a protected endpoint.

```ruby
# Source: TokenService.issue codebase analysis + factory_bot pattern
module AuthHelper
  def auth_headers_for(user, brokerage)
    Current.brokerage = brokerage
    Current.user = user
    token = TokenService.issue(user)
    { "Authorization" => "Bearer #{token}", "Host" => brokerage.brokerage_domains.first.domain }
  ensure
    Current.reset
  end
end
```

**Critical:** `TokenService.issue(user)` reads `Current.brokerage` to embed the role in the JWT payload (see `token_service.rb` line 9: `BrokerageMembership.find_by(user_id: user.id, brokerage_id: Current.brokerage&.id)`). `Current.brokerage` must be set before calling `issue`. [VERIFIED: codebase]

### Pattern 2: Current.reset Teardown

**What:** Prevents `CurrentAttributes` from leaking between tests. Must run in `teardown`, not `after`.

```ruby
# Source: Rails ActiveSupport::CurrentAttributes API
class ActiveSupport::TestCase
  teardown do
    Current.reset
  end
end
```

`Current.reset` is the official method on `ActiveSupport::CurrentAttributes`. [VERIFIED: codebase — `Current < ActiveSupport::CurrentAttributes`]

### Pattern 3: Host Header in Integration Tests

**What:** BrokerageAuth reads `request.host` to resolve `Current.brokerage`. Integration tests must set the Host header.

```ruby
# Source: Rails ActionDispatch::Integration::Session
get "/v1/admin/users", headers: {
  "Host" => "brokerage-a.example.com",
  "Authorization" => "Bearer #{token}"
}
```

Rails integration tests use `ActionDispatch::IntegrationTest`. The `host!` method can also be used to set the host for all subsequent requests in a session.

### Pattern 4: renderWithProviders — Fresh Providers Per Test

**What:** Wraps a component in isolated `QueryClientProvider` (TanStack Query), Redux `Provider`, and `MemoryRouter` (React Router). A fresh `QueryClient` per test prevents cache leakage between tests.

```typescript
// Source: TanStack Query testing docs pattern + project app providers (main.jsx)
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import accountReducer from '@/store/reducers/account'

export function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  const store = configureStore({ reducer: { account: accountReducer } })

  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>
          {ui}
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>
  )
}
```

**Note:** TanStack Query v4 (the project's current version) requires `retry: false` in test config to prevent retrying failed queries. [VERIFIED: package.json uses `@tanstack/react-query@^4.22.0`]

### Pattern 5: MSW 2.x Server Setup

**What:** MSW 2.x has a breaking API change from 1.x. Handlers now use `http` namespace (not `rest`), and `server.listen()` takes `{ onUnhandledRequest: 'error' }`.

```typescript
// Source: MSW 2.x official docs pattern [VERIFIED: npm view msw version → 2.14.2]
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const server = setupServer(
  http.post('/v1/sessions', () => {
    return HttpResponse.json({ token: 'mock-jwt' })
  })
)

// In setup.ts:
import { server } from './server'
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

**Breaking change from MSW 1.x:** `rest.get(url, (req, res, ctx) => res(ctx.json(...)))` → `http.get(url, () => HttpResponse.json(...))`. Do not use the 1.x API. [VERIFIED: npm view msw dist-tags → latest: 2.14.2]

### Pattern 6: Mocking AWS Amplify in Vitest

**What:** `aws-amplify/auth` exports `signInWithRedirect`, `fetchAuthSession`, `Hub`. Vitest's `vi.mock` replaces the module before the component imports it.

```typescript
// Source: Vitest vi.mock pattern + aws-amplify@6 module structure
import { vi } from 'vitest'

vi.mock('aws-amplify/auth', () => ({
  signInWithRedirect: vi.fn(),
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: { idToken: { toString: () => 'mock-id-token' } }
  }),
  Hub: {
    listen: vi.fn()
  }
}))
```

**Note:** `aws-amplify` v6 (project uses `^6.15.9`) uses sub-path imports (`aws-amplify/auth`). Mock the sub-path, not the root package. [VERIFIED: CreateAccount.tsx uses `from 'aws-amplify/auth'`; amplify.ts uses `from 'aws-amplify'`]

### Pattern 7: GoogleSignInButton Component (new — required for TEST-09)

**What:** A minimal React component that calls `signInWithRedirect({ provider: 'Google' })` on click and listens to `Hub` for `signInWithRedirect` events to trigger `fetchAuthSession` + `POST /v1/sessions`.
**Why it must be created in Phase 2:** TEST-09 success criteria requires a passing test that exercises `signInWithRedirect` click + Hub event. The component does not exist in the codebase. Phase 4 will flesh it out with full UI/UX; Phase 2 creates a minimal testable version.

```typescript
// Minimal GoogleSignInButton — testable skeleton
import { signInWithRedirect } from 'aws-amplify/auth'

const GoogleSignInButton = () => (
  <button onClick={() => signInWithRedirect({ provider: 'Google' })}>
    Sign in with Google
  </button>
)

export default GoogleSignInButton
```

The test verifies: (1) clicking the button calls `signInWithRedirect({ provider: 'Google' })`; (2) a Hub `signInWithRedirect` event callback triggers `fetchAuthSession` and then calls `POST /v1/sessions` with the idToken.

### Anti-Patterns to Avoid

- **Setting `Current.brokerage` in a before block without resetting:** CurrentAttributes are thread-local and persist across tests unless `Current.reset` is called. [VERIFIED: codebase — `Current < ActiveSupport::CurrentAttributes`]
- **Using `ActiveRecord::Base.transaction` rollback for test isolation when using `insert_all`:** `FilterSetsController` uses `GroupEstate.insert_all(rows)` which bypasses ActiveRecord callbacks and may not roll back in some adapters. Use `DatabaseCleaner` or explicit cleanup. [ASSUMED — standard pitfall with insert_all and transaction rollback]
- **Shared QueryClient across tests:** One QueryClient per test is mandatory. Shared QueryClient caches responses and causes test interference. [VERIFIED: TanStack Query docs pattern]
- **Using MSW 1.x `rest` API with MSW 2.x:** The `rest` namespace does not exist in MSW 2.x. Use `http` from `msw`. [VERIFIED: MSW 2.x API]
- **Calling `TokenService.issue` without setting `Current.brokerage` first:** The service reads `Current.brokerage` to look up the role. Without it, `role` will be `nil` in the JWT. [VERIFIED: token_service.rb line 9]
- **Not upgrading `@testing-library/react` from v13 to v16:** v13 does not include React 18 concurrent mode support and uses a different `act()` wrapping. Tests will produce warnings or fail silently. [VERIFIED: peer dependency check]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test data creation | Manual `User.create!(...)` in every test | factory_bot_rails factories | Factories handle associations, defaults, sequences, uniqueness |
| JWT verification in tests | Custom JWT decode | `TokenService.verify(token)` already exists | The service handles algorithm + secret correctly |
| API request mocking in frontend | `vi.fn()` on axios directly | MSW 2.x | MSW intercepts at the network level — tests are unaware of HTTP client implementation |
| Association matchers | Custom `assert_includes` loops | shoulda-matchers `should have_many` | One-liner, readable, maintainable |
| HTTP request stubs in backend tests | Manual WebMock stubs for Cognito | `TokenService.issue` bypasses Cognito entirely | Tests mint JWTs directly — no Cognito HTTP call needed |

**Key insight:** The existing `TokenService` is the unlock for backend tests. Because it signs with `Rails.application.secret_key_base` and `CognitoAuth` verifies with the same key, tests can create real, verifiable JWTs without any external call. The only thing `CognitoAuth` does after JWT verification is look up `User.find_by!(uid: claims["sub"])` — which requires a factory-created user with a matching `uid`.

---

## Critical Finding: TEST-05 Rating Sort Gap

TEST-05 requires: "sort by price, and sort by rating return correct record sets."

`GroupEstatesQuery#apply_sort` has these sort cases: `activity-desc`, `activity-asc`, `date-added-asc`, `price-asc`, `price-desc`, `size-asc`, `size-desc`. **There is no `rating-asc` or `rating-desc` sort case.** [VERIFIED: codebase — full `apply_sort` method read]

Two valid approaches:
1. **Test the rating filter instead of a rating sort.** TEST-05 can test `filter_by_min_user_rating` (passing `min_user_rating:` param) which does exist.
2. **Add a rating sort case to `GroupEstatesQuery#apply_sort`** as part of this phase (e.g., `"rating-desc"` → `ORDER BY AVG(estate_ratings.rating) DESC NULLS LAST`), then test it.

Approach 2 is the correct interpretation of the requirement. The planner should include a task to add rating sort to `apply_sort` before writing the test. The SQL would join `estate_ratings` and aggregate:

```ruby
when "rating-desc"
  scope
    .joins("LEFT JOIN group_estates ge_r ON ge_r.estate_id = estates.id AND ge_r.group_id = #{@group.id} AND ge_r.deleted_at IS NULL")
    .joins("LEFT JOIN estate_ratings er_sort ON er_sort.group_estate_id = ge_r.id")
    .group("estates.id")
    .order("AVG(er_sort.rating) DESC NULLS LAST")
when "rating-asc"
  scope
    .joins("LEFT JOIN group_estates ge_r ON ge_r.estate_id = estates.id AND ge_r.group_id = #{@group.id} AND ge_r.deleted_at IS NULL")
    .joins("LEFT JOIN estate_ratings er_sort ON er_sort.group_estate_id = ge_r.id")
    .group("estates.id")
    .order("AVG(er_sort.rating) ASC NULLS LAST")
```

[ASSUMED — exact SQL form; must be validated against SQLite3 test DB compatibility]

---

## Common Pitfalls

### Pitfall 1: Current.brokerage Not Set When Calling TokenService.issue
**What goes wrong:** JWT payload has `role: nil` — the test user appears to have no role, causing `require_admin!` to always reject.
**Why it happens:** `TokenService.issue` queries `BrokerageMembership.find_by(user_id: user.id, brokerage_id: Current.brokerage&.id)`. If `Current.brokerage` is nil, `brokerage_id` is nil, no membership is found, role is nil.
**How to avoid:** Always set `Current.brokerage` before calling `TokenService.issue`. Set both `Current.brokerage` and `Current.user` in `AuthHelper#auth_headers_for`.
**Warning signs:** Tests that should pass as `owner` return 403.

### Pitfall 2: Host Header Not Set in Integration Tests
**What goes wrong:** `BrokerageAuth#resolve_brokerage` raises `ActiveRecord::RecordNotFound` → Rails returns a 404 JSON error before any controller action runs.
**Why it happens:** `BrokerageAuth` looks up `BrokerageDomain.find_by(domain: request.host.downcase)`. The default Rails test host is `www.example.com` which has no `BrokerageDomain` record.
**How to avoid:** Use `host!` or set `"Host"` header on every test request. Seed a `BrokerageDomain` for `www.example.com` OR always set the host to a seeded domain.
**Warning signs:** All integration tests return 404 with "Brokerage not found".

### Pitfall 3: acts_as_paranoid Soft Delete Scoping in Tests
**What goes wrong:** Tests that create soft-deleted records may have those records return in queries if the `.without_deleted` scope is not applied.
**Why it happens:** `acts_as_paranoid` default behavior adds `WHERE deleted_at IS NULL` via `default_scope`. But test setup using `create!` followed by `destroy!` (soft delete) may still appear in `.all` if code misses the scope.
**How to avoid:** Test isolation via transaction rollback is fine — `deleted_at IS NULL` filtering is handled at the application level. Focus on testing the "happy path" where records are not deleted.
**Warning signs:** N+1 tests pass locally but fail on CI with different seed data.

### Pitfall 4: Vitest + @testing-library/react v13 act() Warnings
**What goes wrong:** State updates in tests produce `Warning: An update to X inside a test was not wrapped in act(...)` — and some assertions fail intermittently.
**Why it happens:** `@testing-library/react@13` does not fully support React 18's concurrent rendering mode.
**How to avoid:** Upgrade to `@testing-library/react@^16` as part of the Vitest setup task.
**Warning signs:** Console warns about `act()` on every async test.

### Pitfall 5: MSW 2.x onUnhandledRequest Throws by Default
**What goes wrong:** A test makes a real network request that MSW hasn't handled — MSW throws an error and the test fails with a confusing message.
**Why it happens:** MSW 2.x `server.listen({ onUnhandledRequest: 'error' })` throws on any unhandled request.
**How to avoid:** Set `{ onUnhandledRequest: 'warn' }` initially while discovering which requests need handlers. Switch to `'error'` once all requests are mocked.
**Warning signs:** Tests fail with `"MSW: Unhandled GET request to /some-url"`.

### Pitfall 6: ProtectedRoute uses localStorage — Must Be Mocked in Tests
**What goes wrong:** `ProtectedRoute` calls `isAuthenticated()` which reads `localStorage.getItem('auth_token')`. jsdom provides localStorage but it persists between tests in the same file unless cleared.
**Why it happens:** jsdom's `localStorage` is shared within a test file. If a previous test sets a token, the next test starts authenticated.
**How to avoid:** Clear `localStorage` in `beforeEach` or use `afterEach(() => localStorage.clear())`. To test the "unauthenticated" case: clear localStorage; to test "authenticated": set a valid-looking JWT in `localStorage.setItem('auth_token', mockJwt)`.
**Warning signs:** Redirect tests pass individually but fail in suite.

### Pitfall 7: RequireRole Reads Redux State — Must Pre-Seed Store
**What goes wrong:** `RequireRole` renders `null` (not a redirect) when `isUserLoaded` is false. Test asserts redirect but gets nothing.
**Why it happens:** `useRole()` returns `{ role: null, isUserLoaded: false }` when `account.id === ''` (the initial Redux state). The component returns `null` until the user is loaded.
**How to avoid:** Pre-populate the Redux store in `renderWithProviders` with a user that has a defined role. Pass `preloadedState` to `configureStore`.
**Warning signs:** RequireRole tests show nothing rendered — neither children nor redirect.

---

## Code Examples

### Backend Test Helper Setup

```ruby
# Source: factory_bot_rails + shoulda-matchers official config pattern
# test/test_helper.rb
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "factory_bot_rails"
require "shoulda/matchers"

Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :minitest
    with.library :rails
  end
end

class ActiveSupport::TestCase
  include FactoryBot::Syntax::Methods

  teardown do
    Current.reset
  end
end

module AuthHelper
  def with_auth(user, brokerage)
    Current.brokerage = brokerage
    Current.user = user
    token = TokenService.issue(user)
    { "Authorization" => "Bearer #{token}", "Host" => brokerage.brokerage_domains.first.domain }
  ensure
    Current.reset
  end
end

class ActionDispatch::IntegrationTest
  include AuthHelper
end
```

### Example Factory

```ruby
# Source: factory_bot_rails documentation pattern
# test/factories/users.rb
FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    first_name { "Test" }
    last_name  { "User" }
    cognito_sub { SecureRandom.uuid }
    uid         { SecureRandom.uuid }
  end
end

# test/factories/brokerage_memberships.rb
FactoryBot.define do
  factory :brokerage_membership do
    user
    brokerage
    role { "agent" }

    trait :owner   { role { "owner" } }
    trait :admin   { role { "admin" } }
    trait :agent   { role { "agent" } }
    trait :client  { role { "client" } }
  end
end
```

### Example Integration Test — Tenant Isolation

```ruby
# Source: Rails ActionDispatch::IntegrationTest pattern
# test/integration/tenant_isolation_test.rb
class TenantIsolationTest < ActionDispatch::IntegrationTest
  setup do
    @brokerage_a = create(:brokerage)
    @domain_a    = create(:brokerage_domain, brokerage: @brokerage_a, domain: "a.example.com")
    @brokerage_b = create(:brokerage)
    @domain_b    = create(:brokerage_domain, brokerage: @brokerage_b, domain: "b.example.com")
    @user_a      = create(:user)
    create(:brokerage_membership, :owner, user: @user_a, brokerage: @brokerage_a)
  end

  test "user from brokerage A cannot access brokerage B endpoints" do
    headers = with_auth(@user_a, @brokerage_a).merge("Host" => @domain_b.domain)
    get "/v1/admin/users", headers: headers
    assert_includes [403, 404], response.status
  end
end
```

### Vitest Config

```typescript
// Source: Vitest 4.x documentation
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  }
})
```

### MSW 2.x Setup File

```typescript
// Source: MSW 2.x documentation
// src/test/setup.ts
import '@testing-library/jest-dom'
import { server } from './server'
import { afterAll, afterEach, beforeAll } from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
afterEach(() => localStorage.clear())
```

### ProtectedRoute Test

```typescript
// Source: @testing-library/react pattern + ProtectedRoute code analysis
import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ProtectedRoute from '@/components/common/guards/ProtectedRoute'
import { renderWithProviders } from '@/test/renderWithProviders'

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    localStorage.clear() // ensure no token
    renderWithProviders(<ProtectedRoute />, { route: '/dashboard' })
    // MemoryRouter + Navigate should redirect — check URL changed
    // Since MemoryRouter is used, verify the rendered output shows login
  })

  it('renders outlet for authenticated users', () => {
    // Create a JWT with exp in the future
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    localStorage.setItem('auth_token', `header.${payload}.sig`)
    renderWithProviders(<ProtectedRoute />, { route: '/dashboard' })
    // Outlet renders — no redirect
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MSW `rest.get(url, (req, res, ctx) => res(ctx.json(...)))` | `http.get(url, () => HttpResponse.json(...))` | MSW 2.0 (2023) | Complete API rewrite — no backward compat |
| `@testing-library/react` v13 (CRA era) | v14+ (Vite/Vitest compatible) | 2023 | Drops CRA-specific wrappers; React 18 concurrent mode |
| Jest in CRA projects | Vitest in Vite projects | 2022-present | Vitest is faster, native ESM, no Babel needed |
| `wrapper` option in `render()` | `renderWithProviders` helper | Ongoing | Explicit helper is more readable and testable |

**Deprecated/outdated:**
- `@types/jest`: Replace with `@vitest/globals` or `globals: true` in vitest config — `@types/jest` types conflict with Vitest
- `react-app/jest` eslint config: Remove from `package.json` `eslintConfig` — not needed with Vitest
- `rest` namespace from MSW: Removed in MSW 2.0 — use `http` namespace

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rating sort SQL (LEFT JOIN group_estates + estate_ratings + GROUP BY estates.id) is compatible with SQLite3 test DB | Critical Finding: TEST-05 | SQLite3 has different NULLS LAST handling than PostgreSQL — test may need adjustment |
| A2 | `DatabaseCleaner` gem is not needed — Rails default transactional fixtures handle rollback including `insert_all` in SQLite3 test DB | Architecture Patterns (anti-patterns) | If `insert_all` breaks transaction rollback, FilterSets test will leave dirty data |
| A3 | `vi.mock('aws-amplify/auth')` with the module factory approach correctly intercepts the imports in GoogleSignInButton.tsx | Code Examples — Amplify mocking | If Amplify uses a non-standard module resolution, the mock may not apply |
| A4 | The Hub signInWithRedirect listener pattern in GoogleSignInButton can be tested by directly invoking the Hub.listen callback | Architecture Patterns — GoogleSignInButton | If Hub.listen is not mockable via vi.mock, test approach must change to fire a synthetic event |

---

## Open Questions

1. **TEST-05 rating sort: add to query or test filter instead?**
   - What we know: `apply_sort` has no rating case; `filter_by_min_user_rating` exists
   - What's unclear: Whether the requirement means testing filter capability OR adding a new sort case
   - Recommendation: Add `rating-desc`/`rating-asc` sort cases to `GroupEstatesQuery` and test both — this is the literal reading of TEST-05 and adds real value

2. **TEST-09 GoogleSignInButton: minimal stub vs. full Phase 4 component?**
   - What we know: The component does not exist; Phase 4 implements full OAuth; TEST-09 only requires the click behavior and Hub listener
   - What's unclear: How much Phase 4 logic to anticipate here
   - Recommendation: Build the minimal component (button + click handler + Hub listener) that satisfies TEST-09. Phase 4 will replace it with the polished version. Mark the file clearly as a Phase 4 target.

3. **Transaction-based test isolation for FilterSets (insert_all)?**
   - What we know: `FilterSetsController` uses `GroupEstate.insert_all(rows)` which bypasses AR callbacks
   - What's unclear: Whether Rails test transaction wrapping rolls back `insert_all` correctly in SQLite3
   - Recommendation: Use `DatabaseCleaner` with truncation strategy for the FilterSets integration test only, or just wrap setup in an explicit `GroupEstate.delete_all` teardown

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ruby 4.0.2 | Backend tests | ✓ | 4.0.2 (rbenv) | — |
| SQLite3 CLI | Test DB inspection | ✓ | 3.46.1 | — |
| SQLite3 gem | Test DB (already in Gemfile) | ✓ | >= 1.4 | — |
| Node.js | Frontend tests | ✓ | v22.9.0 | — |
| npm | Package installation | ✓ | (via node) | — |
| webmock | Backend HTTP stubbing (already in Gemfile) | ✓ | current | — |
| factory_bot_rails | Test data | ✗ (not in Gemfile yet) | 6.5.1 | None — must install |
| shoulda-matchers | Model matchers | ✗ (not in Gemfile yet) | 7.0.1 | None — must install |
| vitest | Frontend test runner | ✗ (not in package.json) | 4.1.5 | None — must install |
| jsdom | DOM environment for Vitest | ✗ (not in package.json) | 25.x | None — must install |
| msw | API mocking | ✗ (not in package.json) | 2.14.2 | None — must install |

**Missing dependencies with no fallback:**
- `factory_bot_rails` (6.5.1) — required for TEST-01; no viable alternative
- `shoulda-matchers` (7.0.1) — required for TEST-01
- `vitest` + `jsdom` + `msw` — required for TEST-07 through TEST-09

**Note:** The frontend already has `@testing-library/react@^13.4.0` and `@types/jest@^29`. These will be upgraded/removed as part of Vitest setup. `@types/node@^18` must be upgraded to `@types/node@^20` to satisfy Vitest 4.x peer dependency.

---

## Sources

### Primary (HIGH confidence)
- Backend codebase: `TokenService`, `CognitoAuth`, `BrokerageAuth`, `V1::Admin::BaseController`, `Current`, `GroupEstatesQuery`, `FilterSetsController` — all read directly
- `backend/config/database.yml` — test env uses SQLite3 confirmed
- `backend/Gemfile` — factory_bot_rails and shoulda-matchers NOT present; webmock and sqlite3 ARE present
- `frontend/package.json` — vitest/msw NOT present; @testing-library/react@^13 present
- `frontend/src/components/common/guards/ProtectedRoute.tsx` — uses `isAuthenticated()` from localStorage
- `frontend/src/components/common/guards/RequireRole.tsx` — uses `useRole()` from Redux state
- `frontend/src/store/reducers/account.ts` — `account.id === ''` means user not loaded
- `frontend/src/lib/auth.ts` — `isAuthenticated()` checks localStorage `auth_token` + JWT exp
- `frontend/src/config/amplify.ts` — Amplify v6 configured with `loginWith.oauth`
- `npm view vitest version` → 4.1.5 [VERIFIED]
- `npm view msw dist-tags` → latest: 2.14.2 [VERIFIED]
- `gem search factory_bot_rails` → 6.5.1 [VERIFIED]
- `gem search shoulda-matchers` → 7.0.1 [VERIFIED]
- `npm view @testing-library/react@16` peerDependencies → React 18 compatible [VERIFIED]

### Secondary (MEDIUM confidence)
- Vitest 4.x peer dependency requires `@types/node@^20` (not @18) — confirmed via `npm view vitest peerDependencies`
- MSW 2.x breaking API change from `rest` to `http` namespace — confirmed via dist-tag check

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm/gem registry
- Architecture: HIGH — codebase fully read, controller/concern/model relationships verified
- Pitfalls: HIGH — most derived directly from codebase analysis (Current.brokerage + TokenService interaction, localStorage localStorage clearing, Redux preloaded state)
- TEST-05 rating sort gap: HIGH — verified by reading full apply_sort method

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (30 days — stack is stable)

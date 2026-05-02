# Phase 2: Test Suite - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 23 (new/modified files across backend and frontend)
**Analogs found:** 14 / 23 (9 have no codebase analog — infrastructure is net-new)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/Gemfile` (add gems) | config | — | `backend/Gemfile` itself | self-modify |
| `backend/test/test_helper.rb` | test-config | request-response | `backend/app/services/token_service.rb` (JWT pattern) + `backend/app/controllers/concerns/cognito_auth.rb` | partial |
| `backend/test/factories/users.rb` | test-data | — | `backend/app/models/user.rb` (schema reference) | no analog (net-new) |
| `backend/test/factories/brokerages.rb` | test-data | — | no analog | no analog |
| `backend/test/factories/brokerage_domains.rb` | test-data | — | `backend/app/controllers/concerns/brokerage_auth.rb` (domain pattern) | partial |
| `backend/test/factories/brokerage_memberships.rb` | test-data | — | `backend/app/controllers/v1/admin/base_controller.rb` (role names) | partial |
| `backend/test/factories/groups.rb` | test-data | — | no analog | no analog |
| `backend/test/factories/estates.rb` | test-data | — | no analog | no analog |
| `backend/test/factories/group_estates.rb` | test-data | — | no analog | no analog |
| `backend/test/factories/group_filter_sets.rb` | test-data | — | no analog | no analog |
| `backend/test/factories/invitations.rb` | test-data | — | no analog | no analog |
| `backend/test/integration/tenant_isolation_test.rb` | test | request-response | `backend/app/controllers/concerns/brokerage_auth.rb` + `cognito_auth.rb` | partial |
| `backend/test/integration/admin_authorization_test.rb` | test | request-response | `backend/app/controllers/v1/admin/base_controller.rb` | partial |
| `backend/test/integration/filter_sets_test.rb` | test | CRUD | `backend/app/controllers/v1/admin/group/filter_sets_controller.rb` | partial |
| `backend/test/integration/group_estates_query_test.rb` | test | CRUD+transform | `backend/app/queries/group_estates_query.rb` | partial |
| `backend/test/integration/invitations_test.rb` | test | request-response | `backend/app/controllers/v1/dashboard/invitations_controller.rb` | partial |
| `backend/app/queries/group_estates_query.rb` (modify) | query | CRUD+transform | self (existing `apply_sort`) | exact |
| `frontend/package.json` (modify) | config | — | `frontend/vite.config.ts` (Vite ecosystem) | partial |
| `frontend/vitest.config.ts` | config | — | `frontend/vite.config.ts` | role-match |
| `frontend/src/test/setup.ts` | test-config | — | no analog | no analog |
| `frontend/src/test/server.ts` | test-config | request-response | no analog | no analog |
| `frontend/src/test/renderWithProviders.tsx` | test-utility | — | `frontend/src/main.jsx` (provider setup) + `frontend/src/store/storeProvider.tsx` | partial |
| `frontend/src/components/auth/GoogleSignInButton.tsx` | component | event-driven | `frontend/src/components/common/buttons/StepControls/StepControls.tsx` + `frontend/src/containers/auth/CreateAccount.tsx` | role-match |
| `frontend/src/components/common/guards/ProtectedRoute.test.tsx` | test | request-response | `frontend/src/components/common/guards/ProtectedRoute.tsx` (unit under test) | partial |
| `frontend/src/components/common/guards/RequireRole.test.tsx` | test | request-response | `frontend/src/components/common/guards/RequireRole.tsx` (unit under test) | partial |
| `frontend/src/components/auth/GoogleSignInButton.test.tsx` | test | event-driven | `frontend/src/containers/auth/CreateAccount.tsx` (Amplify usage) | partial |

---

## Pattern Assignments

### `backend/test/test_helper.rb` (test-config, request-response)

**Analog sources:** `backend/app/services/token_service.rb`, `backend/app/controllers/concerns/cognito_auth.rb`, `backend/app/controllers/v1/admin/base_controller.rb`

**TokenService.issue pattern** — from `backend/app/services/token_service.rb` lines 8-22:
```ruby
def issue(user)
  role = BrokerageMembership
    .find_by(user_id: user.id, brokerage_id: Current.brokerage&.id)
    &.role

  payload = {
    sub: user.uid,
    email: user.email,
    role: role,
    iat: Time.now.to_i,
    exp: EXPIRY_DURATION.from_now.to_i
  }

  JWT.encode(payload, secret, ALGORITHM)
end
```

**Critical constraint:** `Current.brokerage` MUST be set before calling `TokenService.issue(user)`. The service reads `Current.brokerage&.id` on line 10 to look up the membership. Without it, `role` is nil and all `require_admin!` checks fail with 403.

**AuthHelper — auth_headers_for pattern:**
```ruby
module AuthHelper
  def auth_headers_for(user, brokerage)
    Current.brokerage = brokerage
    Current.user = user
    token = TokenService.issue(user)
    {
      "Authorization" => "Bearer #{token}",
      "Host" => brokerage.brokerage_domains.first.domain
    }
  ensure
    Current.reset  # always reset even if TokenService raises
  end
end
```

**Current.reset teardown pattern** — `Current < ActiveSupport::CurrentAttributes`; `Current.reset` is the documented method to clear all attributes:
```ruby
class ActiveSupport::TestCase
  include FactoryBot::Syntax::Methods

  teardown do
    Current.reset
  end
end

class ActionDispatch::IntegrationTest
  include AuthHelper
end
```

**shoulda-matchers config pattern:**
```ruby
Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :minitest
    with.library :rails
  end
end
```

---

### `backend/test/factories/*.rb` (test-data)

**No direct codebase analog** — factories are net-new. Derive field names from the codebase objects they represent.

**Role names for `brokerage_memberships` factory** — from `backend/app/controllers/v1/admin/base_controller.rb` lines 18:
```ruby
%w[owner admin]  # allowed roles for admin access
# Full role set: "owner", "admin", "agent", "client"
```

**BrokerageAuth domain lookup pattern** — from `backend/app/controllers/concerns/brokerage_auth.rb` lines 15-18:
```ruby
domain_record = BrokerageDomain
  .includes(:brokerage)
  .find_by(domain: domain)
# domain is request.host.downcase — factories must produce real domains
```

**Factory trait pattern for roles** (from RESEARCH.md Pattern section):
```ruby
FactoryBot.define do
  factory :brokerage_membership do
    user
    brokerage
    role { "agent" }

    trait :owner  { role { "owner" } }
    trait :admin  { role { "admin" } }
    trait :agent  { role { "agent" } }
    trait :client { role { "client" } }
  end
end
```

**User factory field names** — from `frontend/src/assets/types/userType.ts` and `backend/app/services/token_service.rb` (uses `user.uid` and `user.email`):
```ruby
FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    first_name { "Test" }
    last_name  { "User" }
    cognito_sub { SecureRandom.uuid }
    uid         { SecureRandom.uuid }
  end
end
```

---

### `backend/test/integration/tenant_isolation_test.rb` (test, request-response)

**Analog:** `backend/app/controllers/concerns/brokerage_auth.rb` + `backend/app/controllers/concerns/cognito_auth.rb`

**BrokerageAuth failure path** — from `brokerage_auth.rb` lines 19:
```ruby
raise ActiveRecord::RecordNotFound, "Brokerage not found for domain: #{domain}" unless domain_record
# Rails translates RecordNotFound to 404 — test must assert [403, 404]
```

**CognitoAuth membership check** — from `cognito_auth.rb` lines 22-27:
```ruby
if Current.brokerage.present? && !skip_brokerage_membership?
  unless BrokerageMembership.exists?(user_id: Current.user.id, brokerage_id: Current.brokerage.id)
    render json: {error: "You are not a member of this brokerage", next_step: "no-access"}, status: :forbidden
    return
  end
end
```

**Host header integration test pattern:**
```ruby
class TenantIsolationTest < ActionDispatch::IntegrationTest
  setup do
    @brokerage_a = create(:brokerage)
    @domain_a    = create(:brokerage_domain, brokerage: @brokerage_a, domain: "a.example.com")
    @brokerage_b = create(:brokerage)
    @domain_b    = create(:brokerage_domain, brokerage: @brokerage_b, domain: "b.example.com")
    @user_a      = create(:user)
    create(:brokerage_membership, :owner, user: @user_a, brokerage: @brokerage_a)
  end

  test "brokerage A JWT against brokerage B host is rejected" do
    # auth_headers_for sets Host to brokerage_a domain; override Host to brokerage_b
    headers = auth_headers_for(@user_a, @brokerage_a).merge("Host" => @domain_b.domain)
    get "/v1/admin/users", headers: headers
    assert_includes [403, 404], response.status
  end
end
```

---

### `backend/test/integration/admin_authorization_test.rb` (test, request-response)

**Analog:** `backend/app/controllers/v1/admin/base_controller.rb`

**require_admin! implementation** — from `base_controller.rb` lines 13-21:
```ruby
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
```

**Response shape for 403** — JSON body has `{ error: { code: "forbidden", message: "..." } }`. Tests must assert both status AND body shape:
```ruby
assert_response :forbidden
body = JSON.parse(response.body)
assert_equal "forbidden", body.dig("error", "code")
```

**Admin controller inheritance chain** — all admin controllers inherit `V1::Admin::BaseController` which includes `BrokerageAuth`, `CognitoAuth`, and calls `before_action :require_admin!`. Testing one admin endpoint (e.g., `GET /v1/admin/users`) is sufficient to prove the before_action fires.

---

### `backend/test/integration/filter_sets_test.rb` (test, CRUD)

**Analog:** `backend/app/controllers/v1/admin/group/filter_sets_controller.rb`

**FilterSets#create critical path** — from `filter_sets_controller.rb` lines 39-68:
```ruby
def create
  previous_active_id = nil
  ActiveRecord::Base.transaction do
    @group.lock!
    previous_active_id = @group.group_filter_sets.active.pick(:id)
    @filter_set = @group.group_filter_sets.create!(name: filter_set_params[:name])
    build_filters(@filter_set, filter_set_params[:filters])
  end

  populated = populate_group_estates!(@filter_set, replacing_filter_set_id: previous_active_id)

  # Group-scoped cleanup — SEC-07 fix
  if previous_active_id && !GroupFilterSet.where(id: previous_active_id, active: true).exists?
    GroupEstate.where(group: @group, group_filter_set_id: previous_active_id).destroy_all
  end
  # ...
end
```

**What the test must verify:** After calling `POST /v1/admin/groups/:group_id/filter_sets`, the old active filter set's `GroupEstate` rows for `@group` are destroyed. Rows for OTHER groups must NOT be touched (cross-group safety — SEC-07).

**Transaction note:** `GroupEstate.insert_all` is used inside `populate_group_estates!`. If Rails transaction rollback does not cover `insert_all` in the SQLite3 test env, use explicit teardown: `GroupEstate.delete_all` in the test teardown block.

---

### `backend/test/integration/group_estates_query_test.rb` (test, CRUD+transform)

**Analog:** `backend/app/queries/group_estates_query.rb`

**Price range filter pattern** — from `group_estates_query.rb` lines 118-127:
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

**Existing sort cases** — from `group_estates_query.rb` lines 283-302:
```ruby
def apply_sort(scope)
  case @params[:sort_by]
  when "activity-desc" ...
  when "activity-asc"  ...
  when "date-added-asc" ...
  when "price-asc"
    scope.joins(:listing_detail).order("listing_details.price_numeric ASC NULLS LAST")
  when "price-desc"
    scope.joins(:listing_detail).order("listing_details.price_numeric DESC NULLS LAST")
  when "size-asc"  ...
  when "size-desc" ...
  else
    scope.order(Arel.sql("group_estates.created_at DESC"))
  end
end
```

**Rating sort addition — copy this exact pattern** for new `rating-desc` / `rating-asc` cases. The SQL must use LEFT JOIN (not INNER JOIN) so estates with zero ratings still appear. `NULLS LAST` puts unrated estates at the bottom. The join aliases (`ge_r`, `er_sort`) avoid collisions with the `includes(:group_estates, :estate_ratings)` already on the scope:
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

**SQLite3 compatibility note:** `NULLS LAST` is supported in SQLite 3.30.0+ (project uses 3.46.1 — confirmed safe). The `GROUP BY estates.id` is required when using `AVG()` aggregate. `@group.id` is interpolated directly — this is safe because `@group` is always a trusted AR object fetched from `Current.brokerage`.

**Query call pattern** — from `group_estates_query.rb` lines 1-6:
```ruby
GroupEstatesQuery.new(group, current_user, params).call
# Both current_user AND group are required — filter_by_min_user_rating uses @current_user.id
```

---

### `backend/test/integration/invitations_test.rb` (test, request-response)

**Analog:** `backend/app/controllers/v1/dashboard/invitations_controller.rb`

**Invitations controller auth setup** — from `invitations_controller.rb` lines 3-13:
```ruby
class InvitationsController < ApplicationController
  include CognitoAuth
  include BrokerageAuth
  include Pagy::Backend

  before_action :authenticate_cognito_user!, except: [:validate_token]
  before_action :set_invitation, only: [:show, :accept, :decline]

  def skip_brokerage_membership?
    action_name == "accept_token"
  end
```

**accept_token success path** — from `invitations_controller.rb` lines 74-112:
```ruby
def accept_token
  user = Current.user
  brokerage = Current.brokerage
  invite_token = params[:invite_token].to_s

  invitation = Invitation.find_by(token: invite_token, brokerage_id: brokerage&.id)
  # ...
  BrokerageMembership.find_or_create_by!(user_id: user.id, brokerage_id: brokerage.id) do |m|
    m.role = invitation.role
  end
  # ...
  render json: {message: "Invitation accepted", next_step: next_step}, status: :ok
end
```

**Test must verify:** `POST /v1/dashboard/invitations/accept_token` with valid `invite_token` param returns 200. This proves the Phase 1 `Current.user` crash fix holds (pre-fix used `current_user` method which doesn't exist).

---

### `backend/app/queries/group_estates_query.rb` (modify — add rating sort)

**Analog:** self — copy the `price-asc`/`price-desc` sort case pattern exactly, adapting for rating aggregation.

**Insertion point** — add after `when "size-desc"` block at line 298, before the `else` at line 299:

```ruby
# ADD THESE TWO CASES before the `else` default:
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

---

### `frontend/vitest.config.ts` (config, —)

**Analog:** `frontend/vite.config.ts`

**Vite config structure to copy** — from `frontend/vite.config.ts` lines 1-21:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// The existing vite.config.ts uses async dynamic import for tailwindcss.
// vitest.config.ts does NOT need tailwindcss — keep it synchronous.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  }
  // ...
})
```

**`@` alias must be reproduced** — `frontend/vite.config.ts` line 12 uses `path.resolve(__dirname, 'src')`. The vitest config must duplicate this so `@/` imports resolve in tests.

**Vitest-specific additions:**
```typescript
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

---

### `frontend/src/test/renderWithProviders.tsx` (test-utility, —)

**Analog:** `frontend/src/main.jsx` (provider tree) + `frontend/src/store/storeProvider.tsx` + `frontend/src/store/reducers/index.tsx`

**Provider tree from `frontend/src/main.jsx`** lines 14-21:
```jsx
<QueryClientProvider client={queryClient}>
  <StoreProvider>       // wraps Redux Provider
    <RouterProvider ... />
  </StoreProvider>
</QueryClientProvider>
```

**Redux store configuration** — from `frontend/src/store/reducers/index.tsx` lines 6-13:
```typescript
const reducer = {
  account: accountReducer,
  createBrokerageWizard: createBrokerageWizardReducer,
  tempBrokerage: tempBrokerageReducer
}
export const store = configureStore({ reducer })
```

**renderWithProviders must:**
1. Create a fresh `QueryClient` per call (`retry: false` prevents hanging on failed queries)
2. Create a fresh Redux store per call (prevents state bleed between tests)
3. Accept `preloadedState` to let tests seed Redux state (required for RequireRole test — must set `account.id` to non-empty and `account.membership.role` to a value)
4. Use `MemoryRouter` (not `BrowserRouter`) for isolated routing

```typescript
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import accountReducer from '@/store/reducers/account'
import createBrokerageWizardReducer from '@/store/reducers/createBrokerageWizard'
import tempBrokerageReducer from '@/store/reducers/tempBrokerage'

export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/', preloadedState = {} } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  const store = configureStore({
    reducer: {
      account: accountReducer,
      createBrokerageWizard: createBrokerageWizardReducer,
      tempBrokerage: tempBrokerageReducer,
    },
    preloadedState
  })

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

---

### `frontend/src/test/setup.ts` + `frontend/src/test/server.ts` (test-config)

**No codebase analog** — net-new. Copy MSW 2.x pattern from RESEARCH.md verbatim.

**setup.ts pattern:**
```typescript
import '@testing-library/jest-dom'
import { server } from './server'
import { afterAll, afterEach, beforeAll } from 'vitest'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
afterEach(() => localStorage.clear())  // prevents ProtectedRoute token bleed
```

**server.ts pattern — use `http` namespace, not `rest`:**
```typescript
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const server = setupServer(
  http.post('/v1/sessions', () => {
    return HttpResponse.json({ token: 'mock-jwt-token' })
  })
)
```

---

### `frontend/src/components/auth/GoogleSignInButton.tsx` (component, event-driven)

**Analog:** `frontend/src/components/common/buttons/StepControls/StepControls.tsx` (button structure) + `frontend/src/containers/auth/CreateAccount.tsx` (Amplify auth pattern)

**Button component import pattern** — from `StepControls.tsx` lines 1-3:
```typescript
import React from 'react'
import { Button } from '@/components/ui/button'
```

**Amplify auth import pattern** — from `CreateAccount.tsx` lines 1-6:
```typescript
import {
  confirmSignUp,
  resendSignUpCode,
  signUp
} from 'aws-amplify/auth'
// GoogleSignInButton needs: signInWithRedirect, fetchAuthSession, Hub
```

**Amplify v6 sub-path import** — always import from `'aws-amplify/auth'`, not `'aws-amplify'`. The Hub import is at `'aws-amplify/utils'` in v6.

**Minimal GoogleSignInButton** (testable skeleton — Phase 4 replaces with polished UI):
```typescript
import { useEffect } from 'react'
import { signInWithRedirect, fetchAuthSession } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { Button } from '@/components/ui/button'

// TODO Phase 4: replace with polished Google-branded button + full OAuth UI
const GoogleSignInButton = () => {
  useEffect(() => {
    const unlisten = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        fetchAuthSession().then((session) => {
          const idToken = session.tokens?.idToken?.toString()
          if (idToken) {
            // POST /v1/sessions with idToken — session exchange
          }
        })
      }
    })
    return unlisten
  }, [])

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => signInWithRedirect({ provider: 'Google' })}
    >
      Sign in with Google
    </Button>
  )
}

export default GoogleSignInButton
```

**Button variant to use:** `variant="outline"` — matches the pattern in `StepControls.tsx` line 21 for secondary/social actions.

---

### `frontend/src/components/common/guards/ProtectedRoute.test.tsx` (test, request-response)

**Analog:** `frontend/src/components/common/guards/ProtectedRoute.tsx`

**ProtectedRoute implementation** — full file (`ProtectedRoute.tsx` lines 1-14):
```typescript
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'

const ProtectedRoute = () => {
  const location = useLocation()
  if (!isAuthenticated()) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }
  return <Outlet />
}
```

**`isAuthenticated()` implementation** — from `frontend/src/lib/auth.ts` lines 18-23:
```typescript
export const isAuthenticated = (): boolean => {
  const token = getToken()  // localStorage.getItem('auth_token')
  if (!token) return false
  const payload = decodePayload(token)
  return typeof payload?.exp === 'number' && payload.exp > Date.now() / 1000
}
```

**Test requires localStorage control.** Mock a valid token by constructing a JWT with `exp` in the future:
```typescript
const futureJwt = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.sig`
localStorage.setItem('auth_token', futureJwt)
```

**Redirect target:** `<Navigate to="/auth/login" ...>` — test must confirm the component renders this route (or the redirect destination appears in the MemoryRouter output).

---

### `frontend/src/components/common/guards/RequireRole.test.tsx` (test, request-response)

**Analog:** `frontend/src/components/common/guards/RequireRole.tsx`

**RequireRole implementation** — full file (`RequireRole.tsx` lines 1-24):
```typescript
const RequireRole = ({ roles, redirectTo = '/', children }: RequireRoleProps) => {
  const { role, isUserLoaded } = useRole()
  if (!isUserLoaded) return null
  if (!role || !roles.includes(role)) {
    return <Navigate to={redirectTo} replace />
  }
  return <>{children}</>
}
```

**useRole Redux dependency** — from `frontend/src/store/hooks/Auth/useRole.ts`:
```typescript
const useRole = () => {
  const account = useAppSelector((state) => state.account)
  return {
    role: account.membership?.role ?? null,
    isUserLoaded: account.id !== '',  // empty string = user not loaded
  }
}
```

**Redux initial state** — from `frontend/src/store/reducers/account.ts` lines 7-12:
```typescript
const initialState: accountType = {
  id: '',  // empty string → isUserLoaded = false → RequireRole returns null
  name: '',
  // ...
}
```

**Test must pre-seed Redux store via `preloadedState`.** Pass to `renderWithProviders`:
```typescript
// Test: role matches → renders children
renderWithProviders(<RequireRole roles={['admin']}><div>Protected</div></RequireRole>, {
  preloadedState: {
    account: { id: 'user-123', name: 'Test', firstName: 'Test', lastName: 'User',
               email: 'test@test.com', membership: { role: 'admin' } }
  }
})

// Test: role doesn't match → navigate to redirectTo
// Test: user not loaded (id = '') → returns null (nothing rendered)
```

---

### `frontend/src/components/auth/GoogleSignInButton.test.tsx` (test, event-driven)

**Analog:** `frontend/src/containers/auth/CreateAccount.tsx` (Amplify usage patterns)

**Amplify sub-path mock target** — from `CreateAccount.tsx` line 3:
```typescript
import { confirmSignUp, resendSignUpCode, signUp } from 'aws-amplify/auth'
// GoogleSignInButton uses: signInWithRedirect, fetchAuthSession (from 'aws-amplify/auth')
// Hub is from 'aws-amplify/utils'
```

**vi.mock pattern for Amplify v6:**
```typescript
import { vi } from 'vitest'

vi.mock('aws-amplify/auth', () => ({
  signInWithRedirect: vi.fn(),
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: { idToken: { toString: () => 'mock-id-token' } }
  }),
}))

vi.mock('aws-amplify/utils', () => ({
  Hub: {
    listen: vi.fn()
  }
}))
```

**Test flow for button click:**
```typescript
import userEvent from '@testing-library/user-event'
import { signInWithRedirect } from 'aws-amplify/auth'

it('calls signInWithRedirect with Google provider on click', async () => {
  renderWithProviders(<GoogleSignInButton />)
  await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }))
  expect(signInWithRedirect).toHaveBeenCalledWith({ provider: 'Google' })
})
```

---

## Shared Patterns

### Current.brokerage + TokenService (backend tests)
**Source:** `backend/app/services/token_service.rb` line 10, `backend/app/controllers/concerns/brokerage_auth.rb` line 21
**Apply to:** All backend integration tests — every call to `auth_headers_for` and every request to an endpoint that uses `BrokerageAuth`

Must always: (1) create a `BrokerageDomain` for the brokerage, (2) set `Current.brokerage` before `TokenService.issue`, (3) set `Host` header to the brokerage's domain on every request.

### Host Header Resolution (backend integration tests)
**Source:** `backend/app/controllers/concerns/brokerage_auth.rb` lines 15-19
**Apply to:** All `ActionDispatch::IntegrationTest` classes

Default Rails test host is `www.example.com`. `BrokerageAuth` will raise `RecordNotFound` (→ 404) unless `Host` header matches a seeded `BrokerageDomain`. Use `auth_headers_for` helper (which includes `Host`) or set `"Host"` explicitly.

### require_admin! Response Shape (backend admin tests)
**Source:** `backend/app/controllers/v1/admin/base_controller.rb` lines 19-21
**Apply to:** `admin_authorization_test.rb`

403 response body is `{ "error": { "code": "forbidden", "message": "..." } }`. Tests must use `body.dig("error", "code")` not `body["error"]`.

### localStorage Isolation (frontend component tests)
**Source:** `frontend/src/lib/auth.ts` lines 3 + 18-23
**Apply to:** `ProtectedRoute.test.tsx`, `GoogleSignInButton.test.tsx`, any test involving `isAuthenticated()`

`setup.ts` already calls `localStorage.clear()` in `afterEach`. Additionally clear at the top of each test block that tests unauthenticated state to be safe against test ordering.

### Redux preloadedState (frontend component tests)
**Source:** `frontend/src/store/reducers/account.ts` lines 7-12, `frontend/src/store/hooks/Auth/useRole.ts`
**Apply to:** `RequireRole.test.tsx`, any test that renders components reading Redux `account` state

Pass `preloadedState` to `renderWithProviders`. An `account.id` of `''` means "not loaded" — `RequireRole` returns null. Set a non-empty `account.id` + `account.membership.role` to simulate a loaded user.

### @vitejs/plugin-react in Test Config
**Source:** `frontend/vite.config.ts` line 3
**Apply to:** `vitest.config.ts`

The React plugin is required so Vitest can transform JSX/TSX. Copy the import from the existing vite.config.ts. Do NOT add the tailwindcss plugin — it is not needed in test context.

### `@` Alias Reproduction
**Source:** `frontend/vite.config.ts` lines 11-13
**Apply to:** `vitest.config.ts`

```typescript
resolve: { alias: { '@': path.resolve(__dirname, 'src') } }
```

This must be in vitest.config.ts. Without it, all `@/` imports in test files fail to resolve.

---

## No Analog Found

Files where the codebase has no existing test infrastructure to copy patterns from (planner should use RESEARCH.md patterns directly):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/test/factories/groups.rb` | test-data | — | No factories exist in codebase |
| `backend/test/factories/estates.rb` | test-data | — | No factories exist in codebase |
| `backend/test/factories/group_estates.rb` | test-data | — | No factories exist in codebase |
| `backend/test/factories/group_filter_sets.rb` | test-data | — | No factories exist in codebase |
| `backend/test/factories/invitations.rb` | test-data | — | No factories exist in codebase |
| `frontend/src/test/setup.ts` | test-config | — | No Vitest setup exists; copy MSW 2.x pattern from RESEARCH.md |
| `frontend/src/test/server.ts` | test-config | request-response | No MSW server exists; use `http` + `HttpResponse` from `msw` (2.x API) |

---

## Metadata

**Analog search scope:** `backend/app/`, `backend/test/` (empty), `frontend/src/`
**Files scanned:** 22
**Key codebase reads:** `token_service.rb`, `brokerage_auth.rb`, `cognito_auth.rb`, `base_controller.rb` (admin), `group_estates_query.rb`, `filter_sets_controller.rb`, `invitations_controller.rb`, `ProtectedRoute.tsx`, `RequireRole.tsx`, `useRole.ts`, `account.ts` (reducer), `main.jsx`, `vite.config.ts`, `auth.ts`, `amplify.ts`, `button.tsx`, `StepControls.tsx`, `CreateAccount.tsx`
**Pattern extraction date:** 2026-05-02

# Testing Patterns

**Analysis Date:** 2026-04-29

## Current State

**No test suite exists in this codebase.** Neither backend nor frontend has a test directory, test files, or test framework configuration.

- `backend/spec/` — does not exist
- `backend/test/` — does not exist
- `frontend/src/**/*.test.*` — no files found
- `frontend/vitest.config.*` / `frontend/jest.config.*` — no project-level config found
- No CI pipeline found (no `.github/workflows/*.yml` in either repo root)

The `Gemfile` includes `webmock` in the `development, test` group, suggesting backend testing was planned but not implemented.

The `frontend/package.json` includes `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, and `@types/jest` as dependencies, suggesting frontend testing was planned but not implemented.

---

## Planned/Available Infrastructure

Even though no tests exist, the following testing infrastructure is present and ready to use:

### Backend (Rails)

**Gems available (Gemfile):**
- `webmock` — for stubbing HTTP requests (AWS Cognito calls, RETS API calls)
- `faker ~> 3.4` — for generating test data
- `sqlite3 >= 1.4` — for in-memory test database
- `debug` — for debugging

**Standard Rails test tooling:**
- Minitest (built into Rails) — default test framework
- Alternatively, RSpec (`rspec-rails`) can be added — no preference established

**Recommended test setup:**
```bash
# From backend/
RAILS_ENV=test rails db:reset  # Documented in CLAUDE.md
bundle exec rails test          # Minitest (if tests were added)
```

### Frontend

**Packages available (package.json):**
- `@testing-library/react ^13.4.0` — React component testing
- `@testing-library/jest-dom ^5.16.5` — DOM matchers
- `@testing-library/user-event ^13.5.0` — user interaction simulation
- `@types/jest ^29.2.5` — Jest TypeScript types

**No test runner is configured.** To add testing, install and configure Vitest (recommended for Vite projects) or Jest.

---

## Recommended Patterns

When tests are added, follow these patterns based on the codebase architecture:

### Backend — Unit Tests (Query Objects)

Query objects in `backend/app/queries/` are the highest-value test targets. They contain all filtering logic and are pure functions of a scope.

```ruby
# test/queries/group_estates_query_test.rb
require "test_helper"

class GroupEstatesQueryTest < ActiveSupport::TestCase
  setup do
    @brokerage = brokerages(:default)
    @group = groups(:active)
    @user = users(:agent)
  end

  test "filters by city" do
    result = GroupEstatesQuery.new(@group, @user, { cities: ["Vancouver"] }).call
    assert result.all? { |e| e.listing_detail.city == "Vancouver" }
  end

  test "excludes rejected estates" do
    result = GroupEstatesQuery.new(@group, @user, {}).call
    assert_not result.include?(estates(:rejected_by_user))
  end
end
```

### Backend — Controller Tests

Test the JSON response shape and status codes. Use `webmock` to stub Cognito JWT verification.

```ruby
# test/controllers/v1/admin/groups_controller_test.rb
class V1::Admin::GroupsControllerTest < ActionDispatch::IntegrationTest
  setup do
    stub_cognito_auth(users(:admin))
  end

  test "GET /v1/admin/groups returns paginated groups" do
    get "/v1/admin/groups", headers: auth_headers
    assert_response :ok
    json = JSON.parse(response.body)
    assert json.key?("groups")
    assert json.key?("meta")
    assert json.dig("meta", "pagination")
  end
end
```

### Backend — Soft Delete Guards

Tests should verify that soft-deleted records do not leak through:

```ruby
test "deleted estates do not appear in group estates" do
  estate = estates(:active)
  estate.destroy  # soft delete via acts_as_paranoid
  result = GroupEstatesQuery.new(@group, @user, {}).call
  assert_not result.include?(estate)
end
```

### Backend — Serializer Tests

Verify `instance_options` keys are consumed correctly:

```ruby
test "estate serializer uses precomputed user_rating" do
  serialized = EstateSerializer.new(
    estate,
    { user_ratings: { group_estate_id => 4.5 }, group_estate_ids: { estate.id => group_estate_id } }
  ).as_json
  assert_equal 4.5, serialized[:user_rating]
end
```

### Frontend — Hook Tests

Test TanStack Query hooks using `@testing-library/react` with a wrapper providing `QueryClientProvider`:

```typescript
// src/store/hooks/Dashboard/estates/__tests__/useToggleFavorite.test.ts
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useToggleFavorite from '../useToggleFavorite'

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
        {children}
    </QueryClientProvider>
)

test('calls toggleFavorite API on mutate', async () => {
    const { result } = renderHook(() => useToggleFavorite(), { wrapper })
    // ...
})
```

### Frontend — API Module Tests

Mock the axios instance to test API modules in isolation:

```typescript
import fetchGroupEstates from '@/assets/api/dashboard/groups/fetchGroupEstates'
import api from '@/assets/axios/axios'

jest.mock('@/assets/axios/axios')

test('fetchGroupEstates sends snake_case params', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { estates: [], meta: {} } })
    await fetchGroupEstates({ groupId: 'abc', pagination: { page: 1 }, minPrice: '500000' })
    expect(api.get).toHaveBeenCalledWith(
        '/v1/dashboard/groups/abc/estates',
        expect.objectContaining({ params: expect.objectContaining({ min_price: '500000' }) })
    )
})
```

### Frontend — Context Tests

Test the context hook in isolation using `renderHook`:

```typescript
import { renderHook } from '@testing-library/react'
import useGeneralDashboardContext from '@/containers/dashboard/general/GeneralDashboardContext'

test('resets to page 1 when search term changes', async () => {
    const { result } = renderHook(() => useGeneralDashboardContext(), { wrapper })
    act(() => result.current.actions.setListingsPage(3))
    act(() => result.current.actions.setSearchTerm('Vancouver'))
    expect(result.current.state.listingsPage).toBe(1)
})
```

---

## Coverage Priorities

When tests are introduced, prioritize in this order:

1. **Query objects** (`backend/app/queries/`) — pure filter logic, highest bug risk, easiest to test
2. **Soft delete guards** — verify `.without_deleted` is applied correctly on joined tables
3. **Controller response shapes** — verify JSON structure, status codes, pagination meta
4. **Service objects** (`backend/app/services/`) — verify `Result.success?` and transaction rollback
5. **Frontend API modules** (`frontend/src/assets/api/`) — verify param serialization (camelCase → snake_case)
6. **Frontend hooks** — verify query key construction, invalidation on mutation
7. **Frontend contexts** — verify state derivation and filter reset logic

---

## What Should NOT Be Mocked

- The database (use fixtures or factories with a test database)
- The soft-delete behavior — must verify on real AR queries
- `Current.brokerage` / `Current.user` — stub authentication, not the Current object itself

## What MUST Be Mocked/Stubbed

- AWS Cognito JWT verification (`TokenService.verify`) — use `webmock` to stub HTTP calls
- S3 uploads (`S3UploadService`) — stub the AWS SDK
- External RETS API calls (`RetsAuthService`, `RetsPhotoService`) — use `webmock`

---

*Testing analysis: 2026-04-29*

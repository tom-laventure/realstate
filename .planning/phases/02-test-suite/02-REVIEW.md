---
phase: 02-test-suite
reviewed: 2026-05-02T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - backend/Gemfile
  - backend/app/queries/group_estates_query.rb
  - backend/test/factories/brokerage_domains.rb
  - backend/test/factories/brokerage_memberships.rb
  - backend/test/factories/brokerages.rb
  - backend/test/factories/estates.rb
  - backend/test/factories/group_estates.rb
  - backend/test/factories/group_filter_sets.rb
  - backend/test/factories/groups.rb
  - backend/test/factories/invitations.rb
  - backend/test/factories/listing_details.rb
  - backend/test/factories/users.rb
  - backend/test/integration/admin_authorization_test.rb
  - backend/test/integration/filter_sets_test.rb
  - backend/test/integration/group_estates_query_test.rb
  - backend/test/integration/invitations_test.rb
  - backend/test/integration/tenant_isolation_test.rb
  - backend/test/test_helper.rb
  - frontend/package.json
  - frontend/src/components/auth/GoogleSignInButton.test.tsx
  - frontend/src/components/auth/GoogleSignInButton.tsx
  - frontend/src/components/common/guards/ProtectedRoute.test.tsx
  - frontend/src/components/common/guards/RequireRole.test.tsx
  - frontend/src/test/renderWithProviders.tsx
  - frontend/src/test/server.ts
  - frontend/src/test/setup.ts
  - frontend/vitest.config.ts
findings:
  critical: 3
  warning: 7
  info: 3
  total: 13
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

This phase delivered backend Minitest integration tests (factory_bot, shoulda-matchers) and a frontend Vitest unit test suite (MSW 2.x, @testing-library/react). The test infrastructure is structurally sound and follows established project patterns — `renderWithProviders` creates fresh QueryClient and Redux store per test, MSW lifecycle hooks are correct, and the `auth_headers_for` helper properly mints real JWTs via `TokenService`.

However, three blockers exist: a SQL injection vulnerability in the production query under review (`GroupEstatesQuery`) that the test suite fails to catch or flag; a filter-sets test that asserts on a deletion path that is conditionally skipped by the real controller logic (making the test assert a behavior the code does not guarantee); and a ProtectedRoute test that uses a fabricated token format incompatible with the `isAuthenticated()` implementation it is supposed to exercise. Several additional warnings affect test reliability and correctness.

---

## Critical Issues

### CR-01: SQL Injection in `GroupEstatesQuery#apply_sort` — Not Caught by Tests

**File:** `backend/app/queries/group_estates_query.rb:301,307`
**Issue:** The `rating-desc` and `rating-asc` sort branches interpolate `@group.id` directly into a raw SQL string:

```ruby
.joins("LEFT JOIN group_estates ge_r ON ge_r.estate_id = estates.id AND ge_r.group_id = #{@group.id} AND ge_r.deleted_at IS NULL")
```

`@group.id` is an integer produced by ActiveRecord so the injection risk is low in practice, but the pattern is prohibited — any future refactor that passes a non-integer `group_id` (e.g. a UID string) would open a real injection path. More critically, this same query file is under review as a Phase 2 deliverable and the test suite has a `sort_by rating-desc` test that exercises this path without asserting anything about the SQL safety. The test passes while the dangerous pattern ships unchallenged.

**Fix:** Use `Arel.sql` with a parameterised join or bind the integer explicitly:
```ruby
group_id_int = @group.id.to_i
.joins(Arel.sql("LEFT JOIN group_estates ge_r ON ge_r.estate_id = estates.id AND ge_r.group_id = #{group_id_int} AND ge_r.deleted_at IS NULL"))
```
Or restructure to use a subquery with `sanitize_sql_array` as every other filter in this file does. The test should also assert that the result set is scoped to `@group` and does not leak estates from other groups.

---

### CR-02: `FilterSetsTest` Asserts a Deletion Path the Controller May Never Execute

**File:** `backend/test/integration/filter_sets_test.rb:42`
**Issue:** The test asserts that the previous active filter set's group estates are soft-deleted after the POST:

```ruby
assert_equal 0, GroupEstate.without_deleted.where(group: @group, group_filter_set_id: @active_filter_set.id).count
```

The comment in the test itself acknowledges the response can be 201 or 422. Examining the controller (`filter_sets_controller.rb:56-58`), the deletion at line 57 is guarded by:

```ruby
if previous_active_id && !GroupFilterSet.where(id: previous_active_id, active: true).exists?
  GroupEstate.where(group: @group, group_filter_set_id: previous_active_id).destroy_all
end
```

When `filters: []` is sent, `populate_group_estates!` returns `false` early (line 150: `return false if filters.empty?`). The group_filter_set model's `before_save` callback deactivates the old filter set and activates the new one. So the guard `!GroupFilterSet.where(id: previous_active_id, active: true).exists?` evaluates to `true` (old one is now inactive) and the destroy runs — so the test currently passes. However, the 422 branch is returned after the deletion, which means the assertion on line 42 that "the deletion still runs before the 422 render" is correct only because of the specific ordering of operations in the controller. This is fragile: the test comment says "deletion behavior is what this test asserts" but the assertion actually passes for implementation-specific sequencing reasons that are not made explicit. If the controller is ever refactored to wrap the deletion inside the `if !populated && previous_active_id` block, the test would still accept 422 as a valid status but the assertion at line 42 would fail — yet the test provides no signal of why, making it a latent false-alarm. More critically: the test does not assert the 201 path at all. A test that accepts any of two statuses and asserts a side-effect that only happens in one branch is not a reliable safety net.

**Fix:** Split into two tests: one that provides valid filters (assert 201 + deletion), and one that provides empty filters (assert 422 + deletion still occurred). This eliminates the ambiguity and makes each assertion traceable to a specific behavior.

---

### CR-03: `ProtectedRoute` Test Uses a Token Format Incompatible with `isAuthenticated()`

**File:** `frontend/src/components/common/guards/ProtectedRoute.test.tsx:9-10`
**Issue:** The helper `makeValidToken()` produces:

```ts
const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
return `header.${payload}.sig`
```

The `isAuthenticated()` function in `lib/auth.ts` decodes `token.split('.')[1]` with standard base64 decoding (`atob(base64)`). The JWT spec uses base64url encoding (replacing `+` with `-` and `/` with `_`), and `auth.ts` does reverse that substitution before calling `atob`. However, `btoa(JSON.stringify({...}))` uses standard base64 which may contain `+` and `/` characters. These will be incorrectly transformed by the `replace(/-/g, '+').replace(/_/g, '/')` substitution in `decodePayload` — the substitution is designed to go from base64url TO base64, but standard base64 output fed into that function will have its `+` replaced with nothing (since `-` won't appear) and its `/` replaced with nothing (since `_` won't appear). For payloads that happen not to contain `+` or `/` in their base64 output this passes silently, but it means the test is not faithfully simulating a real JWT and will give a false pass for any payload value where base64 encoding happens to produce those characters.

More directly: the test is supposed to prove that `isAuthenticated()` correctly accepts a valid token. But `makeValidToken()` does not produce a valid JWT — it produces a syntactically similar but encoding-incompatible string. The test is passing by coincidence (the specific payload `{"exp":<number>}` in base64 typically doesn't produce `-` or `_` characters), not by correctness.

**Fix:** Produce a valid base64url-encoded payload:
```ts
function makeValidToken(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `header.${payload}.sig`
}
```
This matches what a real Cognito/JWT token looks like and what `decodePayload` in `auth.ts` expects.

---

## Warnings

### WR-01: `GroupEstatesQuery` Accepts `current_user` but CLAUDE.md Prohibits Unused Parameters — Not Flagged by Tests

**File:** `backend/app/queries/group_estates_query.rb:3`
**Issue:** The CLAUDE.md project convention explicitly states: "Only include `current_user` in the initializer if the query actually uses it for filtering or authorization. If it's unused, omit it." The query does use `@current_user` (in `filter_by_rejection`, `filter_by_min_user_rating`, `filter_by_pending_review`, `filter_by_favorites`) so the parameter is not literally unused. However, the `GroupEstatesQueryTest` calls the query with `@user` hardcoded in every test:

```ruby
GroupEstatesQuery.new(@group, @user, {min_price: "200000", ...}).call
```

None of the tests exercise the user-specific filters (`min_user_rating`, `pending_review`, `favorites_only`, `show_rejected`). This means the `current_user` parameter's behavior is never validated, which creates a gap where a future refactor could break user-scoped filtering with no test catching it.

**Fix:** Add at least one test per user-dependent filter branch (`filter_by_rejection`, `filter_by_min_user_rating`, `filter_by_pending_review`, `filter_by_favorites`).

---

### WR-02: `auth_headers_for` Mutates `Current` Between Requests — State Leak Risk

**File:** `backend/test/test_helper.rb:26-36`
**Issue:** `auth_headers_for` sets `Current.brokerage` and `Current.user` before minting the token, then calls `Current.reset` in `ensure`. This is necessary for `TokenService.issue` to embed the role. However, the integration tests call `auth_headers_for` in `setup` blocks (e.g. `AdminAuthorizationTest` calls it four times in setup), and the `teardown` in `ActiveSupport::TestCase` also resets `Current`. The problem is that `ActionDispatch::IntegrationTest` does not inherit from `ActiveSupport::TestCase` — it inherits from `ActiveSupport::TestCase` indirectly but the teardown is defined on `ActiveSupport::TestCase`, not on `ActionDispatch::IntegrationTest`. In Rails 7.1, `ActionDispatch::IntegrationTest` does include `ActiveRecord::TestFixtures` which provides its own teardown chain, so this usually works. However, the `teardown` block in `ActiveSupport::TestCase` (line 17-19) is the only safeguard against `Current` leakage if `auth_headers_for` raises before reaching `ensure`. If `TokenService.issue` raises an exception and the `ensure` block does not run (impossible in Ruby — `ensure` always runs), this is safe. But if a test calls `auth_headers_for` and then fails inside the test body before the test framework's teardown, `Current` will already have been reset by the `ensure`. This is actually correct behavior. The real issue is that `Current.reset` in the `ensure` of `auth_headers_for` is the only protection — if someone adds a helper that sets `Current` without the `ensure`, there is no second line of defense. This is a latent architectural fragility.

**Fix:** Low urgency but document the reliance: add a comment in `test_helper.rb` noting that the `teardown { Current.reset }` in `ActiveSupport::TestCase` is a safety net for any helper that sets Current state without cleaning up.

---

### WR-03: `FilterSetsTest` Does Not Guard Against Unique Index Violation

**File:** `backend/test/integration/filter_sets_test.rb:14`
**Issue:** The `group_filter_sets` table has a partial unique index: `unique: true, where: "(active = true)"` on `group_id`. The test setup creates `@active_filter_set` with `active: true` for `@group`. The POST to create a new filter set triggers the model's `before_save` which deactivates the old one before saving the new active one. This ordering is correct and avoids the unique constraint. However, if the controller's `before_save` callback order is ever changed, the test will fail with an `ActiveRecord::RecordNotUnique` database error rather than a meaningful test failure. The test has no defensive assertion that guards this scenario. This is a test-quality issue: the test relies on implicit ordering guarantees not expressed in any assertion.

**Fix:** Add an explicit `assert_equal 1, GroupFilterSet.where(group: @group, active: true).count` after the POST to verify exactly one active filter set exists. This turns a potential database crash into a meaningful assertion failure.

---

### WR-04: `GoogleSignInButton` Test Does Not Verify the Unlisten Cleanup

**File:** `frontend/src/components/auth/GoogleSignInButton.test.tsx:55-67`
**Issue:** The test verifies that `Hub.listen` is called and that the callback fires `fetchAuthSession`. It does not test that `unmount` triggers the cleanup function returned by `Hub.listen`. The component passes the return value of `Hub.listen` back as the `useEffect` cleanup — but only if `typeof unlisten === 'function'` (line 22 of `GoogleSignInButton.tsx`). The mock returns a function that calls `setMockHubCallback(null)`. If the cleanup never fires (e.g. because `typeof unlisten === 'function'` fails), Hub listeners accumulate and cause test pollution in any test that renders the component multiple times. The current `beforeEach` calls `setMockHubCallback(null)` which masks this.

**Fix:** Add a test that unmounts the component and asserts `getMockHubCallback()` is null afterward:
```ts
it('unlistens from Hub on unmount', () => {
  const { unmount } = renderWithProviders(<GoogleSignInButton />)
  expect(getMockHubCallback()).not.toBeNull()
  unmount()
  expect(getMockHubCallback()).toBeNull()
})
```

---

### WR-05: `RequireRole` Test Preloaded State Shape Does Not Match Redux Store Type

**File:** `frontend/src/components/common/guards/RequireRole.test.tsx:8-17`
**Issue:** The `loadedAdminState` object shape is:
```ts
{ account: { id: 'user-123', name: 'Test Admin', ..., membership: { role: 'admin' } } }
```
But the `accountType` (from `account.ts`) extends `userType`, and the `initialState` for the account reducer has no `membership` field — it only has `id`, `name`, `firstName`, `lastName`, `email`. The `useRole` hook reads `account.membership?.role` from the Redux state. If `membership` is not part of the typed `accountType`, then setting it in `preloadedState` works at runtime (Redux doesn't validate shape), but it means the test is relying on untyped state surgery rather than going through a proper action (like `updateUser`). If `accountType` is ever tightened to exclude `membership`, the test will silently break (TypeScript will error, but at test-write time not at runtime).

More importantly: the `useRole` hook reads `account.membership?.role`. The account reducer's `updateUser` action uses `Object.assign(state, action.payload)` which would merge the membership field. But `renderWithProviders` passes `preloadedState` directly to `configureStore`, bypassing reducers. This works now but is fragile.

**Fix:** Dispatch `updateUser({ membership: { role: 'admin' } })` via `store.dispatch` after render, or define the `membership` field on `accountType`/`userType` so the preloaded state is type-checked.

---

### WR-06: `listing_details` Factory Missing `beds` Column — Causes Silent Gaps in `filter_by_beds` Tests

**File:** `backend/test/factories/listing_details.rb:1-6`
**Issue:** The `GroupEstatesQuery#filter_by_beds` method queries `COALESCE(listing_details.beds, listing_details.bedrooms, 0)`. The schema shows the column is named `bedrooms` (line 291 of schema.rb) — there is no `beds` column in the schema. This means `listing_details.beds` will always be NULL in a real database, and the COALESCE falls through to `bedrooms`. The factory does not set `bedrooms`, so any test exercising `filter_by_beds` would need to set `bedrooms` explicitly. No test in the suite currently covers `filter_by_beds`, so this is not a blocking failure today — but the underlying query references a non-existent column `listing_details.beds` which will produce either a PostgreSQL error or silently return NULL depending on the DB configuration. If PostgreSQL is strict (which it is), `listing_details.beds` in the COALESCE will cause a `PG::UndefinedColumn` error at runtime.

**Fix:** In `group_estates_query.rb`, remove the reference to `listing_details.beds` and use only `listing_details.bedrooms`:
```ruby
scope.joins(:listing_detail)
  .where("COALESCE(listing_details.bedrooms, 0) >= ?", min_beds)
```
And add a `bedrooms` attribute to the `listing_detail` factory for completeness.

---

### WR-07: `GroupEstatesQueryTest` Sets `Current` Without DatabaseCleaner Teardown — Integration Test Order Risk

**File:** `backend/test/integration/group_estates_query_test.rb:34,49,58,72`
**Issue:** Each test in `GroupEstatesQueryTest` sets `Current.brokerage` and `Current.user` and cleans up via `ensure { Current.reset }`. This is correct for normal operation. However, `GroupEstatesQueryTest` extends `ActionDispatch::IntegrationTest`, which in Rails 7.1 wraps each test in a transaction by default (`use_transactional_tests = true`). The `Current` thread-local object is not transaction-aware — if a test raises between `Current.brokerage = @brokerage` and the `ensure`, the DB transaction rolls back but `Current` holds stale state. Since `ensure` always executes in Ruby this is actually safe. The real concern is that `Current` is set directly on the test thread but integration tests run actual HTTP requests through Rails middleware — for `GroupEstatesQueryTest`, the query is called directly (not via HTTP), so `Current` state set in the test body is visible to the query. But if any future test calls an HTTP endpoint instead, `Current` set in the test body would NOT be visible inside the request (which runs middleware that sets its own `Current`). The test structure creates a false sense of security about how `Current` flows.

**Fix:** Document this explicitly with a comment. The tests that call `GroupEstatesQuery` directly (rather than via HTTP) are not true integration tests and should be labeled as unit/query tests or moved to a unit test class to avoid confusion.

---

## Info

### IN-01: `brokerages` Factory Name Sequence Collides Across Test Runs with Unique Index

**File:** `backend/test/factories/brokerages.rb:3`
**Issue:** The `brokerages` table has a unique index on `name` (schema.rb line 83). The factory uses `sequence(:name) { |n| "Brokerage #{n}" }`. FactoryBot sequences are global and not reset between test files in a single run. When tests run in parallel or when multiple test files use `create(:brokerage)` without explicit names, the sequence counter advances per-process. This is generally safe because the sequence guarantees uniqueness within a process. However, if tests use fixtures AND factories, or if the sequence resets unexpectedly (e.g., test framework restart mid-run), there could be collisions. This is a known FactoryBot pattern and low risk, but worth noting.

**Fix:** No immediate action required. Confirm that no fixtures are in use alongside factories (no `fixtures :all` in test_helper.rb — confirmed absent).

---

### IN-02: Frontend `package.json` — `name` Field is `"travelapp"` Instead of Project Name

**File:** `frontend/package.json:2`
**Issue:** The `name` field is `"travelapp"` which does not match the actual project (real estate platform). This is a leftover from project scaffolding and creates confusion in `npm` output and tooling.

**Fix:** Update to an appropriate name (e.g., `"realstate-frontend"` or `"brokerage-platform"`).

---

### IN-03: `GoogleSignInButton` Has a TODO Blocking Session Completion — No Test Coverage for the Wired Path

**File:** `frontend/src/components/auth/GoogleSignInButton.tsx:16-18`
**Issue:** The `idToken` is fetched from `fetchAuthSession` but then discarded — there is a comment saying "Phase 4 will wire this to POST /v1/sessions". The test for this component (`GoogleSignInButton.test.tsx`) verifies that `fetchAuthSession` is called, but the MSW server in `server.ts` has a handler for `POST /v1/sessions` that returns `{ token: 'mock-jwt-token' }`. This handler is set up but never triggered by the current component implementation, meaning the test infrastructure is more complete than the component it tests. When Phase 4 wires the POST, the MSW handler is already in place — which is good — but the test does not assert that the token is stored (via `setToken`). When that wiring lands, there will be no regression coverage for the token storage step.

**Fix:** Note in the test file that when Phase 4 wires `POST /v1/sessions`, a test asserting `localStorage.getItem('auth_token')` equals the mock token must be added. The TODO comment in the component should reference this.

---

_Reviewed: 2026-05-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

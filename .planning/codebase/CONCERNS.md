# Codebase Concerns

**Analysis Date:** 2026-04-29

---

## Security Considerations

### Admin API Endpoints Lack Role-Based Authorization

**Risk:** Any authenticated brokerage member — including `client` and `agent` roles — can call every `/v1/admin/**` endpoint directly via HTTP. The frontend `RequireRole` guard in `AppShellAdmin.tsx` blocks UI access, but there is no server-side enforcement.

**Files:**
- `backend/app/controllers/v1/admin/brokerages_controller.rb` (line 7)
- `backend/app/controllers/v1/admin/groups_controller.rb` (line 8)
- `backend/app/controllers/v1/admin/users_controller.rb` (line 8)
- `backend/app/controllers/v1/admin/board_credentials_controller.rb` (line 7)
- `backend/app/controllers/concerns/cognito_auth.rb`
- `backend/app/constants/roles.rb` (defines `%w[owner admin agent staff client]`)

**Current mitigation:** Frontend-only guard via `RequireRole` in `frontend/src/components/common/guards/RequireRole.tsx`.

**Recommendations:**
- Add a `require_admin!` before_action to all admin controllers that checks `BrokerageMembership.find_by(user_id: Current.user.id, brokerage_id: Current.brokerage.id)&.role` against `%w[owner admin]`.
- Create a base `Admin::BaseController` that enforces this centrally.

---

### JWT Stored in `localStorage` (XSS Exposure)

**Risk:** The application issues its own HS256 JWT (not Cognito tokens) and stores it in `localStorage`. Any XSS vulnerability in the app can steal this token and impersonate users.

**Files:**
- `frontend/src/lib/auth.ts` — `localStorage.setItem(TOKEN_KEY, token)`
- `frontend/src/assets/api/auth/signIn.ts` — calls `setToken`
- `backend/app/services/token_service.rb` — issues HS256 JWT signed with `Rails.application.secret_key_base`

**Recommendations:** Use `HttpOnly` cookies for token storage. If staying with localStorage, ensure a strict CSP header is deployed.

---

### CORS Configured as Wildcard (`origins "*"`)

**Risk:** The Rack::CORS configuration allows all origins. In a multi-tenant SaaS product, this means any website can make credentialed requests to the API on behalf of a logged-in user.

**Files:**
- `backend/config/initializers/cors.rb` (line 10: `origins "*"`)

**Current mitigation:** Brokerage resolution uses the `Origin` header, so requests resolve to a brokerage. However, CSRF-style attacks from arbitrary origins are not blocked.

**Recommendations:** Restrict `origins` to a known allowlist (e.g., `*.yourproduct.com` pattern or dynamically from `BrokerageDomain`).

---

### No Rate Limiting on Any Endpoint

**Risk:** The login endpoint (`POST /v1/sessions`) and all API endpoints are unprotected from brute-force and scraping attacks. No Rack::Attack or equivalent middleware is present.

**Files:** All controllers under `backend/app/controllers/v1/`

**Recommendations:** Install `rack-attack` and add throttles at minimum to `POST /v1/sessions`.

---

### Hardcoded Test Credentials in Shipped Component

**Risk:** The sign-in form component ships with hardcoded test email and password as `defaultValue` props. These values appear in production HTML.

**Files:**
- `frontend/src/components/common/form/signIn/signIn.tsx` (line 49: `defaultValue="anthony@muller-schiller.test"`, line 68: `defaultValue="password123"`)

**Recommendations:** Remove all `defaultValue` props from authentication form inputs immediately.

---

### Sensitive Domain Name Logged on Every Request

**Risk:** The resolved brokerage domain is written to the Rails logger at `info` level on every authenticated request, which may end up in centralized log aggregation and expose tenant domain lists.

**Files:**
- `backend/app/controllers/concerns/brokerage_auth.rb` (line 13)

**Recommendations:** Lower to `debug` level or remove.

---

## Known Bugs

### `current_user` Helper Called Without Definition in `InvitationsController`

**Symptoms:** A `NoMethodError` or unexpected `nil` when a brokerage-level invitation is created or accepted. Line 71 calls `current_user.full_name` for the `inviter` field in the response; line 163 assigns `user = current_user`.

**Files:**
- `backend/app/controllers/v1/admin/invitations_controller.rb` (lines 71, 163)

**Trigger:** Any call to `POST /v1/admin/invitations` (create) or `POST /v1/admin/invitations/accept_invitation`.

**Workaround:** None — the response will crash or return a wrong inviter name. Replace with `Current.user`.

---

### `FilterByPopup` Imports `framer-motion` Package That Does Not Exist

**Symptoms:** Bundle-time `Cannot find module 'framer-motion'` error if the component is ever imported.

**Files:**
- `frontend/src/components/common/popups/filterByPopup/FilterByPopup.tsx` (line 1: `import { motion, AnimatePresence } from "framer-motion"`)

**Trigger:** Component is never imported by any other file — dead code. But if it is referenced in the future the build breaks.

**Workaround:** Delete the file.

---

## Tech Debt

### `per_page` Cap at 100 Not Enforced Uniformly

**Issue:** Several controllers accept arbitrary `per_page` values and pass them directly to Pagy without capping at 100. CLAUDE.md explicitly requires `[per_page, 100].min`.

**Files missing the cap:**
- `backend/app/controllers/v1/dashboard/group/estate_comments_controller.rb` (line 26)
- `backend/app/controllers/v1/dashboard/group/estate_documents_controller.rb` (line 32)
- `backend/app/controllers/v1/dashboard/notifications_controller.rb` (line 39)
- `backend/app/controllers/v1/admin/group/estates_controller.rb` (line 21)
- `backend/app/controllers/v1/admin/invitations_controller.rb` (line 22)
- `backend/app/controllers/v1/admin/group/invitations_controller.rb` (line 19)

**Impact:** A caller can request 10,000 records in a single response, causing high DB load and large JSON payloads.

**Fix approach:** Apply `per_page = [per_page, 100].min` before every uncapped `pagy(scope, items: per_page)` call.

---

### Price and Strata Fees Stored as Strings — CAST Workaround in Queries

**Issue:** `listing_details.price` and `listing_details.strata_fees` are `string` columns. Filtering requires `CAST(... AS REAL)` which bypasses any index. A `price_numeric` decimal column exists and is used by `FilterSetEstatesQuery`, but `GroupEstatesQuery` still uses string CAST. This creates inconsistent filtering behavior between filter-set preview and dashboard listing pages.

**Files:**
- `backend/db/schema.rb` (`t.string "price"`, `t.string "strata_fees"`, `t.decimal "price_numeric"`)
- `backend/app/queries/group_estates_query.rb` (lines 119–150: all use `CAST(listing_details.price AS REAL)`)
- `backend/app/queries/filter_set_estates_query.rb` (line 11: uses `listing_details.price_numeric` correctly)

**Impact:** Price-based sorts and filters in the dashboard may produce incorrect results for values formatted with commas or currency symbols. Filter set preview counts may differ from dashboard filtered counts.

**Fix approach:** Migrate `GroupEstatesQuery` to use `listing_details.price_numeric` and `listing_details.strata_fees` as a numeric column (add migration to add `strata_fees_numeric`).

---

### Dead Code: `Group#order_estates` and Related Methods

**Issue:** `Group` defines `order_estates`, `estates_ordered_by_avg_rating`, `estates_ordered_by_user_rating`, and `estates_ordered_by_created_at` (lines 33–66). None are called by any controller. All ordering is handled by `GroupEstatesQuery#apply_sort`.

**Files:**
- `backend/app/models/group.rb` (lines 33–66)

**Impact:** `estates_ordered_by_user_rating` contains an unparameterized string interpolation `AND estate_ratings.user_id = #{user.id}` (line 58) — a SQL injection vulnerability if the method were ever called with an attacker-controlled object.

**Fix approach:** Remove the dead methods. If ordering is ever needed on the model, use Arel parameterized queries.

---

### `Pagination` Concern `paginate` Lambda Is Unused

**Issue:** `ApplicationController` includes the `Pagination` concern which defines a `paginate` lambda (line 20). No controller calls this method — all pagination uses Pagy directly.

**Files:**
- `backend/app/controllers/concerns/pagination.rb` (lines 19–21)
- `backend/app/controllers/application_controller.rb`

**Fix approach:** Remove the `paginate` lambda. The `per_page` and `page_no` helpers may also be removable if all controllers compute them inline.

---

### Dual Admin Directory Structure Creates Navigation Confusion

**Issue:** Admin functionality is split across two parallel directory trees with no clear ownership boundary:
- `frontend/src/containers/adminBoard/` — container logic, contexts, state (21 files)
- `frontend/src/components/view/admin/` — view/presentational components (26 files)

The dashboard section uses a unified `containers/dashboard/` approach. The admin section has no equivalent convention.

**Files:**
- `frontend/src/containers/adminBoard/` (entire tree)
- `frontend/src/components/view/admin/` (entire tree)

**Fix approach:** Establish a rule: admin container files own state; admin view files are always pure. Document where new admin features should go. Long-term: consolidate toward the dashboard containers pattern.

---

### Typo in Directory Name `usersAminView`

**Issue:** Directory is named `usersAminView` (missing `d`), diverging from the naming pattern of other admin view directories.

**Files:**
- `frontend/src/components/view/admin/usersAminView/` (all files inside)

**Fix approach:** Rename to `usersAdminView` and update all imports. Affects approximately 5 files.

---

### Legacy SCSS Modules Mixed with Tailwind CSS

**Issue:** 21 `.module.scss` files coexist with Tailwind utility classes. The project convention (per CLAUDE.md) is Tailwind utility classes only. Several shell and layout components still use SCSS modules, creating two styling systems.

**Files:**
- `frontend/src/components/common/shells/appShell.module.scss`
- 20 additional `.module.scss` files across `frontend/src/`

**Fix approach:** Incrementally migrate `.module.scss` files to Tailwind as components are touched. Do not introduce new SCSS modules.

---

### State Management Inconsistency: Redux + React Context + TanStack Query

**Issue:** The project uses three coexisting state mechanisms:
- Redux (`@reduxjs/toolkit`) for `account`, `createBrokerageWizard`, and `tempBrokerage` slices
- React Context (Context Providers in `containers/`) for page-scoped orchestration
- TanStack Query for server state

Redux is used in only 5 call sites (identified by `useAppSelector`). New state should always go to React Context + TanStack Query per CLAUDE.md, but Redux exists alongside them as a full dependency.

**Files:**
- `frontend/src/store/reducers/` (3 Redux slices: `account.ts`, `createBrokerageWizard.ts`, `tempBrokerage.ts`)
- `frontend/src/store/storeProvider.tsx`

**Fix approach:** Migrate the 3 Redux slices to React Context or component-local state, then remove `redux`, `@reduxjs/toolkit`, and `react-redux` from `package.json`.

---

### `console.log` Statements in Production Code

**Issue:** Several debug `console.log` calls are present in production source files, including in the Amplify config that fires on every page load.

**Files:**
- `frontend/src/config/amplify.ts` (line 25: `console.log('✅ Amplify Cognito configured')`)
- `frontend/src/containers/adminBoard/listingGroupAdminBoard/listingGroupDetailsAdminBoard/useListingGroupDetailsContext.tsx` (line 142: `console.log('page', page)`)
- `frontend/src/components/view/admin/usersAminView/UsersListView.tsx` (line 64: `console.log('Delete user', ...)`)
- `frontend/src/components/view/admin/usersAminView/memberAdminView/MemberDetailCard.tsx` (line 18: `console.log(dateString)`)
- `frontend/src/components/common/form/signIn/signIn.tsx` (line 30: `console.log(response)`)
- `frontend/src/components/common/popups/filterByPopup/FilterByPopup.tsx` (line 12: `console.log("Filters applied:", ...)`)

**Fix approach:** Remove all `console.log` calls. Add an ESLint `no-console` rule to prevent regression.

---

## Performance Bottlenecks

### `EstateLike.exists?` Fires Per Estate on Index (N+1)

**Issue:** `EstateSerializer#liked` falls back to `EstateLike.exists?(user: current_user, group_estate_id: ge_id)` when `liked_ge_ids` is not in `instance_options`. No controller ever passes `liked_ge_ids`, so this DB query fires once per estate in every index response.

**Files:**
- `backend/app/serializers/estate_serializer.rb` (lines 67–77: fallback on line 76)
- `backend/app/controllers/v1/dashboard/group/estates_controller.rb` (index action — does not pass `liked_ge_ids`)
- `backend/app/controllers/v1/admin/group/estates_controller.rb` (index action — does not pass `liked_ge_ids`)

**Impact:** An index page with 10 estates fires 10 extra queries. Rejections are precomputed correctly; likes are not.

**Fix approach:** In both estates index actions, add bulk precomputation:
```ruby
liked_ge_ids = EstateLike.where(user_id: Current.user.id, group_estate_id: ge_ids).pluck(:group_estate_id).to_set
```
Then pass `liked_ge_ids: liked_ge_ids` to the serializer options.

---

### `EstateEventSerializer` Issues Per-Event DB Queries for RSVP

**Issue:** `EstateEventSerializer#rsvp_status` and `#rsvp_attendees` fall back to individual DB queries when the `:rsvps` association is not loaded (lines 34, 42). Collection endpoints that serialize multiple events cause N+1 per event unless `:rsvps` is explicitly preloaded.

**Files:**
- `backend/app/serializers/estate_event_serializer.rb` (lines 29–52)
- `backend/app/controllers/v1/dashboard/group/estate_events_controller.rb`

**Fix approach:** Add `.includes(rsvps: :user)` to the event query scope before serialization.

---

### Group Summary Fires 4 COUNT Queries Per Show Request

**Issue:** `GroupsController#group_summary` runs 4 individual COUNT queries sequentially on every `GET /v1/dashboard/groups/:id` request.

**Files:**
- `backend/app/controllers/v1/dashboard/groups_controller.rb` (lines 92–119)

**Impact:** 4 queries per show request in addition to the base group fetch. Becomes a bottleneck as groups grow to hundreds of estates.

**Fix approach:** Consolidate counts into a single SQL query using `GROUP BY` and `CASE` expressions, or cache via a background job that writes stats to a `group_stats` column.

---

### `ActivityQuery` In-Memory Merge Sort Does Not Scale

**Issue:** `ActivityQuery` fetches up to 100 items per activity type (`ITEMS_PER_TYPE = 100`) into Ruby arrays, concatenates them, then sorts in Ruby before slicing. At 6 activity types, this is up to 600 records in memory per request.

**Files:**
- `backend/app/queries/activity_query.rb` (line 4: `ITEMS_PER_TYPE = 100`, lines 43–50)

**Current capacity:** Acceptable for small groups. Degrades at ~10 active groups with high comment volume.

**Scaling path:** Move the multi-type merge sort to SQL using `UNION ALL` with a shared `created_at` sort and database-level `LIMIT`.

---

## Fragile Areas

### `GroupEstate` Cleanup in `FilterSetsController#create` Is Not Group-Scoped

**Issue:** In the `create` action, the cleanup of the previous filter set's estates uses `GroupEstate.where(group_filter_set_id: previous_active_id).destroy_all` (line 62) without scoping to `group: @group`. The `update` action (line 99) correctly uses `GroupEstate.where(group: @group, group_filter_set_id: ...)`. If filter set IDs were ever reused across groups, the create path would delete estates from the wrong group.

**Files:**
- `backend/app/controllers/v1/admin/group/filter_sets_controller.rb` (line 62 vs line 99)

**Safe modification:** Change line 62 to match line 99:
```ruby
GroupEstate.where(group: @group, group_filter_set_id: previous_active_id).destroy_all
```

---

### `User#current_brokerage_membership` Association Embeds `Current.brokerage` at Class Load Time

**Issue:** The `has_one :current_brokerage_membership` association uses a lambda that references `Current.brokerage.id` (line 5). If this association is eager-loaded outside a request context (e.g., in a Rake task or background job), `Current.brokerage` is `nil`, causing `NoMethodError`.

**Files:**
- `backend/app/models/user.rb` (lines 4–6)

**Fix approach:** Never eager-load `current_brokerage_membership` in job context. Document this constraint clearly. Consider replacing with a method `def brokerage_membership_for(brokerage)`.

---

### `BrokerageBoardCredential#status` Lacks Enum Definition

**Issue:** `status` is validated against `%w[active invalid]` as a string inclusion check but has no `enum` declaration. Callers use `status: :active` (symbol) in queries, which silently becomes `"active"` via ActiveRecord string coercion — but this is implicit and fragile.

**Files:**
- `backend/app/models/brokerage_board_credential.rb` (line 16)

**Fix approach:** Add `enum status: { active: "active", invalid: "invalid" }` or define as a proper integer enum with a migration.

---

## Test Coverage Gaps

### No Test Suite Exists

**What's not tested:** The entire backend and frontend have zero test coverage. No `spec/` directory exists in `backend/`, no `test/` directory exists, and no `*.test.*` or `*.spec.*` files are present in `frontend/src/`.

**Files:** All of `backend/app/` and `frontend/src/`

**Risk:** Every code path is untested. Critical paths that could regress silently include:
- Multi-tenant brokerage isolation logic (`BrokerageAuth`, brokerage-scoped queries)
- Soft-delete guard completeness across joined queries
- Filter set create/update transition logic and estate cleanup
- N+1 serializer fallback paths
- Admin endpoint authorization bypass

**Priority:** High

**Fix approach:** Start with integration tests for the highest-risk paths:
1. Tenant isolation — confirm user from brokerage A cannot access brokerage B data
2. Admin endpoint authorization — confirm `agent` role is rejected from admin endpoints
3. `FilterSetsController` create/update transitions — verify estates are correctly moved and old set cleaned up
4. `GroupEstatesQuery` filter combinations — verify price/CAST filtering returns correct results

---

## Dependencies at Risk

### TanStack Query on v4 (v5 API Has Breaking Changes)

**Risk:** `@tanstack/react-query` is pinned at `^4.22.0`. v5 removed `onSuccess`/`onError` callbacks from `useQuery`. Multiple hooks in `frontend/src/store/hooks/` use `onError` at the query options level — these would need refactoring before upgrading.

**Impact:** Dependency drift; will eventually need a migration effort.

**Migration plan:** Audit all `onSuccess`/`onError` usages in `frontend/src/store/hooks/` before upgrading. Move side effects to `useEffect` watching query state.

---

*Concerns audit: 2026-04-29*

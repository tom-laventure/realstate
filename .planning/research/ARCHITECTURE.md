# Architecture Patterns

**Domain:** Multi-tenant real estate SaaS — Rails 7.1 JSON API + React 18 SPA
**Researched:** 2026-04-29
**Milestone scope:** Google OAuth via Cognito, per-user calendar sync, server-side RBAC, test suite

---

## Q1: Cognito Federated Identity — How Google OAuth Changes the Request Flow

### What Actually Happens in Cognito When a User Signs In with Google

Cognito always generates its own `sub` UUID for every user profile — whether native or federated. For a Google-federated user who signs in without any linking, Cognito creates a second user profile. The `cognito:username` for that profile is `Google_<google-sub>`, and the `sub` is a Cognito-generated UUID unrelated to the Google sub. The Google sub is only stored in the `identities` array claim of the ID token. (HIGH confidence — confirmed via AWS Cognito federation docs and independent implementation guide.)

**The key consequence for this codebase:** `CognitoAuth` currently looks up users by `cognito_sub`. A Google-only sign-in would find no matching `User` row if the user originally registered with email/password, because the two Cognito profiles have different `sub` values.

### Frontend Flow After Adding Google as a Federated Provider

```
User clicks "Sign in with Google"
  → Amplify.signInWithRedirect({ provider: "Google" })
  → Browser redirects to Cognito Hosted UI → then to Google OAuth
  → Google redirects back to Cognito's /oauth2/idpresponse
  → Cognito redirects back to the app's configured callback URL
  → Amplify Hub fires { event: "signInWithRedirect" }
  → Frontend calls fetchAuthSession() to get the Cognito ID token
  → Frontend sends ID token to POST /v1/sessions (same endpoint as email/password)
  → Backend verifies the Cognito token → issues its own HS256 JWT → returns it
```

`CognitoAuth` and `TokenService` continue to work unchanged — they receive the same Cognito ID token format and issue the same HS256 JWT in response. The only difference is the claims inside the Cognito token.

### User Identity Linking — DB Changes Required

The risk is account fragmentation: a user who previously registered with email/password and later signs in with Google ends up with two separate Cognito profiles. Fix this with a Cognito Pre Sign-up Lambda trigger.

**Lambda trigger approach (recommended):**
When `PreSignUp_ExternalProvider` fires (Google sign-in), the Lambda calls `AdminLinkProviderForUser` to link the incoming Google identity to the existing native Cognito user with the same email. After linking, all subsequent Google sign-ins resolve to the original Cognito profile, preserving the original `sub`.

```
# Lambda: PreSignUp_ExternalProvider trigger
1. Extract email from trigger event
2. Look up existing Cognito user by email using AdminGetUser
3. If found: call AdminLinkProviderForUser(
     destination: { ProviderName: "Cognito", ProviderAttributeValue: existingUsername },
     source: { ProviderName: "Google", ProviderAttributeName: "Cognito_Subject", ProviderAttributeValue: googleSub }
   )
4. Return event — Cognito cancels the new profile creation, uses the linked one
```

After linking, the `sub` in the JWT is the original native user's `sub`. The `identities` claim in the ID token shows Google as an associated provider but does not change what `CognitoAuth` reads.

**DB change for `User` model:**

Add a `google_identity_linked_at` column (nullable timestamp) to record when a Google identity was connected. No new foreign key or separate table is needed — Cognito's own `identities` claim tracks the linkage.

```ruby
# migration
add_column :users, :google_identity_linked_at, :datetime
```

For "connect Google to existing account" from the logged-in settings screen: the frontend calls `Amplify.linkWithRedirect({ provider: "Google" })` (Amplify Gen 1 calls this `federatedSignIn` with `customProvider`), which goes through the same Lambda path and links the identity. The Rails backend then sets `user.update!(google_identity_linked_at: Time.current)`.

**What does NOT change:**
- `CognitoAuth` concern — still reads `sub` from JWT, looks up `User.find_by(cognito_sub: sub)`
- `TokenService` — still issues HS256 JWT keyed on `User#id`
- `SessionsController` — still receives POST with the Cognito ID token body param

### Component Boundary Summary

| Component | Change Required |
|-----------|----------------|
| Cognito User Pool (AWS console) | Add Google as social IdP, configure callback URLs |
| Pre Sign-up Lambda | New: calls AdminLinkProviderForUser for existing email matches |
| `CognitoAuth` concern | No change — sub lookup still works |
| `TokenService` | No change |
| `SessionsController` | No change — same POST /v1/sessions interface |
| `User` model | Add `google_identity_linked_at` column |
| Frontend `Login` container | Add "Sign in with Google" button calling `signInWithRedirect` |
| Frontend Hub listener | Listen for `signInWithRedirect` event, then call same session POST |
| Frontend amplify config | Add `oauth` block with callback URLs and Google scope |

---

## Q2: Per-User Calendar OAuth Token Storage

### What to Store and Why

Each calendar provider requires a different credential type:
- **Google Calendar**: OAuth 2.0 — access_token (short-lived, ~1h), refresh_token (long-lived), token expiry timestamp, scope
- **Microsoft Graph**: OAuth 2.0 — same structure as Google; requires `offline_access` scope for refresh token
- **Apple iCloud CalDAV**: No OAuth — uses app-specific password + Apple ID email; Basic Auth only (HIGH confidence — Apple has not added OAuth for CalDAV)

### Recommended Model: `UserCalendarConnection`

```ruby
# One row per user per provider. A user can have at most one connection per provider.
create_table :user_calendar_connections do |t|
  t.references :user, null: false, foreign_key: true
  t.string :provider, null: false      # "google" | "microsoft" | "apple"
  t.string :provider_account_email     # which Google/Microsoft account was connected
  t.string :encrypted_access_token
  t.string :encrypted_access_token_iv
  t.string :encrypted_refresh_token
  t.string :encrypted_refresh_token_iv
  t.datetime :token_expires_at
  t.string :calendar_id               # which specific calendar to write to (Google: primary)
  t.string :sync_status, default: "connected"  # "connected" | "error" | "revoked"
  t.text :last_error_message
  t.datetime :last_synced_at
  t.timestamps
  t.index [:user_id, :provider], unique: true
end
```

### Encryption

Use ActiveRecord Encryption (already configured in the project at `backend/config/initializers/active_record_encryption.rb`) — the same mechanism used for `BrokerageBoardCredential`. Encrypt `access_token` and `refresh_token`:

```ruby
class UserCalendarConnection < ApplicationRecord
  belongs_to :user
  encrypts :access_token, :refresh_token
  enum :provider, { google: "google", microsoft: "microsoft", apple: "apple" }
  enum :sync_status, { connected: "connected", error: "error", revoked: "revoked" }
end
```

**Why this over alternatives:**
- ActiveRecord Encryption is already set up — no new key management
- A separate table (not columns on `User`) cleanly handles multiple providers and connection status per provider
- Unique index on `[user_id, provider]` prevents duplicate connections

### Apple CalDAV Credential Storage

For Apple: the `encrypted_access_token` stores the app-specific password; `encrypted_refresh_token` is null; `provider_account_email` stores the Apple ID email. No token refresh logic runs — Apple credentials do not expire (users revoke them manually via Apple ID settings).

### Token Refresh Strategy

**Refresh at job execution time, not at request time.** The calendar sync happens asynchronously in a SolidQueue job. The job is responsible for refreshing the access token before calling the calendar API:

```ruby
# In CalendarSyncService (called from job)
def refresh_token_if_needed(connection)
  return unless connection.provider.in?(%w[google microsoft])
  return unless connection.token_expires_at < 5.minutes.from_now

  response = # call provider token endpoint with refresh_token
  connection.update!(
    access_token: response[:access_token],
    token_expires_at: Time.current + response[:expires_in].seconds
  )
rescue => e
  connection.update!(sync_status: "error", last_error_message: e.message)
  raise  # let the job retry
end
```

Do not refresh tokens during the HTTP request cycle. The request that creates an `EstateDate` should never wait on a calendar API call.

---

## Q3: Calendar Sync Background Job Pattern

### Sync Architecture

**Pattern: async-always.** The controller that creates/updates/deletes an `EstateDate` record enqueues a job. It never calls the calendar API synchronously. This matches the existing pattern used for notification fanout.

```
POST /v1/dashboard/.../estate_dates
  → EstateDatesController#create
  → EstateDate.create!(...)
  → CalendarSyncJob.perform_later(estate_date_id: estate_date.id, action: "create")
  → 200 OK (job is in queue, not yet executed)
```

### Idempotency — Avoid Duplicate Calendar Events

Store the external calendar event ID returned by each provider on the `EstateDate` model (or in a join table). This is the single most important idempotency control.

```ruby
# Add to estate_dates table (or a separate estate_date_calendar_events table)
add_column :estate_dates, :google_calendar_event_id, :string
add_column :estate_dates, :microsoft_calendar_event_id, :string
# Apple CalDAV uses a UID in the .ics payload — store similarly
add_column :estate_dates, :apple_caldav_uid, :string
```

Create logic:
1. If `google_calendar_event_id` is already set on the `EstateDate`, skip creation (already synced)
2. Call Google Calendar API to create the event
3. Store the returned `event.id` on the `EstateDate`

Update logic:
1. If `google_calendar_event_id` is blank, treat as create (handles partial failures)
2. Call PATCH on the known event ID

Delete logic:
1. If `google_calendar_event_id` is blank, nothing to delete
2. Call DELETE on the known event ID; rescue 404 as success (already gone)

### Job Structure

```ruby
class CalendarSyncJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :polynomially_longer, attempts: 5
  discard_on ActiveRecord::RecordNotFound

  def perform(estate_date_id:, action:, user_id:)
    estate_date = EstateDate.find(estate_date_id)
    user = User.find(user_id)

    user.user_calendar_connections.connected.each do |connection|
      CalendarSyncService.new(connection).sync(estate_date, action)
    rescue => e
      # log and mark this connection's error but don't fail the whole job
      connection.update(sync_status: "error", last_error_message: e.message)
    end
  end
end
```

**Why per-user, not per-brokerage:** Calendar connections are personal — the agent syncing to their Google Calendar is the user who created or is attending the event. Pass `user_id` to the job so it loads connections for that user only.

**Failure handling:**
- If one provider (e.g., Google) fails, update that connection's `sync_status` to `"error"` with the error message, and continue syncing other providers for the same user. Do not fail the whole job.
- The job itself retries up to 5 times with polynomial back-off (same as existing jobs).
- Surface `sync_status: "error"` connections in the UI so users can reconnect.

**Who to sync for:** On `EstateDate` create/update/delete, sync for the acting user (`Current.user`) only. Do not sync for all group members — calendar sync is opt-in and personal. Each user's job is enqueued when they interact with their own calendar connection, not when a colleague creates an event.

### Triggering the Job

```ruby
# EstateDatesController (create and update actions)
after_commit -> { CalendarSyncJob.perform_later(estate_date_id: id, action: "create", user_id: Current.user.id) },
  on: :create

# Or in the controller:
CalendarSyncJob.perform_later(
  estate_date_id: @estate_date.id,
  action: "create",
  user_id: Current.user.id
)
```

Use `after_commit` or enqueue after the `save!` succeeds to avoid jobs referencing records that didn't commit.

---

## Q4: Rails Test Architecture for Multi-Tenant API

### Test Type Decision

**Use `ActionDispatch::IntegrationTest` (Rails request tests) for all controller-level tests.** Do not use `ActionController::TestCase` (functional tests) — request tests exercise the full middleware stack including `BrokerageAuth` and `CognitoAuth`, which is exactly what the highest-risk test scenarios require. Unit tests for query objects and service objects use `ActiveSupport::TestCase` directly. (HIGH confidence — this is the Rails-recommended pattern as of Rails 6+.)

### File Layout

```
backend/
  test/
    test_helper.rb
    helpers/
      auth_helper.rb           # JWT generation, host headers
      fixture_helper.rb        # convenience methods for loading fixtures
    integration/
      tenant_isolation_test.rb
      admin_authorization_test.rb
      filter_sets_controller_test.rb
      invitations_controller_test.rb
    unit/
      queries/
        group_estates_query_test.rb
      services/
        groups_create_test.rb
    fixtures/
      brokerages.yml
      users.yml
      brokerage_memberships.yml
      groups.yml
      estates.yml
      group_estates.yml
```

### Tenant Isolation Setup

The multi-tenancy concern (`BrokerageAuth`) resolves `Current.brokerage` from the `Host` header. Set it directly in request tests:

```ruby
# test/helpers/auth_helper.rb
module AuthHelper
  def auth_headers(user, brokerage)
    token = TokenService.issue(user)
    {
      "Authorization" => "Bearer #{token}",
      "Host" => brokerage.primary_domain   # triggers BrokerageAuth
    }
  end

  def sign_in_as(user, brokerage)
    @auth_headers = auth_headers(user, brokerage)
  end
end

# In test_helper.rb
class ActionDispatch::IntegrationTest
  include AuthHelper
end
```

```ruby
# test/integration/tenant_isolation_test.rb
class TenantIsolationTest < ActionDispatch::IntegrationTest
  fixtures :all

  setup do
    @brokerage_a = brokerages(:alpha)
    @brokerage_b = brokerages(:beta)
    @user_a = users(:alice)   # member of brokerage_a only
    @group_b = groups(:beta_group)  # belongs to brokerage_b
  end

  test "user from brokerage A cannot read brokerage B group" do
    get v1_dashboard_group_url(@group_b),
        headers: auth_headers(@user_a, @brokerage_a)
    assert_response :not_found  # or 403 — depends on controller rescue
  end
end
```

**Fixture design for multi-tenancy:** Each YAML fixture file must include `brokerage_id` references pointing to distinct brokerages. At minimum: two brokerages, two users each in a different brokerage, two groups each in a different brokerage. Use labelled fixtures (`alpha:`, `beta:`) for clarity.

**CognitoAuth in tests:** `CognitoAuth` verifies the JWT using `TokenService.verify`. In tests, generate real JWTs via `TokenService.issue(user)` in the `auth_headers` helper. This tests the actual token verification path rather than stubbing it. No mocking is needed because `TokenService` is a pure HS256 in-process implementation with no network calls.

**Database strategy:** Use Rails' default transactional fixtures (wrapped in a transaction, rolled back after each test). Do not use `DatabaseCleaner` — transactional fixtures are correct and faster.

### Admin Authorization Test Pattern

```ruby
# test/integration/admin_authorization_test.rb
class AdminAuthorizationTest < ActionDispatch::IntegrationTest
  fixtures :all

  test "agent role is rejected from admin endpoints" do
    agent = users(:agent_user)
    brokerage = brokerages(:alpha)
    assert_equal "agent", brokerage_memberships(:agent_membership).role

    get v1_admin_users_url,
        headers: auth_headers(agent, brokerage)
    assert_response :forbidden
  end

  test "admin role is permitted on admin endpoints" do
    admin = users(:admin_user)
    brokerage = brokerages(:alpha)

    get v1_admin_users_url,
        headers: auth_headers(admin, brokerage)
    assert_response :ok
  end
end
```

### Unit Test Pattern for Query Objects

```ruby
# test/unit/queries/group_estates_query_test.rb
class GroupEstatesQueryTest < ActiveSupport::TestCase
  fixtures :all

  setup do
    @group = groups(:alpha_group)
    @user = users(:alice)
  end

  test "price filter excludes estates outside range" do
    results = GroupEstatesQuery.new(@group, price_min: "500000", price_max: "800000").call
    assert results.all? { |ge| ge.estate.listing_detail.price_numeric.between?(500_000, 800_000) }
  end
end
```

---

## Q5: Admin::BaseController RBAC Pattern

### Recommended Implementation

**Create `Admin::BaseController` in the admin namespace and have all admin controllers inherit from it.** Do not use a concern for role enforcement — `before_action` in a base controller is the Rails-idiomatic approach and the most explicit. A concern implies reuse across namespaces; RBAC for admin is namespace-scoped.

```ruby
# backend/app/controllers/v1/admin/base_controller.rb
module V1
  module Admin
    class BaseController < ApplicationController
      before_action :require_admin!

      private

      def require_admin!
        membership = BrokerageMembership
          .without_deleted
          .find_by(user_id: Current.user.id, brokerage_id: Current.brokerage.id)

        return if membership&.role.in?(%w[owner admin])

        render json: { error: "Forbidden" }, status: :forbidden
      end
    end
  end
end
```

All existing admin controllers then change their parent:

```ruby
# backend/app/controllers/v1/admin/users_controller.rb
module V1
  module Admin
    class UsersController < BaseController   # was < ApplicationController
      # ...
    end
  end
end
```

**Why not a concern:** A concern mixed into `ApplicationController` would affect all controllers. A concern mixed explicitly into each admin controller is better than nothing, but is easy to forget on a new controller. Inheritance from `Admin::BaseController` is automatic — new admin controllers are protected by default.

**Where in the `before_action` chain:** `BrokerageAuth` and `CognitoAuth` run first in `ApplicationController` (they set `Current.brokerage` and `Current.user`). `require_admin!` in `Admin::BaseController` runs after, so `Current.brokerage` and `Current.user` are guaranteed to be set. No ordering problem.

**Opt-out for specific actions:** If a specific action in an admin controller is intentionally open to non-admin members (unlikely but possible), use `skip_before_action :require_admin!, only: [:that_action]`. This makes exceptions explicit rather than implicit.

### Component Boundary

```
ApplicationController
  ↳ BrokerageAuth (concern: sets Current.brokerage)
  ↳ CognitoAuth (concern: sets Current.user)
  ↳ V1::Admin::BaseController
      ↳ before_action :require_admin!  ← new, checks membership.role
      ↳ V1::Admin::UsersController
      ↳ V1::Admin::GroupsController
      ↳ V1::Admin::BrokeragesController
      ↳ V1::Admin::BoardCredentialsController
      ↳ V1::Admin::InvitationsController
```

### Avoiding Double Membership Lookup

`CognitoAuth` already looks up `BrokerageMembership` to confirm the user is a member of the brokerage. To avoid a second query in `require_admin!`, set the membership on `Current`:

```ruby
# backend/app/models/current.rb
class Current < ActiveSupport::CurrentAttributes
  attribute :brokerage, :user, :membership  # add :membership
end

# In CognitoAuth:
Current.membership = BrokerageMembership
  .without_deleted
  .find_by(user_id: Current.user.id, brokerage_id: Current.brokerage.id)

# In Admin::BaseController:
def require_admin!
  return if Current.membership&.role.in?(%w[owner admin])
  render json: { error: "Forbidden" }, status: :forbidden
end
```

This makes `require_admin!` a free read from the thread-local context — zero additional DB queries.

### Testing `require_admin!`

Covered by the integration test pattern in Q4 above. The key assertion is:
- `agent` and `client` memberships receive 403
- `owner` and `admin` memberships receive 2xx

Test both the base controller behavior (applies to all admin routes) and that individual controllers do not inadvertently skip it.

---

## Component Boundaries Summary

| New Component | Location | Responsibility |
|--------------|----------|----------------|
| Cognito Pre Sign-up Lambda | AWS console / Lambda | Links Google identity to existing Cognito user on first Google sign-in |
| `User#google_identity_linked_at` | `backend/app/models/user.rb` | Timestamps Google identity connection |
| `UserCalendarConnection` model | `backend/app/models/user_calendar_connection.rb` | Stores per-user OAuth tokens for calendar providers, encrypted at rest |
| `CalendarSyncService` | `backend/app/services/calendar_sync_service.rb` | Encapsulates token refresh + calendar API write for a single connection |
| `CalendarSyncJob` | `backend/app/jobs/calendar_sync_job.rb` | Async dispatch of `CalendarSyncService` for all user connections on `EstateDate` lifecycle events |
| `V1::Admin::BaseController` | `backend/app/controllers/v1/admin/base_controller.rb` | Centralizes `require_admin!` before_action for all admin endpoints |
| `Current.membership` | `backend/app/models/current.rb` | Thread-local membership to avoid duplicate queries between `CognitoAuth` and `require_admin!` |
| `test/helpers/auth_helper.rb` | `backend/test/helpers/` | Generates JWT + Host header tuples for request tests |

---

## Anti-Patterns to Avoid

### Inline calendar sync in the request cycle
**What goes wrong:** Calling Google Calendar API synchronously in `EstateDatesController#create` — adds 300-1500ms latency to every listing date creation, and a single API timeout fails the user's save.
**Do this instead:** Enqueue `CalendarSyncJob` after the record commits. The user's record is saved immediately; the calendar write happens asynchronously.

### Checking admin role in individual controllers
**What goes wrong:** Each controller has its own `before_action :require_admin_or_owner!` — easy to forget on new controllers, and role logic drifts between controllers.
**Do this instead:** Inherit from `V1::Admin::BaseController` and enforce in one place.

### Storing OAuth tokens in clear text
**What goes wrong:** Access and refresh tokens in plaintext columns are readable by anyone with DB access or in backups.
**Do this instead:** Use ActiveRecord Encryption (`encrypts :access_token, :refresh_token`) — the infrastructure is already configured in the project.

### Relying on the Cognito `sub` claim for user linking without the Pre Sign-up Lambda
**What goes wrong:** A user signs in with Google and gets a brand new Cognito profile with a different `sub` — `CognitoAuth` calls `User.find_by(cognito_sub: sub)` and finds nothing, so the user cannot log in.
**Do this instead:** The Pre Sign-up Lambda intercepts the Google sign-in, calls `AdminLinkProviderForUser`, and ensures all Google sign-ins resolve to the user's original Cognito sub.

### Syncing all group members' calendars when one user creates an `EstateDate`
**What goes wrong:** An event with 20 group members would enqueue 20 calendar sync jobs, most for users who have never connected a calendar — wasteful and wrong semantics.
**Do this instead:** Sync only `Current.user`'s connections when they create or modify a date. Calendar sync is an individual opt-in, not a group broadcast.

---

## Sources

- AWS Cognito user linking: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html
- Cognito federation implementation guide (sub claim behavior): https://hidekazu-konishi.com/entry/amazon_cognito_federation_implementation_guide.html
- Amplify social provider sign-in: https://docs.amplify.aws/gen1/react/build-a-backend/auth/add-social-provider/
- Apple CalDAV — no OAuth, app-specific password only: https://www.onecal.io/blog/how-to-integrate-icloud-calendar-api-into-your-app
- SolidQueue idempotency / unique jobs: https://github.com/rails/solid_queue/issues/176
- Rails integration test guide: https://guides.rubyonrails.org/testing.html
- Admin BaseController RBAC pattern: https://medium.com/@er.sumitsah/implementing-role-based-access-control-rbac-in-rails-a-comprehensive-guide-752194c8bffe

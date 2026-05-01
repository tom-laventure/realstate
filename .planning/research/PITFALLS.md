# Domain Pitfalls

**Domain:** Multi-tenant real estate SaaS — Milestone 2 (Google OAuth, Calendar Sync, RBAC, Testing, Security hardening)
**Researched:** 2026-04-29

---

## Critical Pitfalls

Mistakes that cause rewrites, security breaches, or data corruption.

---

### Pitfall 1: Cognito Account Duplication — Same Email via Password + Google

**What goes wrong:** When a user who already has an email/password account in Cognito signs in with Google OAuth for the first time, Cognito creates a *second, completely separate* user account — same email, different identity. The app ends up with two `User` records (or one User record pointing to the wrong Cognito sub), broken brokerage membership resolution, and a split data history.

**Why it happens:** Cognito does not auto-link federated identities to native accounts by email. This is intentional (security), but it surprises every developer building this pattern. The two accounts coexist silently.

**Consequences:**
- The returning user appears as a new user with no brokerage membership → 403 redirect loop
- The old password account still exists; user cannot log in via password without getting the "old" account with no Google association
- `TokenService` issues a JWT for the wrong `User` record
- Any existing listings, ratings, comments owned by the original `User.id` are orphaned under a different identity

**Prevention:**
- Add a `PreSignUp` Lambda trigger on the Cognito User Pool. When the trigger fires for a Google federated sign-in, call `AdminLinkProviderForUser` to link the Google identity to the existing native account if an email match is found.
- The trigger must look up the existing native Cognito user by email, then call `cognitoIdentityProvider.adminLinkProviderForUser` with the source (Google) and destination (native) user.
- Only link if `email_verified: true` on the Google token — do not link on unverified emails (phishing risk: an attacker could create a Google account with someone else's unverified email and gain access to their account).

**Detection:** Two `User` records with the same email in the database after a Google sign-in by an existing user. 403 errors for users who previously had accounts.

**Source:** [Cognito account linking docs](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html) | [amplify-js issue #11565](https://github.com/aws-amplify/amplify-js/issues/11565)

---

### Pitfall 2: Cognito `email_verified` Attribute Overwritten on Every Google Sign-In

**What goes wrong:** Cognito resets `email_verified` to `false` for the federated user on each login if attribute mapping is not explicitly configured. This breaks password reset ("forgot password" requires a verified email), and silently disables email-based confirmation flows.

**Why it happens:** The default attribute mapping for Google's `email_verified` claim is absent unless explicitly added in the Cognito User Pool → Identity Provider attribute mapping config. Without it, Cognito defaults the attribute to `false`.

**Consequences:**
- Users who sign in via Google cannot use "Forgot Password" on their native account
- CognitoAuth concern verifies JWTs, but if Cognito-side state is broken, `initiate_auth` may fail unpredictably on future password logins
- Manifests silently — no error is thrown at sign-in time

**Prevention:** In Cognito Console → User Pool → Social Identity Providers → Google: add attribute mapping `email_verified` (Google claim) → `email_verified` (User Pool attribute). Set this before any users sign in with Google.

**Detection:** Check `cognito-idp list-users` for existing Google users — `email_verified` attribute = false despite successful sign-in.

**Source:** [AWS Cognito federated auth guide](https://awsfundamentals.com/blog/cognito-federated-auth) | [Code Genie account linking](https://codegenie.codes/blog/aws-cognito-user-pools-sign-in-with-email-google-saml-and-link-to-a-single-user/)

---

### Pitfall 3: Amplify Callback URL Multi-Tenant Mismatch

**What goes wrong:** This app uses domain-based multi-tenancy (each brokerage has its own subdomain). Cognito's hosted UI requires an exact allowlist of callback URLs. In a multi-tenant setup, each brokerage domain is a different origin — you cannot enumerate all of them in Cognito's static callback URL list. At runtime, Cognito will reject the `redirect_uri` for any brokerage domain not explicitly listed.

**Why it happens:** Cognito's App Client settings require explicit callback URLs. There is no wildcard support for subdomains. Amplify's `federatedSignIn()` sends the current `window.location.origin` as `redirect_uri`, which will differ per brokerage.

**Consequences:** The entire Google OAuth flow silently fails for any brokerage domain not individually pre-registered. The user sees a Cognito "redirect_uri_mismatch" error page.

**Prevention:**
- Use a single fixed OAuth callback URL (e.g., `https://auth.yourapp.com/callback`) that Cognito knows about, then redirect to the correct brokerage domain after exchanging the code for tokens.
- Alternatively, if the number of brokerage domains is bounded and known at deployment time, enumerate them in the App Client config (cumbersome but works for small N).
- The Amplify config in `frontend/src/config/amplify.ts` will need a `redirectSignIn` and `redirectSignOut` that is either domain-specific (computed at runtime) or points to a fixed intermediary.

**Detection:** After clicking "Sign in with Google", the browser lands on a Cognito error page (`redirect_mismatch`) rather than completing the OAuth flow.

**Source:** [Amplify social provider docs](https://docs.amplify.aws/gen1/react/build-a-backend/auth/add-social-provider/) | [amplify-cli issue #2792](https://github.com/aws-amplify/amplify-js/issues/2792)

---

### Pitfall 4: OAuth Token Rotation Race Condition in Background Jobs

**What goes wrong:** When a user's calendar OAuth access token expires, the background job responsible for syncing calendar events attempts to refresh it. If two jobs for the same user run concurrently (e.g., retry + new job overlap), both see the expired token, both call the provider's token refresh endpoint, the first refresh invalidates the refresh token for some providers (Google uses rotating refresh tokens), and the second job gets an `invalid_grant` error. The refresh token is now dead — the user silently loses calendar sync permanently.

**Why it happens:** SolidQueue runs jobs in parallel across workers. There is no built-in mutex per user-credential record. Token rotation without distributed locking is inherently racy.

**Consequences:**
- `UserCalendarConnection` has a stale/dead `refresh_token` in the database
- All future sync attempts fail silently (or raise errors that are discarded)
- The user never knows — their calendar just stops receiving events
- Recovery requires the user to manually reconnect their calendar

**Prevention:**
- Use PostgreSQL advisory locks (cheap, no Redis dependency) to serialize token refresh per `UserCalendarConnection.id`:
  ```ruby
  ActiveRecord::Base.connection.execute("SELECT pg_advisory_lock(#{connection_id})")
  # perform refresh
  ActiveRecord::Base.connection.execute("SELECT pg_advisory_unlock(#{connection_id})")
  ```
- Alternatively, use an `optimistic_lock` column on `UserCalendarConnection` and retry on `StaleObjectError`.
- Never pass raw refresh tokens to jobs — pass `user_calendar_connection_id` and re-read from DB inside the job. This ensures the job always works with the current token, not a stale capture.

**Detection:** Multiple `invalid_grant` errors in logs for the same `user_calendar_connection_id` within a short window. `UserCalendarConnection#refresh_token` stops changing after a sync error.

**Source:** [OAuth token management for SaaS](https://truto.one/blog/how-to-architect-a-scalable-oauth-token-management-system-for-saas-integrations/)

---

### Pitfall 5: `Current.brokerage` Is Nil in Job Context — Breaks Tenant-Scoped Queries

**What goes wrong:** The existing `User#current_brokerage_membership` association uses a lambda that references `Current.brokerage.id`. SolidQueue jobs run outside the HTTP request lifecycle — `Current` attributes are not set. The new `CalendarSyncJob` will query user data, and any code path that touches this association (directly or indirectly through a serializer or query object) will raise `NoMethodError: undefined method 'id' for nil`.

**Why it happens:** `ActiveSupport::CurrentAttributes` is request-scoped. SolidQueue jobs run in separate processes with no request context. The existing CONCERNS.md already flags this under "Fragile Areas."

**Consequences:**
- Calendar sync jobs crash on any user record fetch that touches `current_brokerage_membership`
- The crash is not obvious — the job may succeed for simple cases but fail for edge cases in production where users have multiple memberships
- `acts_as_paranoid`'s `.without_deleted` on a scope that uses `Current.brokerage` will also silently return all records across brokerages if `Current.brokerage` is nil (depending on query construction)

**Prevention:**
- In every job, explicitly set `Current.brokerage` at the start:
  ```ruby
  connection = UserCalendarConnection.find(args[:connection_id])
  Current.brokerage = connection.user.brokerages.find(args[:brokerage_id])
  Current.user = connection.user
  ```
- Never rely on `User#current_brokerage_membership` in job context. Pass explicit `brokerage_id` as a job argument and look up the membership directly.
- Do not eager-load the `current_brokerage_membership` association anywhere in job code.

**Detection:** `NoMethodError: undefined method 'id' for nil:NilClass` in SolidQueue job logs, with a backtrace pointing to `user.rb:5`.

---

### Pitfall 6: Admin Endpoint RBAC Bypass (Existing, Unmitigated)

**What goes wrong:** All `/v1/admin/**` endpoints currently have zero server-side role enforcement. Any valid JWT holder — `agent`, `staff`, or `client` — can call admin endpoints directly via HTTP. This milestone adds the `require_admin!` fix, but if it is implemented in individual controllers rather than a shared `Admin::BaseController`, some controllers will be missed.

**Why it happens:** The current architecture relies on the `ApplicationController` which includes `BrokerageAuth` and `CognitoAuth` but has no role check. Developers adding new admin controllers may forget to include the role check.

**Consequences:** Full admin privilege escalation for any authenticated brokerage member.

**Prevention:**
- Create `Admin::BaseController < ApplicationController` with `before_action :require_admin!` and make all admin controllers inherit from it, not `ApplicationController` directly.
- A test that proves `agent` role gets 403 from every admin endpoint is the only reliable guard.

**Detection:** Calling `POST /v1/admin/users` with a valid `agent`-role JWT and receiving a 200 instead of 403.

---

## Moderate Pitfalls

Mistakes that cause incorrect behavior, data quality issues, or non-trivial debugging sessions.

---

### Pitfall 7: Google Calendar Timezone — UTC Offset vs. IANA Identifier

**What goes wrong:** `EstateDate` records likely store date/time without an IANA timezone identifier (e.g., they store a UTC timestamp). When pushing these to Google Calendar, using a bare UTC offset (e.g., `-07:00`) instead of an IANA timezone ID (e.g., `America/Vancouver`) causes events to shift by 1 hour during DST transitions. Users see showing appointments at the wrong time twice a year.

**Why it happens:** The Google Calendar API requires IANA timezone IDs in the `timeZone` field of `EventDateTime`. Passing UTC offsets is silently accepted but produces wrong behavior across DST boundaries.

**Consequences:** Calendar events appear 1 hour off during DST transitions. Recurring events drift. Users notice and blame the app.

**Prevention:**
- Always pass `timeZone: "America/Vancouver"` (or the brokerage's configured timezone, stored as an IANA ID) alongside the datetime.
- Never construct event times from UTC offsets alone.
- Verify that `EstateDate` has a `timezone` column (or inherit the brokerage timezone) before building the calendar integration.

**Source:** [Google Calendar timezone guide](https://www.codestudy.net/blog/list-of-acceptable-google-calendar-api-time-zones/)

---

### Pitfall 8: Google Calendar Duplicate Event Creation on Retry

**What goes wrong:** The calendar sync job creates an event via the Google Calendar API. The API responds with a timeout or 5xx error. SolidQueue retries the job. The original request actually succeeded server-side — Google now creates a second event for the same `EstateDate`. Users see duplicates.

**Why it happens:** HTTP POST to create calendar events is not idempotent. Retry-on-failure without idempotency keys creates duplicates.

**Consequences:** Duplicate calendar events accumulate for every retry cycle. Cleanup requires a separate deduplication pass.

**Prevention:**
- Use Google Calendar's `eventId` field: generate a deterministic ID from `EstateDate.id` (e.g., `"estatedate-#{estate_date.id}"`, slugified to match Google's alphanumeric constraint). Google returns 409 if the ID already exists — treat 409 as success on retry.
- Store `google_event_id` on `UserCalendarConnection` or a join table immediately after creation so subsequent retries can use the update path instead.

**Source:** [Google Calendar API error handling](https://developers.google.com/workspace/calendar/api/guides/errors)

---

### Pitfall 9: Apple CalDAV — No OAuth, Requires App-Specific Password

**What goes wrong:** Unlike Google and Microsoft, Apple iCloud CalDAV does not support OAuth 2.0. Users must manually generate an app-specific password in their Apple ID settings and provide it to the app. Any change to their primary Apple password immediately revokes all app-specific passwords, breaking the connection silently.

**Why it happens:** Apple has not opened a standard OAuth 2.0 integration for iCloud CalDAV. The CalDAV endpoint is `caldav.icloud.com` using basic auth with the app-specific password.

**Consequences:**
- The "connect" UX for Apple Calendar is fundamentally different from Google/Microsoft — no OAuth redirect, just a username + password form.
- CalDAV does not support webhooks — no push notifications for changes. Sync is pull-only.
- Full PUT required for any event update (no PATCH).
- If a user changes their Apple ID password, the stored credential silently goes dead.

**Prevention:**
- Design the Apple Calendar connection UI as a credential input form, not an OAuth redirect button. Make this difference explicit to the user.
- Store the app-specific password using `attr_encrypted` (ActiveRecord Encryption already exists on the project for board credentials — use the same pattern).
- Add a connectivity check before each sync attempt and surface an "Apple Calendar disconnected — please reconnect" error to the user when basic auth fails (401).
- Consider CalDAV URL discovery: the standard principal URL for iCloud is `https://caldav.icloud.com` with PROPFIND to discover calendar home sets.

**Source:** [iCloud CalDAV integration guide](https://www.onecal.io/blog/how-to-integrate-icloud-calendar-api-into-your-app) | [Apple app-specific passwords](https://support.apple.com/en-us/102654)

---

### Pitfall 10: Microsoft Graph — Personal Accounts vs. Work/School Accounts Require Different App Registration

**What goes wrong:** A Microsoft Entra app registration configured for "organizational accounts only" will reject personal Microsoft accounts (Outlook.com, Hotmail, Live). Real estate agents are likely to use personal Microsoft accounts. If the app registration uses the `/organizations` OAuth endpoint rather than `/common`, personal account logins will fail with a 401.

**Why it happens:** The OAuth tenant endpoint determines which account types are accepted. `https://login.microsoftonline.com/organizations` = work/school only. `https://login.microsoftonline.com/common` = both personal and organizational.

**Consequences:** A substantial portion of users (personal Outlook accounts) cannot connect their Microsoft calendar.

**Prevention:**
- Set the app registration "Supported account types" to "Accounts in any organizational directory and personal Microsoft accounts."
- Use `https://login.microsoftonline.com/common` as the OAuth authority.
- Be aware: client credentials flow (app-only auth) does not support personal accounts — use delegated auth (on-behalf-of user) only.

**Source:** [Microsoft Graph auth docs](https://learn.microsoft.com/en-us/graph/auth-v2-user) | [Multi-tenant + personal account Q&A](https://learn.microsoft.com/en-us/answers/questions/1289403/determine-organisationid-tenant-upon-oauth2-login)

---

### Pitfall 11: Rack::Attack In-Memory Store — Per-Worker Counters

**What goes wrong:** The default `Rack::Attack.cache.store` is `Rails.cache`, which in a Puma multi-worker deployment defaults to an in-memory store. Each Puma worker maintains its own independent counter. An attacker gets `N × limit` attempts (where N is the number of workers) before being blocked, completely defeating rate limiting on login.

**Why it happens:** `rack-attack` works correctly only with a shared backing store. The in-memory store is siloed per-process.

**Consequences:** Rate limiting on `POST /v1/sessions` is illusory — provides no real protection with multiple Puma workers.

**Prevention:**
- Use the existing PostgreSQL database as the cache backend (`ActiveRecord::ConnectionAdapters::CacheStore` or `dalli` with Memcached), or configure `Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new` only for single-worker dev.
- In production: configure `config.cache_store = :redis_cache_store` or use a shared PostgreSQL-backed store.
- The simplest option given the existing stack: configure `Rails.cache` to use a `SolidCache` or a database-backed store, which SolidQueue (already in the stack) supports.

**Source:** [Rack::Attack production guide](https://ttb.software/2026/03/21/rails-rate-limiting-rack-attack-production-guide/)

---

### Pitfall 12: CORS Dynamic Origins — Regex Suffix Attack

**What goes wrong:** When replacing the wildcard CORS origin with a regex to match all brokerage subdomains (e.g., `/.*\.yourapp\.com/`), an attacker can register `evil-yourapp.com` or `yourapp.com.evil.com` and satisfy a poorly anchored regex. The CORS `Origin` header is attacker-controlled.

**Why it happens:** `Rack::CORS` accepts a regex for `origins`. If the regex is `/.*.yourapp.com/` (unescaped dot, no anchors), it matches any string containing `yourapp.com` including `badsite-yourapp.com.attacker.io`.

**Consequences:** A malicious site can make cross-origin credentialed requests to the API on behalf of a logged-in user. Combined with the existing `localStorage` JWT, this allows CSRF-style token theft.

**Prevention:**
- Use a proc for `origins` that performs an explicit DB lookup:
  ```ruby
  origins do |source, env|
    BrokerageDomain.exists?(domain: source.gsub(/^https?:\/\//, ''))
  end
  ```
- Or if using a regex, anchor tightly: `/\Ahttps:\/\/[a-z0-9-]+\.yourapp\.com\z/`
- Always specify `https://` protocol in the pattern — do not allow HTTP origins in production.

**Source:** [Rack::CORS configuration tricks](https://blog.jverkamp.com/2020/01/16/rackcors-configuration-tricks/) | [CORS security vulnerabilities](https://outpost24.com/blog/exploiting-permissive-cors-configurations/)

---

### Pitfall 13: `Current.brokerage` Leaking Between Tests

**What goes wrong:** `ActiveSupport::CurrentAttributes` resets between requests in production via a Rack middleware. In Minitest, there is no HTTP request boundary — `Current.brokerage` and `Current.user` set in one test persist into the next test unless explicitly reset. Tests appear to pass individually but fail in batch runs depending on execution order.

**Why it happens:** Rails resets `CurrentAttributes` via `CurrentAttributes.reset_all` in the `ActionDispatch::Executor` middleware, which wraps each request. In test context without a full request cycle (e.g., unit tests calling service objects directly), no reset occurs.

**Consequences:**
- Tenant isolation tests pass in isolation but fail in suites
- False negatives: a query that should return 0 records (wrong brokerage) returns correct results because `Current.brokerage` leaked from the prior test's setup
- Extremely hard to debug — failure depends on test ordering

**Prevention:**
- Add a global Minitest `teardown` that resets `Current`:
  ```ruby
  # test/test_helper.rb
  class ActiveSupport::TestCase
    teardown { Current.reset }
  end
  ```
- For integration tests that do use `ActionDispatch::IntegrationTest`, `Current` is reset automatically between requests — but not between the `setup` block and the first request.

**Detection:** Tests pass with `--seed <specific-seed>` but fail with a different seed. Add `minitest-bisect` to the test toolchain.

---

### Pitfall 14: Minitest + `acts_as_paranoid` — Transaction Rollback Does Not Restore Soft-Deleted Records

**What goes wrong:** `database_cleaner` with the `:transaction` strategy wraps each test in a transaction that is rolled back. This works correctly for hard deletes. But if a test calls `model.destroy` with `acts_as_paranoid`, the record gets `deleted_at` set (soft delete) — and that change is inside the transaction, so it will be rolled back correctly. However, if a test explicitly calls `model.really_destroy!`, the record is permanently deleted and the rollback strategy is ineffective.

More importantly: `acts_as_paranoid`'s default scope hides soft-deleted records. Tests that verify "record is deleted" may pass for wrong reasons if the record was never created in the first place (factory problem). And `.without_deleted` in production code must be explicitly exercised in tests — the default scope means omitting it in test queries silently hides the bug.

**Prevention:**
- Use `:transaction` strategy (not `:truncation`) for speed — it works correctly with soft deletes as long as `really_destroy!` is avoided in test setup/teardown.
- Write explicit tests that create a soft-deleted record and verify it is invisible to production queries (which use `.without_deleted`) and visible via `with_deleted`.
- In test factories, do not call `destroy` in a factory trait — set `deleted_at` directly to avoid triggering callbacks.

---

### Pitfall 15: Google Calendar Sync Token Invalidation — No Full Resync Fallback

**What goes wrong:** Google Calendar sync tokens (used for incremental sync to avoid re-fetching all events) expire and become invalid. When this happens, Google returns a `410 Gone` with `fullSyncRequired`. If the job has no fallback to perform a full sync when it receives a 410, it will crash or silently fail on every subsequent sync attempt.

**Why it happens:** Sync tokens are invalidated server-side by Google for various reasons (too old, ACL changes, internal server decisions). They cannot be renewed — only replaced by a full sync.

**Consequences:** Calendar sync permanently stops working for affected users. Error logs show 410 responses that are not handled, SolidQueue discards the job after retry exhaustion, and the `UserCalendarConnection` record shows stale status.

**Prevention:**
- Always handle 410 explicitly in the Google Calendar sync job: perform a full resync, store the new sync token, and continue.
- Store `sync_token` on `UserCalendarConnection` and clear it + set a `needs_full_resync` flag when a 410 is received.

**Source:** [Google Calendar sync guide](https://developers.google.com/workspace/calendar/api/guides/sync)

---

## Minor Pitfalls

Issues that cause annoyance or minor bugs but are easily caught and fixed.

---

### Pitfall 16: Amplify `federatedSignIn` Double Redirect

**What goes wrong:** When Amplify's `federatedSignIn({ provider: 'Google' })` completes, Cognito redirects to the callback URL with an authorization code. Amplify then exchanges the code for tokens and fires another redirect. If the app has a post-login redirect (e.g., "redirect to the page the user was trying to access"), the double redirect can land the user on an unexpected page.

**Prevention:** Use `Hub.listen('auth', ...)` in Amplify to detect the `signIn` event rather than relying on URL parameters after redirect. Store the intended destination in `sessionStorage` before initiating `federatedSignIn` and restore it in the Hub listener.

**Source:** [amplify-js issue #4822](https://github.com/aws-amplify/amplify-js/issues/4822)

---

### Pitfall 17: Rack::Attack Throttling by Email — Denial-of-Service Vector

**What goes wrong:** A common rack-attack pattern throttles by `params[:email]` on login. If implemented, a malicious actor can intentionally trigger rate-limit lockouts for legitimate users by submitting failed login attempts with another user's email address.

**Prevention:** Throttle by IP address only (not by email) for the login endpoint. Use IP + email combination only for an aggressive lockout tier (e.g., 10 attempts from the same IP for the same email).

**Source:** [Rack::Attack ultimate guide](https://wafris.org/guides/ultimate-guide-to-rack-attack)

---

### Pitfall 18: Microsoft Graph Throttling — `Retry-After` Header Not Respected

**What goes wrong:** Microsoft Graph Calendar API returns 429 with a `Retry-After` header when throttled. If the retry logic uses a fixed delay (e.g., `retry_on ... wait: 5.seconds`) rather than reading `Retry-After`, the job re-attempts too quickly, receives another 429, and cycles through all retries before `Retry-After` has elapsed.

**Prevention:** Parse the `Retry-After` header from the 429 response and use `raise TooManyRequestsError` with a custom `wait` value in SolidQueue, or implement a dedicated retry job that respects the header value.

**Source:** [Microsoft Graph throttling guidance](https://learn.microsoft.com/en-us/graph/throttling)

---

### Pitfall 19: Test Factory Tenant Scope — Factories Creating Orphaned Records

**What goes wrong:** When factories create records without specifying a brokerage, they generate a random brokerage via `association :brokerage`. Tests that do not set `Current.brokerage` and rely on implicit factory associations will have mismatched brokerage context, causing queries scoped to `Current.brokerage` to return 0 records, and tests to fail for the wrong reason.

**Prevention:**
- Create a shared test helper that sets up a canonical test brokerage and user:
  ```ruby
  def setup_tenant(role: :admin)
    @brokerage = create(:brokerage)
    @user = create(:user)
    create(:brokerage_membership, user: @user, brokerage: @brokerage, role: role)
    Current.brokerage = @brokerage
    Current.user = @user
  end
  ```
- All factories for tenant-scoped models should accept `brokerage:` as an explicit parameter rather than generating a new one each time.

---

### Pitfall 20: Deleting the Dead `FilterByPopup` Component — Import Graph Check

**What goes wrong:** `FilterByPopup.tsx` imports `framer-motion` which does not exist. The file is described as dead code. Deleting it without verifying no other file imports it could introduce a build error if there is a dynamic import or barrel export that is not easily visible by static grep.

**Prevention:** Before deleting, run `grep -r "FilterByPopup" frontend/src/` to verify zero import sites. Also check for any barrel `index.ts` re-exports.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Google OAuth (Cognito federated) | Account duplication for existing email/password users | Implement PreSignUp Lambda with `AdminLinkProviderForUser` before any test user signs in |
| Google OAuth (Cognito federated) | `email_verified` reset on every sign-in | Configure Google attribute mapping in Cognito before first federated sign-in |
| Google OAuth (Amplify frontend) | Callback URL rejected for brokerage subdomains | Decide on fixed-callback vs per-domain strategy before writing frontend code |
| Calendar Sync — Google | Duplicate events on job retry | Use deterministic `eventId` derived from `EstateDate.id` from day one |
| Calendar Sync — Google | Sync token 410 → permanent failure | Handle 410 with full resync fallback before shipping |
| Calendar Sync — Google | DST time drift | Use IANA timezone IDs, never bare UTC offsets |
| Calendar Sync — Apple | OAuth assumption | Apple CalDAV uses basic auth with app-specific password — different UX pattern entirely |
| Calendar Sync — Apple | Silent disconnect on password change | Build connectivity check + user-facing error for 401 responses |
| Calendar Sync — Microsoft | Personal vs work account | Use `/common` endpoint and "multi-tenant + personal accounts" app registration |
| Calendar Sync (all) | Token refresh race condition | Use PostgreSQL advisory locks on `UserCalendarConnection.id` during token refresh |
| Calendar Sync (all) | `Current.brokerage` nil in jobs | Set `Current.brokerage` + `Current.user` at job start from job arguments |
| RBAC enforcement | Per-controller `before_action` drift | Use `Admin::BaseController` inheritance, not per-controller `before_action` |
| CORS tightening | Regex suffix attack | Use DB proc-based origin check or tightly anchored regex with scheme enforcement |
| Rack::Attack | In-memory store per Puma worker | Configure shared cache store before deploying rate limiting |
| Test suite setup | `Current` attributes leaking between tests | Add `teardown { Current.reset }` in `test_helper.rb` on day one |
| Test suite setup | Factory orphaned tenant records | Define a `setup_tenant` helper; all tenant-scoped factories take explicit `brokerage:` |
| Test suite (soft deletes) | False confidence from `.without_deleted` | Write tests that explicitly verify soft-deleted records are invisible to production queries |

---

## Sources

- [Cognito account consolidation docs](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html)
- [amplify-js issue: account linking remaining issues](https://github.com/aws-amplify/amplify-js/issues/11565)
- [Cognito federated auth guide](https://awsfundamentals.com/blog/cognito-federated-auth)
- [Code Genie: linking email + Google + SAML in Cognito](https://codegenie.codes/blog/aws-cognito-user-pools-sign-in-with-email-google-saml-and-link-to-a-single-user/)
- [Amplify social provider sign-in docs (Gen 1)](https://docs.amplify.aws/gen1/react/build-a-backend/auth/add-social-provider/)
- [amplify-cli issue #2792: multiple redirect URLs](https://github.com/aws-amplify/amplify-js/issues/2792)
- [Google Calendar API error handling](https://developers.google.com/workspace/calendar/api/guides/errors)
- [Google Calendar quota and rate limits](https://developers.google.com/workspace/calendar/api/guides/quota)
- [Google Calendar sync token guide](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Google Calendar timezone guide (IANA)](https://www.codestudy.net/blog/list-of-acceptable-google-calendar-api-time-zones/)
- [iCloud CalDAV integration guide](https://www.onecal.io/blog/how-to-integrate-icloud-calendar-api-into-your-app)
- [Apple app-specific passwords](https://support.apple.com/en-us/102654)
- [Microsoft Graph auth for users](https://learn.microsoft.com/en-us/graph/auth-v2-user)
- [Microsoft Graph throttling guidance](https://learn.microsoft.com/en-us/graph/throttling)
- [OAuth token management for SaaS](https://truto.one/blog/how-to-architect-a-scalable-oauth-token-management-system-for-saas-integrations/)
- [Rack::Attack production guide](https://ttb.software/2026/03/21/rails-rate-limiting-rack-attack-production-guide/)
- [Rack::Attack ultimate guide](https://wafris.org/guides/ultimate-guide-to-rack-attack)
- [Rack::CORS configuration tricks](https://blog.jverkamp.com/2020/01/16/rackcors-configuration-tricks/)
- [CORS vulnerabilities and permissive configurations](https://outpost24.com/blog/exploiting-permissive-cors-configurations/)

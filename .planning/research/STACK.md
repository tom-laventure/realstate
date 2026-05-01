# Technology Stack — Milestone 2 Additions

**Project:** RealState SaaS — Milestone 2
**Researched:** 2026-04-30
**Scope:** Three new capability areas only. Existing stack (Rails 7.1, React 18, Cognito, TanStack Query v4, shadcn/ui, etc.) is already documented in `.planning/codebase/STACK.md`.

---

## Area 1: Google Sign-In via Cognito Federated Identity

### How the flow works

Cognito acts as the OAuth broker. The frontend calls `signInWithRedirect({ provider: 'Google' })` via Amplify, which redirects to the Cognito Hosted UI. Cognito handles the Google OAuth2 handshake at its own `/oauth2/idpresponse` endpoint, creates or retrieves a Cognito User Pool record, then redirects back to the app's `redirectSignIn` URL with Cognito tokens (not Google tokens — Google's token is consumed by Cognito and discarded).

After the redirect lands, Amplify fires a Hub `signInWithRedirect` event and populates its token cache. The frontend can then call `fetchAuthSession()` to get the Cognito `idToken`. **The existing `POST /v1/sessions` backend endpoint must accept this Cognito idToken the same way it accepts an email/password-derived one** — `CognitoAuth` already verifies the token via `TokenService`, so the backend flow is unchanged after a thin adapter in the frontend.

### New packages — Frontend

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `aws-amplify` | already at 6.15.9 | `signInWithRedirect`, Hub events | Already installed — no new dep |
| `@aws-amplify/auth` | already at 6.17.1 | `fetchAuthSession` post-redirect | Already installed — no new dep |

No new frontend packages needed. The `signInWithRedirect` API and Hub listener are already in the installed Amplify v6 bundle. (MEDIUM confidence — confirmed via Amplify Gen 1 docs.)

### New gems — Backend

None required for the sign-in path. Cognito validates the Google identity and issues its own JWT. The backend receives a standard Cognito idToken; `CognitoAuth` + `TokenService` verify it identically to a password login.

### Account linking — Backend

Linking an existing email/password Cognito user to a Google identity requires calling `AdminLinkProviderForUser` on the Cognito User Pools API. The existing `aws-sdk-cognitoidentityprovider` gem (v1.132.0) already exposes this call via `client.admin_link_provider_for_user`. No new gem needed.

The recommended approach is a **Cognito Pre Sign-Up Lambda trigger**: when a Google sign-in arrives for an email that already has a native Cognito user, the Lambda calls `AdminLinkProviderForUser` automatically, merging the identities. After linking, the user signs in as their existing account; the Cognito `idToken` `identities` claim lists both providers. (MEDIUM confidence — AWS docs + community sources agree on this pattern.)

### Cognito User Pool configuration (one-time, not code)

1. Create a Google OAuth 2.0 Web Client in Google Cloud Console.
2. Add Google as an Identity Provider in the Cognito User Pool console.
3. Set `Authorized redirect URI` in Google to `https://<cognito-domain>/oauth2/idpresponse`.
4. Map the Google `email` attribute to the Cognito `email` user pool attribute.
5. Enable the Cognito Hosted UI and add `redirectSignIn` / `redirectSignOut` URLs for each brokerage domain.
6. Add `VITE_COGNITO_DOMAIN`, `VITE_REDIRECT_SIGN_IN`, `VITE_REDIRECT_SIGN_OUT` to frontend `.env` if not already set.

### Amplify.configure additions

Add `oauth` block to the existing `Amplify.configure` call in `frontend/src/config/amplify.ts`:

```ts
oauth: {
  domain: import.meta.env.VITE_COGNITO_DOMAIN,
  scopes: ['openid', 'email', 'profile'],
  redirectSignIn: [import.meta.env.VITE_REDIRECT_SIGN_IN],
  redirectSignOut: [import.meta.env.VITE_REDIRECT_SIGN_OUT],
  responseType: 'code',
}
```

### Post-redirect session exchange pattern

After `signInWithRedirect` completes, listen via Hub, call `fetchAuthSession()` to get the Cognito `idToken`, then POST it to `POST /v1/sessions` (or a new `POST /v1/sessions/federated` variant) so the backend issues its HS256 JWT:

```ts
Hub.listen('auth', async ({ payload }) => {
  if (payload.event === 'signInWithRedirect') {
    const session = await fetchAuthSession()
    const idToken = session.tokens?.idToken?.toString()
    // POST idToken to backend → backend calls TokenService.issue(user) → store HS256 JWT
  }
})
```

The backend `SessionsController` should accept the Cognito idToken directly (it already can via `CognitoAuth`) and return the same `{ token, user }` shape as a password login. No structural backend changes needed — only the controller action needs to handle the federated path.

---

## Area 2: Personal Calendar Sync (Live OAuth)

### Overview of approach per provider

Three providers, three distinct auth mechanisms:

| Provider | Protocol | Auth | Ruby gem |
|----------|----------|------|----------|
| Google Calendar | REST (Calendar API v3) | OAuth2 with offline access | `google-apis-calendar_v3` + `googleauth` |
| Microsoft Outlook | REST (Graph API) | OAuth2 (Azure AD v2.0) | `oauth2` gem + direct HTTParty calls |
| Apple Calendar | CalDAV | App-specific password (NOT OAuth2) | `calendav` |

### Google Calendar

**Gems:**

| Gem | Version | Purpose | Why |
|-----|---------|---------|-----|
| `google-apis-calendar_v3` | ~> 0.29 | Calendar API v3 client (create/update/delete events) | Official Google-generated client; wraps Calendar REST API cleanly |
| `googleauth` | ~> 1.11 | OAuth2 flow + token refresh via `Signet`; `PostgreSQL`-backed custom token store | Official Google auth library; `WebUserAuthorizer` + custom `TokenStore` stores tokens per-user in DB; auto-refresh on expiry |

`signet` is a transitive dependency of `googleauth` — do not add it separately.

**Token storage pattern:**

Implement a custom `Google::Auth::TokenStore` that persists to a `UserCalendarConnection` model column instead of a file or Redis:

```ruby
class GoogleCalendarTokenStore
  def load(id)
    conn = UserCalendarConnection.find_by(user_id: id, provider: 'google')
    conn&.token_data&.to_json
  end

  def store(id, token)
    UserCalendarConnection.upsert(
      { user_id: id, provider: 'google', token_data: JSON.parse(token), updated_at: Time.current },
      unique_by: [:user_id, :provider]
    )
  end

  def delete(id)
    UserCalendarConnection.where(user_id: id, provider: 'google').destroy_all
  end
end
```

**Token refresh pattern:**

`google-apis-calendar_v3` raises `Google::Apis::AuthorizationError` when a token is expired. Rescue it, call `client.refresh!`, persist the updated token, and retry:

```ruby
service = Google::Apis::CalendarV3::CalendarService.new
service.authorization = build_signet_client(user)
begin
  service.insert_event('primary', event)
rescue Google::Apis::AuthorizationError
  service.authorization.refresh!
  store_token(user, service.authorization)
  retry
end
```

(HIGH confidence — official `google-apis-calendar_v3` and `googleauth` docs + Saeloun blog.)

### Microsoft Calendar (Graph API)

The `msgraph-sdk-ruby` gem was archived on July 9, 2025 and is unmaintained. Do not use it.

**Recommended approach:** Use the `oauth2` gem for the OAuth2 token exchange/refresh, and `httparty` (already in the Gemfile at 0.23.2) for direct Graph API REST calls.

**Gems:**

| Gem | Version | Purpose | Why |
|-----|---------|---------|-----|
| `oauth2` | ~> 2.0 | Microsoft Azure AD v2.0 OAuth2 token exchange + refresh | Standard Ruby OAuth2 client; handles PKCE, token refresh, scopes |

`httparty` is already installed — use it to call `https://graph.microsoft.com/v1.0/me/events`.

**OAuth2 scopes needed:** `offline_access https://graph.microsoft.com/Calendars.ReadWrite`

**Token refresh:** The `oauth2` gem's `AccessToken#refresh!` method handles token refresh; persist the new token back to `UserCalendarConnection`.

(MEDIUM confidence — msgraph-sdk archived status confirmed from GitHub; oauth2 + httparty pattern confirmed from community sources.)

### Apple Calendar (CalDAV / iCloud)

Apple **does not support OAuth2** for iCloud CalDAV access. The only supported mechanism is an iCloud app-specific password (a 16-character password the user generates in their Apple ID settings). There is no OAuth redirect flow — the user provides their iCloud email and app-specific password directly.

**Gem:**

| Gem | Version | Purpose | Why |
|-----|---------|---------|-----|
| `calendav` | ~> 1.0 | CalDAV client with built-in Apple iCloud support | Active Ruby CalDAV library; native `Calendav.credentials(:apple, email, app_password)` method; supports create/update/delete via iCalendar |

**Credential storage:** Store the iCloud email and app-specific password encrypted with `ActiveRecord Encryption` (already configured for `BrokerageBoardCredential`) on the `UserCalendarConnection` model.

**Key constraint:** Because there is no OAuth redirect for Apple, the UI must present a credential form (email + app-specific password) rather than an OAuth consent screen. Users must manually create the app-specific password at appleid.apple.com.

(HIGH confidence — Apple developer forums confirm no OAuth2 for CalDAV; `calendav` gem confirmed via GitHub.)

### UserCalendarConnection model (new)

```ruby
create_table :user_calendar_connections do |t|
  t.references :user, null: false, foreign_key: true
  t.string :provider, null: false         # 'google', 'microsoft', 'apple'
  t.string :status, default: 'connected'  # 'connected', 'error', 'disconnected'
  t.jsonb :token_data                     # access_token, refresh_token, expires_at (Google/Microsoft)
  t.string :encrypted_credential          # encrypted app-specific password (Apple)
  t.string :encrypted_credential_iv
  t.string :email                         # iCloud email (Apple) or account email
  t.datetime :last_synced_at
  t.text :last_error
  t.timestamps
  t.index [:user_id, :provider], unique: true
end
```

Use `encrypts :credential` (ActiveRecord Encryption, already configured) for the Apple app-specific password column.

### Background job for calendar sync writes

All writes to external calendar APIs go through a `SolidQueue` job (already in the stack). This provides retry resilience for transient API failures without blocking the request cycle. The project already uses `polynomially_longer` backoff and `RecordNotFound` discard — apply the same pattern.

---

## Area 3: Rails + React Testing Setup

### Backend (Minitest)

The backend has Minitest, `webmock`, `faker` 3.5.2, and `sqlite3` already installed. The missing piece is test data factories and a reliable integration test helper.

**Gems to add:**

| Gem | Group | Purpose | Why |
|-----|-------|---------|-----|
| `factory_bot_rails` | test, development | Test data factories | Standard Rails factory library; integrates with Minitest via `include FactoryBot::Syntax::Methods` in `test/test_helper.rb`; far more flexible than fixtures for multi-tenant isolation |
| `shoulda-matchers` | test | One-liner AR validations, associations | Reduces boilerplate in model tests; works with Minitest |

`webmock` is already present for stubbing external HTTP (calendar APIs, Cognito, etc.).

**Test helper setup (`test/test_helper.rb` additions):**

```ruby
require 'factory_bot_rails'
require 'shoulda/matchers'

class ActiveSupport::TestCase
  include FactoryBot::Syntax::Methods

  # Wrap every test in a transaction that rolls back — guarantees isolation
  self.use_transactional_tests = true

  Shoulda::Matchers.configure do |config|
    config.integrate { |with| with.test_framework(:minitest).library(:rails) }
  end
end
```

**Controller/Integration test authentication pattern:**

Because the app uses a custom HS256 JWT (`TokenService`), tests should have a helper that mints a test token and attaches it as a header:

```ruby
module AuthTestHelper
  def auth_headers(user)
    token = TokenService.issue(user)
    { 'Authorization' => "Bearer #{token}" }
  end
end

class ActionDispatch::IntegrationTest
  include AuthTestHelper
end
```

**Multi-tenant isolation pattern:**

Every integration test creates its own `brokerage` and `brokerage_domain` via factories, sets up users scoped to that brokerage, and asserts that cross-brokerage requests return 403 or 404. The `BrokerageAuth` concern resolves tenant from the `Host` header — pass it explicitly in tests:

```ruby
get v1_dashboard_estates_path,
    headers: auth_headers(user).merge('Host' => brokerage_domain.domain)
```

(HIGH confidence — Rails testing guide + factory_bot docs + community patterns.)

### Frontend (Vitest + React Testing Library)

The frontend already has `@testing-library/react` 13.4.0, `@testing-library/user-event` 13.5.0, `@testing-library/jest-dom` 5.16.5, and `@types/jest` 29.2.5, but no test runner is configured (no `vitest.config` or `jest.config` detected). The project uses Vite 6, which makes **Vitest** the natural choice — it reuses the Vite config and plugins with zero duplication.

**Packages to add:**

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `vitest` | ^2.0 | Test runner | Vite-native; reads existing `vite.config.ts`; replaces Jest with no config duplication |
| `jsdom` | ^24.0 | DOM environment for Vitest | Replaces browser environment in Node; required for RTL |
| `msw` | ^2.0 | Mock Service Worker | Intercepts Axios/fetch at the network level; single source of truth for API mocking; TanStack Query docs explicitly recommend MSW over mocking axios directly |

**Note:** Upgrade `@testing-library/react` to 14+ if React 18 `act()` warnings appear — v13 has known issues with React 18's concurrent mode. The existing `@testing-library/jest-dom` matchers work with Vitest via the `@testing-library/jest-dom/vitest` import path.

**`vite.config.ts` additions:**

```ts
/// <reference types="vitest" />
// Add to existing defineConfig:
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/tests/setup.ts',
}
```

**`src/tests/setup.ts`:**

```ts
import { afterEach, afterAll, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { server } from './mocks/server'

beforeAll(() => server.listen())
afterEach(() => { cleanup(); server.resetHandlers() })
afterAll(() => server.close())
```

**TanStack Query v4 test wrapper:**

Every test rendering a component or hook that uses TanStack Query needs a fresh `QueryClient` per test (never share state between tests):

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  })
}

export function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}
```

**Testing context hooks:**

Use `renderHook` from `@testing-library/react` (v14+) with the same `QueryClientProvider` wrapper. Mock `useNavigate` from `react-router-dom` with `vi.mock`. Mock Amplify auth with `vi.mock('aws-amplify/auth')`.

(HIGH confidence for Vitest setup — official Vitest docs + DEV guides. HIGH confidence for MSW + TanStack Query pattern — TanStack Query v4 docs + tkdodo.eu blog.)

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Google Social Login | Cognito Federated (Amplify `signInWithRedirect`) | Direct Google OAuth2 (no Cognito) | Violates project constraint: token issuance must stay centralized in `TokenService` |
| Microsoft Graph client | `oauth2` gem + `httparty` | `msgraph-sdk-ruby` | Archived July 2025, unmaintained, never left Community Preview |
| Apple Calendar | `calendav` + app-specific password | OAuth2 CalDAV | Apple does not support OAuth2 for CalDAV; app-specific password is the only option |
| Frontend test runner | Vitest | Jest | Jest requires separate babel/jest transform config fighting Vite; Vitest reuses existing Vite config |
| API mocking | MSW | `vi.mock` on axios | Mocking axios internals breaks when query keys or hooks change; MSW tests the network layer correctly |
| Backend factories | `factory_bot_rails` | Rails fixtures | Fixtures are static and hard to scope per-tenant; factories produce isolated, per-test data |
| Account linking | Cognito Pre Sign-Up Lambda | Manual linking endpoint | Lambda runs before user creation, preventing duplicate identity records automatically |

---

## Installation

### Backend gems to add (`backend/Gemfile`)

```ruby
# Google Calendar
gem 'google-apis-calendar_v3', '~> 0.29'
gem 'googleauth', '~> 1.11'

# Microsoft Calendar OAuth2 (httparty already present)
gem 'oauth2', '~> 2.0'

# Apple Calendar CalDAV
gem 'calendav', '~> 1.0'

# Testing
group :test do
  gem 'factory_bot_rails'
  gem 'shoulda-matchers', '~> 6.0'
end
```

```bash
cd backend && bundle install
```

### Frontend packages to add (`frontend/`)

```bash
npm install -D vitest jsdom msw
# Upgrade RTL if React 18 act() warnings appear:
npm install -D @testing-library/react@14
```

---

## Sources

- Amplify Gen 1 Social Provider docs: https://docs.amplify.aws/gen1/react/build-a-backend/auth/add-social-provider/
- Cognito AdminLinkProviderForUser API: https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminLinkProviderForUser.html
- Cognito federated identity linking guide: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html
- Google Auth Library Ruby (googleauth): https://github.com/googleapis/google-auth-library-ruby
- Google Calendar Rails integration (Saeloun): https://blog.saeloun.com/2023/11/16/integrating-google-calendar-api-into-rails-application/
- Signet token refresh issue: https://github.com/googleapis/signet/issues/131
- msgraph-sdk-ruby (archived): https://github.com/microsoftgraph/msgraph-sdk-ruby
- Apple CalDAV / no OAuth: https://developer.apple.com/forums/thread/94150
- calendav gem: https://github.com/pat/calendav
- TanStack Query v4 testing guide: https://tanstack.com/query/v4/docs/react/guides/testing
- tkdodo testing React Query: https://tkdodo.eu/blog/testing-react-query
- Vitest + RTL setup: https://dev.to/kevinccbsg/react-testing-setup-vitest-typescript-react-testing-library-42c8
- MSW quick start: https://mswjs.io/docs/quick-start/
- factory_bot_rails: https://github.com/thoughtbot/factory_bot_rails
- Rails testing guide: https://guides.rubyonrails.org/testing.html

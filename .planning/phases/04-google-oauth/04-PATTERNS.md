# Phase 4: Google OAuth - Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 11 new/modified files
**Analogs found:** 10 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/controllers/v1/sessions_controller.rb` | controller | request-response | self (extend existing) | exact |
| `backend/config/initializers/cors.rb` | config | request-response | self (extend existing) | exact |
| `backend/app/serializers/user_serializer.rb` | serializer | request-response | self (extend existing) | exact |
| `backend/db/migrate/YYYYMMDD_add_auth_provider_to_users.rb` | migration | batch | `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb` | exact |
| `frontend/src/components/auth/GoogleSignInButton.tsx` | component | event-driven | `frontend/src/containers/auth/CreateAccount.tsx` | role-match |
| `frontend/src/containers/auth/LoginSuccessful.tsx` | component | request-response | self (extend existing) | exact |
| `frontend/src/router/auth/auth.tsx` | route config | — | self (extend existing) | exact |
| `frontend/src/assets/types/userType.ts` | type definition | — | self (extend existing) | exact |
| `frontend/src/assets/api/account/getAccountProfile.tsx` | API module | request-response | self (no change needed — `authProvider` flows through automatically) | exact |
| `frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberDetailCard.tsx` | component | request-response | `frontend/src/components/view/account/EditProfileView.tsx` | role-match |
| `auth-callback/index.html` | static page | request-response | none — no static callback pages exist | no analog |
| `lambda/pre_signup/index.js` | lambda | event-driven | none — no Lambda functions exist in repo | no analog |

---

## Pattern Assignments

### `backend/app/controllers/v1/sessions_controller.rb` (controller, request-response)

**Analog:** self — extend the existing `#create` action

**Current full file** (`backend/app/controllers/v1/sessions_controller.rb`, lines 1-51):
```ruby
module V1
  class SessionsController < ApplicationController
    include CognitoAuth
    include BrokerageAuth

    before_action :authenticate_cognito_user!, only: [:destroy]

    def skip_brokerage_membership?
      true
    end

    # POST /v1/sessions
    def create
      if params[:email].blank? || params[:password].blank?
        render json: {error: "Email and password are required"}, status: :unprocessable_entity
        return
      end

      claims = CognitoService.initiate_auth(email: params[:email], password: params[:password])

      user = User.find_or_initialize_by(cognito_sub: claims[:sub])
      user.email = claims[:email] if user.email.blank?

      if user.first_name.blank?
        full_name = claims[:name].presence || user.email.split("@").first
        parts = full_name.split(/\s+/, 2)
        user.first_name = claims[:first_name].presence || parts[0] || "User"
        user.last_name = claims[:last_name].presence || parts[1] || "Unknown"
      end

      user.name = claims[:name] if user.name.blank?
      user.save!

      render json: {token: TokenService.issue(user)}, status: :ok
    rescue CognitoService::AuthError => e
      render json: {error: e.message}, status: :unauthorized
    rescue ActiveRecord::RecordInvalid => e
      render json: {error: "Could not create user account: #{e.message}"}, status: :unprocessable_entity
    end

    # DELETE /v1/sessions
    def destroy
      CognitoService.admin_user_global_sign_out(Current.user.cognito_sub)
    rescue => e
      Rails.logger.warn("Sign-out error: #{e.class} - #{e.message}")
    ensure
      head :no_content
    end
  end
end
```

**OAuth branch to add** (from RESEARCH.md Pattern 2 — verified against codebase):

The new `#create` action branches on `params[:id_token].present?` BEFORE the existing email/password check. Key differences from the email/password path:
- Uses `JWT.decode(params[:id_token], nil, false)` — third arg `false` skips RS256 verification (same pattern as `CognitoService.initiate_auth` line 39 which uses `JWT.decode(result.authentication_result.id_token, nil, false)`)
- Claims are string-keyed (`claims["sub"]`, `claims["email"]`) NOT symbol-keyed (`claims[:sub]`) — because `JWT.decode` returns string keys, while `CognitoService` returns a transformed hash with symbol keys
- Sets `user.auth_provider = "google"` on the user object before `save!`
- Rescues `JWT::DecodeError` (not `CognitoService::AuthError`)
- Must NOT call `TokenService.verify` — that uses HS256 and will raise `JWT::DecodeError` against RS256-signed Cognito tokens

**Error handling pattern** (lines 36-39 of existing file):
```ruby
rescue CognitoService::AuthError => e
  render json: {error: e.message}, status: :unauthorized
rescue ActiveRecord::RecordInvalid => e
  render json: {error: "Could not create user account: #{e.message}"}, status: :unprocessable_entity
```
OAuth branch adds `rescue JWT::DecodeError => e` with `status: :unauthorized`.

---

### `backend/config/initializers/cors.rb` (config, request-response)

**Analog:** self — extend the existing `origins` proc

**Current full file** (`backend/config/initializers/cors.rb`, lines 1-24):
```ruby
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

**Change:** Replace line 9 (`host.present? && BrokerageDomain.exists?(domain: host)`) with:
```ruby
host.present? && (
  BrokerageDomain.exists?(domain: host) ||
  source == "https://auth.realtybase.ca"
)
```
The `source` variable (full origin string including scheme) is compared exactly — not `host` — because `host` strips the scheme and the special-case check needs to distinguish `https://` from `http://`.

---

### `backend/app/serializers/user_serializer.rb` (serializer, request-response)

**Analog:** self — add one attribute to the existing `attributes` declaration

**Current `attributes` line** (line 4):
```ruby
attributes :id, :email, :name, :first_name, :last_name, :created_at, :in_group
```

**Change:** Add `:auth_provider` to the attributes list:
```ruby
attributes :id, :email, :name, :first_name, :last_name, :created_at, :in_group, :auth_provider
```

No custom method needed — `auth_provider` is a plain string column, Active Model Serializers reads it directly. Value is `nil` for existing users (serialized as JSON `null`; camelcase-keys transforms the key to `authProvider`; frontend treats `undefined`/`null` as "no badge").

**Conditional attribute pattern** (lines 9-12 of existing file, for reference):
```ruby
attribute :show_welcome_banner, if: :include_welcome_banner?
attribute :groups, if: :groups_loaded?
attribute :membership, if: :membership_loaded?
```
`auth_provider` does NOT need an `if:` guard — it should always be serialized, including as `null`.

---

### `backend/db/migrate/YYYYMMDD_add_auth_provider_to_users.rb` (migration, batch)

**Analog:** `backend/db/migrate/20260503000001_add_welcomed_at_to_brokerage_memberships.rb`

**Analog file** (full, lines 1-7):
```ruby
class AddWelcomedAtToBrokerageMemberships < ActiveRecord::Migration[7.1]
  def change
    add_column :brokerage_memberships, :welcomed_at, :datetime
    add_column :brokerage_memberships, :deleted_at, :datetime
    add_index :brokerage_memberships, :deleted_at
  end
end
```

**Copy pattern:**
```ruby
class AddAuthProviderToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :auth_provider, :string, default: nil
  end
end
```

Migration version convention: use `YYYYMMDDHHMMSS` format matching existing migrations (e.g., `20260505000001_add_auth_provider_to_users.rb`). No index needed — `auth_provider` is not queried for filtering.

---

### `frontend/src/components/auth/GoogleSignInButton.tsx` (component, event-driven)

**Analog:** `frontend/src/containers/auth/CreateAccount.tsx` (loading state + Button pattern)

**Current skeleton** (`frontend/src/components/auth/GoogleSignInButton.tsx`, lines 1-38):
```tsx
import { useEffect } from 'react'
import { signInWithRedirect, fetchAuthSession } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import { Button } from '@/components/ui/button'

const GoogleSignInButton = () => {
  useEffect(() => {
    const unlisten = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        fetchAuthSession().then((session) => {
          const idToken = session.tokens?.idToken?.toString()
          if (idToken) {
            // Session exchange — Phase 4 will wire this to POST /v1/sessions
          }
        })
      }
    })
    return () => {
      if (typeof unlisten === 'function') unlisten()
    }
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
```

**Loading state pattern from CreateAccount.tsx** (lines 75-76, 402-404):
```tsx
const [loading, setLoading] = useState(false)
// ...
<Button className="w-full" type="submit" disabled={loading}>
    {mode === 'create' ? 'Create account' : 'Log in'}
</Button>
```

**Error display pattern from CreateAccount.tsx** (lines 396-400):
```tsx
{error && (
    <div className="text-sm text-destructive" role="alert">
        {error}
    </div>
)}
```

**Phase 4 changes to make:**
1. Remove the `Hub.listen` `useEffect` entirely — callback page handles session exchange, not this component
2. Remove `fetchAuthSession` and `Hub` imports (no longer needed)
3. Add `useState` for loading state (spinner for ~500ms per D-12)
4. Encode `customState = btoa(JSON.stringify({ brokerage: window.location.hostname }))` on click
5. Call `signInWithRedirect({ provider: 'Google', customState })` after spinner delay
6. Replace button content with Google logo SVG (inline, not lucide-react) + "Continue with Google" text
7. Keep `Button` from `@/components/ui/button` with `variant="outline"` and `className="w-full"`

**Icon exception:** CLAUDE.md says lucide-react only, but CONTEXT.md explicitly permits an inline Google SVG as a Claude's Discretion item. Use a minimal inline `<svg>` for the Google G logo.

---

### `frontend/src/containers/auth/LoginSuccessful.tsx` (component, request-response)

**Analog:** self — add a `useEffect` on mount to existing spinner component

**Current full file** (`frontend/src/containers/auth/LoginSuccessful.tsx`, lines 1-15):
```tsx
const LoginSuccessful = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6 w-full">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                <div>
                    <div className="text-lg font-semibold text-foreground">Finalizing your sign-in</div>
                    <div className="text-sm text-muted-foreground">Loading your profile and workspace…</div>
                </div>
            </div>
        </div>
    )
}
```

**Pattern to add** (from RESEARCH.md Pattern 7 + lib/auth.ts verification):

`lib/auth.ts` exports `setToken` which writes to `localStorage` with key `'auth_token'` (line 5). This is the same key the existing Axios instance and `isAuthenticated()` read.

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken } from '@/lib/auth'

// Inside the component, before the return:
const navigate = useNavigate()
const [error, setError] = useState(false)

useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const token = params.get('token')

    if (!token) {
        setError(true)
        return
    }

    setToken(token)
    window.location.hash = ''    // clear before navigate — hash cleared first, navigate exits component
    navigate('/', { replace: true })
}, [])  // empty deps — runs once on mount only (per Pitfall 5)
```

The spinner JSX is unchanged. Add a conditional error state below the spinner card when `error === true` (a small text message linking back to login).

---

### `frontend/src/router/auth/auth.tsx` (route config, —)

**Analog:** self — add one route object to the `children` array

**Current file** (`frontend/src/router/auth/auth.tsx`, lines 1-50):
```tsx
import ErrorPage from '@/containers/errorPage/ErrorPage'
import Login from '@/containers/auth/Login'
import Invitation from '@/containers/auth/Invitation'
import BrokerageContact from '@/containers/auth/BrokerageContact'
import AppShellCreateAccount from '@/components/common/shells/appShellCreateAccount/appShellCreateAccount'

export const auth = {
    path: '/auth/',
    element: <AppShellCreateAccount />,
    errorElement: <ErrorPage />,
    children: [
        {
            path: 'login',
            element: <Login />
        },
        // ...
    ]
}
```

**Changes:**
1. Add import: `import LoginSuccessful from '@/containers/auth/LoginSuccessful'`
2. Add to `children` array:
```tsx
{
    path: 'login-success',
    element: <LoginSuccessful />
}
```

`LoginSuccessful` is not currently imported in `auth.tsx` (verified — it exists at the path but is not referenced in the router).

---

### `frontend/src/assets/types/userType.ts` (type definition, —)

**Analog:** self — add one optional field

**Current full file** (`frontend/src/assets/types/userType.ts`, lines 1-21):
```typescript
import { group } from "./groupType"
import MembershipType from "./membershipType"

interface user {
    id: string
    name: string,
    firstName: string,
    lastName: string,
    email: string,

    groups?: group[],
    nextStep?: string,
    membership?: MembershipType,
    licenseNumber?: string,
    inGroup?: boolean,
    createdAt?: string,
    showWelcomeBanner?: boolean,
}
```

**Change:** Add `authProvider?: string` to the `user` interface, after `showWelcomeBanner`:
```typescript
authProvider?: string,
```

Optional (`?`) because existing users will have `null` from the API (→ `undefined` after camelcase-keys). The badge renders only when `profile.authProvider === 'google'`.

---

### `frontend/src/assets/api/account/getAccountProfile.tsx` (API module, request-response)

**No change needed.** The global Axios interceptor (`camelcaseKeys(response.data, { deep: true })`) automatically converts `auth_provider` → `authProvider`. The response type `GetAccountProfileResponse` wraps the `user` interface — once `authProvider` is added to `userType.ts`, this file automatically picks it up.

**Current full file** (for reference, lines 1-13):
```tsx
import axiosInstance from '@/assets/axios/axios'
import user from '@/assets/types/userType'

interface GetAccountProfileResponse {
    user: user
}

const getAccountProfile = async (): Promise<GetAccountProfileResponse> => {
    const response = await axiosInstance.get('/v1/account/profile')
    return response.data as GetAccountProfileResponse
}

export default getAccountProfile
```

---

### `frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberDetailCard.tsx` (component, request-response)

**Analog:** self — add a conditional badge row to the existing card

**Analog for badge chip styling:** `MemberDetailCard.tsx` lines 54-57 already use the `Badge` component from `@/components/ui/badge`:
```tsx
<Badge variant="outline" className={roleClassName(member?.membership?.role)}>
    {getRoleLabel(member?.membership?.role)}
</Badge>
```

**Badge row pattern to add** (below the email row, above the Role row — between lines 71 and 73):

The existing row pattern (lines 64-70):
```tsx
<div className="flex items-start gap-3">
    <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
    <div className="min-w-0">
        <div className="text-xs text-muted-foreground">Email</div>
        <div className="break-all text-sm">{member?.email || '—'}</div>
    </div>
</div>
```

**Google badge addition** — only rendered when `member?.authProvider === 'google'`. Uses the same `flex items-start gap-3` row structure. Icon: inline Google SVG (same exception as `GoogleSignInButton`). Badge chip uses `text-xs` label and a styled inline chip consistent with the card aesthetic.

Note: `MemberDetailCard` receives a `member: user | undefined` prop. Since `authProvider` is optional on the `user` type, use optional chaining: `member?.authProvider === 'google'`.

---

### `frontend/src/config/amplify.ts` (config, —)

**Analog:** self — update the `redirectSignIn` array

**Current file** (`frontend/src/config/amplify.ts`, line 16):
```typescript
redirectSignIn: [import.meta.env.VITE_REDIRECT_SIGN_IN || 'http://localhost:3000/'],
```

**Change:**
```typescript
redirectSignIn: [
    'https://auth.realtybase.ca/oauth/callback',
    import.meta.env.VITE_REDIRECT_SIGN_IN || 'http://localhost:3000/',
],
```

The production URL is added as the first entry. The existing env var entry is kept for local development. Both must be registered in the Cognito user pool OAuth settings for the redirect to work.

---

## Shared Patterns

### `setToken` / Token Storage
**Source:** `frontend/src/lib/auth.ts`, lines 4-5
**Apply to:** `LoginSuccessful.tsx` (hash reading), `auth-callback/index.html` (does NOT apply — callback page uses its own fetch to POST /v1/sessions)
```typescript
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)
// TOKEN_KEY = 'auth_token' (line 1)
```
`LoginSuccessful.tsx` MUST use `setToken` from `@/lib/auth` — not a raw `localStorage.setItem` — to stay consistent with the key used by the Axios instance and `isAuthenticated()`.

### `JWT.decode` No-Verify Pattern
**Source:** `CognitoService.initiate_auth` in `backend/app/services/cognito_service.rb` (verified by RESEARCH.md line 193)
**Apply to:** `SessionsController#create` OAuth branch
```ruby
claims, _header = JWT.decode(params[:id_token], nil, false)
# Third arg false = skip signature verification
# Returns string-keyed hash: claims["sub"], claims["email"], etc.
```
This is the established project pattern. Do NOT call `TokenService.verify` for Cognito-issued idTokens.

### User Find-or-Initialize Pattern
**Source:** `backend/app/controllers/v1/sessions_controller.rb`, lines 22-33
**Apply to:** `SessionsController#create` OAuth branch (same logic, same fallback chain)
```ruby
user = User.find_or_initialize_by(cognito_sub: claims[:sub])
user.email = claims[:email] if user.email.blank?

if user.first_name.blank?
  full_name = claims[:name].presence || user.email.split("@").first
  parts = full_name.split(/\s+/, 2)
  user.first_name = claims[:first_name].presence || parts[0] || "User"
  user.last_name  = claims[:last_name].presence || parts[1] || "Unknown"
end

user.name = claims[:name] if user.name.blank?
user.save!
```
In the OAuth branch, claims are string-keyed (`claims["sub"]` etc.), so adapt accordingly.

### `TokenService.issue` Pattern
**Source:** `backend/app/controllers/v1/sessions_controller.rb`, line 35
**Apply to:** `SessionsController#create` OAuth branch
```ruby
render json: {token: TokenService.issue(user)}, status: :ok
```
Both the email/password path and the OAuth path issue the same app HS256 JWT. Response shape is identical.

### Button Loading State Pattern
**Source:** `frontend/src/containers/auth/CreateAccount.tsx`, lines 75, 269, 402
**Apply to:** `GoogleSignInButton.tsx`
```tsx
const [loading, setLoading] = useState(false)
// ...
<Button ... disabled={loading}>
    {loading ? <span className="h-4 w-4 animate-spin ..." /> : 'Button text'}
</Button>
```
`CreateAccount` uses `setLoading(true)` before async ops and `setLoading(false)` in `finally`. `GoogleSignInButton` uses a ~500ms delay then fires redirect (user navigates away, so no `finally` needed).

### Card Row Pattern (for badge in MemberDetailCard)
**Source:** `frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberDetailCard.tsx`, lines 64-70
**Apply to:** Google badge row in `MemberDetailCard.tsx`
```tsx
<div className="flex items-start gap-3">
    <IconComponent className="mt-0.5 h-4 w-4 text-muted-foreground" />
    <div className="min-w-0">
        <div className="text-xs text-muted-foreground">Label</div>
        <div className="text-sm">Value</div>
    </div>
</div>
```

### "— or —" Divider Pattern
**Source:** No existing analog — use the design system tokens
**Apply to:** `CreateAccount.tsx` (divider between password form and `GoogleSignInButton`)
```tsx
<div className="flex items-center gap-3 my-2">
    <div className="flex-1 h-px bg-border" />
    <span className="text-xs text-muted-foreground">or</span>
    <div className="flex-1 h-px bg-border" />
</div>
```
Uses `bg-border` (Tailwind token from shadcn/ui) and `text-muted-foreground` — consistent with `CreateAccount`'s existing card aesthetic (`border-border`, `text-muted-foreground` labels already present).

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `auth-callback/index.html` | static page | request-response | No static HTML pages exist in the repo. No framework. Pattern: load Amplify config → `fetchAuthSession()` → POST idToken → `window.location.href`. Use RESEARCH.md Pattern 5. |
| `lambda/pre_signup/index.js` | lambda | event-driven | No Lambda functions exist in the repo. Node.js 20.x + AWS SDK v3. Use RESEARCH.md Pattern 6. |

---

## Metadata

**Analog search scope:** `backend/app/controllers/`, `backend/app/serializers/`, `backend/config/initializers/`, `backend/db/migrate/`, `frontend/src/components/auth/`, `frontend/src/containers/auth/`, `frontend/src/containers/account/`, `frontend/src/router/auth/`, `frontend/src/assets/api/account/`, `frontend/src/assets/types/`, `frontend/src/lib/`, `frontend/src/config/`
**Files read:** 20
**Pattern extraction date:** 2026-05-05

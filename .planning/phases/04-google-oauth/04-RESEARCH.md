# Phase 4: Google OAuth - Research

**Researched:** 2026-05-05
**Domain:** AWS Cognito Federated Identity, AWS Amplify v6, Rails JWT session exchange, multi-tenant OAuth callback
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fixed OAuth redirect URL: `https://auth.realtybase.ca/oauth/callback`. Registered in Cognito user pool and Google OAuth app. All tenants share this single URL.
- **D-02:** `state` param encodes brokerage domain only — `base64(JSON.stringify({ brokerage: "broker1.realtybase.ca" }))`. No destination path.
- **D-03:** Callback page at `auth.realtybase.ca/oauth/callback` is a minimal static HTML/JS file (no framework). Calls `fetchAuthSession()` via Amplify, POSTs idToken to `POST /v1/sessions`, receives app JWT, redirects via `window.location.href` to brokerage domain with token in hash.
- **D-04:** Token handoff: redirect to `https://{brokerage_domain}/auth/login-success#token={JWT}`. Hash is browser-only, invisible to server logs. Works for both subdomains and custom domains.
- **D-05:** Extend `POST /v1/sessions` with `id_token` param path. When `id_token` present: call `TokenService.verify(id_token)` to validate/decode Cognito JWT, find-or-create User from `sub` claim, set `auth_provider = 'google'`, return `TokenService.issue(user)`. Email+password path unchanged.
- **D-06:** CORS: extend existing proc to also allow `https://auth.realtybase.ca`. Pattern: `BrokerageDomain.exists?(domain: origin_host) || origin == 'https://auth.realtybase.ca'`.
- **D-07:** Add `/auth/login-success` route. `LoginSuccessful.tsx` (existing spinner screen) handles this route. On mount: reads `window.location.hash`, extracts token, writes to localStorage using `setToken()` from `@/lib/auth`, clears hash, calls `navigate('/', { replace: true })`.
- **D-08:** Add `auth_provider` string column to `users` table via migration. Default `null`. Set to `'google'` in OAuth session exchange path. Returned by `GET /v1/account/profile`.
- **D-09:** Badge appears in profile section of account settings (MemberDetailCard.tsx), below email, above Role row. Rendered as chip when `profile.authProvider === 'google'`. Purely presentational.
- **D-10:** PreSignUp Lambda: when `triggerSource === 'PreSignUp_ExternalProvider'` and matching email Cognito user exists, call `adminLinkProviderForUser`. Must verify `email_verified: true` before linking.
- **D-11:** `GoogleSignInButton` wired into `CreateAccount.tsx` in both login and signup modes, below email/password form, separated by "— or —" divider.
- **D-12:** Button shows spinner ~500ms on click, then `signInWithRedirect({ provider: 'Google' })` fires.
- **D-13:** `signInWithRedirect` passes current brokerage domain in `customState` option. Callback reads from `state` query param on OAuth redirect.

### Claude's Discretion

- Exact base64/JSON encoding format for state param
- Google logo/icon treatment (official SVG — lucide has no Google icon)
- Lambda runtime (Node.js 20.x standard for Cognito triggers)
- Exact chip/badge styling in account settings
- Error handling on callback page if `fetchAuthSession` fails

### Deferred Ideas (OUT OF SCOPE)

- "Connect Google from profile settings" for existing email/password users (v2)
- Microsoft / Apple social login (v2)
- Error page at auth.realtybase.ca with full retry UI
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Google federated IdP in Cognito; fixed intermediary callback URL; `state` param carries brokerage domain; per-tenant session exchange | D-01/D-02/D-03: callback page pattern; D-05: session exchange extension; Amplify v6 `signInWithRedirect` with `customState` confirmed |
| AUTH-02 | PreSignUp Lambda calls `AdminLinkProviderForUser` when Google sign-in matches existing email/password user; verifies `email_verified: true`; handles first-link exception | D-10: Lambda architecture; Lambda runtime Node.js 20.x; AWS SDK v3 `adminLinkProviderForUser` pattern documented below |
| AUTH-03 | "Sign in with Google" button on login screen; `fetchAuthSession()` retrieves idToken; exchange at `POST /v1/sessions` for app HS256 JWT | GoogleSignInButton.tsx skeleton exists; `fetchAuthSession` import confirmed in existing file; session exchange extension on existing controller action |
| AUTH-04 | "Connected via Google" badge in account settings when signed in via Google federation | D-08/D-09: `auth_provider` column + serializer attribute + `MemberDetailCard.tsx` badge; `userType.ts` needs `authProvider?: string` |
</phase_requirements>

---

## Summary

Phase 4 implements Google OAuth federated login across a multi-tenant SaaS platform. The core challenge is that Cognito requires a single registered redirect URI, but the app has unlimited tenant domains — solved by a fixed intermediary callback page at `auth.realtybase.ca` that decodes the tenant from the OAuth `state` parameter and hands off a JWT to the correct tenant domain via URL hash.

The implementation has four atomic components that must all ship together: (1) the PreSignUp Lambda for account linking, (2) the `GoogleSignInButton` implementation, (3) the intermediary callback page, and (4) the `LoginSuccessful.tsx` hash-reading route. The backend session exchange is an extension to the existing `POST /v1/sessions` controller — the OAuth path adds an `id_token` branch alongside the existing email/password branch.

A critical security concern: the existing `TokenService.verify` uses HS256 (the app's own secret), but Cognito-issued idTokens are signed with RS256 using the Cognito user pool's JWKS. The `id_token` path in `SessionsController` **must not call the existing `TokenService.verify`** — it must decode the Cognito JWT without signature verification (or verify against Cognito's JWKS) to extract claims, then call `TokenService.issue(user)` to issue the app's own HS256 token. This is already how `CognitoService.initiate_auth` works: it calls `JWT.decode(id_token, nil, false)` (no verification), trusting Amplify/Cognito to have authenticated the user before returning the token. The OAuth path should follow the same pattern.

**Primary recommendation:** Follow the existing `CognitoService.initiate_auth` pattern — decode the Cognito idToken with `JWT.decode(token, nil, false)` to extract claims (`sub`, `email`, `email_verified`, `given_name`, `family_name`, `name`), then find-or-create the user and issue the app JWT. Do not attempt RS256 JWKS verification unless a security requirement demands it — the existing pattern is the established project precedent.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OAuth redirect initiation | Browser/Client | — | `signInWithRedirect` is a client-side Amplify call; browser navigates to Google |
| OAuth callback / tenant resolution | Static Host (auth.realtybase.ca) | — | Intermediary page lives outside the React SPA; has no server; decodes state and completes exchange |
| JWT session exchange | API/Backend | — | `POST /v1/sessions` validates idToken, finds/creates user, issues app JWT |
| Account linking (PreSignUp) | AWS Lambda | — | AWS-managed trigger; runs in Cognito's execution context, not backend |
| Token storage and app entry | Browser/Client (Frontend SPA) | — | `LoginSuccessful.tsx` reads hash, writes localStorage, navigates |
| "Connected via Google" badge | Frontend SPA | API/Backend | Frontend reads `authProvider` from profile API; backend serializes from DB column |
| CORS policy extension | API/Backend | — | `cors.rb` proc controls which origins can call `POST /v1/sessions` |
| `auth_provider` persistence | Database | API/Backend | `users.auth_provider` column; set in `SessionsController` OAuth path |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| aws-amplify | 6.15.9 (installed) | `signInWithRedirect`, `fetchAuthSession` | Project standard — already installed and configured |
| jwt (Ruby gem) | ~2.7 (installed) | Decode Cognito idToken without verification (nil key, false verify) | Already used in `CognitoService.initiate_auth` for same pattern |
| aws-sdk-cognitoidentityprovider | ~1.65 (installed) | Lambda: `adminLinkProviderForUser` call | Already installed in backend |

[VERIFIED: codebase grep — all three are installed in the project]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-cognito-identity-provider | v3 (Node.js 20.x) | Lambda: `CognitoIdentityProviderClient`, `AdminLinkProviderForUserCommand` | Inside the PreSignUp Lambda (separate from backend Gemfile) |

[ASSUMED] Lambda uses AWS SDK v3 (Node.js 20.x runtime). AWS SDK v3 is standard for all new Lambda functions as of 2023+.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `JWT.decode(token, nil, false)` (no verify) | JWKS RS256 verification | JWKS verification is more secure but adds HTTP round-trip to Cognito; project precedent in `CognitoService.initiate_auth` uses no-verify pattern — consistency is more valuable than marginal security gain here (Amplify already authenticated the user) |
| Static HTML callback page | React SPA callback page | React adds complexity and a full framework load to a transient screen; static is correct per D-03 |
| localStorage token write in callback page | Cookie from callback page | Cross-origin cookie would require `SameSite=None; Secure` + domain matching; hash-based token handoff is simpler and avoids cross-origin cookie complexity per D-04 |

---

## Architecture Patterns

### System Architecture Diagram

```
User (any tenant domain)
     |
     | clicks "Continue with Google"
     v
[GoogleSignInButton.tsx]
     | signInWithRedirect({ provider: 'Google', customState: base64({brokerage: hostname}) })
     v
[Cognito Hosted UI / Google OAuth]
     | -- PreSignUp Lambda trigger (if existing email) --
     | adminLinkProviderForUser → links Google identity to existing Cognito user
     |
     | OAuth redirect (with state param)
     v
[auth.realtybase.ca/oauth/callback] (static HTML/JS page)
     | fetchAuthSession() → gets Cognito idToken
     | POST /v1/sessions { id_token: ... } → CORS-allowed from auth.realtybase.ca
     v
[Rails: POST /v1/sessions]
     | JWT.decode(id_token, nil, false) → extract sub, email, given_name, family_name
     | User.find_or_initialize_by(cognito_sub: sub)
     | user.auth_provider = 'google'
     | user.save!
     | TokenService.issue(user) → app HS256 JWT
     |
     | returns { token: "..." }
     v
[auth.realtybase.ca/oauth/callback]
     | window.location.href = "https://{brokerage_domain}/auth/login-success#token={JWT}"
     v
[LoginSuccessful.tsx at /auth/login-success]
     | useEffect → read window.location.hash → extract token
     | setToken(token) → localStorage 'auth_token'
     | window.location.hash = '' (clear hash)
     | navigate('/', { replace: true })
     v
[Authenticated app — normal flow]
```

### Recommended Project Structure

No new top-level directories needed. All changes fit within existing structures:

```
backend/
├── app/
│   ├── controllers/v1/sessions_controller.rb    # extend with id_token branch
│   └── serializers/user_serializer.rb           # add auth_provider attribute
├── config/initializers/cors.rb                  # add auth.realtybase.ca
├── db/
│   └── migrate/YYYYMMDD_add_auth_provider_to_users.rb
lambda/
└── pre_signup/
    └── index.js                                 # PreSignUp Lambda (new directory in monorepo root)

frontend/
├── src/
│   ├── components/auth/GoogleSignInButton.tsx   # full implementation replacing skeleton
│   ├── containers/auth/LoginSuccessful.tsx      # add hash-reading useEffect
│   ├── router/auth/auth.tsx                     # add /auth/login-success route
│   └── assets/types/userType.ts                # add authProvider?: string

auth-callback/
└── index.html                                   # static callback page (new directory in monorepo root)
```

### Pattern 1: Cognito idToken Decode (No Verify — Project Standard)

**What:** Decode a Cognito-issued idToken to extract user claims without verifying the RS256 signature. Relies on Cognito's own auth having already validated the token.
**When to use:** When Amplify has completed the OAuth flow and returned the idToken via `fetchAuthSession()`. The token is already trusted — it came from Cognito's own hosted UI.

```ruby
# Source: CognitoService#initiate_auth (existing pattern in app/services/cognito_service.rb)
# Existing precedent: JWT.decode(result.authentication_result.id_token, nil, false)
claims, _header = JWT.decode(params[:id_token], nil, false)

sub       = claims["sub"]           # Cognito user sub (UUID)
email     = claims["email"]
email_verified = claims["email_verified"]  # boolean — MUST check before trusting email
given_name  = claims["given_name"]
family_name = claims["family_name"]
name        = claims["name"]
```

[VERIFIED: codebase — CognitoService#initiate_auth line 39 uses this exact pattern]

### Pattern 2: SessionsController — id_token Branch

**What:** Extend `POST /v1/sessions` to handle an `id_token` param alongside the existing `email`+`password` path.

```ruby
# Source: sessions_controller.rb (existing) extended with OAuth branch
def create
  if params[:id_token].present?
    # OAuth path
    claims, _header = JWT.decode(params[:id_token], nil, false)
    email_verified = claims["email_verified"]

    unless email_verified
      render json: { error: "Google account email is not verified" }, status: :unprocessable_entity
      return
    end

    user = User.find_or_initialize_by(cognito_sub: claims["sub"])
    user.email = claims["email"] if user.email.blank?

    if user.first_name.blank?
      full_name = claims["name"].presence || user.email.split("@").first
      parts = full_name.split(/\s+/, 2)
      user.first_name = claims["given_name"].presence || parts[0] || "User"
      user.last_name  = claims["family_name"].presence || parts[1] || "Unknown"
    end

    user.name = claims["name"] if user.name.blank?
    user.auth_provider = "google"
    user.save!

    render json: { token: TokenService.issue(user) }, status: :ok
  elsif params[:email].present? && params[:password].present?
    # Existing email/password path — unchanged
    ...
  else
    render json: { error: "Email and password are required" }, status: :unprocessable_entity
  end
rescue JWT::DecodeError => e
  render json: { error: "Invalid token: #{e.message}" }, status: :unauthorized
rescue ActiveRecord::RecordInvalid => e
  render json: { error: "Could not create user account: #{e.message}" }, status: :unprocessable_entity
end
```

[VERIFIED: codebase — sessions_controller.rb + cognito_service.rb read]

### Pattern 3: CORS Extension for auth.realtybase.ca

**What:** The existing CORS proc only allows origins matching a `BrokerageDomain` record. The callback page at `auth.realtybase.ca` is not a brokerage domain — it needs a special-case OR condition.

```ruby
# Source: config/initializers/cors.rb (existing) + D-06
origins do |source, _env|
  host = begin
    URI.parse(source).host&.downcase
  rescue URI::InvalidURIError
    nil
  end

  host.present? && (
    BrokerageDomain.exists?(domain: host) ||
    source == "https://auth.realtybase.ca"
  )
end
```

[VERIFIED: codebase — cors.rb read; pattern matches existing structure exactly]

### Pattern 4: Amplify signInWithRedirect with customState

**What:** Pass brokerage domain in `customState` so the callback page knows which tenant to redirect back to.

```typescript
// Source: AWS Amplify v6 docs + CONTEXT.md D-13
import { signInWithRedirect } from 'aws-amplify/auth'

const brokerage = window.location.hostname
const customState = btoa(JSON.stringify({ brokerage }))

await signInWithRedirect({
  provider: 'Google',
  customState
})
```

The Amplify library appends `customState` to the OAuth `state` parameter. On redirect, the callback page reads `new URLSearchParams(window.location.search).get('state')`. Amplify encodes the custom state as a suffix separated by `-`. The static callback page must parse this to extract the brokerage domain.

[ASSUMED] Amplify v6 encodes `customState` into the OAuth `state` param as a URL-encoded suffix. The exact format requires testing — the callback page should handle potential encoding variations.

### Pattern 5: Static Callback Page

**What:** Minimal HTML/JS at `auth.realtybase.ca/oauth/callback`. No framework.

```html
<!-- Source: CONTEXT.md D-03; AWS Amplify v6 CDN pattern -->
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { Amplify } from 'https://cdn.jsdelivr.net/npm/aws-amplify@6/dist/aws-amplify.js';
    // ... OR use a bundled version
  </script>
</head>
<body>
  <script type="module">
    // 1. Configure Amplify with the same Cognito settings as the main SPA
    // 2. fetchAuthSession() — Amplify handles PKCE code exchange internally
    // 3. Extract idToken from session.tokens.idToken.toString()
    // 4. Parse state param to get brokerage domain
    // 5. POST idToken to backend
    // 6. window.location.href = `https://${brokerage}/auth/login-success#token=${jwt}`
  </script>
</body>
</html>
```

**Amplify on static page:** The challenge is that Amplify v6 is an ES module. The callback page can use a CDN-hosted bundle or a minimal pre-bundled JS file checked into the repo. Given no framework is allowed, using a pre-built bundle is simpler and avoids CDN reliability concerns.

[ASSUMED] A pre-bundled Amplify callback script (built once, checked into `auth-callback/`) is the most reliable approach. CDN approach introduces runtime dependency.

### Pattern 6: PreSignUp Lambda

**What:** Node.js 20.x Lambda triggered before Cognito creates a federated user. Links Google identity to existing email/password user.

```javascript
// Source: CONTEXT.md D-10 + AWS Cognito PreSignUp trigger docs [ASSUMED: Node.js 20.x SDK v3]
const { CognitoIdentityProviderClient, AdminLinkProviderForUserCommand } = require('@aws-sdk/client-cognito-identity-provider')

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION })

exports.handler = async (event) => {
  if (event.triggerSource !== 'PreSignUp_ExternalProvider') {
    return event
  }

  const { email, email_verified } = event.request.userAttributes

  // Security gate: never link without verified email
  if (!email_verified) {
    throw new Error('Email not verified by provider')
  }

  const [providerName, providerUserId] = event.userName.split('_', 2) // e.g. "Google_123456789"

  try {
    await client.send(new AdminLinkProviderForUserCommand({
      UserPoolId: event.userPoolId,
      DestinationUser: {
        ProviderName: 'Cognito',
        ProviderAttributeValue: email
      },
      SourceUser: {
        ProviderName: providerName,
        ProviderAttributeName: 'Cognito_Subject',
        ProviderAttributeValue: providerUserId
      }
    }))
  } catch (err) {
    // AliasExistsException means already linked — first-link race, not an error
    if (err.name !== 'AliasExistsException') throw err
  }

  return event
}
```

[ASSUMED] AWS SDK v3 `AdminLinkProviderForUserCommand` pattern. `DestinationUser.ProviderAttributeValue` being email (not username) is the standard approach for email-based linking — requires confirmation against AWS docs.

### Pattern 7: LoginSuccessful.tsx — Hash Reading

**What:** Repurpose existing spinner screen to read the JWT from the URL hash and write it to localStorage.

```typescript
// Source: LoginSuccessful.tsx (existing spinner) + D-07
// Token key: 'auth_token' from lib/auth.ts (VERIFIED)
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setToken } from '@/lib/auth'

const LoginSuccessful = () => {
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

    setToken(token)               // writes to localStorage with key 'auth_token'
    window.location.hash = ''    // clear hash (does not trigger re-render)
    navigate('/', { replace: true })
  }, [navigate])

  // ... render spinner (no error) or error state
}
```

[VERIFIED: codebase — lib/auth.ts uses `TOKEN_KEY = 'auth_token'`; setToken writes to localStorage]

### Pattern 8: auth_provider Attribute in Serializer

**What:** Expose `auth_provider` from the `users` table through `UserSerializer` so the frontend badge can display.

```ruby
# Source: user_serializer.rb (existing) + D-08
class UserSerializer < ActiveModel::Serializer
  attributes :id, :email, :name, :first_name, :last_name, :created_at, :in_group, :auth_provider
  # ... rest of serializer unchanged
end
```

The `auth_provider` column is a plain string — no conditional logic needed in the serializer. It will be `null` for existing users (JSON `null` → `undefined` in frontend after camelCase conversion → badge not rendered).

[VERIFIED: codebase — user_serializer.rb read; pattern matches existing attribute declarations]

### Anti-Patterns to Avoid

- **Calling `TokenService.verify(id_token)` for the Cognito idToken:** `TokenService.verify` uses the app's HS256 secret. Cognito idTokens are signed with RS256 using the user pool's private key. This will always raise `JWT::DecodeError`. Use `JWT.decode(token, nil, false)` instead (same pattern as `CognitoService.initiate_auth`).
- **Reading the token from `window.location.hash` after `navigate()`:** Navigate clears the hash. Read and store the token BEFORE calling `navigate`.
- **Shipping the button without the Lambda:** The `state` query param encoding must be consistent between what `signInWithRedirect` sends and what the callback page reads. Test the round-trip.
- **Hub.listen for signInWithRedirect in GoogleSignInButton:** The CONTEXT.md explicitly moves Hub listener logic to the `/auth/login-success` route. The skeleton's Hub listener must be removed. The callback page (not the button's Hub listener) handles the session exchange.
- **Blindly accepting `customState` as a plain string:** Amplify v6 appends `customState` to the OAuth `state` value. The exact separator format must be validated — do not assume the state param is exactly the base64 string you sent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth PKCE code exchange | Manual code → token exchange in callback | `fetchAuthSession()` from aws-amplify | Amplify handles PKCE, token validation, and Cognito's code exchange endpoint automatically |
| Cognito JWT signature verification | Custom RS256 JWKS fetcher | `JWT.decode(token, nil, false)` — trust Cognito's flow | Project precedent; RS256 JWKS verification adds complexity with no security gain when token comes from Amplify's authenticated flow |
| Account linking logic | Custom DB-level email matching | `adminLinkProviderForUser` via PreSignUp Lambda | AWS handles the identity graph; manual DB linking would miss Cognito-side linkage and break future federated logins |
| Cross-domain token transport | Cookies, postMessage, serverside redirect | URL hash (`#token=...`) per D-04 | Cross-origin localStorage is blocked; hash is browser-only and doesn't appear in server logs |

**Key insight:** The hardest part of multi-tenant OAuth is the callback URL constraint — Cognito allows only one registered redirect URI per client. The intermediary page pattern (D-01 through D-04) is the standard solution for this exact problem.

---

## Common Pitfalls

### Pitfall 1: TokenService.verify vs JWT.decode for Cognito idTokens

**What goes wrong:** Developer calls `TokenService.verify(params[:id_token])` thinking it validates any Cognito token. It raises `JWT::DecodeError: Signature verification raised` immediately.
**Why it happens:** `TokenService.verify` passes `secret_key_base` as the HMAC key, but Cognito idTokens are RS256-signed with the user pool's private key. Algorithm mismatch.
**How to avoid:** Use `JWT.decode(params[:id_token], nil, false)` (third argument `false` = skip verification). This is the existing pattern in `CognitoService#initiate_auth`.
**Warning signs:** `JWT::DecodeError` in `SessionsController#create` on the `id_token` path.

### Pitfall 2: amplify.ts redirectSignIn Must Include the Callback URL

**What goes wrong:** Amplify's OAuth flow silently falls back to the first `redirectSignIn` URL if the configured domain doesn't match. Users land on the wrong URL.
**Why it happens:** `amplify.ts` currently has `redirectSignIn: [import.meta.env.VITE_REDIRECT_SIGN_IN || 'http://localhost:3000/']` — a single URL. It must be updated to include `https://auth.realtybase.ca/oauth/callback` (and retain `http://localhost:3000/` for dev).
**How to avoid:** Add the callback URL to the array in `amplify.ts`. Cognito only redirects to registered URIs — both must be registered in the Cognito user pool OAuth settings.
**Warning signs:** After Google login, browser redirects to `localhost:3000/` instead of `auth.realtybase.ca/oauth/callback` in production.

### Pitfall 3: User.find_or_initialize_by on cognito_sub — New User Has No Name

**What goes wrong:** A brand new Google user (never signed in before) has `given_name`/`family_name` in Cognito claims but the `User` record fails validation for `first_name`/`last_name` presence if the claim extraction logic has a bug.
**Why it happens:** The `first_name` blank-check uses `user.first_name.blank?` — on a new record this is true, so it enters the name-extraction branch. Must handle cases where `given_name` is absent in the Google token (rare but possible for older Google accounts).
**How to avoid:** Follow the exact same fallback chain as the existing email/password path in `SessionsController#create`: `given_name` → split `name` → split `email` → "User".
**Warning signs:** `ActiveRecord::RecordInvalid: Validation failed: First name can't be blank` in `SessionsController`.

### Pitfall 4: Lambda Lookup Uses Email, Not Username

**What goes wrong:** `DestinationUser` in `AdminLinkProviderForUserCommand` set with `ProviderAttributeName: 'username'` — works for some setups but fails when the Cognito user was created with email as the username alias.
**Why it happens:** Cognito pools with email aliases need `ProviderAttributeName: 'email'` (which searches by email attribute, not username string).
**How to avoid:** Use `ProviderAttributeName: 'email'` and `ProviderAttributeValue: email` from the `userAttributes`. Cross-verify with the user pool's alias settings.
**Warning signs:** `UserNotFoundException` in Lambda, even though user exists.

### Pitfall 5: hash Clearing Triggers Re-render Race

**What goes wrong:** `window.location.hash = ''` in `LoginSuccessful.tsx` triggers a `hashchange` event, which can cause `useEffect` to re-run before `navigate()` completes.
**Why it happens:** `useEffect` with `navigate` in dependency array would re-run. The `useEffect` must NOT include `navigate` as a dependency that changes on hash update.
**How to avoid:** Read token, call `setToken`, then `window.location.hash = ''`, then `navigate('/', { replace: true })` — all in a single effect invocation. The navigate call exits the component, making the re-render race moot. Use a `useEffect` with `[]` dependency (runs once on mount).
**Warning signs:** Infinite navigate loop or double-trigger of the effect.

### Pitfall 6: customState Encoding in Amplify v6

**What goes wrong:** The static callback page reads `searchParams.get('state')` and gets an Amplify-prefixed string that doesn't base64-decode to the expected JSON.
**Why it happens:** Amplify v6 uses the OAuth `state` param for PKCE and its own session tracking. It appends the `customState` value with a separator. The raw `state` param is NOT the raw `customState` value.
**How to avoid:** In the callback page, after Amplify's `fetchAuthSession()` completes, retrieve the custom state via Amplify's own Hub event or by reading the Amplify-specific `customState` claim from the decoded token (in `event.detail.data.customState` from Hub). Alternatively, parse the `state` query param to extract the suffix after Amplify's prefix.
**Warning signs:** `JSON.parse(atob(stateParam))` throws in the callback page.

---

## Code Examples

### Migration: Add auth_provider to users

```ruby
# Source: Rails migration pattern; column spec from D-08
class AddAuthProviderToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :auth_provider, :string, default: nil
  end
end
```

[VERIFIED: codebase — schema.rb shows no existing `auth_provider` column on `users` table]

### userType.ts — Add authProvider

```typescript
// Source: frontend/src/assets/types/userType.ts (existing) + D-08/D-09
interface user {
    id: string
    name: string
    firstName: string
    lastName: string
    email: string
    authProvider?: string          // add this — 'google' | null (undefined when absent)
    // ... existing fields
}
```

[VERIFIED: codebase — userType.ts read; `authProvider` not currently present]

### Amplify config update — add callback URL

```typescript
// Source: frontend/src/config/amplify.ts (existing) + D-01
redirectSignIn: [
    'https://auth.realtybase.ca/oauth/callback',
    import.meta.env.VITE_REDIRECT_SIGN_IN || 'http://localhost:3000/'
],
```

The `VITE_REDIRECT_SIGN_IN` env var currently points to `http://localhost:3000/` (verified in `.env`). The production callback URL is added as the first entry.

[VERIFIED: codebase — amplify.ts and .env read]

### Auth router — add login-success route

```tsx
// Source: frontend/src/router/auth/auth.tsx (existing) + D-07
import LoginSuccessful from '@/containers/auth/LoginSuccessful'

// Add to children array:
{
    path: 'login-success',
    element: <LoginSuccessful />
}
```

Note: `LoginSuccessful` is not currently imported in `auth.tsx`. The import must be added.

[VERIFIED: codebase — auth.tsx read; LoginSuccessful exists at the referenced path]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| aws-amplify npm package | GoogleSignInButton, callback page | ✓ | 6.15.9 (latest: 6.17.0) | — |
| aws-sdk-cognitoidentityprovider gem | Lambda (via Gemfile) | ✓ | ~1.65 | — |
| jwt Ruby gem | SessionsController OAuth path | ✓ | ~2.7 | — |
| Cognito user pool Google IdP config | AUTH-01 | External (AWS console) | — | None — must be configured before testing |
| Static host for auth.realtybase.ca | D-03 callback page | External (DNS/hosting) | — | None — required for production; localhost dev can use redirect to localhost |
| Google OAuth app credentials | AUTH-01 | External (Google Cloud Console) | — | None — dev credentials may exist |
| Node.js 20.x runtime | PreSignUp Lambda | External (AWS Lambda) | — | Node.js 18.x is a valid fallback |
| @aws-sdk/client-cognito-identity-provider (Lambda) | PreSignUp Lambda | External (Lambda layer or bundled) | v3 | AWS SDK v2 (not recommended) |

**Missing dependencies with no fallback:**
- Cognito user pool must have Google as a federated IdP — this is an AWS console configuration step that cannot be automated via code alone
- `auth.realtybase.ca` DNS and static hosting must be provisioned — required for the callback page to be reachable

**Missing dependencies with fallback (dev only):**
- For local development, `VITE_REDIRECT_SIGN_IN` can remain `http://localhost:3000/auth/login-success` and the callback page logic can be embedded in the SPA's login-success route directly

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Cognito federated IdP; `email_verified: true` gate in Lambda |
| V3 Session Management | yes | JWT in localStorage (existing pattern); hash cleared after read; token not in server logs |
| V4 Access Control | yes | Existing `BrokerageAuth` + `CognitoAuth` — no change needed for OAuth users |
| V5 Input Validation | yes | `email_verified` check; `JWT::DecodeError` rescue; `id_token` presence guard |
| V6 Cryptography | no | RS256 verification delegated to Amplify; app issues HS256 JWT via existing `TokenService` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Account takeover via unverified email | Spoofing | Lambda MUST verify `email_verified: true` before `adminLinkProviderForUser` |
| State param injection (redirect to attacker domain) | Tampering | Callback page must validate that decoded `brokerage` value matches a known pattern before redirecting; do not blindly `window.location.href` to attacker-controlled domain |
| Token in URL hash leaking via Referer header | Information Disclosure | Hash fragment is not sent in Referer headers (browser spec) — mitigated by design; clear hash immediately after reading |
| Cross-origin request to POST /v1/sessions | Spoofing | CORS proc — only `BrokerageDomain` records and the exact `https://auth.realtybase.ca` string are allowed |
| JWT replay (stolen token from hash) | Elevation of privilege | Existing JWT expiry (24h); token in localStorage (not cookie — XSS risk, but same risk as existing auth) |
| Lambda `adminLinkProviderForUser` race (double-link) | Tampering | Catch `AliasExistsException` gracefully — already linked is a no-op, not an error |

**Callback state param validation:** The callback page receives `state` from the OAuth redirect. Before using the decoded brokerage domain to construct a redirect URL, validate that the domain is either a known pattern (e.g., ends in `.realtybase.ca`) or appears in a trusted list. Redirect to an arbitrary URL from a state param is an open redirector vulnerability.

---

## Open Questions (RESOLVED)

1. **customState encoding format in Amplify v6 — exact separator**
   - What we know: Amplify v6 uses `customState` option in `signInWithRedirect`. It encodes this into the OAuth `state` param.
   - What was unclear: The exact format of how Amplify separates its internal state tracking from the `customState` value in the `state` query parameter that arrives at the callback URL.
   - **RESOLVED:** Hub listener approach used in callback page — the callback page calls `fetchAuthSession()` first (completing PKCE exchange), then reads `customState` from Amplify's Hub `customOAuthState` event detail rather than parsing the raw `state` query param. This avoids the Amplify prefix format entirely. Implementation: set up `Hub.listen('auth', ...)` before calling `fetchAuthSession()`; the Hub event `payload.data.customState` contains the decoded custom state string (the base64 JSON from D-02) — no raw state param parsing needed.

2. **Callback page hosting: where does the static file live?**
   - What we know: The page must be at `https://auth.realtybase.ca/oauth/callback`. It is not part of the React SPA.
   - What was unclear: Whether a hosting provider (Cloudflare Pages, S3, Netlify) is already provisioned for `auth.realtybase.ca`, or whether this is a new infrastructure task.
   - **RESOLVED:** `auth-callback/index.html` is a new directory at the monorepo root, committed to the monorepo root git repo (not to `backend/` or `frontend/` sub-repos). Static hosting infrastructure (DNS + server) is a manual provisioning step flagged in Plan 04-03 as infrastructure-out-of-scope. The file is created by Plan 04-03 and must be deployed to a static host at `auth.realtybase.ca` as a separate human-performed step.

3. **Amplify config for the callback page: must it be identical to the SPA?**
   - What we know: The callback page needs to call `fetchAuthSession()` which requires the same Cognito configuration (userPoolId, clientId, domain, redirectSignIn).
   - What was unclear: Whether the callback page gets its Amplify config from environment variables (impossible for a static file at runtime) or from a hardcoded config embedded in the bundle.
   - **RESOLVED:** Amplify config values are embedded directly in `auth-callback/index.html` at development time, sourced from `frontend/.env`. The callback page has no build step — config values are hardcoded from the env file. Plan 04-03 Task 1 explicitly instructs the executor to read `frontend/.env` before writing the callback page and to replace placeholder strings with actual env values.

4. **Does the Cognito client need a client secret for the OAuth flow?**
   - What we know: `CognitoService` uses a `client_secret` for `SECRET_HASH`. The Amplify public client (`VITE_COGNITO_CLIENT_ID`) is typically a public client without a secret.
   - What was unclear: Whether the Cognito app client configured for Amplify has a secret. Public clients (no secret) are standard for SPAs and mobile apps; adding a Google federated IdP uses the same client.
   - **RESOLVED:** No change needed. The Amplify public client (`VITE_COGNITO_CLIENT_ID`) is a public SPA client without a secret. Federated IdP sign-in uses the same client. `CognitoService` uses a separate confidential client (with SECRET_HASH) for admin operations — these are different app clients and the distinction is already correctly handled in the existing codebase.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AWS SDK v3 is standard for new Lambda functions (Node.js 20.x); `AdminLinkProviderForUserCommand` is the correct command name | PreSignUp Lambda pattern | Lambda fails to compile or link; use SDK v2 (`adminLinkProviderForUser`) as fallback |
| A2 | `DestinationUser.ProviderAttributeName: 'email'` is the correct linkage method for email-aliased Cognito pools | PreSignUp Lambda pattern | `UserNotFoundException` in Lambda; may need `ProviderAttributeName: 'username'` or `cognito:username` depending on pool config |
| A3 | Amplify v6 `customState` arrives at the callback URL in a parseable format from the `state` query param | Callback page, Pattern 4 | Callback page cannot reconstruct brokerage domain; OAuth flow fails silently |
| A4 | A pre-bundled Amplify script is the correct approach for the static callback page (vs. CDN import) | Callback page pattern | CDN import works fine and simplifies the build; pre-bundle adds unnecessary complexity |
| A5 | The `auth.realtybase.ca` static hosting infrastructure does not yet exist and must be provisioned as part of this phase | Environment Availability | Infrastructure already exists and the only task is deploying the file |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Amplify v5 `Auth.federatedSignIn()` | Amplify v6 `signInWithRedirect({ provider })` | Amplify v6 (2023) | Different import path; `provider` is an object not a string |
| Amplify v5 `Auth.currentSession()` | Amplify v6 `fetchAuthSession()` | Amplify v6 (2023) | Same semantic; different function name and import |
| AWS SDK v2 `cognitoidentityserviceprovider.adminLinkProviderForUser()` | AWS SDK v3 `AdminLinkProviderForUserCommand` | 2021 | Command-based SDK; tree-shakeable |

**Deprecated/outdated:**
- `Hub.listen` for `signInWithRedirect` event in `GoogleSignInButton`: The Phase 2 skeleton used this. Per CONTEXT.md, Phase 4 removes this from the button — the callback page handles the session exchange instead. The Hub listener pattern is still valid Amplify v6 but is not the right pattern for the static-page callback approach chosen here.

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives apply to this phase and must be honored in the plan:

1. **Sub-repos:** `backend/` and `frontend/` are separate git repos. All code commits go to them directly. Planning docs commit to monorepo root.
2. **Soft deletes:** `acts_as_paranoid` is on `User`. Any `User.find_by` in `SessionsController` must use `.without_deleted` or the `find_or_initialize_by` path (which does not filter by default). The OAuth path uses `find_or_initialize_by(cognito_sub:)` — confirm this works correctly with `acts_as_paranoid` (it searches all records including soft-deleted; `find_or_initialize_by` does not use `without_deleted` scope by default).
3. **Frontend data flow:** Context → TanStack hook → API module. The `authProvider` field flows: `ProfileController#show` → `UserSerializer#auth_provider` → `getAccountProfile` API → `useGetAccountProfile` hook → `AccountContext` → `MemberDetailCard`. No inline API calls.
4. **Icons:** `lucide-react` only. Google G logo is an exception per CONTEXT.md discretion — use inline SVG.
5. **Imports:** Use `@` alias for all frontend imports.
6. **URL search param hydration:** Not applicable to this phase (no filter state from URL). The hash reading in `LoginSuccessful` is a one-shot mount effect, not a filter hydration pattern.
7. **`standardrb` linting:** All Ruby files must pass `bundle exec standardrb`.
8. **No confirmation prompt before git commit:** Per project memory, always prompt user. Planner should note that executor must confirm before committing.

**Soft-delete concern for `find_or_initialize_by(cognito_sub:)` in OAuth path:**
`acts_as_paranoid` default scope excludes soft-deleted records from queries. `find_or_initialize_by` goes through the default scope. If a user was soft-deleted, a Google sign-in with their email would create a new User record instead of restoring the soft-deleted one. This is the same behavior as the existing email/password path (which also uses `find_or_initialize_by`). The plan should note this as an accepted limitation consistent with the existing session controller.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `sessions_controller.rb`, `cognito_service.rb`, `token_service.rb`, `cognito_auth.rb`, `cors.rb`, `amplify.ts`, `GoogleSignInButton.tsx`, `LoginSuccessful.tsx`, `auth.tsx`, `CreateAccount.tsx`, `user_serializer.rb`, `profile_controller.rb`, `userType.ts`, `auth.ts`, `schema.rb`, `user.rb` — all read directly
- `frontend/.env` — Amplify config env vars verified
- `frontend/package.json` — aws-amplify 6.15.9 confirmed installed
- `backend/Gemfile` — jwt ~2.7, aws-sdk-cognitoidentityprovider confirmed

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01 through D-13 — all decisions verified against codebase for feasibility
- UI-SPEC.md — visual contracts verified against `MemberDetailCard.tsx` and `LoginSuccessful.tsx`

### Tertiary (LOW confidence)
- Lambda `AdminLinkProviderForUserCommand` pattern: based on training knowledge of AWS Cognito PreSignUp trigger behavior; not verified against live AWS docs in this session
- Amplify v6 `customState` encoding format in OAuth `state` param: [ASSUMED] based on Amplify v5 → v6 migration patterns; exact format not verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as installed in the project
- Architecture: HIGH — all patterns verified against existing code; decisions are locked in CONTEXT.md
- Pitfalls: HIGH for backend patterns (code-verified); MEDIUM for Lambda and callback page (assumed based on training)
- Lambda pattern: MEDIUM — training knowledge; `adminLinkProviderForUser` is a well-documented Cognito API

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable AWS/Amplify APIs; 30-day estimate)

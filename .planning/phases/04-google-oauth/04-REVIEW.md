---
phase: 04-google-oauth
reviewed: 2026-05-09T19:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - auth-callback/index.html
  - backend/app/controllers/v1/sessions_controller.rb
  - backend/app/serializers/user_serializer.rb
  - backend/config/initializers/cors.rb
  - backend/db/migrate/20260509000001_add_auth_provider_to_users.rb
  - frontend/src/assets/types/userType.ts
  - frontend/src/components/auth/GoogleSignInButton.tsx
  - frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberDetailCard.tsx
  - frontend/src/config/amplify.ts
  - frontend/src/containers/auth/CreateAccount.tsx
  - frontend/src/containers/auth/LoginSuccessful.tsx
  - frontend/src/router/auth/auth.tsx
  - lambda/pre_signup/index.js
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
note: Updated after 04-05 gap closure — CR-01/CR-02/CR-03 now resolved, 4 warnings remain
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase implements Google OAuth via AWS Cognito federation, consisting of a static auth-callback page, an extended `SessionsController`, a PreSignUp Lambda, and frontend components. The overall structure is sound and follows the existing project patterns. However, three blockers were found: the backend accepts unsigned JWTs from untrusted clients, the `BrokerageAuth` concern will raise a 500 for every OAuth login attempt because the API's own host (`api.realtybase.ca`) is not a registered `BrokerageDomain`, and the auth-callback page injects server-supplied error text via `innerHTML` creating an XSS vector. These three issues, individually, would prevent the feature from working correctly or securely in production.

---

## Critical Issues

### CR-01: JWT signature not verified — any forged token accepted as a valid Google login

**File:** `backend/app/controllers/v1/sessions_controller.rb:21`

**Issue:** `JWT.decode(params[:id_token], nil, false)` decodes the client-supplied Cognito idToken with the third argument set to `false`, disabling all signature verification. The `params[:id_token]` value originates from the user's browser (via `auth-callback/index.html`). Because no signature is checked, an attacker can craft any JWT with arbitrary claims (`sub`, `email`, `email_verified: true`, etc.) and POST it to `/v1/sessions`. The controller will accept it, find-or-create a `User` from the forged `sub` claim, and return a valid app session token. This is a complete authentication bypass.

The planning doc (D-05, `04-RESEARCH.md` line 66) explicitly endorses this pattern by analogy to `CognitoService.initiate_auth`. That analogy is flawed: `CognitoService.initiate_auth` decodes a token it fetched directly from Cognito over an authenticated AWS SDK call. The sessions controller decodes a token sent by an untrusted browser client. The trust model is entirely different.

`COGNITO_CONFIG[:jwks_uri]` is already computed in `backend/config/initializers/cognito.rb` but never used.

**Fix:** Verify the RS256 signature against Cognito's JWKS endpoint before trusting any claim. The `jwt` gem (already installed) supports this:

```ruby
require "net/http"
require "json"

def cognito_jwks
  uri = URI(COGNITO_CONFIG[:jwks_uri])
  JSON.parse(Net::HTTP.get(uri))
end

# In sessions#create OAuth path:
jwks = JWT::JWK::Set.new(cognito_jwks)
claims, _header = JWT.decode(
  params[:id_token],
  nil,
  true,                          # verify signature
  algorithms: ["RS256"],
  jwks: jwks,
  iss: COGNITO_CONFIG[:issuer],  # validate issuer
  verify_iss: true,
  aud: COGNITO_CONFIG[:client_id],
  verify_aud: true
)
```

Cache the JWKS response (it rarely changes) to avoid a blocking HTTP call per login request.

---

### CR-02: `BrokerageAuth.resolve_brokerage` raises 500 for every OAuth login

**File:** `backend/app/controllers/v1/sessions_controller.rb:4` / `backend/app/controllers/concerns/brokerage_auth.rb:19`

**Issue:** `SessionsController` includes `BrokerageAuth`, which unconditionally registers `before_action :resolve_brokerage`. `resolve_brokerage` looks up `request.host` in `BrokerageDomain` and raises `ActiveRecord::RecordNotFound` if no match is found (line 19 of `brokerage_auth.rb`).

The auth-callback page sends its `POST /v1/sessions` request to the hardcoded URL `https://api.realtybase.ca` (line 31 of `auth-callback/index.html`). When Rails processes this request, `request.host` is `api.realtybase.ca`. There is no seed data, no migration, and no known code path that registers `api.realtybase.ca` as a `BrokerageDomain`. The lookup returns `nil`, `raise` is triggered, and the exception is not rescued by any of the three `rescue` clauses in `sessions#create` (`JWT::DecodeError`, `CognitoService::AuthError`, `ActiveRecord::RecordInvalid`). Rails returns a 500.

This affects 100% of OAuth login attempts. The email/password flow is unaffected because those requests arrive with a brokerage subdomain as the `Host` header.

**Fix — Option A (skip brokerage resolution for the unauthenticated OAuth path):**

Add to `SessionsController`:

```ruby
skip_before_action :resolve_brokerage, only: [:create]
```

Then in `sessions#create`, after the user is found/created, resolve the brokerage via the `sub` claim's existing memberships if `Current.brokerage` is needed for `TokenService.issue`. `TokenService.issue` already handles a nil brokerage gracefully (`Current.brokerage&.id` returns `nil`, role is `nil`).

**Fix — Option B (send brokerage domain as a request header from the callback page):**

Have `auth-callback/index.html` send a custom `X-Brokerage-Domain: <brokerage>` header in the `fetch` call, and have `BrokerageAuth` fall back to that header when `request.host` is the API's own domain. This preserves brokerage context in the issued token.

---

### CR-03: XSS via `innerHTML` with server-controlled error text in auth-callback

**File:** `auth-callback/index.html:38-40`

**Issue:** The `showError` function uses `innerHTML` to display the error message:

```js
document.getElementById('status').innerHTML =
  '<span class="error-text">' + message + '</span><br>' +
  '<a href="/" ...>Back to sign in</a>'
```

At line 110, `message` is constructed as:

```js
'Sign-in failed: ' + (body.error || response.statusText) + '. Please try again.'
```

`body.error` is the raw JSON error field from the backend response. Because CR-01 exists (no JWT signature verification), an attacker can:

1. Send a forged JWT with `email` set to a string containing HTML (e.g., `"><img src=x onerror=alert(1)>@x.com`).
2. The backend's `user.save!` fails with `ActiveRecord::RecordInvalid` whose message contains the email.
3. The backend returns `{"error": "Could not create user account: Validation failed: Email ><img src=x onerror=alert(1)>@x.com is invalid"}`.
4. The callback page injects `body.error` into the DOM via `innerHTML`.
5. The injected HTML executes on `auth.realtybase.ca`.

Even without CR-01, any backend error that includes unsanitized user-supplied content would trigger this.

**Fix:** Use `textContent` instead of `innerHTML`, and build the link as a DOM element rather than raw HTML:

```js
function showError(message) {
  document.getElementById('spinner').style.display = 'none'
  const status = document.getElementById('status')
  status.textContent = ''
  const span = document.createElement('span')
  span.className = 'error-text'
  span.textContent = message
  const br = document.createElement('br')
  const a = document.createElement('a')
  a.href = '/'
  a.style.cssText = 'margin-top:0.75rem;display:inline-block'
  a.textContent = 'Back to sign in'
  status.appendChild(span)
  status.appendChild(br)
  status.appendChild(a)
}
```

---

## Warnings

### WR-01: `redirectSignOut` in auth-callback points to the OAuth callback itself

**File:** `auth-callback/index.html:53`

**Issue:** The Amplify configuration sets `redirectSignOut: ['https://auth.realtybase.ca/oauth/callback']`. After a Cognito hosted-UI sign-out, Cognito redirects the browser to this URL. The auth-callback page then runs `fetchAuthSession()`, which finds no active session, returns tokens as `undefined`, and the `if (!idToken)` branch fires — showing the "Authentication failed: no token received" error to a user who just successfully signed out. This makes the sign-out flow appear broken.

**Fix:** Set `redirectSignOut` to a dedicated landing page (e.g., `https://auth.realtybase.ca/signed-out.html`) or to the main marketing domain. If the callback page is the only static file hosted, add a simple `?signedout=1` query check at the top of the script to detect this case and show a success message instead.

---

### WR-02: `auth_provider` unconditionally overwritten on every Google sign-in

**File:** `backend/app/controllers/v1/sessions_controller.rb:42`

**Issue:** `user.auth_provider = "google"` is set on every call through the OAuth path, including for returning users. If a user was originally a `"email"` provider user who linked Google and later disconnects Google (a v2 flow per the context doc), their `auth_provider` would still be `"google"` because the OAuth login path always stamps it. Additionally, if the app ever supports multiple providers, this overwrites the previous value unconditionally.

**Fix:** Only set `auth_provider` when it is blank, consistent with how `email`, `first_name`, etc. are handled:

```ruby
user.auth_provider = "google" if user.auth_provider.blank?
```

---

### WR-03: `in_group` declared twice in `UserSerializer` — conditional guard is dead

**File:** `backend/app/serializers/user_serializer.rb:4,12`

**Issue:** `in_group` is declared in two places:

- Line 4: `attributes :id, :email, :name, :first_name, :last_name, :created_at, :in_group, :auth_provider` — unconditional.
- Line 12: `attribute :in_group, if: :groups_loaded?` — conditional.

In `active_model_serializers`, listing an attribute in `attributes` unconditionally takes precedence. The `if: :groups_loaded?` guard on line 12 is effectively ignored; `in_group` is always serialized. The `def in_group` method safely returns `false` when `@instance_options[:group]` is nil, so this does not crash. However, every serialized user response carries an `in_group` field that is only meaningful when the caller passes a `:group` instance option, creating silent noise for all other callers.

**Fix:** Remove `in_group` from the `attributes` line 4, leaving only the conditional declaration on line 12:

```ruby
attributes :id, :email, :name, :first_name, :last_name, :created_at, :auth_provider

attribute :in_group, if: :groups_loaded?
```

---

### WR-04: PreSignUp Lambda silently blocks brand-new Google-only users

**File:** `lambda/pre_signup/index.js:54-80`

**Issue:** When a user who has never created an email/password Cognito account attempts to sign in with Google for the first time, `AdminLinkProviderForUserCommand` is called with `DestinationUser` resolved by email. If no existing native Cognito user with that email exists, AWS throws `UserNotFoundException`. The Lambda's `catch` block only swallows `AliasExistsException`; all other errors are re-thrown (line 78). Cognito receives the error and aborts the sign-up, returning an error to the user.

The ROADMAP states: "a user on any brokerage subdomain... can sign in with Google." It is ambiguous whether this includes users who have never created an email/password account. If Google-first new users should be allowed, this is a functional blocker. Even if intentional, the behavior is undocumented and the error surfaced to the user is a raw AWS error, not a user-friendly message.

**Fix (if Google-first sign-up should be allowed):** Catch `UserNotFoundException` and pass through:

```js
} catch (err) {
  // AliasExistsException: Google already linked — pass through.
  // UserNotFoundException: no existing email/password account — new Google user, pass through.
  const passThrough = ['AliasExistsException', 'UserNotFoundException']
  if (!passThrough.includes(err.name)) {
    throw err
  }
}
```

**Fix (if Google sign-in requires a prior email/password account):** Document this constraint explicitly in the Lambda comments and ensure the frontend shows a clear error message (not a raw Cognito error) when this case occurs.

---

## Info

### IN-01: Hardcoded production Cognito configuration values in auth-callback

**File:** `auth-callback/index.html:28-31`

**Issue:** `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN`, and `BACKEND_URL` are embedded as literal strings with a comment noting they "must be updated when deploying to a different environment." Cognito Pool IDs and Client IDs are not secrets, but hardcoding them means any environment change (staging environment, pool rotation, new region) requires a manual file edit and redeploy rather than a config/env pipeline change.

**Fix:** If the file is built as part of a CI pipeline (even a simple one), inject these at build time using `sed` substitution or a templating step from environment variables, consistent with how `frontend/.env` values are used in `frontend/src/config/amplify.ts`.

---

### IN-02: Commented-out route fragments in `auth.tsx`

**File:** `frontend/src/router/auth/auth.tsx:28-49`

**Issue:** Approximately six route blocks are commented out (`invalid-token`, `expired`, `already-accepted`, `revoked`, `complete-profile`). These appear to be planned v2 routes. Commented-out code in a router file creates ambiguity about whether these routes were removed intentionally, are in-progress, or were never implemented.

**Fix:** Remove the commented-out blocks and track the planned routes as tasks in the planning docs or as a TODO comment with a JIRA/GitHub issue reference. The `confirm-invite` route remains as an empty fragment (`element: <></>`), which is also worth addressing — it silently renders nothing and gives users no feedback.

---

_Reviewed: 2026-05-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

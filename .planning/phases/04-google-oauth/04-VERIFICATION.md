---
phase: 04-google-oauth
verified: 2026-05-09T19:30:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/11
  gaps_closed:
    - "POST /v1/sessions with id_token verifies JWT signature before trusting claims (CR-01 closed)"
    - "POST /v1/sessions to api.realtybase.ca does not raise 500 from BrokerageAuth (CR-02 closed)"
    - "auth-callback/index.html showError is XSS-safe — no innerHTML (CR-03 closed)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Click 'Continue with Google' on login screen of any brokerage tenant, complete Google consent, confirm landing on brokerage dashboard as authenticated user"
    expected: "Browser redirects to Google, user grants consent, Google redirects to auth.realtybase.ca/oauth/callback, callback exchanges idToken for app JWT, redirects to {brokerage}/auth/login-success#token=..., LoginSuccessful.tsx reads hash, calls setToken, navigates to /, user sees dashboard"
    why_human: "Full OAuth PKCE round-trip requires live Cognito app client config, live Google OAuth app, and deployed auth-callback page at auth.realtybase.ca — cannot verify programmatically without all three deployed"
  - test: "Sign in with Google using an email that already has an existing email/password account in the same brokerage"
    expected: "Cognito PreSignUp Lambda fires, calls AdminLinkProviderForUser, user is linked — no second User DB record is created; user sees their existing groups and data"
    why_human: "Requires live Cognito Lambda trigger deployment and AWS IAM permission (cognito-idp:AdminLinkProviderForUser) — Lambda is code-complete but external deployment has not been verified"
  - test: "View MemberDetailCard for a member who has logged in via Google; verify 'Connected via Google' badge appears"
    expected: "Shield icon row visible with 'Sign-in method' label and sky-blue 'Connected via Google' badge; row absent for email/password members"
    why_human: "Requires a Google-authenticated user record in the DB (auth_provider = 'google') which requires the full OAuth flow to have executed at least once"
---

# Phase 04: Google OAuth Verification Report

**Phase Goal:** Enable Google OAuth sign-in via AWS Cognito federation — users can log in with their Google account on any brokerage tenant subdomain, eliminating the email/password barrier for Google Workspace users.
**Verified:** 2026-05-09T19:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plan 04-05 closed CR-01, CR-02, CR-03)

---

## Re-Verification Summary

Previous verification (2026-05-09T15:00:00Z) found 3 blockers: CR-01 (JWT signature bypass), CR-02 (BrokerageAuth 500 on api.realtybase.ca), CR-03 (XSS in auth-callback showError). Plan 04-05 was executed to close all three. This re-verification confirms all three are closed with no regressions.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /v1/sessions id_token branch does NOT 500 on api.realtybase.ca host | VERIFIED | `skip_before_action :resolve_brokerage, only: [:create]` at line 7 of sessions_controller.rb — grep count: 1 |
| 2 | POST /v1/sessions with id_token verifies RS256 signature against COGNITO_CONFIG[:jwks_uri] | VERIFIED | `algorithms: ["RS256"]`, `verify_iss: true`, `verify_aud: true`, `jwks: jwks_loader` — all present; unsafe `JWT.decode(token, nil, false)` count: 0 |
| 3 | POST /v1/sessions id_token branch: JWKS cached 1 hour via Rails.cache | VERIFIED | `Rails.cache.fetch("cognito_jwks", expires_in: 1.hour)` in private `cognito_jwks` helper — HTTParty.get wired to COGNITO_CONFIG[:jwks_uri] |
| 4 | POST /v1/sessions rejects email_verified=false with 422 | VERIFIED | `unless email_verified … render … :unprocessable_entity` at line 38-41 of sessions_controller.rb |
| 5 | POST /v1/sessions with malformed id_token returns 401 | VERIFIED | `rescue JWT::DecodeError => e … :unauthorized` — covers JWT::VerificationError, JWT::InvalidIssuerError, JWT::InvalidAudError (all inherit from JWT::DecodeError) |
| 6 | POST /v1/sessions with email+password still returns 200 (regression guard) | VERIFIED | `CognitoService.initiate_auth` count: 1 in elsif branch — logic untouched |
| 7 | auth-callback/index.html error handling is XSS-safe — no innerHTML | VERIFIED | `innerHTML` count: 0; `errorSpan.textContent = message` count: 1; `createElement` count: 3; `appendChild` count: 3 |
| 8 | auth-callback/index.html validates brokerage domain, exchanges idToken, redirects with hash token | VERIFIED | `endsWith('.realtybase.ca')` count: 1; `v1/sessions` count: 1; `login-success#token=` count: 1; `Hub.listen` count: 1; no REPLACE_WITH placeholders remaining |
| 9 | LoginSuccessful.tsx reads hash token on mount, calls setToken(), navigates to / | VERIFIED | `useEffect` count: 2 (import + call); `setToken` count: 2 (import + call); `window.location.hash` count: 2 (read + clear) |
| 10 | /auth/login-success route exists in frontend router | VERIFIED | `login-success` count: 1 in auth.tsx; `import LoginSuccessful` count: 1 |
| 11 | GoogleSignInButton wired in CreateAccount form stage; calls signInWithRedirect with customState; Hub.listen removed | VERIFIED | `GoogleSignInButton` count: 2 in CreateAccount.tsx (import + usage); `border-t border-border` divider present; `customState` count: 3 in button; `btoa(JSON.stringify` count: 1; `Hub.listen` count: 0 |
| 12 | MemberDetailCard shows "Connected via Google" badge when member.authProvider === 'google' | VERIFIED | `Connected via Google` count: 1; `authProvider.*google` count: 1; `Shield` count: 2 (import + usage) |
| 13 | Lambda exists with email_verified guard, adminLinkProviderForUser, AliasExistsException handling | VERIFIED | `node --check` exits 0; `PreSignUp_ExternalProvider` count: 2; `email_verified` count: 3; `AliasExistsException` count: 2; `AdminLinkProviderForUserCommand` count: 2; `exports.handler` count: 1 |

**Score:** 11/11 truths verified (all must-haves from plans 04-01 through 04-05)

---

### ROADMAP Success Criteria Cross-Reference

| SC | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| SC-1 | User on any brokerage subdomain clicks "Sign in with Google", completes OAuth, lands on dashboard authenticated | HUMAN NEEDED | All code wired correctly (CR-01/CR-02/CR-03 closed); requires live Cognito + deployed auth-callback page to verify end-to-end |
| SC-2 | Existing email/password user signs in with Google — linked automatically, no duplicate account | HUMAN NEEDED | Lambda code correct (verified); requires live AWS deployment with IAM permission to confirm account linking works |
| SC-3 | User signed in via Google sees "Connected via Google" badge | HUMAN NEEDED | Badge code and data flow verified; requires a Google-authenticated user in DB to visually confirm |

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `backend/db/migrate/20260509000001_add_auth_provider_to_users.rb` | VERIFIED | `add_column :users, :auth_provider, :string, default: nil` present |
| `backend/app/controllers/v1/sessions_controller.rb` | VERIFIED | skip_before_action (CR-02); RS256 JWKS-verified decode (CR-01); cognito_jwks private helper with 1-hour cache; email_verified guard; auth_provider tag; email/password path intact |
| `backend/config/initializers/cors.rb` | VERIFIED | `source == "https://auth.realtybase.ca"` exact-match OR condition present |
| `backend/app/serializers/user_serializer.rb` | VERIFIED | `:auth_provider` in attributes line |
| `backend/config/initializers/cognito.rb` | VERIFIED | `COGNITO_CONFIG[:jwks_uri]` and `COGNITO_CONFIG[:issuer]` and `COGNITO_CONFIG[:client_id]` present — consumed by CR-01 fix |
| `lambda/pre_signup/index.js` | VERIFIED | Valid Node.js syntax; all account-linking logic present; email_verified string check; AliasExistsException no-op; ExternalProvider guard |
| `auth-callback/index.html` | VERIFIED | Full OAuth callback logic; XSS-safe showError (textContent/createElement); actual Cognito config values (no REPLACE_WITH placeholders); open-redirector guard |
| `frontend/src/containers/auth/LoginSuccessful.tsx` | VERIFIED | useEffect([]) hash-reading; setToken; hash clear; navigate with replace; AlertCircle error state |
| `frontend/src/router/auth/auth.tsx` | VERIFIED | login-success route; LoginSuccessful import |
| `frontend/src/components/auth/GoogleSignInButton.tsx` | VERIFIED | Hub.listen removed; Google G SVG; 500ms spinner; customState btoa encoding; signInWithRedirect wired; error state |
| `frontend/src/config/amplify.ts` | VERIFIED | `'https://auth.realtybase.ca/oauth/callback'` in redirectSignIn array |
| `frontend/src/assets/types/userType.ts` | VERIFIED | `authProvider?: string` on user interface |
| `frontend/src/containers/auth/CreateAccount.tsx` | VERIFIED | GoogleSignInButton import + or-divider + button in form stage |
| `frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberDetailCard.tsx` | VERIFIED | Shield import; conditional `member?.authProvider === 'google'` row with "Connected via Google" badge |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sessions_controller.rb` | COGNITO_CONFIG[:jwks_uri] | `cognito_jwks` private method + Rails.cache.fetch | WIRED | HTTParty.get fetches JWKS; jwks_loader lambda passed to JWT.decode |
| `sessions_controller.rb` | JWT.decode (RS256 verified) | id_token branch with algorithms/verify_iss/verify_aud | WIRED | Unsafe nil/false call count: 0; verified call with jwks: present |
| `sessions_controller.rb` | BrokerageAuth#resolve_brokerage | skip_before_action only: [:create] | SKIPPED (correct) | Resolves for :destroy; skipped for :create — api.realtybase.ca host no longer 500s |
| `auth-callback/index.html` | POST /v1/sessions | fetch with id_token body | WIRED | `BACKEND_URL + '/v1/sessions'` with `{ id_token: idToken }` |
| `auth-callback/index.html` | `{brokerage}/auth/login-success#token=` | window.location.href | WIRED | Redirect after successful token exchange |
| `auth-callback/index.html` | DOM status element | textContent + createElement (NOT innerHTML) | WIRED | `status.textContent = ''`; `errorSpan.textContent = message`; appendChild — XSS-safe |
| `LoginSuccessful.tsx` | localStorage auth_token | setToken() from @/lib/auth | WIRED | setToken called with extracted hash token |
| `GoogleSignInButton.tsx` | signInWithRedirect | onClick → 500ms → customState encoding | WIRED | `btoa(JSON.stringify({brokerage: window.location.hostname}))` |
| `CreateAccount.tsx` | GoogleSignInButton | import + JSX in form stage | WIRED | Import count: 1; usage count: 1; divider present |
| `MemberDetailCard.tsx` | member.authProvider | conditional badge row | WIRED | `member?.authProvider === 'google'` renders Shield + badge |
| `lambda/pre_signup/index.js` | AdminLinkProviderForUserCommand | send() call with DestinationUser by email | WIRED | ProviderAttributeName: "email" (correct for email-alias pools); SourceUser Cognito_Subject |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `MemberDetailCard.tsx` | `member.authProvider` | GET /v1/admin/users/:id → UserSerializer :auth_provider → users.auth_provider DB column | Yes — set to "google" on each OAuth login via sessions_controller.rb line 54 | FLOWING |
| `auth-callback/index.html` | `idToken` | Amplify fetchAuthSession() → session.tokens.idToken | Yes — Cognito PKCE token after code exchange | FLOWING |
| `LoginSuccessful.tsx` | `token` | window.location.hash parsed on mount | Yes — JWT from redirect hash | FLOWING |
| `GoogleSignInButton.tsx` | `customState` | btoa(JSON.stringify({brokerage: window.location.hostname})) | Yes — real hostname, not hardcoded | FLOWING |
| `sessions_controller.rb` (OAuth path) | `jwks_data` | Rails.cache.fetch → HTTParty.get(COGNITO_CONFIG[:jwks_uri]) | Yes — Cognito public key endpoint (1-hour TTL) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-02: BrokerageAuth skip present | `grep -c "skip_before_action :resolve_brokerage, only: \[:create\]"` sessions_controller.rb | 1 | PASS |
| CR-01: unsafe JWT.decode eliminated | `grep -c "JWT.decode(params\[:id_token\], nil, false)"` sessions_controller.rb | 0 | PASS |
| CR-01: RS256 algorithm enforced | `grep -c 'algorithms: \["RS256"\]'` sessions_controller.rb | 1 | PASS |
| CR-01: JWKS 1-hour cache | `grep -c 'Rails.cache.fetch("cognito_jwks"'` sessions_controller.rb | 1 | PASS |
| CR-03: innerHTML eliminated | `grep -c "innerHTML"` auth-callback/index.html | 0 | PASS |
| CR-03: textContent XSS fix | `grep -c "errorSpan.textContent = message"` auth-callback/index.html | 1 | PASS |
| Lambda syntax valid | `node --check lambda/pre_signup/index.js` | exit 0 | PASS |
| No placeholder config values | `grep -c "REPLACE_WITH"` auth-callback/index.html | 0 | PASS |
| standardrb passes | `bundle exec standardrb --no-fix app/controllers/v1/sessions_controller.rb` | exit 0 (no output) | PASS |
| Regression: email/password path intact | `grep -c "CognitoService.initiate_auth"` sessions_controller.rb | 1 | PASS |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| AUTH-01 | 04-01, 04-03, 04-05 | Fixed intermediary callback URL extracts brokerage from state, exchanges idToken at POST /v1/sessions for app JWT | VERIFIED (code) | Callback page: Hub.listen captures customState, endsWith guard, POST /v1/sessions wired; sessions_controller: skip_before_action (CR-02) + RS256 verify (CR-01) both present |
| AUTH-02 | 04-02 | PreSignUp Lambda links Google identity to existing Cognito user; email_verified guard; first-link exception handled | VERIFIED (code); HUMAN NEEDED (deployment) | Lambda code verified; AWS deployment (zip + IAM + trigger config) is an external step not yet confirmed |
| AUTH-03 | 04-03, 04-04, 04-05 | User clicks "Sign in with Google"; Amplify fires signInWithRedirect; idToken exchanged at POST /v1/sessions | VERIFIED (code); HUMAN NEEDED (E2E) | Button, callback page, token handoff, session endpoint all wired; full PKCE round-trip requires live infrastructure |
| AUTH-04 | 04-01, 04-04 | "Connected via Google" badge in account settings when signed in via Google federation | VERIFIED (code) | auth_provider in UserSerializer; authProvider in userType.ts; MemberDetailCard badge conditional on authProvider === 'google' |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/controllers/v1/sessions_controller.rb` | 54 | `user.auth_provider = "google"` unconditionally on every OAuth login | WARNING | Overwrites provider on every sign-in; no impact on current single-provider design; prevents multi-provider disconnect flows in v2. Previously flagged in WR-05, behavior unchanged — acceptable for this milestone. |
| `backend/app/serializers/user_serializer.rb` | 4 + (guard line) | `:in_group` declared unconditionally AND with conditional guard | WARNING | Dead conditional guard — `in_group` always serialized. Pre-existing issue, not introduced by Phase 4. No crash. |
| `lambda/pre_signup/index.js` | catch block | Only `AliasExistsException` swallowed; `UserNotFoundException` propagates | WARNING | New Google-only users (no prior email/password account) are blocked from signing up via Google. This is a deferred scope item per REQUIREMENTS.md v2 section. ROADMAP Phase 4 goal states users "can sign in" — ambiguous whether this includes net-new Google-only users. For existing users the flow is correct. |

No new anti-patterns introduced by Plan 04-05 gap closure.

---

### Human Verification Required

#### 1. End-to-end Google sign-in flow

**Test:** From any brokerage tenant subdomain (e.g., `broker1.realtybase.ca`), click the "Continue with Google" button on the login or create-account screen.

**Expected:**
1. Browser shows 500ms spinner then navigates to Google consent screen
2. User grants consent; Google redirects to `https://auth.realtybase.ca/oauth/callback?code=...&state=...`
3. Callback page shows "Completing your sign-in…" spinner
4. Callback exchanges idToken for app JWT via POST to `https://api.realtybase.ca/v1/sessions`
5. Page redirects to `https://broker1.realtybase.ca/auth/login-success#token=...`
6. LoginSuccessful.tsx reads hash, calls setToken, clears hash, navigates to `/`
7. User arrives on dashboard as authenticated

**Why human:** Full OAuth PKCE round-trip requires (a) Cognito app client configured with `https://auth.realtybase.ca/oauth/callback` as allowed callback URL, (b) `auth-callback/index.html` deployed to `https://auth.realtybase.ca/oauth/callback`, (c) DNS configured for `auth.realtybase.ca`. None of these can be verified programmatically.

---

#### 2. Account linking for existing email/password user

**Test:** Sign in with Google using an email address that already has a registered email/password account in the Cognito user pool.

**Expected:**
- Cognito fires PreSignUp Lambda before creating a second user
- Lambda calls AdminLinkProviderForUser with DestinationUser lookup by email
- No second `users` DB row is created for the same email
- User sees their existing groups and brokerage data (not a blank account)

**Why human:** Requires the Lambda to be deployed to AWS Lambda with the correct IAM policy (`cognito-idp:AdminLinkProviderForUser`), set as the Cognito user pool's PreSignUp trigger, and `AWS_REGION` env var configured in Lambda. These are infrastructure steps verified only by running the actual sign-in.

---

#### 3. "Connected via Google" badge display

**Test:** After completing a Google sign-in (human test #1), navigate to the admin member detail view for the user who just signed in.

**Expected:** A "Sign-in method" row appears with a Shield icon and a sky-blue "Connected via Google" badge. The row is absent for members who signed in via email/password.

**Why human:** Requires a user record in the DB with `auth_provider = 'google'`, which is only set after a successful OAuth flow completes (human test #1 must pass first).

---

### Gaps Summary

No programmatic gaps remain. All three blockers from the previous verification are closed:

- **CR-01 (JWT signature bypass):** CLOSED. `JWT.decode(params[:id_token], nil, false)` (count: 0) replaced with RS256 JWKS-verified decode with `algorithms: ["RS256"]`, `verify_iss: true`, `verify_aud: true`, cached JWKS via `Rails.cache.fetch("cognito_jwks", expires_in: 1.hour)`.
- **CR-02 (BrokerageAuth 500):** CLOSED. `skip_before_action :resolve_brokerage, only: [:create]` present at line 7. POST /v1/sessions from `api.realtybase.ca` no longer raises `ActiveRecord::RecordNotFound` before the id_token branch executes.
- **CR-03 (XSS in showError):** CLOSED. `innerHTML` count: 0. `showError` rewrites DOM using `status.textContent = ''` + `createElement` + `errorSpan.textContent = message` + `appendChild`. Server-supplied error content cannot execute as HTML.

Remaining items are human verification needs (live infrastructure tests) — not code gaps.

---

_Verified: 2026-05-09T19:30:00Z_
_Verifier: Claude (gsd-verifier)_

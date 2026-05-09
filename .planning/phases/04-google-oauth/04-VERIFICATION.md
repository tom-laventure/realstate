---
phase: 04-google-oauth
verified: 2026-05-09T15:00:00Z
status: gaps_found
score: 8/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "POST /v1/sessions with id_token param returns 200 for a valid Cognito idToken from any tenant domain"
    status: failed
    reason: "CR-02: BrokerageAuth.resolve_brokerage fires unconditionally on SessionsController#create via before_action. OAuth POST arrives at api.realtybase.ca — a host not registered in BrokerageDomain. resolve_brokerage raises ActiveRecord::RecordNotFound, which is not rescued by the three rescue clauses (JWT::DecodeError, CognitoService::AuthError, ActiveRecord::RecordInvalid). Rails returns 500. No skip_before_action for resolve_brokerage exists in sessions_controller.rb. api.realtybase.ca is not seeded as a BrokerageDomain. This blocks 100% of OAuth login attempts in production."
    artifacts:
      - path: "backend/app/controllers/v1/sessions_controller.rb"
        issue: "Missing skip_before_action :resolve_brokerage, only: [:create] — BrokerageAuth before_action fires on every create, raises 500 when host is api.realtybase.ca"
      - path: "backend/app/controllers/concerns/brokerage_auth.rb"
        issue: "resolve_brokerage raises ActiveRecord::RecordNotFound unconditionally when BrokerageDomain.find_by returns nil — not rescued in sessions_controller"
    missing:
      - "Add skip_before_action :resolve_brokerage, only: [:create] to SessionsController (Option A from CR-02), OR send X-Brokerage-Domain header from callback page and update BrokerageAuth to fall back to that header (Option B)"
  - truth: "POST /v1/sessions with id_token param verifies JWT signature before trusting claims"
    status: failed
    reason: "CR-01: JWT.decode(params[:id_token], nil, false) disables all signature verification. An attacker can craft any JWT with arbitrary claims (sub, email, email_verified: true) and receive a valid app session token. This is a complete authentication bypass. The trust model differs from CognitoService#initiate_auth (which decodes a token fetched directly from Cognito via authenticated AWS SDK call) — here the token comes from an untrusted browser client. COGNITO_CONFIG[:jwks_uri] is already defined in backend/config/initializers/cognito.rb but is never used."
    artifacts:
      - path: "backend/app/controllers/v1/sessions_controller.rb"
        issue: "Line 21: JWT.decode(params[:id_token], nil, false) — third arg false disables RS256 signature verification; no issuer/audience validation"
    missing:
      - "Verify RS256 signature against COGNITO_CONFIG[:jwks_uri] using JWT::JWK::Set, with verify_iss and verify_aud. Cache JWKS response to avoid blocking HTTP round-trip per login."
  - truth: "auth-callback/index.html shows safe error messages (no XSS vector)"
    status: failed
    reason: "CR-03: showError function uses innerHTML to inject message text directly into the DOM (line 38-40). message is constructed from body.error (raw JSON from backend response). A backend error containing user-supplied content (e.g., an email address from a failed user.save!) can inject arbitrary HTML into the auth.realtybase.ca origin. Even without CR-01, any Rails validation error that echoes user input triggers this."
    artifacts:
      - path: "auth-callback/index.html"
        issue: "Lines 38-40: document.getElementById('status').innerHTML = '<span...>' + message + '...</span>' — body.error (server-controlled, potentially user-supplied) injected via innerHTML"
    missing:
      - "Replace innerHTML assignment with textContent for the error span and DOM createElement for the back link, matching the pattern in CR-03 fix recommendation"
---

# Phase 04: Google OAuth Verification Report

**Phase Goal:** Enable Google Sign-In as an additional auth method alongside Cognito email/password — users on any brokerage tenant can sign in with their Google account, with proper account linking for existing users.
**Verified:** 2026-05-09T15:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /v1/sessions id_token branch exists and handles valid Cognito idToken | PARTIAL | Code path exists (line 15-45 sessions_controller.rb) but will 500 before reaching it due to BrokerageAuth (CR-02) |
| 2 | POST /v1/sessions verifies JWT signature before trusting claims | FAILED | JWT.decode(token, nil, false) — signature verification disabled; JWKS URI available but unused (CR-01) |
| 3 | POST /v1/sessions rejects email_verified=false with 422 | VERIFIED | `unless email_verified … render … :unprocessable_entity` at line 26 |
| 4 | POST /v1/sessions with malformed id_token returns 401 | VERIFIED | `rescue JWT::DecodeError => e … :unauthorized` at line 67 |
| 5 | POST /v1/sessions with email+password still returns 200 (existing path unaffected) | VERIFIED | elif branch at line 46 is identical to original; logic untouched |
| 6 | auth-callback/index.html completes PKCE exchange, validates brokerage domain, exchanges idToken for app JWT, redirects with hash token | VERIFIED | Hub.listen, fetchAuthSession, endsWith('.realtybase.ca') guard, POST /v1/sessions, redirect to /auth/login-success#token= — all present and wired |
| 7 | auth-callback/index.html error handling does not introduce XSS | FAILED | showError uses innerHTML (line 38); body.error is raw server text including user-supplied content (CR-03) |
| 8 | LoginSuccessful.tsx reads hash token on mount, calls setToken(), navigates to / | VERIFIED | useEffect([]) reads hash, calls setToken, clears hash, navigate('/', {replace:true}) — lines 10-26 |
| 9 | /auth/login-success route exists in frontend router | VERIFIED | auth.tsx line 51: `path: 'login-success', element: <LoginSuccessful />` |
| 10 | GoogleSignInButton is wired in CreateAccount.tsx form stage with or-divider; calls signInWithRedirect with customState | VERIFIED | Import line 7; divider + button at lines 407-417 inside the form else-block; customState = btoa(JSON.stringify({brokerage: window.location.hostname})) in GoogleSignInButton.tsx line 48 |
| 11 | MemberDetailCard shows "Connected via Google" badge when member.authProvider === 'google' | VERIFIED | Conditional row at line 73 with Shield icon and "Connected via Google" text |

**Score:** 8/11 truths verified (3 failed/partial)

---

### ROADMAP Success Criteria Cross-Reference

| SC | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| SC-1 | User clicks "Sign in with Google", completes OAuth, lands on brokerage dashboard | BLOCKED | auth-callback POST to api.realtybase.ca will 500 (CR-02); JWT signature not verified (CR-01); XSS in error path (CR-03) |
| SC-2 | Existing email/password user signs in with Google — linked, no duplicate account | PARTIAL | PreSignUp Lambda (04-02) implements account linking correctly; backend user upsert logic correct; but blocked by CR-02 at session exchange |
| SC-3 | User signed in via Google sees "Connected via Google" badge | VERIFIED | MemberDetailCard conditionally renders badge when authProvider === 'google'; auth_provider in UserSerializer; authProvider? in userType.ts |

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `backend/db/migrate/20260509000001_add_auth_provider_to_users.rb` | VERIFIED | Migration `up` — schema.rb confirms `t.string "auth_provider"` on users table |
| `backend/app/controllers/v1/sessions_controller.rb` | STUB (critical wiring missing) | id_token branch exists but BrokerageAuth raises 500 before it runs; JWT.decode with false disables signature verification |
| `backend/config/initializers/cors.rb` | VERIFIED | `source == "https://auth.realtybase.ca"` exact-match OR condition present |
| `backend/app/serializers/user_serializer.rb` | VERIFIED (with warning) | `:auth_provider` in attributes line; note WR-03: `:in_group` declared twice (unconditional + conditional guard), guard is dead |
| `lambda/pre_signup/index.js` | VERIFIED | Syntax valid; PreSignUp_ExternalProvider guard, email_verified === "true" string check, AdminLinkProviderForUserCommand, AliasExistsException no-op, pass-through for non-federated triggers |
| `auth-callback/index.html` | PARTIAL | All OAuth flow logic correct; security gap: showError uses innerHTML with server-supplied text (CR-03) |
| `frontend/src/containers/auth/LoginSuccessful.tsx` | VERIFIED | useEffect([]) reads hash, setToken, clears hash, navigate with replace; error state with AlertCircle |
| `frontend/src/router/auth/auth.tsx` | VERIFIED | login-success route present and imports LoginSuccessful |
| `frontend/src/components/auth/GoogleSignInButton.tsx` | VERIFIED | Hub.listen removed; Google G SVG; 500ms spinner; customState btoa encoding; signInWithRedirect wired |
| `frontend/src/config/amplify.ts` | VERIFIED | `'https://auth.realtybase.ca/oauth/callback'` as first redirectSignIn entry |
| `frontend/src/assets/types/userType.ts` | VERIFIED | `authProvider?: string` on user interface |
| `frontend/src/containers/auth/CreateAccount.tsx` | VERIFIED | GoogleSignInButton import + or-divider + button in form stage (both login and create modes); not shown in confirm/authenticated stages |
| `frontend/src/components/view/admin/usersAdminView/memberAdminView/MemberDetailCard.tsx` | VERIFIED | Shield import; conditional `member?.authProvider === 'google'` row with "Connected via Google" badge |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sessions_controller.rb` | `JWT.decode` | id_token branch | PARTIAL | JWT.decode called but with false (no sig verify) — CR-01 |
| `sessions_controller.rb` | `BrokerageAuth#resolve_brokerage` | `before_action` | BROKEN | No `skip_before_action :resolve_brokerage` for OAuth path — CR-02; 500 on api.realtybase.ca host |
| `auth-callback/index.html` | `POST /v1/sessions` | fetch with id_token body | WIRED | Correctly POSTs `{ id_token: idToken }` to BACKEND_URL + '/v1/sessions' |
| `auth-callback/index.html` | `{brokerage}/auth/login-success#token=` | window.location.href | WIRED | Redirect after successful token exchange |
| `auth-callback/index.html` | showError DOM | innerHTML + server body.error | BROKEN | XSS vector — CR-03 |
| `LoginSuccessful.tsx` | `localStorage auth_token` | setToken() from @/lib/auth | WIRED | setToken called with extracted hash token |
| `GoogleSignInButton.tsx` | `signInWithRedirect` | onClick → 500ms → customState | WIRED | btoa(JSON.stringify({brokerage: window.location.hostname})) |
| `CreateAccount.tsx` | `GoogleSignInButton` | import + JSX | WIRED | Import at line 7; rendered at line 417 inside form stage |
| `MemberDetailCard.tsx` | `member.authProvider` | conditional badge row | WIRED | `member?.authProvider === 'google'` at line 73 |
| `lambda/pre_signup/index.js` | `AdminLinkProviderForUserCommand` | send() call | WIRED | Correct DestinationUser by email, SourceUser by Cognito_Subject |

---

### Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| AUTH-01 | 04-01, 04-03 | Intermediary callback URL extracts brokerage domain from state, completes per-tenant session exchange | PARTIAL | Callback page and session endpoint exist; blocked by CR-02 (BrokerageAuth 500) and CR-01 (unsigned JWT accepted) |
| AUTH-02 | 04-02 | PreSignUp Lambda links Google identity to existing Cognito user; email_verified guard | PARTIAL | Lambda code correct; not yet deployed to AWS (external step); WR-04: UserNotFoundException not caught — first-time Google-only users blocked |
| AUTH-03 | 04-03, 04-04 | User can click Sign in with Google; Amplify fires signInWithRedirect; idToken exchanged at POST /v1/sessions | PARTIAL | Button, callback page, and token handoff wired; blocked end-to-end by CR-02 |
| AUTH-04 | 04-01, 04-04 | "Connected via Google" badge in account settings | VERIFIED | auth_provider in UserSerializer; authProvider in userType.ts; MemberDetailCard badge conditional on authProvider === 'google' |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `MemberDetailCard.tsx` | `member.authProvider` | GET /v1/admin/users/:id → UserSerializer :auth_provider | Yes — DB column on users table, set on OAuth login | FLOWING |
| `auth-callback/index.html` | `idToken` | Amplify fetchAuthSession → session.tokens.idToken | Yes — Cognito PKCE token | FLOWING |
| `LoginSuccessful.tsx` | `token` | window.location.hash parsed on mount | Yes — JWT from redirect hash | FLOWING |
| `GoogleSignInButton.tsx` | `customState` | btoa(JSON.stringify({brokerage: window.location.hostname})) | Yes — real hostname | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration is applied | `rails db:migrate:status` | `up 20260509000001 Add auth provider to users` | PASS |
| Lambda parses as valid Node.js | `node --check lambda/pre_signup/index.js` | exit 0 | PASS |
| CORS allows auth.realtybase.ca | grep in cors.rb | `source == "https://auth.realtybase.ca"` found | PASS |
| auth_provider in UserSerializer | grep user_serializer.rb | `:auth_provider` in attributes line | PASS |
| POST /v1/sessions will 500 for OAuth from api.realtybase.ca | Code trace: BrokerageAuth#resolve_brokerage raises RecordNotFound on api.realtybase.ca host; not rescued in sessions#create | 500 in production | FAIL |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/controllers/v1/sessions_controller.rb` | 21 | `JWT.decode(token, nil, false)` with browser-supplied token | BLOCKER | Complete authentication bypass — forged JWTs accepted as valid Google logins |
| `backend/app/controllers/v1/sessions_controller.rb` | 4 | `include BrokerageAuth` without skip for OAuth path | BLOCKER | 500 on every OAuth POST to api.realtybase.ca; feature dead in production |
| `auth-callback/index.html` | 38-40 | `innerHTML` with server-supplied `body.error` | BLOCKER | XSS: server error message containing user-supplied content executes on auth.realtybase.ca |
| `backend/app/serializers/user_serializer.rb` | 4 + 12 | `:in_group` declared unconditionally AND with `if: :groups_loaded?` guard | WARNING | Dead conditional guard — `in_group` always serialized; minor noise, no crash |
| `backend/app/controllers/v1/sessions_controller.rb` | 42 | `user.auth_provider = "google"` unconditionally on every OAuth login | WARNING | Overwrites provider on every sign-in; prevents future multi-provider disconnect flows |
| `lambda/pre_signup/index.js` | 74-78 | Catch block only swallows `AliasExistsException` | WARNING | `UserNotFoundException` propagates — new Google-only users who have no email/password account are blocked from signing up |

---

### Human Verification Required

None — all blockers are programmable to determine from code analysis.

---

### Gaps Summary

Three blockers prevent the phase goal from being achieved in production:

**CR-02 (BLOCKER — complete feature failure):** The OAuth POST from auth-callback/index.html goes to `https://api.realtybase.ca`. SessionsController includes BrokerageAuth, whose `resolve_brokerage` before_action looks up `api.realtybase.ca` in BrokerageDomain and raises `ActiveRecord::RecordNotFound` when nothing matches — which it never will for the API's own host. None of the three rescue clauses in sessions#create handle RecordNotFound. Every OAuth login returns 500. The email/password path is unaffected because those requests come from brokerage subdomains. Fix: add `skip_before_action :resolve_brokerage, only: [:create]` to SessionsController.

**CR-01 (BLOCKER — authentication bypass):** JWT.decode is called with `nil, false` on a token supplied by the browser. An attacker can craft any JWT with `email_verified: true` and an arbitrary `sub` to receive a valid app session token. The fix (JWKS verification) is low-effort: `COGNITO_CONFIG[:jwks_uri]` is already available in the cognito initializer. The analogy to CognitoService is flawed because CognitoService decodes a server-fetched token, not a client-supplied one.

**CR-03 (BLOCKER — XSS):** `showError` injects `body.error` (raw server JSON) into the DOM via `innerHTML`. Combined with CR-01's existence, an attacker can craft a JWT whose email triggers a Rails validation error containing HTML, which is then injected into auth.realtybase.ca. The fix is a trivial textContent + createElement replacement.

These three issues are mechanically interdependent — CR-02 must be fixed for any OAuth login to reach the JWT decode step where CR-01 matters, and CR-01 must be fixed for CR-03 to be non-exploitable — but all three require code changes and all three must be resolved before the phase goal is achieved.

**WR-04 (WARNING — deferred scope question):** The PreSignUp Lambda only handles account-linking. New users who have never created an email/password account receive a `UserNotFoundException` from the Lambda, causing Cognito to reject their sign-up. The ROADMAP states "users on any brokerage tenant can sign in with their Google account" — it is ambiguous whether this includes users with no prior email/password account. If it does, the Lambda must catch `UserNotFoundException` as a pass-through.

---

_Verified: 2026-05-09T15:00:00Z_
_Verifier: Claude (gsd-verifier)_

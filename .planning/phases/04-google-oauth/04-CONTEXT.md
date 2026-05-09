# Phase 4: Google OAuth - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship Google social login atomically: Cognito federation (PreSignUp Lambda for account linking) + "Sign in with Google" button on the frontend + intermediary callback infrastructure + "Connected via Google" badge in account settings. All four components land in the same phase — the button must never ship without the Lambda, and the Lambda must never ship without the button (per roadmap atomic constraint).

After this phase: a user on any brokerage subdomain or custom domain can sign in with Google, existing email/password accounts are auto-linked by email, and account settings shows a "Connected via Google" badge.

</domain>

<decisions>
## Implementation Decisions

### Intermediary Callback URL

- **D-01:** The fixed OAuth redirect URL is `https://auth.realtybase.ca/oauth/callback`. This URL is registered in the Cognito user pool as the allowed redirect URI and in the Google OAuth app. All Google OAuth flows from all brokerage tenants go through this single URL.
- **D-02:** The `state` parameter encodes the brokerage domain only — `base64(JSON.stringify({ brokerage: "broker1.realtybase.ca" }))`. Sufficient for the callback to construct the post-auth redirect target. No destination path in state.
- **D-03:** The callback page at `auth.realtybase.ca/oauth/callback` is a minimal static HTML/JS file (no framework). It calls `fetchAuthSession()` via Amplify, POSTs the Cognito idToken to `POST /v1/sessions` on the backend (CORS-allowed), receives the app JWT, then `window.location.href` redirects to the brokerage domain with the token in the URL hash.
- **D-04:** Token handoff after callback: redirect to `https://{brokerage_domain}/auth/login-success#token={JWT}`. The hash is browser-only and does not appear in server access logs. Works for both `broker1.realtybase.ca` subdomains and custom domains (`mybrokeragerealstate.com`) — different origins, localStorage would not work.

### Session Exchange (Backend)

- **D-05:** Extend `POST /v1/sessions` with an `id_token` param path. When `id_token` is present: decode the Cognito idToken with `JWT.decode(params[:id_token], nil, false)` (third arg `false` skips signature verification — Cognito idTokens are RS256-signed, NOT HS256; `TokenService.verify` uses HS256 and will always raise `JWT::DecodeError` — do not use it here), extract claims (`sub`, `email`, `email_verified`, `given_name`, `family_name`, `name`), find-or-create the User from the `sub` claim, set `auth_provider = 'google'` on the user, and return `TokenService.issue(user)`. When `email` + `password` are present: existing `CognitoService.initiate_auth` path unchanged.
- **D-06:** CORS: extend the existing BrokerageDomain proc to also allow `https://auth.realtybase.ca`. Pattern: `BrokerageDomain.exists?(domain: origin_host) || origin == 'https://auth.realtybase.ca'`. This is a special-case addition — `auth.realtybase.ca` is not a brokerage tenant domain.

### Session Exchange (Frontend)

- **D-07:** Add a new `/auth/login-success` route to the auth router. The `LoginSuccessful.tsx` component (already exists as a spinner screen) handles this route. On mount, it reads `window.location.hash`, extracts the token, writes it to localStorage using the same key as the existing email/password sign-in flow, clears the hash from the URL, then calls `navigate('/', { replace: true })` to enter the authenticated app.

### Connected via Google Badge

- **D-08:** Add `auth_provider` string column to the `users` table via a new migration. Default: `null` (existing users). Set to `'google'` in the OAuth session exchange path in `SessionsController#create` when `id_token` is present. Returned by `GET /v1/account/profile` so the frontend can display the badge.
- **D-09:** Badge appears in the **profile section** of account settings, below the user's name and email. Rendered as a small chip/indicator when `profile.authProvider === 'google'`. Purely presentational — no action needed on the badge.

### PreSignUp Lambda (AUTH-02)

- **D-10:** A Cognito PreSignUp Lambda trigger handles account linking. When `event.triggerSource === 'PreSignUp_ExternalProvider'` and a Cognito user with a matching email exists, the Lambda calls `adminLinkProviderForUser` to link the Google identity. Lambda must verify `email_verified: true` on the Google claim before linking (prevents account takeover). The first-link exception is caught gracefully — on the frontend this is transparent, the user simply lands on their dashboard.

### Button UX in Login Flow

- **D-11:** `GoogleSignInButton` is wired into `CreateAccount.tsx` in **both login and signup modes**, below the email/password form, separated by a "— or —" divider (standard OAuth layout). The email/password form remains the primary path; Google is secondary.
- **D-12:** Button shows a spinner state for ~500ms on click, then `signInWithRedirect({ provider: 'Google' })` fires and the user is redirected to Google. Spinner provides feedback without being disruptive — the user leaves the page quickly.
- **D-13:** The Google button passes the current brokerage domain in the `customState` option of `signInWithRedirect` so the callback can decode which tenant to redirect back to. The static callback page reads this from the `state` query param on the OAuth redirect.

### Claude's Discretion

- Exact base64/JSON encoding format for state param
- Google logo/icon treatment in the button (official SVG vs lucide-react icon — lucide has no Google icon, so a Google SVG or text-only button is fine)
- Lambda runtime (Node.js 20.x is standard for Cognito triggers)
- Exact chip/badge styling in account settings
- Error handling on the callback page if fetchAuthSession fails (show a retry link)

</decisions>

<specifics>
## Specific Ideas

- The callback page (`auth.realtybase.ca/oauth/callback`) is intentionally minimal — a static file that does: load Amplify config → `fetchAuthSession()` → POST idToken → redirect with hash. No React, no routing library.
- `LoginSuccessful.tsx` already exists as a polished spinner screen — repurpose it for the `/auth/login-success` route rather than building something new. It just needs a `useEffect` on mount to read the hash and store the token.
- The "— or —" divider in `CreateAccount` should visually match the existing card aesthetic (thin border, `text-muted-foreground` label).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §Google OAuth (Social Login) — AUTH-01 through AUTH-04 with exact acceptance criteria
- `.planning/ROADMAP.md` §Phase 4 — success criteria (3 must-be-true conditions) + atomic constraint note

### Key Source Files — Callback Infrastructure
- `frontend/src/config/amplify.ts` — current Amplify config; `redirectSignIn` must be updated to `https://auth.realtybase.ca/oauth/callback`
- `frontend/src/components/auth/GoogleSignInButton.tsx` — existing skeleton; replace with full implementation
- `frontend/src/containers/auth/LoginSuccessful.tsx` — repurpose for `/auth/login-success` hash-reading route
- `frontend/src/router/auth/auth.tsx` — add `/auth/login-success` route here

### Key Source Files — Session Exchange (Backend)
- `backend/app/controllers/v1/sessions_controller.rb` — extend `#create` with `id_token` path
- `backend/app/controllers/concerns/cognito_auth.rb` — `TokenService.verify` pattern for idToken validation
- `backend/config/initializers/cors.rb` — add `auth.realtybase.ca` special-case origin

### Key Source Files — Session Exchange (Frontend)
- `frontend/src/containers/auth/CreateAccount.tsx` — wire in `GoogleSignInButton` below the form
- `frontend/src/router/auth/auth.tsx` — new `/auth/login-success` route

### Key Source Files — Connected via Google Badge
- `backend/db/schema.rb` — current users table (add `auth_provider` column via migration)
- `frontend/src/containers/account/AccountContext.tsx` — profile data chain for badge display
- `frontend/src/assets/api/account/getAccountProfile.tsx` — profile API call; `authProvider` will come through here

### Key Source Files — Button UX
- `frontend/src/containers/auth/CreateAccount.tsx` — add divider + `GoogleSignInButton` below the form in both modes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GoogleSignInButton.tsx` — skeleton already imports `signInWithRedirect`, `fetchAuthSession`, `Hub`. Phase 4 fleshes it out: Google logo, spinner, `customState` encoding, error handling.
- `LoginSuccessful.tsx` — spinner screen already exists and matches the design language. Repurpose with a `useEffect` to read hash token.
- `SessionsController#create` — existing find-or-create-user logic can be reused in the OAuth path; same claim mapping (`sub`, `email`, `name`, `given_name`, `family_name`).

### Established Patterns
- **Session exchange:** existing email/password path calls `CognitoService.initiate_auth` → gets claims → find-or-create user → `TokenService.issue`. OAuth path follows the same shape but starts with `JWT.decode(params[:id_token], nil, false)` instead of `TokenService.verify` (which uses HS256 and cannot verify Cognito RS256 idTokens).
- **CORS:** `config/initializers/cors.rb` proc validates `request.host` against `BrokerageDomain`; extend with OR condition for the fixed auth domain.
- **Context data chain:** `AccountContext` → `useGetAccountProfile` → `getAccountProfile` API → serializer. `auth_provider` flows through this chain once added to the serializer.
- **Amplify Hub listener:** `GoogleSignInButton` already uses `Hub.listen('auth', ...)` — the Phase 2 skeleton used this for `signInWithRedirect` event. Phase 4 moves this logic into the `/auth/login-success` route instead (callback page handles the session exchange, not the Hub listener).

### Integration Points
- `amplify.ts` `redirectSignIn` must be updated to `https://auth.realtybase.ca/oauth/callback` (+ localhost for dev)
- `users` table needs `auth_provider` column (migration required)
- Cognito user pool: Google identity provider + PreSignUp Lambda trigger must be configured in AWS console or Terraform
- Static callback page must be hosted at `auth.realtybase.ca` (DNS + static host)

</code_context>

<deferred>
## Deferred Ideas

- **"Connect Google from profile settings" for existing email/password users** — REQUIREMENTS.md v2 item. The current phase only handles PreSignUp Lambda linking (automatic, server-side). Frontend-initiated linking from account settings is a separate v2 flow.
- **Microsoft / Apple social login** — v2 per roadmap. Only Google is in scope for this milestone.
- **Error page at auth.realtybase.ca** — if `fetchAuthSession` fails on the callback page, a proper error UI with retry/redirect. Claude's discretion for Phase 4; a basic inline error message is fine.

</deferred>

---

*Phase: 04-google-oauth*
*Context gathered: 2026-05-05*
